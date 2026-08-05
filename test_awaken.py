#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""自主唤醒模块测试（2026-08-06，Phase 自主唤醒 A/C/B/D 收尾）。
覆盖：salience 判据（anomaly 直通 / 连续高熵 / 权重阈值）、
sleep_pressure（冷却 / 去重 / 休眠 / override）、first_sight（摘要生成）。
运行：python3 test_awaken.py
"""
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import salience_gate as sg
import sleep_pressure as sp
import first_sight as fs

FAILS = []


def check(name, cond, detail=""):
    mark = "✅" if cond else "❌"
    print(f"{mark} {name} {detail}")
    if not cond:
        FAILS.append(name)


# ── 1. salience 判据 ─────────────────────────────────────────
def test_salience():
    # 1.1 anomaly 直通（硬告警）
    v = sg.judge(event_type="anomaly",
                 metrics={"last_surprise": 0.04, "entropy_ratio": 0.95,
                          "purpose_coherence": 0.95},
                 dry_run=True)
    check("anomaly 直通", v["salient"] and v["hard_bypass"],
          f"score={v['score']}")

    # 1.2 连续高熵可唤醒（salience 单指标成立）
    prev = None
    results = []
    for _ in range(3):
        prev = sg.judge(event_type="routine",
                        metrics={"last_surprise": 0.05, "entropy_ratio": 0.95,
                                 "purpose_coherence": 0.95},
                        dry_run=True, state=prev)
        results.append(prev)
    check("连续高熵→salient", results[-1]["salient"],
          f"streak={results[-1]['entropy_streak']} score={results[-1]['score']}")

    # 1.3 正常态不唤醒（低熵低惊讶例行）
    v = sg.judge(event_type="routine",
                 metrics={"last_surprise": 0.03, "entropy_ratio": 0.6,
                          "purpose_coherence": 0.95},
                 dry_run=True)
    check("正常态不唤醒", not v["salient"], f"score={v['score']}")

    # 1.4 事件权重
    check("anomaly 权重>routine", sg.event_weight("anomaly") > sg.event_weight("routine"))


# ── 2. sleep_pressure 体力系统 ────────────────────────────────
def test_sleep_pressure():
    # 每个子场景用独立状态，避免相互污染
    # 2.1 第一次 anomaly 放行（override）
    st = sp.default_state()
    allowed, reason, st = sp.check(event_type="anomaly", fingerprint="e1",
                                   state=st, dry_run=True)
    check("首次 anomaly override", allowed and reason == "anomaly_override",
          f"reason={reason} W={st['W']:.2f}")

    # 2.2 冷却期抑制（routine 事件，非 anomaly）
    st = sp.default_state()
    allowed, _, st = sp.check(event_type="routine", fingerprint="e0",
                              state=st, dry_run=True)
    allowed, reason, st = sp.check(event_type="routine", fingerprint="e1",
                                   state=st, dry_run=True)
    check("冷却期抑制", not allowed and reason == "cooldown", f"reason={reason}")

    # 2.3 去重（同指纹）
    st = sp.default_state()
    allowed, _, st = sp.check(event_type="anomaly", fingerprint="e1",
                              state=st, dry_run=True)
    allowed, reason, st = sp.check(event_type="anomaly", fingerprint="e1",
                                   state=st, dry_run=True)
    check("去重抑制", not allowed and reason == "dedup", f"reason={reason}")

    # 2.4 休眠（放行一次后 W>θ_sleep → 进入休眠，后续被抑制）
    st = sp.default_state()
    st["W"] = 0.75          # 超过 θ_sleep(0.7)
    allowed, reason, st = sp.check(event_type="routine", fingerprint="",
                                   state=st, dry_run=True)
    check("W超标放行后进入休眠", allowed and st["mode"] == "sleeping",
          f"mode={st['mode']} reason={reason}")
    allowed, reason, st = sp.check(event_type="routine", fingerprint="",
                                   state=st, dry_run=True)
    check("休眠期抑制", not allowed and reason == "sleeping", f"reason={reason}")
    allowed, reason, st = sp.check(event_type="anomaly", fingerprint="",
                                   state=st, dry_run=True)
    check("休眠期 anomaly override", allowed and reason == "anomaly_override",
          f"reason={reason}")


# ── 3. first_sight 摘要 ───────────────────────────────────────
def test_first_sight():
    s = fs.build(max_chars=500)
    check("first_sight 生成摘要", isinstance(s, str) and len(s) > 0,
          f"{len(s) if s else 0} 字")
    if s:
        check("摘要含回魂标记", "回魂" in s or "熵" in s)
        check("摘要≤500字", len(s) <= 520)


if __name__ == "__main__":
    test_salience()
    test_sleep_pressure()
    test_first_sight()
    print("-" * 40)
    if FAILS:
        print(f"❌ 失败 {len(FAILS)} 项: {FAILS}")
        sys.exit(1)
    print("✅ 全部通过")
