#!/bin/sh
# install-hooks.sh — 安装 git post-commit hooks
# 在新机器上克隆仓库后执行此脚本
REPO="$(cd "$(dirname "$0")/.." && pwd)"
echo "📦 安装 git hooks → $REPO/.git/hooks/"
for hook in "$(dirname "$0")/githooks/"*; do
    [ -f "$hook" ] || continue
    name=$(basename "$hook")
    cp "$hook" "$REPO/.git/hooks/$name"
    chmod +x "$REPO/.git/hooks/$name"
    echo "  ✅ $name"
done
echo "安装完成"
