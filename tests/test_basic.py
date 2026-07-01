"""冒烟测试 — 验证编辑器基本功能正常"""

def test_status_api(editor_url):
    """/api/status 应该返回 200"""
    import requests
    r = requests.get(f"{editor_url}/api/status", timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert "ok" in data

def test_version_api(editor_url):
    """/api/version 应该返回版本号"""
    import requests
    r = requests.get(f"{editor_url}/api/version", timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert data.get("version") is not None

def test_homepage(editor_url):
    """首页应该返回 200"""
    import requests
    r = requests.get(f"{editor_url}/", timeout=5)
    assert r.status_code == 200
