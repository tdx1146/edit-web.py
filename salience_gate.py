#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
salience_gate.py — 显著性判据（B 判据保守版，2026-08-06）
==========================================================
选择性唤醒是大脑默认架构（Salience Network, Seeley 2007）；显著性 =
概率更新量（Baldi & Itti 2010）；记忆 gate 三路合流：novelty × salience
× goal（Lisman & Grace 2005）。本模块把科学判据工程化，且"宁可漏报
不可误报"（初始阈值保守）。

判据（高阈值 + 连续计数 + 边沿触发，复用 self_pulse v2 模式）：
  1. surprise z-score：近期窗口（默认 20 个采样）均值 + 2σ 触发；
     样本 < 5 或 σ≈0 时不判（fail-open 保守）
  2. entropy_ratio > 0.85 连续 ≥3 次（2026-08-06 随 self_pulse 调低：0.9→0.85）
  3. purpose_coherence < 0.8 连续 ≥3 次
  4. 事件类型权重：anomaly=0.9 > dream/相变=0.6 > task_complete=0.3 > 例行=0.1
  5. 合流规则：score = 0.25*novelty + 0.50*salience + 0.25*goal，
     总分 > 0.4 放行（2026-08-06 实测确认：慢性高熵+目的正常持续 salient，
     score≈0.525 已过；阈值保持 0.4 不再调，权重 0.25/0.50/0.25 已验证）。
     anomaly（goal 0.9）也需至少一路 LMS 确认合流；SG_ANOMALY_BYPASS=1
     可强制直通（默认开，2026-08-06：anomaly=硬告警允许穿透）。

状态文件（跟 sleep_pressure 同目录，持久）：
  /vol2/1000/AI专用/所有自动化/轻如烟/sandglass/salience_state.json
  （环境变量 SP_SALIENCE_STATE_FILE 可覆盖；NEXSANDBASE_HOME 优先）

用法：
    from salience_gate import judge
    v = judge('anomaly', metrics={...})     # metrics 可注入；None 时自采
    v['salient'], v['rising_edge'], v['score']

CLI：
    python3 salience_gate.py --event anomaly --simulate high_entropy
    python3 salience_gate.py --event anomaly --lms-off     # 模拟 LMS 不可达
"""

import json
import math
import os
import sys
import time
import urllib.request
from datetime import datetime

# 沙漏数据目录（同 self_pulse 推导）：NEXSANDBASE_HOME 优先
_SANDBASE = os.environ.get('NEXSANDBASE_HOME') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'sandglass',
)
_STATE_FILE = os.environ.get('SP_SALIENCE_STATE_FILE',
                             os.path.join(_SANDBASE, 'salience_state.json'))
_LMS_URL = os.environ.get('SELF_PULSE_LMS_URL', 'http://127.0.0.1:8190/status/main')

# 判据阈值（保守起步，全部 env 可覆盖）
SURPRISE_WINDOW = int(os.environ.get('SG_WINDOW', '20'))      # 近期窗口
SURPRISE_MIN_SAMPLES = int(os.environ.get('SG_MIN_SAMPLES', '5'))  # 不足不判
SURPRISE_Z_MIN = float(os.environ.get('SG_Z_MIN', '2.0'))     # 均值 + 2σ
ENTROPY_HIGH = float(os.environ.get('SG_ENTROPY_HIGH', '0.85'))  # 2026-08-06: 随 self_pulse 0.9→0.85
PURPOSE_LOW = float(os.environ.get('SG_PURPOSE_LOW', '0.8'))
MIN_STREAK = int(os.environ.get('SG_MIN_STREAK', '3'))
SCORE_THRESHOLD = float(os.environ.get('SG_SCORE_THRESHOLD', '0.4'))
W_NOVELTY = float(os.environ.get('SG_W_NOVELTY', '0.25'))
W_SALIENCE = float(os.environ.get('SG_W_SALIENCE', '0.50'))
W_GOAL = float(os.environ.get('SG_W_GOAL', '0.25'))
ANOMALY_BYPASS = os.environ.get('SG_ANOMALY_BYPASS', '1') == '1'


def _now_iso() -> str:
    return datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')


def event_weight(event_type: str = '') -> float:
    """事件类型权重：anomaly=0.9 > dream/相变=0.6 > task_complete=0.3 > 例行=0.1。"""
    et = (event_type or '').lower()
    if 'anomaly' in et:
        return 0.9
    if 'dream' in et or 'phase' in et or '相变' in et or 'collapse' in et:
        return 0.6
    if 'task_complete' in et or 'task' in et:
        return 0.3
    return 0.1


def load_state(path: str = '') -> dict:
    path = path or _STATE_FILE
    st = {
        'surprise_window': [],
        'entropy_streak': 0,
        'purpose_streak': 0,
        'last_salient': False,
        'last_verdict': None,
        'updated_at': _now_iso(),
    }
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, dict):
            for k in st:
                if k in data:
                    st[k] = data[k]
            st.setdefault('surprise_window', [])
    except Exception:
        pass
    return st


def save_state(st: dict, dry_run: bool = False, path: str = '') -> bool:
    if dry_run:
        return False
    st['updated_at'] = _now_iso()
    path = path or _STATE_FILE
    try:
        tmp = path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(st, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
        return True
    except Exception:
        return False


def collect_metrics() -> dict:
    """GET LMS /status/main（fail-open：失败返回 None）。"""
    try:
        with urllib.request.urlopen(_LMS_URL, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        st = data.get('status') or data
        return {
            'entropy_ratio': float(st['entropy_ratio']),
            'purpose_coherence': float(st['purpose_coherence']),
            'last_surprise': float(st['last_surprise']),
            'turn_count': int(st.get('turn_count', 0)),
        }
    except Exception:
        return None


def _z_flag(surprise: float, window: list) -> tuple:
    """surprise 相对近期基线 z-score：z ≥ 均值 + 2σ。

    样本不足 / σ≈0 → (False, None)（fail-open 保守：不判）。
    返回 (flag, z)。
    """
    if len(window) < SURPRISE_MIN_SAMPLES:
        return False, None
    n = len(window)
    mean = sum(window) / n
    var = sum((x - mean) ** 2 for x in window) / n
    std = math.sqrt(var)
    if std <= 1e-9:
        return False, None
    z = (surprise - mean) / std
    return z >= SURPRISE_Z_MIN, round(z, 2)


def judge(event_type: str = 'routine', metrics: dict = None,
          dry_run: bool = False, state: dict = None) -> dict:
    """显著性判定（每脉冲调用一次以维护窗口/连续计数/边沿）。

    参数：
      event_type  本次事件类型（决定 goal 权重；'anomaly' 直通）
      metrics     LMS 指标 dict（可注入避免重复采集）；None 时自采
      dry_run     不落盘
      state       注入状态（测试用）

    返回 verdict dict（可解释，供 metrics/日志）：
      salient / rising_edge / score / novelty / salience / goal /
      event_type / z / entropy_streak / purpose_streak / hard_bypass / lms_ok
    """
    st = state if state is not None else load_state()
    m = metrics if metrics is not None else collect_metrics()

    novelty = False
    salience = False
    z = None
    window = list(st.get('surprise_window') or [])
    entropy_streak = 0
    purpose_streak = 0

    if m is None:
        # 无法测量：窗口清空、计数归零、不判（宁可漏报不可误报）
        window = []
    else:
        sur = m.get('last_surprise')
        er = m.get('entropy_ratio')
        pc = m.get('purpose_coherence')
        if sur is not None:
            window = (window + [float(sur)])[-SURPRISE_WINDOW:]
            novelty, z = _z_flag(float(sur), window)
        if er is not None and float(er) > ENTROPY_HIGH:
            entropy_streak = st.get('entropy_streak', 0) + 1
        else:
            entropy_streak = 0
        if pc is not None and float(pc) < PURPOSE_LOW:
            purpose_streak = st.get('purpose_streak', 0) + 1
        else:
            purpose_streak = 0
        salience = entropy_streak >= MIN_STREAK or purpose_streak >= MIN_STREAK

    goal = event_weight(event_type)
    score = W_NOVELTY * float(novelty) + W_SALIENCE * float(salience) + W_GOAL * goal
    hard = (event_type == 'anomaly' and ANOMALY_BYPASS)
    salient = hard or score > SCORE_THRESHOLD
    rising_edge = salient and not st.get('last_salient')

    verdict = {
        'salient': salient,
        'rising_edge': rising_edge,
        'score': round(score, 3),
        'novelty': novelty,
        'salience': salience,
        'goal': round(goal, 2),
        'event_type': event_type,
        'z': z,
        'entropy_streak': entropy_streak,
        'purpose_streak': purpose_streak,
        'hard_bypass': hard,
        'lms_ok': m is not None,
        'ts': _now_iso(),
    }

    st['surprise_window'] = window
    st['entropy_streak'] = entropy_streak
    st['purpose_streak'] = purpose_streak
    st['last_salient'] = salient
    st['last_verdict'] = {k: verdict[k] for k in
                          ('salient', 'score', 'novelty', 'salience', 'goal')}
    save_state(st, dry_run=dry_run)
    return verdict


def _simulate_metrics(kind: str) -> dict:
    base = {'entropy_ratio': 0.60, 'purpose_coherence': 0.92,
            'last_surprise': 0.05, 'turn_count': 1}
    if kind == 'high_entropy':
        base.update({'entropy_ratio': 0.95, 'purpose_coherence': 0.90,
                     'last_surprise': 0.31})
    elif kind == 'purpose':
        base.update({'entropy_ratio': 0.55, 'purpose_coherence': 0.75,
                     'last_surprise': 0.02})
    elif kind == 'surprise':
        base.update({'entropy_ratio': 0.60, 'purpose_coherence': 0.92,
                     'last_surprise': 0.50})
    return base


def main(argv=None) -> dict:
    import argparse
    p = argparse.ArgumentParser(description='salience_gate 显著性判据 CLI')
    p.add_argument('--event', default='routine', help='事件类型（anomaly/dream_complete/task_complete/例行）')
    p.add_argument('--simulate', choices=['high_entropy', 'purpose', 'surprise', 'normal'],
                   default='normal', help='模拟 LMS 指标（测试用）')
    p.add_argument('--lms-off', action='store_true', help='模拟 LMS 不可达（fail-open 走查）')
    p.add_argument('--commit', action='store_true', help='落盘（默认 dry-run 不写）')
    p.add_argument('--state-file', default='', help='覆盖状态文件路径')
    args = p.parse_args(argv)
    if args.state_file:
        globals()['_STATE_FILE'] = args.state_file
    m = None if args.lms_off else _simulate_metrics(args.simulate)
    v = judge(args.event, metrics=m, dry_run=not args.commit)
    return v


if __name__ == '__main__':
    try:
        print(json.dumps(main(), ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)[:200]}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
