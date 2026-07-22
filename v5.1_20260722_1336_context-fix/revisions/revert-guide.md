# 轻如烟编辑器 版本回滚指南

## 版本索引
| 版本 | 文件 | 日期 | 说明 |
|------|------|------|------|
| v1 | revisions/20260612_v1_editor-backup.py | 6/12 | 最早的分离尝试 |
| v2 | revisions/20260613_v2_zuixin.py | 6/13 | 第二次分离尝试 |
| v4 | 当前 scripts/edit-web.py | 当前 | 部分分离架构 |
| v4.2 | 当前 scripts/ 全套 | 2026-06-28 | 当前版本（前后端分离 + 版本号统一管理） |

## 回滚到 v1
```bash
cp scripts/revisions/20260612_v1_editor-backup.py scripts/edit-web.py
# 重启编辑器
```

## 回滚到 v2
```bash
cp scripts/revisions/20260613_v2_zuixin.py scripts/edit-web.py
# 重启编辑器
```

## 回滚到 v4 / v4.2
### 方式一：从 revisions 备份恢复
```bash
# v4.2 备份存放在 scripts/revisions/v4.2_20260628_version-fix/
cp scripts/revisions/v4.2_20260628_version-fix/edit-web.py scripts/edit-web.py
# 重启编辑器
```

### 方式二：从 编辑器所有版本 目录恢复
```bash
# 完整的 v4.2 备份在 编辑器所有版本/v4.2_20260628_version-fix/
```

## 当前版本状态
- router.py 已分离 ✅
- utils/ 已分离 ✅
- handlers/ 已分离 ✅
- utils/version.py 版本号唯一数据源 ✅
- /api/version 动态端点 ✅
