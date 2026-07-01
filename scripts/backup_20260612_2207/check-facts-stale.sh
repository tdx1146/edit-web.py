#!/bin/bash
# check-facts-stale.sh — 检查 facts.dict.md 是否过时，
#   以及依赖文档是否同步更新
#
# 两种检查模式：
#   源文件 vs 事实字典：源文件变更 → 事实字典需要更新
#   事实字典 vs 依赖文档：事实字典更新 → 依赖文档需要同步
#
# Usage: ./check-facts-stale.sh [--quiet|--json]

DIR="/vol1/@team/qh团队/QH/AI专用/所有自动化/轻如烟"
FACTS="$DIR/memory/facts.dict.md"

if [ ! -f "$FACTS" ]; then
  MSG='{"ok":false,"error":"facts.dict.md 不存在！系统事实完全缺失"}'
  [ "$1" == "--json" ] && echo "$MSG" || echo "❌ facts.dict.md 不存在！"
  exit 1
fi

FACTS_MTIME=$(stat -c %Y "$FACTS" 2>/dev/null || echo 0)

# ── 检查A：源文件是否比事实字典新 ──────────────────────────
SOURCE_FILES=(
  "$DIR/scripts/edit-web.py"
  "$DIR/scripts/inject-helper.mjs"
  "$DIR/scripts/spawn-helper.mjs"
  "$DIR/scripts/ws-auth-proxy.cjs"
  "$DIR/scripts/night-watch.sh"
  "$DIR/scripts/pulse.sh"
  "$DIR/scripts/self-stimulate.sh"
  "$DIR/scripts/trim-session.py"
  "$DIR/scripts/check-facts-stale.sh"
  "$DIR/scripts/static/index.html"
  "$DIR/🌫️-摸摸协议.md"
  "$DIR/AGENTS.md"
  "$DIR/README.md"
  "$DIR/SOUL.md"
  "$DIR/USER.md"
  "$DIR/TOOLS.md"
  "$DIR/IDENTITY.md"
  "$DIR/可复制.md"
)

STALE_SOURCE=()
for f in "${SOURCE_FILES[@]}"; do
  if [ -f "$f" ]; then
    MTIME=$(stat -c %Y "$f" 2>/dev/null || echo 0)
    [ "$MTIME" -gt "$FACTS_MTIME" ] && STALE_SOURCE+=("$(basename "$f")")
  fi
done

# ── 检查B：事实字典更新后，依赖文档是否同步 ────────────────
DEPENDENT_DOCS=(
  "$DIR/README.md"
  "$DIR/AGENTS.md"
  "$DIR/🌫️-摸摸协议.md"
  "$DIR/memory/next-turn-note.md"
  "/vol1/@team/qh团队/QH/AI专用/子代理系统合同.md"
  "/vol1/@team/qh团队/QH/AI专用/移交手册.md"
  "/vol1/@team/qh团队/QH/AI专用/找回自己/"
)

STALE_DEP=()
for f in "${DEPENDENT_DOCS[@]}"; do
  if [ -d "$f" ]; then
    # For directories, check the newest file inside
    NEWEST=$(find "$f" -type f -name "*.md" -o -name "*.py" -o -name "*.mjs" -o -name "*.js" -o -name "*.sh" 2>/dev/null | xargs stat -c %Y 2>/dev/null | sort -rn | head -1)
    [ -n "$NEWEST" ] && [ "$NEWEST" -lt "$FACTS_MTIME" ] && STALE_DEP+=("$(basename "$f")")
  elif [ -f "$f" ]; then
    MTIME=$(stat -c %Y "$f" 2>/dev/null || echo 0)
    # Dependency is stale if it's OLDER than the facts dict
    [ "$FACTS_MTIME" -gt 0 ] && [ "$MTIME" -lt "$FACTS_MTIME" ] && STALE_DEP+=("$(basename "$f")")
  fi
done

# ── 输出 ─────────────────────────────────────────────────
HAS_SOURCE_ISSUE=$([ ${#STALE_SOURCE[@]} -gt 0 ] && echo 1 || echo 0)
# 依赖文档的警告只在源文件有变化时才显示（减少噪音）
if [ $HAS_SOURCE_ISSUE -eq 1 ]; then
  HAS_DEP_ISSUE=$([ ${#STALE_DEP[@]} -gt 0 ] && echo 1 || echo 0)
else
  HAS_DEP_ISSUE=0
fi

if [ "$1" == "--json" ]; then
  src_json=$([ ${#STALE_SOURCE[@]} -gt 0 ] && printf '"%s",' "${STALE_SOURCE[@]}")
  dep_json=$([ ${#STALE_DEP[@]} -gt 0 ] && printf '"%s",' "${STALE_DEP[@]}")
  echo "{\"ok\":true,\"stale_source\":$([ $HAS_SOURCE_ISSUE -eq 1 ] && echo true || echo false),\"stale_dep\":$([ $HAS_DEP_ISSUE -eq 1 ] && echo true || echo false),\"source_files\":[${src_json%,}],\"dep_files\":[${dep_json%,}]}"
  exit $((HAS_SOURCE_ISSUE + HAS_DEP_ISSUE * 2))
else
  ISSUE=0
  if [ $HAS_SOURCE_ISSUE -eq 1 ]; then
    echo "⚠️ 源文件比事实字典新，可能需要更新 facts.dict.md："
    for f in "${STALE_SOURCE[@]}"; do echo "  - $f"; done
    ISSUE=1
  fi
  if [ $HAS_DEP_ISSUE -eq 1 ]; then
    echo "⚠️ 事实字典已更新，但依赖文档未同步："
    for f in "${STALE_DEP[@]}"; do echo "  - $f"; done
    ISSUE=1
  fi
  if [ $ISSUE -eq 0 ]; then
    [ "$1" != "--quiet" ] && echo "✅ facts.dict.md 是最新的（检查了 ${#SOURCE_FILES[@]} 个源文件 + ${#DEPENDENT_DOCS[@]} 个依赖文档）"
  fi
  exit $ISSUE
fi
