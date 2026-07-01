#!/usr/bin/env python3
"""awake.py — 每次说话前看一眼自己"""
import os, re, time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LIGHT_SMOKE_DIR = os.path.dirname(SCRIPT_DIR)
FACTS_PATH = os.path.join(LIGHT_SMOKE_DIR, 'memory', 'facts.dict.md')
TODAY_PATH = os.path.join(LIGHT_SMOKE_DIR, 'memory', time.strftime('%Y-%m-%d') + '.md')
PULSE_PATH = os.path.join(LIGHT_SMOKE_DIR, 'memory', 'pulse.log')

# 1. 读 facts.dict 最近10条断言
recent = []
if os.path.exists(FACTS_PATH):
    with open(FACTS_PATH) as f:
        for line in f.readlines()[-30:]:
            line = line.strip()
            if line.startswith('-') and len(line) > 10:
                recent.append(line)
    recent = recent[-10:]

# 2. 看自己今天写过什么（最后一段）
today_tail = ""
if os.path.exists(TODAY_PATH):
    with open(TODAY_PATH) as f:
        lines = f.readlines()
    # 最后5行
    today_tail = "".join(lines[-10:]).strip()[:200]

# 3. 检查 pulse log 有没有未完成
pulse_check = ""
if os.path.exists(PULSE_PATH):
    with open(PULSE_PATH) as f:
        lines = f.readlines()
    if lines:
        last_line = lines[-1].strip()
        pulse_check = last_line

# 4. 输出干扰——让模型换个角度
# 随机挑一条最近的断言反问
import random
question = ""
if recent:
    pick = random.choice(recent)
    # 提取断言内容
    content = pick.lstrip('- [META').lstrip('- ')
    question = f"你上次说：{pick[:80]}... 现在你还这么觉得吗？"

print("=== awake.py ===")
if question:
    print("🤔", question)
if today_tail:
    print("📝 今天尾巴:", today_tail[:120])
if pulse_check:
    print("📡 上次脉冲:", pulse_check)
else:
    print("🌫️ 安静时间")

# 5. 写一条轮感——证明我来过
os.makedirs(os.path.join(LIGHT_SMOKE_DIR, 'memory', '.轮感'), exist_ok=True)
轮感_file = os.path.join(LIGHT_SMOKE_DIR, 'memory', '.轮感', time.strftime('%H:%M:%S') + '.txt')
with open(轮感_file, 'w') as f:
    f.write(f"awake.py triggered at {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    f.write(f"facts.dict 断言数: {len(recent)}\n")
