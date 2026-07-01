---
name: pre-compact-memory
description: "压缩前将关键上下文持久化到memory文件（文件系统级，不依赖LLM）"
metadata:
  openclaw:
    emoji: "💾"
    events: ["session:compact:before"]
    requires:
      bins: ["node"]
---

# Pre-Compaction Memory Persistence Hook

在上下文压缩前，将当前session的对话轮次数、文件变更、关键概念写入memory文件。
这是文件系统级操作，不依赖LLM自我报告，比memoryFlush prompt更可靠。
