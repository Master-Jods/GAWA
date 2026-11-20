/**
 * GAWA Auth Test Runner
 *
 * Runs all auth security tests against a live server.
 * Usage: npx tsx src/__tests__/run-tests.ts
 *
 * Options:
 *   GAWA_TEST_BASE_URL=http://localhost:3000  (default)
 */
import { ALL_TESTS } from "./auth.test.js";

async function main() {
  const base = process.env.GAWA_TEST_BASE_URL || "http://localhost:3000";
  console.log(`\n🧪 GAWA Auth Security Test Suite`);
  console.log(`📡 Server: ${base}`);
  console.log("─".repeat(60));

  // Verify server is reachable
  try {
    await fetch(`${base}/api/listings`);
  } catch {
    console.error(`\n❌ Cannot reach server at ${base}`);
    console.error("   Start the dev server first: pnpm dev\n");
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  const failures: Array<{ name: string; message: string }> = [];

  for (const test of ALL_TESTS) {
    process.stdout.write(`  Running: ${test.name}… `);
    const result = await test();
    if (result.pass) {
      passed++;
      console.log(`\x1b[32m✓\x1b[0m`);
    } else {
      failed++;
      failures.push({ name: result.name, message: result.message });
      console.log(`\x1b[31m✗\x1b[0m  ${result.message}`);
    }
  }

  console.log("─".repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed / ${ALL_TESTS.length} total`);

  if (failures.length > 0) {
    console.log("\n❌ Failures:");
    for (const f of failures) {
      console.log(`   • ${f.name}`);
      console.log(`     ${f.message}`);
    }
  } else {
    console.log("\n✅ All tests passed!");
  }

  console.log("\n📝 Notes:");
  console.log("   • Tests marked TODO require SMTP/SMS/Google credentials to be fully verified.");
  console.log("   • Run with a real Supabase project configured for complete coverage.");
  console.log("   • Integration tests for OTP delivery require SMTP_HOST to be set.");
  console.log("");

  process.exit(failed > 0 ? 1 : 0);
}

main();

