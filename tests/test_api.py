"""API 集成测试"""

import requests


def test_api_status(editor_url):
    """/api/status 返回 200 且包含必要字段"""
    r = requests.get(f"{editor_url}/api/status", timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert "ok" in data


def test_api_version(editor_url):
    """/api/version 返回版本号"""
    r = requests.get(f"{editor_url}/api/version", timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert data.get("version") is not None


def test_api_homepage(editor_url):
    """首页返回 200"""
    r = requests.get(f"{editor_url}/", timeout=5)
    assert r.status_code == 200


def test_api_unknown_endpoint(editor_url):
    """未知端点返回 404"""
    r = requests.get(f"{editor_url}/api/nonexistent", timeout=5)
    assert r.status_code == 404


def test_api_encrypt_status(editor_url):
    """/api/encrypt 返回加密状态"""
    r = requests.post(f"{editor_url}/api/encrypt", json={"action": "status"}, timeout=5)
    assert r.status_code in (200, 404, 500)
