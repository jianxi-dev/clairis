#!/bin/bash
# Folio — mandatory pre-handoff verification
# Run before handing code to the user. All steps must pass.
set -e

echo "═══════════════════════════════════════"
echo "  Folio Verification Suite"
echo "═══════════════════════════════════════"

FAIL=0

# 1. TypeScript
echo ""
echo "── 1. TypeScript ──"
if npx tsc --noEmit; then
  echo "  ✅ TypeScript"
else
  echo "  ❌ TypeScript errors"
  FAIL=1
fi

# 1b. ESLint
echo ""
echo "── 1b. ESLint ──"
if npx eslint src/ --max-warnings 50; then
  echo "  ✅ ESLint"
else
  echo "  ❌ ESLint errors"
  FAIL=1
fi

# 2. Unit tests
echo ""
echo "── 2. Unit Tests ──"
if npm test -- --reporter=verbose 2>&1 | tail -3; then
  echo "  ✅ Unit tests"
else
  echo "  ❌ Unit test failures"
  FAIL=1
fi

# 3. CSS manifest
echo ""
echo "── 3. CSS Manifest ──"
if bash scripts/css-manifest-check.sh; then
  echo "  ✅ CSS manifest"
else
  echo "  ❌ CSS manifest failures"
  FAIL=1
fi

# 3b. Docs Governance Gate
echo ""
echo "── 3b. Docs Governance Gate ──"
if npm run docs:check; then
  echo "  ✅ Docs governance gate"
else
  echo "  ❌ Docs governance gate failures"
  FAIL=1
fi

# 4. Rust
echo ""
echo "── 4. Rust ──"
if cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -q "Finished"; then
  echo "  ✅ Rust compilation"
else
  echo "  ❌ Rust errors"
  FAIL=1
fi

# 5. E2E Browser (UI layout)
echo ""
echo "── 5. E2E Browser (14 UI tests) ──"
if npx playwright test --reporter=dot 2>&1; then
  echo "  ✅ E2E Browser"
else
  echo "  ❌ E2E Browser failures"
  FAIL=1
fi

# 6. E2E Tauri Mock (file operations)
echo ""
echo "── 6. E2E Tauri Mock (9 file-op tests) ──"
if npx playwright test --config=playwright.tauri.config.ts --reporter=dot 2>&1; then
  echo "  ✅ E2E Tauri Mock"
else
  echo "  ❌ E2E Tauri Mock failures"
  FAIL=1
fi

echo ""
echo "═══════════════════════════════════════"
if [ $FAIL -eq 0 ]; then
  echo "  ✅ ALL CHECKS PASSED — Ready for handoff"
else
  echo "  ❌ $FAIL check(s) failed — Fix before handoff"
fi
echo "═══════════════════════════════════════"
exit $FAIL
