import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, mocks, env = {}) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  }}).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    module, exports: module.exports,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    process: { env }, console: { error() {}, log() {} },
  }, { filename: file });
  return module.exports;
}
const smtpEnv = { SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587', SMTP_USER: 'sender@example.com',
  SMTP_PASS: 'aaaa bbbb cccc dddd', SMTP_FROM: 'GAWA <sender@example.com>' };

test('Gmail sender normalizes App Password, requires STARTTLS, and awaits acceptance', async () => {
  let options, mail, closed = false, accept;
  const pending = new Promise(resolve => { accept = resolve; });
  const api = load('src/lib/server/auth-email.ts', { nodemailer: { createTransport(o) {
    options = o;
    return { sendMail(m) { mail = m; return pending; }, close() { closed = true; } };
  }}}, smtpEnv);
  let finished = false;
  const result = api.sendOtpEmail('recipient@example.com', '123456', 5).then(r => { finished = true; return r; });
  await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(options.requireTLS, true); assert.equal(options.secure, false);
  assert.equal(options.auth.pass, 'aaaabbbbccccdddd'); assert.equal(mail.to, 'recipient@example.com');
  accept({ accepted: ['recipient@example.com'], rejected: [] });
  assert.equal((await result).ok, true); assert.equal(closed, true);
});

test('missing SMTP, recipient rejection and transport errors report failure', async () => {
  const missing = load('src/lib/server/auth-email.ts', { nodemailer: { createTransport() { throw Error('must not connect'); } }});
  assert.equal((await missing.sendOtpEmail('x@example.com','123456',5)).ok, false);
  for (const outcome of ['reject', 'throw']) {
    let closed = false;
    const api = load('src/lib/server/auth-email.ts', { nodemailer: { createTransport() { return {
      async sendMail() { if (outcome === 'throw') throw Error('sensitive SMTP response'); return { accepted: [], rejected: ['x@example.com'] }; },
      close() { closed = true; },
    }; }}}, smtpEnv);
    const result = await api.sendOtpEmail('x@example.com','123456',5);
    assert.equal(result.ok, false); assert(!result.error.includes('sensitive')); assert(closed);
  }
});

test('port 465 selects implicit TLS and invalid ports fail before connecting', async () => {
  for (const port of ['465','invalid']) {
    let options;
    const api = load('src/lib/server/auth-email.ts', { nodemailer: { createTransport(o) { options = o; return {
      async sendMail() { return { accepted: ['x@example.com'], rejected: [] }; }, close() {},
    }; }}}, { ...smtpEnv, SMTP_PORT: port });
    const result = await api.sendOtpEmail('x@example.com','123456',5);
    if (port === '465') { assert(result.ok); assert.equal(options.secure, true); }
    else { assert.equal(result.ok,false); assert.equal(options,undefined); }
  }
});


test('legacy email-login and custom MFA endpoints cannot issue sessions', async () => {
  const files = [
    'login','otp/verify','otp/resend','2fa/setup','2fa/verify','2fa/challenge','2fa/recovery','2fa/disable',
  ];
  for (const file of files) {
    const api = load(`src/app/api/auth/${file}/route.ts`, {
      'next/server': { NextResponse: { json(body, options) { return { body, ...options }; } } },
    });
    assert.equal((await api.POST()).status,410);
  }
});
