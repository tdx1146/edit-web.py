# 轻如烟 版本归档索引

| 版本 | 目录 | 日期 | 架构 | 说明 |
|------|------|------|------|------|
| v1 | ARCHIVED/20260612_v1_editor-backup/ | 6/12 | 单体(3772行) | 最早的分离尝试，handlers为空壳 |
| v2 | ARCHIVED/20260613_v2_zuixin/ | 6/13 | 单体(3877行) | 第二次尝试，缺乏sandglass |
| v3 | ARCHIVED/20260622_v3_zuixin2/ | 6/22 | 副本(3925行) | 只是当前版本的副本，伪分离 |
| v4 | scripts/ → 当前运行 | 6/25 | 分离(1915行) | 真正的前后端分离，handlers填实 |

## 当前运行版本
位置: 轻如烟/scripts/
架构: handler方法已迁移到 handlers/*.py，配置集中在 utils/config.py
启动: cd scripts && python3 edit-web.py

## 回滚方法
如果 v4 出现问题，将 ARCHIVED/ 中对应版本的 edit-web.py 复制到 scripts/ 下
然后重启编辑器

## 归档说明
- 本目录仅包含历史版本的只读快照，不用于日常开发
- 当前版本的开发在 scripts/ 目录进行
- 如需参考旧版实现，浏览对应版本目录即可
- 每个版本目录完整保留了当时的所有文件（包括 handlers/、utils/、static/ 等）
