#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# pack.sh — 轻如烟干净发布包制作（2026-08-06）
# ───────────────────────────────────────────────────────────────────
# 原则：三分离（代码可分发 / 配置模板化 / 密钥+运行时数据永不分发）
#   · 白名单制：只打包显式列出的文件，杜绝"乱七八糟"
#   · 打包前密钥扫描：命中真实密钥模式立即中止
#   · 硬编码路径扫描：命中 /vol2/1000 等本机路径给出警告清单
#   · 产出：releases/qinruyan-release-<时间戳>.tar.gz + SHA256SUMS + MANIFEST.txt
#
# 用法：bash pack.sh [--skip-scan]
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

STAMP=$(date +%Y%m%d-%H%M)
RELEASE_DIR="../releases"
mkdir -p "$RELEASE_DIR"
STAGE=$(mktemp -d /tmp/qinruyan-pack.XXXXXX)
trap 'rm -rf "$STAGE"' EXIT

# ── 白名单（相对 scripts/）────────────────────────────────────────
FILES=(
  # 编辑器核心
  edit-web.py inject-helper.mjs index.html editor-config.example.json
  handlers/ utils/ static/
  # 自主唤醒链
  self_pulse_cli.py pulse-cron.sh salience_gate.py sleep_pressure.py
  first_sight.py wake_client.py test_awaken.py SELF_PULSE_README.md
  # 运维与自愈
  health-check.sh health-loop.sh watchdog.sh start-clean.sh start-health-loop.sh
  session_cleanup.py session_safety.py install-hooks.sh githooks/
  # 工具
  momo-pack-cli.py cache_stats_helper.py cache_monitor.py sandglass_log_wrapper.py
  local_search.py searxng_mcp.py bing_search.py nanobot-helper.py
  task_dispatcher.py fix_sister_config.py
  # MCP/桥接
  dandan-mcp-server-active.mjs embed-server.mjs
  # 配置模板与文档
  api_keys.py .env.example DEPLOY_GUIDE.md README.md ARCHITECTURE.md
  CHANGELOG.md PITFALLS.md VERSION_INDEX.md docs/
)

# ── 1. 校验白名单文件存在且已入库 ────────────────────────────────
MISSING=0
for f in "${FILES[@]}"; do
  [ -e "$f" ] || { echo "❌ 白名单文件不存在: $f"; MISSING=1; }
done
[ $MISSING -eq 0 ] || { echo "中止：白名单有缺失"; exit 1; }

# ── 2. 拷贝到暂存区（保留目录结构）───────────────────────────────
for f in "${FILES[@]}"; do
  mkdir -p "$STAGE/$(dirname "$f")"
  cp -r "$f" "$STAGE/$(dirname "$f")/" 2>/dev/null || true
done

# ── 2.5 暂存区垃圾清理（cp -r 会带进 __pycache__/bak，这里剔除）──
find "$STAGE" \( -name '__pycache__' -o -name '*.pyc' -o -name '*.bak*' -o -name '*.log' -o -name '.DS_Store' \) -exec rm -rf {} + 2>/dev/null || true

# ── 3. 密钥扫描（命中即中止）─────────────────────────────────────
if [ "${1:-}" != "--skip-scan" ]; then
  echo "── 密钥扫描 ──"
  HITS=$(grep -rInE \
    'sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|[0-9a-f]{32}\.[A-Za-z0-9]{10,}|Bearer [A-Za-z0-9._-]{10,}|password[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']{6,}|(api[_-]?key|secret)[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9_\-]{16,}' \
    "$STAGE" 2>/dev/null | grep -v "os.environ" | head -10 || true)
  if [ -n "$HITS" ]; then
    echo "🚫 检测到疑似密钥，打包中止："
    echo "$HITS"
    exit 1
  fi
  echo "✅ 无密钥命中"
fi

# ── 4. 本机路径扫描（仅警告，供人工确认）─────────────────────────
echo "── 本机路径扫描（警告清单）──"
WARN=$(grep -rlE '/vol2/1000|/vol1/@apphome' "$STAGE" 2>/dev/null | sed "s#$STAGE/##" | head -15 || true)
if [ -n "$WARN" ]; then
  echo "⚠️ 以下文件含本机绝对路径（部署时需改 editor-config.json 或环境变量）："
  echo "$WARN"
else
  echo "✅ 无本机路径"
fi

# ── 5. 打包 + 校验和 + 清单 ──────────────────────────────────────
PKG="$RELEASE_DIR/qinruyan-release-$STAMP.tar.gz"
tar -czf "$PKG" -C "$STAGE" .
(cd "$RELEASE_DIR" && sha256sum "$(basename "$PKG")" > "$PKG.sha256")
(
  echo "轻如烟发布包 $STAMP"
  echo "文件清单（$(find "$STAGE" -type f | wc -l) 个）："
  (cd "$STAGE" && find . -type f | sort)
  echo ""
  echo "未打包（个人文档/开发文件/实例配置，见 git）："
  echo "AGENTS.md SOUL.md IDENTITY.md USER.md TOOLS.md MEMORY.md STARTER.md"
  echo "backlog.md next-turn-note.md facts.dict.md think_*.py reflection_unified.py"
  echo "editor-config.json（实例路径配置，用 editor-config.example.json 模板）"
  echo "api_keys.py 为纯环境变量读取（无硬编码密钥），.env 填密钥"
) > "$PKG.manifest.txt"

echo ""
echo "✅ 发布包就绪："
ls -la "$PKG"*
echo "SHA256: $(cat "$PKG.sha256" | awk '{print $1}')"
