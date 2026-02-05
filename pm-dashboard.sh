#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# CourseCorrect — PM Dashboard
# Run from project root, paste output to PM agent
# Usage: bash pm-dashboard.sh [--git-only | --full]
# ═══════════════════════════════════════════════════════════════════════

set -e

BRANCHES=("frontend/design-convergence" "gemini/service-layer" "backend/scaffold")
AGENTS=("Agent 1 (Frontend)" "Agent 2 (Gemini)" "Agent 3 (Backend)")
BASE_BRANCH="main"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          COURSECORRECT — PM DASHBOARD                       ║"
echo "║          $(date '+%Y-%m-%d %H:%M:%S')                              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

CURRENT=$(git branch --show-current 2>/dev/null || echo "detached")
echo "  Current branch: $CURRENT"
echo ""

for i in "${!BRANCHES[@]}"; do
    BRANCH="${BRANCHES[$i]}"
    AGENT="${AGENTS[$i]}"
    
    echo "  ┌── $AGENT ──────────────────────────────────"
    echo "  │ Branch: $BRANCH"
    
    if ! git rev-parse --verify "$BRANCH" &>/dev/null; then
        echo "  │ ⚠ Branch does not exist yet"
        echo "  └──────────────────────────────────────────────"
        echo ""
        continue
    fi
    
    echo "  │ Recent commits:"
    git log "$BRANCH" -3 --format="  │   %h %s (%ar)" 2>/dev/null
    
    AHEAD=$(git rev-list "$BASE_BRANCH".."$BRANCH" --count 2>/dev/null || echo "?")
    DIFF_STAT=$(git diff "$BASE_BRANCH"..."$BRANCH" --stat 2>/dev/null | tail -1)
    echo "  │ Ahead of $BASE_BRANCH: $AHEAD commits"
    echo "  │ Diff: ${DIFF_STAT:-(no changes)}"
    
    CHANGED=$(git diff "$BASE_BRANCH"..."$BRANCH" --name-only 2>/dev/null)
    if [ -n "$CHANGED" ]; then
        FILE_COUNT=$(echo "$CHANGED" | wc -l | tr -d ' ')
        echo "  │ Files changed ($FILE_COUNT):"
        echo "$CHANGED" | head -20 | sed 's/^/  │   /'
        [ "$FILE_COUNT" -gt 20 ] && echo "  │   ... and $((FILE_COUNT - 20)) more"
    fi
    
    STATUS_CONTENT=$(git show "$BRANCH":STATUS.md 2>/dev/null || echo "")
    if [ -n "$STATUS_CONTENT" ]; then
        echo "  │"
        echo "  │ STATUS.md:"
        echo "$STATUS_CONTENT" | head -25 | sed 's/^/  │   /'
    fi
    
    echo "  └──────────────────────────────────────────────"
    echo ""
done

# Conflict risk
echo "  ┌── ⚠ CONFLICT RISK ──────────────────────────────"
declare -A FILE_OWNERS
CONFLICT_FOUND=false

for i in "${!BRANCHES[@]}"; do
    BRANCH="${BRANCHES[$i]}"
    AGENT="${AGENTS[$i]}"
    [ ! "$(git rev-parse --verify "$BRANCH" 2>/dev/null)" ] && continue
    while IFS= read -r file; do
        [ -n "$file" ] && {
            [ -n "${FILE_OWNERS[$file]}" ] && FILE_OWNERS[$file]="${FILE_OWNERS[$file]} + $AGENT" || FILE_OWNERS[$file]="$AGENT"
        }
    done <<< "$(git diff "$BASE_BRANCH"..."$BRANCH" --name-only 2>/dev/null)"
done

for file in "${!FILE_OWNERS[@]}"; do
    [[ "${FILE_OWNERS[$file]}" == *"+"* ]] && {
        echo "  │ 🔴 $file"
        echo "  │    Touched by: ${FILE_OWNERS[$file]}"
        CONFLICT_FOUND=true
    }
done
[ "$CONFLICT_FOUND" = false ] && echo "  │ ✅ No multi-agent file conflicts detected"
echo "  └──────────────────────────────────────────────"
echo ""

# Health checks
echo "  ┌── HEALTH CHECKS ────────────────────────────────"
if [ -f ".env.local" ]; then
    echo "  │ .env.local: ✅ exists"
    grep -q "GEMINI_API_KEY" .env.local 2>/dev/null && echo "  │   GEMINI_API_KEY: set" || echo "  │   GEMINI_API_KEY: ⚠ MISSING"
else
    echo "  │ .env.local: ⚠ MISSING"
fi
echo "  └──────────────────────────────────────────────"
echo ""

# Quick summary
echo "  ┌── QUICK SUMMARY ────────────────────────────────"
for i in "${!BRANCHES[@]}"; do
    BRANCH="${BRANCHES[$i]}"
    AGENT="${AGENTS[$i]}"
    if ! git rev-parse --verify "$BRANCH" &>/dev/null; then
        echo "  │ ${AGENT}: ⚪ no branch"
        continue
    fi
    AHEAD=$(git rev-list "$BASE_BRANCH".."$BRANCH" --count 2>/dev/null || echo "?")
    LAST=$(git log "$BRANCH" -1 --format="%s (%ar)" 2>/dev/null)
    FCOUNT=$(git diff "$BASE_BRANCH"..."$BRANCH" --name-only 2>/dev/null | wc -l | tr -d ' ')
    echo "  │ ${AGENT}: ${AHEAD} commits, ${FCOUNT} files | ${LAST}"
done
echo "  └──────────────────────────────────────────────"
echo ""
echo "  Paste everything above to PM agent."
