#!/bin/bash
# CSS Manifest Check
# Verifies every CSS class declared in TypeScript decoration modules
# has a corresponding CSS rule definition in the stylesheet.
# Exit 0 = PASS, Exit 1 = FAIL

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

echo "=== CSS Manifest Check ==="

# 1. Extract class names from decoration modules (both "CLASS =" constants and hardcoded)
DECLARED=$(mktemp)
# From CLASS = "..." constants
grep -rhn 'CLASS\s*=\s*"' "$ROOT/src/editors/decorations/" 2>/dev/null | \
  grep -o '"[^"]*"' | tr -d '"' > "$DECLARED"
# From hardcoded className = "..."
grep -rhn 'className\s*=\s*"' "$ROOT/src/editors/decorations/" 2>/dev/null | \
  grep -o '"[^"]*"' | tr -d '"' >> "$DECLARED"
sort -u -o "$DECLARED" "$DECLARED"

# 2. Extract class names from CSS style files (strip leading .)
DEFINED=$(mktemp)
grep -rhn '\.cm-[a-z-]*' "$ROOT/src/styles/" 2>/dev/null | \
  grep -o '\.cm-[a-z-]*' | sed 's/^\.//' | sort -u > "$DEFINED"

# 3. Find missing (declared but not defined)
MISSING=$(comm -23 "$DECLARED" "$DEFINED")
if [ -n "$MISSING" ]; then
  echo ""
  echo "❌ MISSING CSS DEFINITIONS (declared in TS, no CSS rule):"
  echo "$MISSING" | while read cls; do
    echo "  $cls"
    FAIL=1
  done
else
  echo "  ✅ All decoration CSS classes have definitions"
fi

# 4. Find orphaned (defined but not used, excluding CM6 built-ins)
CM6_BUILTINS="cm-editor|cm-scroller|cm-content|cm-cursor|cm-gutter|cm-line|cm-activeLine|cm-selection|cm-fold|cm-tooltip|cm-panel"
ORPHANED=$(comm -13 "$DECLARED" "$DEFINED" | grep -vE "^($CM6_BUILTINS)$")
if [ -n "$ORPHANED" ]; then
  echo ""
  echo "⚠️  ORPHANED CSS RULES (defined, no module uses):"
  echo "$ORPHANED" | while read cls; do
    echo "  .$cls"
  done
fi

DECL_COUNT=$(wc -l < "$DECLARED" | tr -d ' ')
DEF_COUNT=$(wc -l < "$DEFINED" | tr -d ' ')
echo ""
echo "Summary: $DECL_COUNT declared in TS, $DEF_COUNT defined in CSS"

rm -f "$DECLARED" "$DEFINED"
exit $FAIL
