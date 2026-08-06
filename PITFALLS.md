# OpenClaw 踩坑汇总

> 仓库：tdx1146/memory-integration-layer
> 维护者：轻如yan
> 更新时间：2026-08-03

---

## 〇、inject-helper 消息丢失根因：fire-and-forget（F178，2026-08-03 已修复）

### 问题现象

- 编辑器显示发送成功，但 OpenClaw 实际未收到消息
- 消息丢失通常发生在 gateway 事件循环被阻塞时（实测峰值可达 2.9s）

### 根本原因

**inject-helper.mjs 的 chat.send 分支是 fire-and-forget：**

1. 发送 `chat.send` 帧后立即返回 `{ok:true}`，不等 gateway 确认
2. 100ms 后直接退出进程
3. 若 gateway 事件循环阻塞（如正在读写 50MB 级 session 文件），消息帧可能尚未处理，但界面已显示成功 → 消息静默丢失

### 修复（权威版本 2026-08-03）

1. **等待 ack**：发送 chat.send 帧后，循环读取响应帧直到收到 RPC `res`（含事件帧跳过），确认 gateway 已接收/处理
2. **超时 3s**（略大于阻塞峰值 2.9s）：超时 → `{ok:false, error:"gateway 未确认（3s 超时）"}`，进程以非 0 退出码退出，让 edit-web.py 能捕获失败并重试
3. **保留幂等**：idempotencyKey 不删，重试不重复投递
4. **保留 deliver:true**
5. abort/history 模式不受影响（原有等待逻辑不动）

### 配套结构性补全

- 新增 `utils/process_lock.py`（PID 文件锁，标准库实现）：新版 edit-web.py 第 42 行裸 import `from utils.process_lock import ProcessLock`，但 GitHub 上该文件不存在 → 部署即崩。已补全并验证。
- 补全 GitHub main 根目录缺失的 `utils/` 包、`handlers/` 大部分文件、`static/` 前端文件、`inject-helper.mjs`、`cache_monitor.py`：此前根目录仅剩 edit-web.py + api_keys.py + cache_stats_helper.py + session_handler.py + core.js，结构不完整，无法独立部署。

---

## 一、会话历史膨胀导致内存泄漏（F177）

### 问题现象

- 通过轻如烟编辑器发消息，OpenClaw收不到或延迟很久
- inject日志显示成功，但消息未持久化
- OpenClaw内存1.2GB，CPU占用95%
- sessions.json中所有session的messages字段为空

### 根本原因

**主session文件巨大：**
```
347f2de8-a8a8-4180-bedb-c51f94bf191f.jsonl
- 大小：53MB
- 行数：36087条消息
- 平均：1.5KB/条
```

**导致的问题链：**
1. OpenClaw全量加载53MB到内存 → 1.2GB内存占用
2. 每次inject读写53MB文件 → IO阻塞（iowait 25%）
3. 频繁创建临时对象 → GC频繁（CPU 95%）
4. GC停顿导致写入延迟 → **消息未持久化**

### 诊断方法

```bash
# 1. 检查session文件大小
ls -lh /vol1/@apphome/trim.openclaw/data/home/.openclaw/agents/main/sessions/*.jsonl

# 2. 统计消息数量
wc -l <session-id>.jsonl

# 3. 检查OpenClaw内存
ps aux | grep openclaw | grep -v grep

# 4. 检查inject延迟
cat /vol2/1000/AI专用/所有自动化/轻如烟/scripts/.inject_logs/*.log | grep "timing"
```

### 整治方案

**立即整治：**

```bash
# 1. 备份当前session
SESSION_FILE="/vol1/@apphome/trim.openclaw/data/home/.openclaw/agents/main/sessions/<session-id>.jsonl"
cp "$SESSION_FILE" /tmp/session_backup_$(date +%s).jsonl

# 2. 压缩（保留最近500条）
tail -500 "$SESSION_FILE" > /tmp/session_compressed.jsonl

# 3. 替换
mv /tmp/session_compressed.jsonl "$SESSION_FILE"

# 4. 清理孤儿文件
cd /vol1/@apphome/trim.openclaw/data/home/.openclaw/agents/main/sessions
find . -name "*.trajectory.jsonl" -delete
find . -name "*.checkpoint.*.jsonl" -delete
```

**长期预防：**

在OpenClaw配置中启用自动压缩：

```json
// ~/.openclaw/openclaw.json
{
  "session": {
    "compaction": {
      "enabled": true,
      "maxMessages": 500,
      "strategy": "sliding",
      "minIntervalMs": 3600000
    }
  }
}
```

### 整治效果

| 指标 | 整治前 | 整治后 | 改善 |
|------|--------|--------|------|
| Session文件 | 53MB | 746KB | -98.6% |
| 消息数 | 36087条 | 505条 | -98.6% |
| OpenClaw内存 | 1265MB | 714MB | -43.7% |
| CPU占用 | 95% | 9.4% | -90.1% |
| inject延迟 | 1401ms | 105ms | -92.5% |
| 消息持久化 | ❌ | ✅ | 恢复正常 |

---

## 二、编辑器截断bug（2026-08-01）

### 问题现象

- 用户选择"回滚一页"，期望截断几十行
- 实际截断25637行（几乎全部）
- 触发保险线拦截（>50%）

### 根本原因

**前端索引转换错误：**
- `user_index=49`（前端传入，50轮窗口内序号）
- `target_line=635`（后端期望全文全局序号）
- 索引体系不匹配导致定位错误

### 解决方案

**纯前端修复**（后端保险线工作正常）：
- 修改前端索引计算逻辑
- 传递正确的"用户消息序号"而非"窗口内序号"

**详细报告**：`memory/2026-08-01-轻如烟编辑器截断bug分析.md`

---

## 三、手机embed服务公网访问（2026-08-01）

### 问题现象

- 手机embed服务在内网正常（`192.168.0.103:11435`）
- 但外部AI无法访问（不在同一内网）

### 解决方案

**使用Cloudflare Tunnel：**

1. 在飞牛OS上安装并配置cloudflared
2. 配置named tunnel绑定域名：
   - `11435.tdx1146.cc` → `192.168.0.103:11435`
   - `shouji.tdx1146.cc` → `192.168.0.103:8080`

3. 公网地址：
   - `https://11435.tdx1146.cc/v1/embeddings`
   - `https://shouji.tdx1146.cc/`

### 注意事项

- **Tunnel ID必须匹配**：DNS指向的tunnel ID要和运行的tunnel ID一致
- **DNS传播需要时间**：配置后等待几分钟
- **SSH信息**：`tdx1146@192.168.0.103:8022`，密码`971334`

**详细报告**：`memory/2026-08-01-手机embed服务双栈配置完成.md`

---

## 四、GitHub仓库名称验证（2026-08-02）

### 真实仓库名称

| 仓库名 | 用途 | 状态 |
|--------|------|------|
| `living-memory-system` | 活体记忆系统（LMS）| ✅ 已验证 |
| `memory-integration-layer` | 胶水层（整合沙漏+LMS+向量）| ✅ 已验证 |
| `agent-os-iso-sand` | 同构沙盘 | ✅ 已验证 |
| `monument-network` | 丰碑网络 | ✅ 已验证 |

### 验证方法

```bash
# 检查GitHub仓库是否存在
curl -s "https://api.github.com/repos/tdx1146/<repo-name>" | jq '.full_name'

# 检查本地仓库远程地址
cd /path/to/repo
git remote -v
```

---

## 五、常见问题排查

### Q: 编辑器发消息收不到？

**排查步骤：**

1. 检查inject日志：
   ```bash
   cat /vol2/1000/AI专用/所有自动化/轻如烟/scripts/.inject_logs/*.log
   ```

2. 检查OpenClaw状态：
   ```bash
   ps aux | grep openclaw
   ```

3. 检查session文件大小：
   ```bash
   ls -lh ~/.openclaw/agents/main/sessions/*.jsonl
   ```

4. 检查消息是否持久化：
   ```bash
   tail -10 ~/.openclaw/agents/main/sessions/<session-id>.jsonl
   ```

### Q: OpenClaw内存占用高？

**原因**：会话历史过大

**解决**：压缩session文件（见第一条）

### Q: inject延迟大？

**原因**：
- session文件大
- 磁盘IO慢
- OpenClaw高负载

**解决**：
- 压缩session文件
- 检查磁盘IO
- 重启OpenClaw

---

## 六、监控与预防

### 自动监控脚本

```bash
#!/bin/bash
# 保存为 /etc/cron.hourly/openclaw-monitor

# 检查内存
MEMORY=$(ps aux | grep 'openclaw' | grep -v grep | awk '{print $6}')
if [ $MEMORY -gt 1500000 ]; then
    echo "警告：OpenClaw内存超过1.5GB" | logger -t openclaw
fi

# 检查session文件大小
SESSION_SIZE=$(ls -lh ~/.openclaw/agents/main/sessions/*.jsonl | awk '{print $5}' | head -1)
if [[ $SESSION_SIZE =~ [0-9]+M ]] && [ ${SESSION_SIZE%M} -gt 10 ]; then
    echo "警告：Session文件超过10MB" | logger -t openclaw
fi
```

### 定期清理

```bash
# 每周清理trajectory文件
0 3 * * 0 find ~/.openclaw/agents/main/sessions -name "*.trajectory.jsonl" -delete
```

---

## 七、参考文档

- OpenClaw文档：`/vol1/@apphome/trim.openclaw/data/openclaw/node_modules/openclaw/docs/`
- 会话管理：`docs/reference/session-management-compaction.md`
- 内存管理：`docs/concepts/memory.md`
- 本地整治报告：`memory/2026-08-02-OpenClaw内存泄漏整治方案.md`

---

**维护日志：**
- 2026-08-02：创建文档，记录会话膨胀问题（F177）
- 2026-08-01：编辑器截断bug、手机embed服务配置

---

_此文档应定期更新，记录所有踩坑和解决方案。_