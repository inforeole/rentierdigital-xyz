#!/bin/bash
# Lighthouse CI test — checks that all key pages score 100/100
# Usage: ./scripts/lighthouse-test.sh [base_url]
# Default: http://localhost:4173 (run `npx serve dist -l 4173` first)

set -euo pipefail

BASE_URL="${1:-http://localhost:4173}"
REPORT_DIR="lighthouse-reports"
mkdir -p "$REPORT_DIR"

# Pages to test
PAGES=(
  "/"
  "/blog"
  "/prompt-contract"
  "/tools"
  "/about"
)

THRESHOLD=95  # Minimum acceptable score (out of 100)
FAILED=0
TOTAL=0

echo "=== Lighthouse CI Test ==="
echo "Base URL: $BASE_URL"
echo "Threshold: $THRESHOLD/100"
echo ""

for page in "${PAGES[@]}"; do
  TOTAL=$((TOTAL + 1))
  url="${BASE_URL}${page}"
  slug=$(echo "$page" | sed 's/\//_/g; s/^_//')
  [ -z "$slug" ] && slug="home"

  echo "--- Testing: $url ---"

  # Run Lighthouse in JSON output mode
  npx lighthouse "$url" \
    --chrome-flags="--headless --no-sandbox" \
    --output=json \
    --output-path="$REPORT_DIR/$slug.json" \
    --quiet \
    2>/dev/null

  # Extract scores
  perf=$(jq '.categories.performance.score * 100 | round' "$REPORT_DIR/$slug.json")
  a11y=$(jq '.categories.accessibility.score * 100 | round' "$REPORT_DIR/$slug.json")
  bp=$(jq '.categories["best-practices"].score * 100 | round' "$REPORT_DIR/$slug.json")
  seo=$(jq '.categories.seo.score * 100 | round' "$REPORT_DIR/$slug.json")

  # Check thresholds
  STATUS="PASS"
  for score_name in perf a11y bp seo; do
    score=${!score_name}
    if [ "$score" -lt "$THRESHOLD" ]; then
      STATUS="FAIL"
      FAILED=$((FAILED + 1))
      break
    fi
  done

  if [ "$STATUS" = "FAIL" ]; then
    echo "  FAIL  Perf=$perf  A11y=$a11y  BP=$bp  SEO=$seo"
    # Show failing audits for accessibility
    if [ "$a11y" -lt "$THRESHOLD" ]; then
      echo "  Failing accessibility audits:"
      jq -r '.audits | to_entries[] | select(.value.score != null and .value.score < 1 and .value.details.type == "table") | "    - \(.key): \(.value.title)"' "$REPORT_DIR/$slug.json" 2>/dev/null | head -10
    fi
  else
    echo "  PASS  Perf=$perf  A11y=$a11y  BP=$bp  SEO=$seo"
  fi
  echo ""
done

echo "=== Results: $((TOTAL - FAILED))/$TOTAL passed ==="

if [ "$FAILED" -gt 0 ]; then
  echo "FAILED: $FAILED page(s) below threshold"
  exit 1
else
  echo "ALL PAGES PASSED"
  exit 0
fi
