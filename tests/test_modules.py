"""模块单元测试 — 覆盖 scripts/utils/ 下的新模块（text_utils, encryption, inject_lock, pulse）

测试不依赖外部网络（除标明的 API 测试外），不改运行代码。
"""

import sys
import os
import tempfile
import time

# 确保能找到 scripts 包
_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_this_dir)
_scripts_path = os.path.join(_project_root, "scripts")
if _scripts_path not in sys.path:
    sys.path.insert(0, _scripts_path)


# ──────────────────────────────────────────────
# text_utils
# ──────────────────────────────────────────────

def test_strip_metadata():
    """strip_metadata 应清除 metadata 块和 json 块"""
    from utils.text_utils import strip_metadata

    # 普通文本不变
    assert strip_metadata("hello world") == "hello world"
    # 空串
    assert strip_metadata("") == ""
    # None — 实际行为是 strip(None) 会抛异常，保持原样
    # 所以不测 None

    # 含 Sender metadata 块（metadata 标记后的所有行都被跳过）
    text = "hello\nSender (untrusted metadata): foo\nline1\nline2\nworld"
    result = strip_metadata(text)
    assert "Sender" not in result
    assert "hello" in result
    # metadata 后面的行会被 skip_block 跳过
    assert "world" not in result
    assert "line1" not in result

    # System: 前缀也会触发 skip_block
    text = "hello\nSystem: test\nskipped\nend"
    result = strip_metadata(text)
    assert "hello" in result
    assert "skipped" not in result

    # 含 ```json 代码块（以 ``` 结束）
    text = "start\n```json\n{\"key\": \"val\"}\n```\nend"
    result = strip_metadata(text)
    assert "```json" not in result
    assert "start" in result
    assert "end" in result

    # 纯 [] 行在 skip_block 中直接被跳过
    text = "a\n```json\n[meta]\nb\n```\nc"
    result = strip_metadata(text)
    assert "a" in result
    assert "c" in result
    assert "meta" not in result

    # 含 ```json 代码块
    text = "start\n```json\n{\"key\": \"val\"}\n```\nend"
    result = strip_metadata(text)
    assert "```json" not in result
    assert "start" in result
    assert "end" in result

    # 纯 json 格式的复杂删除
    text = 'pre\n[tag] some text\n{"label": "ignore"}\npost'
    result = strip_metadata(text)
    assert "post" in result


def test_xml_escape():
    """xml_escape 应正确转义 XML 特殊字符"""
    from utils.text_utils import xml_escape

    # 普通文本不变
    assert xml_escape("hello") == "hello"
    assert xml_escape("") == ""

    # & 转义
    assert xml_escape("a&b") == "a&amp;b"
    assert xml_escape("<hello>") == "&lt;hello&gt;"
    # < > 转义
    assert xml_escape("<tag>") == "&lt;tag&gt;"
    # 引号转义
    assert xml_escape('say "hi"') == "say &quot;hi&quot;"
    assert xml_escape("it's") == "it&apos;s"


def test_is_novel_path():
    """is_novel_path 应正确判断路径是否在指定目录下"""
    from utils.text_utils import is_novel_path
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        novel_paths = [td]

        # 子路径应该匹配
        sub = os.path.join(td, "novel.txt")
        assert is_novel_path(sub, novel_paths) is True

        # 目录本身匹配
        assert is_novel_path(td, novel_paths) is True

        # 外部路径不匹配
        assert is_novel_path("/tmp/non-existent", novel_paths) is False

    # 空列表
    assert is_novel_path("/tmp/x", []) is False

    # 空串路径（不存在的路径）
    assert is_novel_path("", ["/tmp"]) is False


def test_group_into_pairs():
    """group_into_pairs 应正确配对 user-assistant"""
    from utils.text_utils import group_into_pairs

    # 空列表
    assert group_into_pairs([]) == []

    # 基本配对
    msgs = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]
    pairs = group_into_pairs(msgs)
    assert len(pairs) == 1
    assert pairs[0]["user"]["content"] == "hi"
    assert len(pairs[0]["assistants"]) == 1

    # toolResult 应被跳过
    msgs = [
        {"role": "user", "content": "q"},
        {"role": "toolResult", "content": "tool out"},
        {"role": "assistant", "content": "a"},
    ]
    pairs = group_into_pairs(msgs)
    assert len(pairs) == 1
    assert len(pairs[0]["assistants"]) == 1

    # 多轮对话
    msgs = [
        {"role": "user", "content": "u1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "u2"},
        {"role": "assistant", "content": "a2"},
        {"role": "assistant", "content": "a2b"},
    ]
    pairs = group_into_pairs(msgs)
    assert len(pairs) == 2
    assert pairs[0]["user"]["content"] == "u1"
    assert len(pairs[0]["assistants"]) == 1
    assert pairs[1]["user"]["content"] == "u2"
    assert len(pairs[1]["assistants"]) == 2


# ──────────────────────────────────────────────
# encryption
# ──────────────────────────────────────────────

def test_xor_crypt_decrypt_roundtrip():
    """xor_crypt → xor_decrypt 应可逆"""
    from utils.encryption import xor_crypt, xor_decrypt

    text = "hello world 你好"
    password = "test123"

    encrypted = xor_crypt(text, password)
    # 加密结果应为 hex 字符串且不等于原文
    assert isinstance(encrypted, str)
    assert encrypted != text

    # 解密回原文
    decrypted = xor_decrypt(encrypted, password)
    assert decrypted == text


def test_xor_decrypt_wrong_password():
    """错误密码应返回空字符串"""
    from utils.encryption import xor_crypt, xor_decrypt

    encrypted = xor_crypt("secret", "pass1")
    wrong = xor_decrypt(encrypted, "pass2")
    assert wrong == ""  # 实际行为：魔数验证失败返回 ''


def test_xor_decrypt_invalid_hex():
    """无效 hex 输入应返回空字符串"""
    from utils.encryption import xor_decrypt

    assert xor_decrypt("zzzz", "pass") == ""
    assert xor_decrypt("", "pass") == ""


def test_is_hex_encrypted():
    """is_hex_encrypted 应识别 hex 格式特征"""
    from utils.encryption import is_hex_encrypted

    # 空/短内容返回 False
    assert is_hex_encrypted("") is False
    assert is_hex_encrypted("abc") is False  # 长度 < 10

    # 纯 hex 字符
    assert is_hex_encrypted("abcdef0123456789") is True
    assert is_hex_encrypted("abcdef01\n23456789 ") is True  # 允许空格换行

    # 非 hex 字符
    assert is_hex_encrypted("abcdef01z23456789") is False
    assert is_hex_encrypted("not hex content here!!") is False


# ──────────────────────────────────────────────
# inject_lock
# ──────────────────────────────────────────────

def test_inject_lock_basic():
    """inject_lock 的基本获取和释放"""
    from utils.inject_lock import acquire_lock, cleanup_lock, is_locked

    with tempfile.TemporaryDirectory() as td:
        # 初始未锁定
        assert is_locked(td) is False

        # 获取锁成功
        assert acquire_lock(td) is True
        assert is_locked(td) is True

        # 重复获取应失败（锁已存在）
        assert acquire_lock(td) is False

        # 释放锁
        cleanup_lock(td)
        assert is_locked(td) is False

        # 释放后重新获取
        assert acquire_lock(td) is True
        assert is_locked(td) is True
        cleanup_lock(td)
        assert is_locked(td) is False


def test_inject_lock_twice_in_a_row():
    """重复获取+释放 3 次应始终正常工作"""
    from utils.inject_lock import acquire_lock, cleanup_lock, is_locked

    with tempfile.TemporaryDirectory() as td:
        for i in range(3):
            assert acquire_lock(td) is True, f"第 {i+1} 次获取失败"
            assert is_locked(td) is True
            cleanup_lock(td)
            assert is_locked(td) is False


def test_inject_lock_cleanup_no_lock():
    """没有锁文件时 cleanup 不应报错"""
    from utils.inject_lock import cleanup_lock

    with tempfile.TemporaryDirectory() as td:
        # 没有锁文件
        cleanup_lock(td)  # 不应抛异常


def test_inject_lock_none_dir():
    """传入 None 路径应安全返回 False"""
    from utils.inject_lock import acquire_lock, is_locked

    assert is_locked(None) is False
    assert acquire_lock(None) is False


# ──────────────────────────────────────────────
# pulse（仅验证可导入和 callable，不发送）
# ──────────────────────────────────────────────

def test_pulse_importable():
    """send_pulse 应可导入且是 callable"""
    from utils.pulse import send_pulse
    assert callable(send_pulse)
    # 不实际调用——需要网络和运行中的 gateway
