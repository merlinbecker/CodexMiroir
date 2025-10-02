#!/bin/bash

# Quick test script for CodexMiroir Function App
# Usage: ./test-api.sh [base-url] [user-id]

BASE_URL="${1:-http://localhost:7071}"
USER_ID="${2:-u_merlin}"
TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -d "+1 day" +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d)

echo "🧪 Testing CodexMiroir API"
echo "Base URL: $BASE_URL"
echo "User ID: $USER_ID"
echo ""

# Test 1: Get Timeline
echo "📅 Test 1: Get Timeline"
echo "GET $BASE_URL/timeline/$USER_ID?dateFrom=$TODAY"
curl -s "$BASE_URL/timeline/$USER_ID?dateFrom=$TODAY" | jq '.'
echo ""

# Test 2: Assign Task to Slot
echo "📌 Test 2: Assign Task to Slot (AM)"
TASK_ID="task_test_$(date +%s)"
curl -s -X POST "$BASE_URL/timeline/$USER_ID/assign" \
  -H "Content-Type: application/json" \
  -d "{
    \"date\": \"$TODAY\",
    \"slotIdx\": 0,
    \"task\": {
      \"id\": \"$TASK_ID\",
      \"kind\": \"business\",
      \"title\": \"Test Task from Script\"
    },
    \"source\": \"manual\"
  }" | jq '.'
echo ""

# Test 3: AutoFill Task
echo "🤖 Test 3: AutoFill Task"
AUTOFILL_TASK_ID="task_autofill_$(date +%s)"
curl -s -X POST "$BASE_URL/timeline/$USER_ID/autofill" \
  -H "Content-Type: application/json" \
  -d "{
    \"dateFrom\": \"$TOMORROW\",
    \"task\": {
      \"id\": \"$AUTOFILL_TASK_ID\",
      \"kind\": \"personal\",
      \"title\": \"Auto-filled Task from Script\"
    }
  }" | jq '.'
echo ""

# Test 4: Get Timeline Again
echo "📅 Test 4: Get Timeline Again (after assignment)"
curl -s "$BASE_URL/timeline/$USER_ID?dateFrom=$TODAY&dateTo=$TOMORROW" | jq '.days[0].slots'
echo ""

echo "✅ Tests complete!"
echo ""
echo "💡 Tip: Open the UI at $BASE_URL"
