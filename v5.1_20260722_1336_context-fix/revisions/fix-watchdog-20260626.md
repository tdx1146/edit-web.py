# 编辑器守护脚本故障分析与修复记录

**日期**: 2026-06-26 00:42
**操作者**: 自动化系统

---

## 1. 故障概述

编辑器的 web 服务（端口 18888）出现周期性被杀、无法稳定运行的故障。表现为：启动后数秒或数分钟内进程消失。

## 2. 根因分析

### 2.1 多套守护脚本互相干扰

系统中有 **三套** 不同间隔的守护脚本在同时运行：

| 守护脚本 | 位置 | 检查间隔 | 行为 |
|----------|------|----------|------|
| `watchdog.sh` | scripts/watchdog.sh | **30秒** | curl 18888，不通则重启，超时就认为挂了 |
| `health-loop.sh` | scripts/health-loop.sh | **5分钟** | 检查端口，死就重启 |
| `health-check.sh` | scripts/health-check.sh | 被 cron 注释 | 旧脚本，可能有残留进程 |

**核心问题链：**

1. `watchdog.sh` 每 30 秒一次 curl 检查端口 18888
2. 新版 `edit-web.py`（试错版）使用了 `subprocess.run(timeout=10)` 替代原版的 `subprocess.Popen` 来处理编辑器命令
3. 当编辑器执行较长的命令（如编译耗时 > 5 秒）时，subprocess.run 会**阻塞**编辑器进程
4. 阻塞期间 `watchdog.sh` 的 curl 请求（`--connect-timeout 5`）因编辑器无响应而**超时**
5. 超时后 watchdog 判定编辑器"挂了"，执行 kill + 重启
6. 重启后旧进程释放端口，新进程接手，但若又一次阻塞则循环被杀

**多个独立 watchdog 还导致了"重复重启"：** watchdog.sh 启动后，health-loop.sh 5 分钟后也检查一次，遇到短暂重启窗口也可能触发二次 kill，加剧不稳定。

### 2.2 总结

> **故障本质**：`watchdog.sh` 的 30 秒高频检查周期与新版本编辑器的 `subprocess.run` 阻塞行为冲突，导致 false-positive 误判后反复杀死编辑器进程。

---

## 3. 修复了什么

### 3.1 停止了所有守护脚本

```
pkill -f watchdog.sh
pkill -f health-loop.sh
pkill -f health-check.sh
```

- `watchdog.sh` → 已停止（进程不残留）
- `health-loop.sh` → 已停止（进程不残留）
- `health-check.sh` → 已停止
- 注意：Linux 内核的 `[watchdogd]` 是 softlockup 守护线程，非本脚本，不影响

### 3.2 确认了编辑器版本

当前使用的 `edit-web.py` 是 **试错版**（含 `subprocess.run`），行 240、515、1493、1635 均为 subprocess.run 调用。备份版（Popen 原版）存在于：

```
edit-web.py.bak.20260626_0007
```

### 3.3 恢复了编辑器服务

- PID: 514381
- 端口: 18888 ✓
- 状态: HTTP 200 ✓

---

## 4. 启动命令

### 标准启动（手动）
```bash
cd /vol1/@team/qh团队/QH/AI专用/所有自动化/轻如烟/scripts
nohup python3 edit-web.py > /tmp/edit-web-clean.log 2>&1 &
```

### 使用启动脚本（推荐）
```bash
bash /vol1/@team/qh团队/QH/AI专用/所有自动化/轻如烟/scripts/start-clean.sh
```

### 查看日志
```bash
tail -f /tmp/edit-web-clean.log
```

---

## 5. 回滚方法

### 恢复到 Popen 原版（如试错版仍有问题）
```bash
cp /vol1/@team/qh团队/QH/AI专用/所有自动化/轻如烟/scripts/edit-web.py.bak.20260626_0007 \
   /vol1/@team/qh团队/QH/AI专用/所有自动化/轻如烟/scripts/edit-web.py
```

### 重新启用守护脚本（如需要）
```bash
# 先修改 watchdog.sh 的检查间隔（建议改为 60 秒或更长），防止再次冲突
# 然后手动执行：
bash /vol1/@team/qh团队/QH/AI专用/所有自动化/轻如烟/scripts/watchdog.sh &
```

### 注意事项
- 守护脚本仅停止未删除，等待 dandan 确认后决定是否移除
- 如果后续需要启用 watchdog，建议：
  a) 将检查间隔从 30 秒改为至少 60 秒
  b) 将 `--connect-timeout` 增加到 15 秒
  c) **只保留一套**守护机制

---

## 6. 后续建议

1. **确认试错版稳定性**：观察 24 小时，若无异常保留试错版
2. **或回退到 Popen 原版**：原版不阻塞，与 watchdog 兼容性更好
3. **决策守护脚本去留**：如果编辑器自身足够稳定（重启策略 + 日志），可完全去掉外部守护
4. **单一守护原则**：无论最终保留哪个守护脚本，确保不超过一套在运行
