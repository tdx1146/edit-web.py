#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
self_pulse_cli.py — 自主脉冲 CLI（v2 真任务化 2026-08-05 / v2.1 自主唤醒链 2026-08-06 / v2.2 级别触发唤醒 2026-08-06）
===========================================================
从"心跳测试"升级为"自主感知引擎"（Phase6 重建版 v1 的继任者）：

v2.1 新增（自主唤醒架构）：漂移告警出口从"写 sandglass+总线"扩展为
  告警 → salience_gate 判定 → sleep_pressure 体力检查 → wake_client
  POST /hooks/wake 唤醒主 AI（text=first_sight 醒来第一眼摘要，
  mode=next-heartbeat 保守）；低优先级（新待办）只记录不唤醒。
  SELF_PULSE_WAKE=0 可整体禁用；SELF_PULSE_WAKE_MODE=now 可立即唤醒。

v2.2 调整（2026-08-06 醒来自主行动）：唤醒条件从"仅漂移告警边沿触发"改为
  级别触发——salient 判定通过即唤醒（慢性高熵无边沿，原守卫永不触发）。
  刹车唯一来源是 sleep_pressure（冷却/去重/休眠/交互相位门/anomaly override）；
  有 drift_alert 走 anomaly（可强唤醒），否则 routine（刹车全生效）。

每个脉冲（pulse-cron.sh 每 10 分钟调用）：
  1. 采集画像指标（全只读、fail-open）：
     - LMS /status/main（127.0.0.1:8190）：entropy_ratio / purpose_coherence /
       last_surprise / turn_count（curl 实测字段名，见设计文档）
     - 沙漏近期记忆（sandglass.txt 尾部 3 行，叙事上下文，仅用于告警叙事）
     - 自身上次脉冲状态（/tmp/pulse-state.json：近 5 次快照 + 连续计数 + 去重游标）
  2. 待办源：workspace/memory/backlog.md（`- [ ] ` 行）；出现新待办 →
     输出摘要 + 总线事件 alert.todo 提醒（不强求真执行）
  3. 画像漂移判定（保守起步，≥3 次连续脉冲才判，阈值可解释）：
     - 高熵漂移：entropy_ratio > 0.9 连续 ≥3 次
       （0.9 即 LMS 自身 entropy_high_threshold，非自造常数）
     - 目的漂移：purpose_coherence < 0.8 连续 ≥3 次
     - 边沿触发告警：仅 正常→漂移 转换时告警一次；漂移持续期不重复刷；
       恢复后再次漂移会重新告警（一个漂移 episode 至多一条告警，防刷屏）
  4. 输出分级（噪音治理）：
     - 正常 → 只写 metrics.jsonl（一行 JSON 指标快照），不写 sandglass.txt
       （sandglass.txt 是叙事层，被回魂/召回读取；每 10 分钟一条"我醒了"
        无叙事价值，已被回魂过滤判为噪音；例行遥测归 metrics.jsonl）
     - 漂移 → sandglass.txt（⚠️ 标记，保留叙事价值）+ 总线事件
       anomaly/FAIL（走 alert.anomaly handler → 丰碑 alerts.log）
     - 新待办 → sandglass.txt + 总线事件 alert.todo（无 handler，仅总线留痕）
  5. 状态持久化：/tmp/pulse-state.json（近 5 次快照 + streaks + 去重游标）

兼容性（可回滚）：
  - 轮次文件 /tmp/self_pulse_round.txt 机制沿用（1..MAX 递增，到顶重置）
  - SELF_PULSE_MAX_ROUNDS=5、NEXSANDBASE_HOME 语义不变
  - 不新增外部依赖（stdlib only）；全 fail-open（任何一步失败不阻塞主流程）
  - 行为差异（v1 → v2）：到顶轮次不再写"已达最大轮次"噪音行，脉冲持续工作；
    正常态不再写 sandglass.txt

测试入口（零写入演练）：
  python3 self_pulse_cli.py --dry-run
  python3 self_pulse_cli.py --dry-run --simulate high_entropy \
      --preload-state /tmp/pulse-state-fixture-high.json
"""

import argparse
import fcntl
import hashlib
import json
import os
import sys
import time
import urllib.request
import uuid
from datetime import datetime

# 自主唤醒链（v2.1，2026-08-06）：salience_gate → sleep_pressure → wake_client
# 全 fail-open：任一模块缺失/异常 → 唤醒链禁用，不影响原有脉冲逻辑
_WAKE_MODULES_OK = False
try:
    from salience_gate import judge as salience_judge
    from sleep_pressure import check as sleep_check
    from first_sight import build as build_first_sight
    from wake_client import wake as wake_main
    _WAKE_MODULES_OK = True
except Exception:
    _WAKE_MODULES_OK = False

_SELF = '/vol1/@apphome/trim.openclaw/data/workspace'
# 沙漏数据目录：NEXSANDBASE_HOME 优先（pulse-cron.sh 会导出）；
# 否则推导为 scripts/../sandglass（本脚本同仓的沙漏目录），
# 避免 v1 遗留的 workspace/sandglass 空回退导致手动运行 metrics 写丢。
_SANDBASE = os.environ.get('NEXSANDBASE_HOME') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'sandglass',
)

# 默认路径（CLI 可覆盖，便于测试隔离；环境变量优先）
_ROUND_FILE = os.environ.get('SELF_PULSE_ROUND_FILE', '/tmp/self_pulse_round.txt')
_STATE_FILE = os.environ.get('SELF_PULSE_STATE_FILE', '/tmp/pulse-state.json')
_BUS_FILE = os.environ.get(
    'SELF_PULSE_BUS_FILE',
    '/vol2/1000/AI专用/Agent OS/iso-sand/data/event_bus.jsonl',
)
_LMS_URL = os.environ.get('SELF_PULSE_LMS_URL', 'http://127.0.0.1:8190/status/main')
_METRICS_FILE = os.path.join(_SANDBASE, 'metrics.jsonl')
_SAND_FILE = os.path.join(_SANDBASE, 'sandglass.txt')

# 判定阈值（保守起步，全部可用环境变量覆盖）
# 2026-08-06 调整：ENTROPY_HIGH 0.9 → 0.85。慢性高位长期化（streak 79+）导致
# 0.9 线永不回落、告警永不产生（边沿触发因此停摆）；调低给"慢性高位"留出
# 可判定的漂移区，仍可 env 覆盖。
ENTROPY_HIGH = float(os.environ.get('SELF_PULSE_ENTROPY_HIGH', '0.85'))  # 2026-08-06: 0.9→0.85
PURPOSE_LOW = float(os.environ.get('SELF_PULSE_PURPOSE_LOW', '0.8'))
MIN_STREAK = int(os.environ.get('SELF_PULSE_MIN_STREAK', '3'))          # 连续 ≥3 次脉冲 ≈ 30 分钟
KEEP_SNAPSHOTS = 5                                                       # 状态文件保留近 5 次快照
MAX_TODO_LEN = 80


# ── 小工具 ───────────────────────────────────────────────────────────────


def _now_iso() -> str:
    return datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')


def _ts() -> str:
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


# ── 采集（全只读、fail-open）────────────────────────────────────────────


def collect_lms_metrics() -> dict:
    """GET LMS /status/main，取画像四指标。失败返回 None（fail-open）。"""
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


def tail_sandglass(path: str, n: int = 3, max_bytes: int = 4096) -> list:
    """读沙漏叙事层尾部 n 行（近记忆上下文，仅用于告警叙事）。失败返回 []。"""
    try:
        with open(path, 'rb') as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            f.seek(max(0, size - max_bytes))
            tail = f.read().decode('utf-8', errors='replace')
        lines = [ln for ln in tail.splitlines() if ln.strip()]
        return lines[-n:]
    except Exception:
        return []


def read_backlog() -> tuple:
    """读真实待办源 workspace/memory/backlog.md，返回 (pending_lines, first_todo)。"""
    path = os.path.join(_SELF, 'memory', 'backlog.md')
    try:
        with open(path, encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return [], ''
    pending = []
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith('- [ ] '):
            pending.append(stripped[len('- [ ] '):].strip())
    return pending, (pending[0] if pending else '')


# ── 状态（/tmp/pulse-state.json，fail-open）──────────────────────────────


def load_state(preload: str = '') -> dict:
    path = preload or _STATE_FILE
    try:
        with open(path, encoding='utf-8') as f:
            st = json.load(f)
        if not isinstance(st, dict):
            st = {}
    except Exception:
        st = {}
    st.setdefault('last_5', [])
    st.setdefault('streaks', {'high_entropy': 0, 'purpose': 0})
    st.setdefault('drift', {'high_entropy': False, 'purpose': False})
    st.setdefault('last_alert', None)
    st.setdefault('last_todo_hash', '')
    st.setdefault('last_todo', '')
    return st


def save_state(st: dict, dry_run: bool = False) -> bool:
    if dry_run:
        return False
    try:
        tmp = _STATE_FILE + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(st, f, ensure_ascii=False, indent=2)
        os.replace(tmp, _STATE_FILE)  # 原子替换，避免半写状态
        return True
    except Exception:
        return False


# ── 漂移判定（规则可解释、边沿触发）──────────────────────────────────────


def judge_drift(metrics: dict, state: dict) -> tuple:
    """更新连续计数并判定漂移。

    返回 (flags, streaks, alerts)：
      - flags:   {'high_entropy': bool, 'purpose': bool}  —— 当前是否处于漂移态
      - streaks: {'high_entropy': int, 'purpose': int}    —— 连续计数（最新值）
      - alerts:  本次脉冲新触发的告警描述列表（仅 正常→漂移 转换时产生）

    规则：
      - 高熵：entropy_ratio > ENTROPY_HIGH（0.9，LMS 自身高熵线）连续 ≥3 次
      - 目的：purpose_coherence < PURPOSE_LOW（0.8）连续 ≥3 次
      - "连续"严格指可测量的连续脉冲：指标缺失（LMS 不可达）时计数归零
        （fail-open：宁可漏报不可误报）
    """
    streaks = dict(state.get('streaks') or {})
    prev_drift = dict(state.get('drift') or {})
    flags = {'high_entropy': False, 'purpose': False}
    alerts = []

    if metrics is None:
        # 无法测量：连续计数归零，不告警
        streaks['high_entropy'] = 0
        streaks['purpose'] = 0
        return flags, streaks, alerts

    er = metrics.get('entropy_ratio')
    pc = metrics.get('purpose_coherence')

    if er is not None and er > ENTROPY_HIGH:
        streaks['high_entropy'] = streaks.get('high_entropy', 0) + 1
    else:
        streaks['high_entropy'] = 0
    if streaks['high_entropy'] >= MIN_STREAK:
        flags['high_entropy'] = True
        if not prev_drift.get('high_entropy'):
            alerts.append(
                f'高熵漂移（entropy_ratio={er:.3f} > {ENTROPY_HIGH}，'
                f'连续 {streaks["high_entropy"]} 次脉冲）'
            )

    if pc is not None and pc < PURPOSE_LOW:
        streaks['purpose'] = streaks.get('purpose', 0) + 1
    else:
        streaks['purpose'] = 0
    if streaks['purpose'] >= MIN_STREAK:
        flags['purpose'] = True
        if not prev_drift.get('purpose'):
            alerts.append(
                f'目的漂移（purpose_coherence={pc:.3f} < {PURPOSE_LOW}，'
                f'连续 {streaks["purpose"]} 次脉冲）'
            )

    return flags, streaks, alerts


# ── 自主唤醒链（v2.1：告警 → salience 判定 → 体力检查 → 唤醒，全 fail-open）──


def attempt_wake(drift_alert: str, metrics: dict, rnd: int,
                 dry_run: bool = False, verdict: dict = None) -> dict:
    """漂移告警 → 体力检查 → 醒来第一眼 → 唤醒主 AI（mode=next-heartbeat 保守）。

    返回 dict（供 metrics/日志；token 永不出现）：
      enabled / salient / allowed / woke + reason + 各步详情
    """
    out = {'enabled': False, 'salient': False, 'allowed': False,
           'woke': False, 'reason': None}
    if not _WAKE_MODULES_OK or os.environ.get('SELF_PULSE_WAKE', '1') == '0':
        out['reason'] = 'wake_disabled'
        return out
    out['enabled'] = True
    out['salient'] = bool(verdict and verdict.get('salient'))
    out['gate'] = {k: (verdict or {}).get(k) for k in
                   ('score', 'novelty', 'salience', 'goal',
                    'hard_bypass', 'z', 'entropy_streak', 'purpose_streak')}
    if not out['salient']:
        out['reason'] = 'gate_rejected'
        return out
    try:
        # 2026-08-06 事件等级映射（级别触发后关键修正）：有漂移告警 → anomaly
        # （可强唤醒，人类被地震吵醒）；慢性态例行唤醒 → routine（交互相位/
        # 休眠/冷却全部生效）。原硬编码 'anomaly' 会让 routine 唤醒绕过全部
        # 刹车 → 自激循环、W 无界增长。指纹仅漂移事件用（去重游标）；
        # routine 走冷却/休眠/体力上限刹车，不做指纹去重。
        ev_type = 'anomaly' if drift_alert else 'routine'
        fp = ''
        if drift_alert:
            fp = hashlib.sha256(('drift:' + drift_alert).encode('utf-8')).hexdigest()[:16]
        allowed, reason, sp = sleep_check(ev_type, fingerprint=fp,
                                          dry_run=dry_run)
        out['allowed'] = allowed
        out['sleep'] = {k: sp.get(k) for k in
                        ('W', 'mode', 'total_wakes',
                         'total_suppressed', 'total_overrides')}
        if not allowed:
            out['reason'] = f'sleep_pressure:{reason}'
            return out
    except Exception as e:
        out['reason'] = f'sleep_error:{type(e).__name__}'
        return out
    try:
        text = build_first_sight()
        out['text_len'] = len(text)
        wr = wake_main(text, mode=os.environ.get('SELF_PULSE_WAKE_MODE',
                                                 'next-heartbeat'),
                       dry_run=dry_run)
        out['woke'] = bool(wr.get('ok'))
        out['wake_status'] = wr.get('status')
        out['wake_error'] = (wr.get('error') or '')[:120]
        out['reason'] = 'woke' if wr.get('ok') else f'wake_failed:{out["wake_error"]}'
    except Exception as e:
        out['reason'] = f'wake_error:{type(e).__name__}'
    return out


# ── 输出通道（全部 fail-open）────────────────────────────────────────────


def publish_bus_event(event_type: str, result: str, detail: str,
                      payload: dict, trace_id: str,
                      dry_run: bool = False) -> dict:
    """v1.1 契约直写事件总线（fcntl 追加 + fsync，幂等 event_id）。fail-open。

    返回事件 dict；dry_run 时只构造不落盘；真实写入失败返回 None。
    """
    event = {
        't': _now_iso(),
        'schema_version': '1.1',
        'event_id': str(uuid.uuid4()),
        'event_type': event_type,
        'producer': 'self_pulse',
        'result': result,
        'trace_id': trace_id,
        'detail': detail[:300],
        'payload': payload or {},
    }
    if dry_run:
        return event
    try:
        with open(_BUS_FILE, 'a', encoding='utf-8') as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            f.write(json.dumps(event, ensure_ascii=False) + '\n')
            f.flush()
            os.fsync(f.fileno())
            fcntl.flock(f, fcntl.LOCK_UN)
        return event
    except Exception:
        return None


def append_sandglass(entry: str, dry_run: bool = False) -> bool:
    if dry_run:
        return False
    try:
        with open(_SAND_FILE, 'a', encoding='utf-8') as f:
            f.write(entry + '\n')
        return True
    except Exception:
        return False


def append_metrics(line: str, dry_run: bool = False) -> bool:
    if dry_run:
        return False
    try:
        with open(_METRICS_FILE, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
        return True
    except Exception:
        return False


def bump_round(max_rounds: int, dry_run: bool = False) -> int:
    """轮次递增（沿用 /tmp/self_pulse_round.txt 机制）。

    1..MAX 递增，到顶重置为 0 并从 1 重新开始（v2：到顶不再写
    "已达最大轮次"噪音行，脉冲持续工作；轮次仅为展示计数）。
    """
    try:
        with open(_ROUND_FILE) as f:
            rnd = int(f.read().strip() or 0)
    except Exception:
        rnd = 0
    if rnd >= max_rounds:
        rnd = 0
        if not dry_run:
            try:
                os.remove(_ROUND_FILE)
            except OSError:
                pass
    rnd += 1
    if not dry_run:
        try:
            with open(_ROUND_FILE, 'w') as f:
                f.write(str(rnd))
        except OSError:
            pass
    return rnd


# ── 测试辅助 ─────────────────────────────────────────────────────────────


def _simulate_metrics(kind: str) -> dict:
    base = {'entropy_ratio': 0.60, 'purpose_coherence': 0.92,
            'last_surprise': 0.05, 'turn_count': 1}
    if kind == 'high_entropy':
        base.update({'entropy_ratio': 0.95, 'purpose_coherence': 0.90,
                     'last_surprise': 0.31})
    elif kind == 'purpose':
        base.update({'entropy_ratio': 0.55, 'purpose_coherence': 0.75,
                     'last_surprise': 0.02})
    return base


def parse_args(argv=None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description='self_pulse 自主脉冲 CLI（真任务化 v2）')
    p.add_argument('--dry-run', action='store_true',
                   help='演练模式：零写入，仅输出将执行的动作')
    p.add_argument('--simulate', choices=['high_entropy', 'purpose', 'normal'],
                   help='模拟画像指标（测试用，绕过 LMS 采集）')
    p.add_argument('--preload-state', metavar='FILE',
                   help='预加载状态文件（测试"连续 N 次"判定用）')
    p.add_argument('--state-file', metavar='FILE', help='覆盖状态文件路径')
    p.add_argument('--bus-file', metavar='FILE', help='覆盖事件总线文件路径')
    p.add_argument('--round-file', metavar='FILE', help='覆盖轮次文件路径')
    p.add_argument('--metrics-file', metavar='FILE', help='覆盖 metrics.jsonl 路径')
    p.add_argument('--sand-file', metavar='FILE', help='覆盖 sandglass.txt 路径')
    return p.parse_args(argv)


# ── 主流程 ───────────────────────────────────────────────────────────────


def main(argv=None) -> dict:
    args = parse_args(argv)
    dry_run = args.dry_run
    max_rounds = int(os.environ.get('SELF_PULSE_MAX_ROUNDS', '5'))

    # 测试隔离：覆盖输出路径
    if args.state_file:
        globals()['_STATE_FILE'] = args.state_file
    if args.bus_file:
        globals()['_BUS_FILE'] = args.bus_file
    if args.round_file:
        globals()['_ROUND_FILE'] = args.round_file
    if args.metrics_file:
        globals()['_METRICS_FILE'] = args.metrics_file
    if args.sand_file:
        globals()['_SAND_FILE'] = args.sand_file

    # 1. 轮次（沿用 /tmp/self_pulse_round.txt 机制）
    rnd = bump_round(max_rounds, dry_run=dry_run)

    # 2. 真实待办源
    pending, first_todo = read_backlog()

    # 3. 指标采集（全只读；--simulate 可绕过 LMS）
    metrics = collect_lms_metrics()
    simulated = False
    if args.simulate:
        metrics = _simulate_metrics(args.simulate)
        simulated = True
    if metrics is not None:
        metrics['simulated'] = simulated
    sand_recent = tail_sandglass(_SAND_FILE)

    # 4. 状态加载 + 漂移判定
    state = load_state(preload=args.preload_state)
    flags, streaks, alerts = judge_drift(metrics, state)

    # 5. 输出分级
    sandglass_entries = []
    bus_events = []
    drift_alert = '；'.join(alerts) if alerts else None
    todo_hash = first_todo[:MAX_TODO_LEN] if first_todo else ''
    todo_new = bool(first_todo and state.get('last_todo_hash') != todo_hash)

    # 5a. 显著性门（每脉冲更新窗口/连续计数/边沿；失败不阻塞，fail-open）
    gate_verdict = None
    if _WAKE_MODULES_OK:
        try:
            gate_ev_type = ('anomaly' if drift_alert
                            else ('alert.todo' if todo_new else 'routine'))
            gate_verdict = salience_judge(gate_ev_type, metrics=metrics,
                                          dry_run=dry_run)
        except Exception:
            gate_verdict = None

    # 5a2. 唤醒链（v2.2 级别触发：salient 即唤醒，不再要求 drift_alert 边沿）
    #   salient 判定通过 → 体力检查 → 醒来第一眼 → POST /hooks/wake
    #   刹车唯一来源 = sleep_pressure（冷却/去重/休眠/交互相位/anomaly override）
    wake_result = None
    if gate_verdict and gate_verdict.get('salient'):
        wake_result = attempt_wake(drift_alert, metrics, rnd,
                                   dry_run=dry_run, verdict=gate_verdict)

    # 5b. 漂移 → sandglass ⚠️ + 总线 anomaly（FAIL，走 alert.anomaly handler）
    if drift_alert:
        sandglass_entries.append(f'{_ts()} | system | ⚠️ self_pulse 漂移告警: {drift_alert}')
        payload = {
            'drift': drift_alert,
            'metrics': {k: metrics.get(k) for k in
                        ('entropy_ratio', 'purpose_coherence',
                         'last_surprise', 'turn_count')},
            'streaks': streaks,
            'round': rnd,
            'recent_sandglass': sand_recent[-1:] if sand_recent else [],
            'wake': wake_result,
        }
        ev = publish_bus_event(
            'anomaly', 'FAIL',
            f'self_pulse 画像漂移告警: {drift_alert}',
            payload,
            f'self_pulse-drift-{int(time.time())}',
            dry_run=dry_run,
        )
        if ev is not None:
            bus_events.append(ev)
            state['last_alert'] = {
                'ts': _now_iso(), 'type': 'drift',
                'detail': drift_alert, 'event_id': ev['event_id'],
                'round': rnd,
            }

    # 5c. 新待办（hash 去重：同一待办不重复刷屏）→ sandglass + 总线 alert.todo
    if todo_new:
        sandglass_entries.append(f'{_ts()} | system | self_pulse 待办提醒: {todo_hash}')
        ev = publish_bus_event(
            'alert.todo', 'OK',
            f'self_pulse 待办提醒: {todo_hash}',
            {'todo': todo_hash, 'pending_count': len(pending), 'round': rnd},
            f'self_pulse-todo-{int(time.time())}',
            dry_run=dry_run,
        )
        if ev is not None:
            bus_events.append(ev)
    state['last_todo_hash'] = todo_hash
    state['last_todo'] = todo_hash

    # 6. 状态持久化（近 5 次快照 + streaks + 漂移态）
    snapshot = {
        'ts': _now_iso(),
        'round': rnd,
        'entropy_ratio': metrics.get('entropy_ratio') if metrics else None,
        'purpose_coherence': metrics.get('purpose_coherence') if metrics else None,
        'last_surprise': metrics.get('last_surprise') if metrics else None,
        'turn_count': metrics.get('turn_count') if metrics else None,
        'drift': flags,
    }
    if metrics is None:
        snapshot['lms_unreachable'] = True
    state['last_5'] = (state.get('last_5') or [])[-(KEEP_SNAPSHOTS - 1):] + [snapshot]
    state['streaks'] = streaks
    state['drift'] = flags
    state['updated_at'] = _now_iso()
    state_saved = save_state(state, dry_run=dry_run)

    # 7. 例行遥测 → metrics.jsonl（任何输出分级下都写）
    metrics_line = json.dumps({
        'ts': _now_iso(),
        'event': 'self_pulse',
        'round': rnd,
        'entropy_ratio': snapshot['entropy_ratio'],
        'purpose_coherence': snapshot['purpose_coherence'],
        'last_surprise': snapshot['last_surprise'],
        'turn_count': snapshot['turn_count'],
        'drift': flags,
        'streaks': streaks,
        'todo': todo_hash or None,
        'sandglass_written': bool(sandglass_entries),
        'bus_events': len(bus_events),
        'simulated': simulated,
        'gate': {k: gate_verdict.get(k) for k in
                 ('salient', 'score', 'novelty', 'salience', 'goal')}
        if gate_verdict else None,
        'wake': wake_result,
    }, ensure_ascii=False)
    metrics_written = append_metrics(metrics_line, dry_run=dry_run)

    # 8. sandglass 叙事写入（仅漂移/新待办，正常态不写 → 噪音治理核心）
    sand_written = False
    for entry in sandglass_entries:
        if append_sandglass(entry, dry_run=dry_run):
            sand_written = True

    return {
        'round': rnd,
        'max_rounds': max_rounds,
        'pending': len(pending),
        'first_todo': todo_hash or None,
        'todo_new': todo_new,
        'metrics': {k: snapshot[k] for k in
                    ('entropy_ratio', 'purpose_coherence',
                     'last_surprise', 'turn_count')},
        'simulated': simulated,
        'drift': flags,
        'streaks': streaks,
        'drift_alert': drift_alert,
        'sandglass_entries': sandglass_entries,
        'sandglass_written': sand_written,
        'bus_events': [
            {'event_type': e['event_type'], 'event_id': e['event_id'],
             'result': e['result'], 'detail': e['detail'][:120]}
            for e in bus_events if e
        ],
        'metrics_written': metrics_written,
        'state_saved': state_saved,
        'dry_run': dry_run,
        'gate_verdict': gate_verdict,
        'wake_result': wake_result,
    }


if __name__ == '__main__':
    try:
        out = main()
        print(json.dumps(out, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
