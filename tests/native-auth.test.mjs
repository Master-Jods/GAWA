import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, mocks) {
  const js = ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
  }).outputText;
  const module={exports:{}};
  vm.runInNewContext(js,{ module,exports:module.exports,require:n=>mocks[n]||require(n),Buffer,console:{error(){}},setTimeout });
  return module.exports;
}
function authContext({ signupSession=false, status='active', role='talent' }={}) {
  const calls=[];
  const client={
    auth:{
      async signInWithPassword(args){calls.push(['password',args]);return {data:{user:{id:'user-1'}}};},
      async signUp(args){calls.push(['signup',args]);return {data:{user:{id:'user-1'},session:signupSession?{}:null}};},
      async signOut(){calls.push(['signOut']);},
      mfa:{async getAuthenticatorAssuranceLevel(){calls.push(['assurance']);return {data:{currentLevel:'aal1'}};}},
    },
    from(table){
      const result={data:table==='account_statuses'?{status}:table==='account_roles'?[{role}]:{id:'user-1'}};
      const query={ select(){return query;},eq(){return query;},order(){return Promise.resolve(result);},single(){return Promise.resolve(result);} };return query;
    },
  };
  const react={createContext:()=>({Provider:'provider'}),useState:initial=>[initial,()=>{}],useEffect:()=>{},useContext:()=>{}};
  const {AuthProvider}=load('src/lib/auth/AuthContext.tsx',{'@/lib/supabase/client':{supabase:client},react});
  return {api:AuthProvider({children:null}).props.value,calls};
}
test('password login uses native Supabase and checks MFA assurance, without sending email OTP',async()=>{
  const h=authContext();const r=await h.api.signIn('user@example.com','password','talent');
  assert.equal(r.role,'talent');assert(h.calls.some(([n])=>n==='password'));assert(h.calls.some(([n])=>n==='assurance'));
  assert(!h.calls.some(([n])=>n==='signup'));
});
test('inactive account and wrong portal sign out rather than continuing',async()=>{
  for(const options of [{status:'suspended'},{role:'business'}]){
    const h=authContext(options);const r=await h.api.signIn('x@example.com','password','talent');
    assert(r.error);assert(h.calls.some(([n])=>n==='signOut'));
  }
});
test('signup requires email confirmation and disallows an automatically confirmed session',async()=>{
  const params={email:'user@example.com',password:'password',displayName:'Test',role:'talent'};
  const h=authContext();const r=await h.api.signUp(params);assert(r.requiresEmailConfirmation);
  const bypass=authContext({signupSession:true});const result=await bypass.api.signUp(params);
  assert(result.error);assert(bypass.calls.some(([n])=>n==='signOut'));
});
function serverHarness(aal,status='active',valid=true){
  let queries=0,validated=false;
  const token='header.'+Buffer.from(JSON.stringify({aal})).toString('base64url')+'.signature';
  const db={auth:{async getUser(value){assert.equal(value,token);validated=true;return valid?{data:{user:{id:'u',email:'u@example.com',email_confirmed_at:'confirmed'}}}:{data:{user:null},error:{}};}},from(table){queries++;const q={select(){return q;},eq(){return q;},single(){return Promise.resolve({data:table==='account_statuses'?{status}:{display_name:'User'}});},then(resolve,reject){return Promise.resolve({data:[{role:'talent'}]}).then(resolve,reject);}};return q;}};
  const api=load('src/lib/server/auth.ts',{
    '@/lib/supabase/server':{createServerAdminClient:()=>db},
    '@/lib/server/security':{},'@/lib/server/rate-limit':{},
  });
  return {api,req:{headers:{get:n=>n==='authorization'?'Bearer '+token:null}},queries:()=>queries,validated:()=>validated};
}
test('server rejects verified password-only tokens before touching application data',async()=>{
  const h=serverHarness('aal1');assert.equal(await h.api.getAuthenticatedUser(h.req),null);
  assert(h.validated());assert.equal(h.queries(),0);
});
test('server admits active AAL2 users, rejects invalid tokens and inactive accounts',async()=>{
  const good=serverHarness('aal2');assert.equal((await good.api.getAuthenticatedUser(good.req)).id,'u');
  for(const h of [serverHarness('aal2','suspended'),serverHarness('aal2','active',false)])assert.equal(await h.api.getAuthenticatedUser(h.req),null);
});
