"""pytest 配置"""
import pytest
import requests
import subprocess
import time
import os

BASE_URL = "http://127.0.0.1:18888"

@pytest.fixture(scope="session")
def editor_url():
    """返回编辑器基础 URL"""
    return BASE_URL

@pytest.fixture(scope="session")
def editor_healthy():
    """检查编辑器是否运行"""
    try:
        r = requests.get(f"{BASE_URL}/api/status", timeout=5)
        r.raise_for_status()
        return True
    except:
        return False
