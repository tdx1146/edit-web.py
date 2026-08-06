#!/usr/bin/env python3
"""
姐姐 OpenClaw 配置一键修复脚本
每次重装后运行，修复：
1. Gateway 端口 → 16878（配合轻如烟编辑器）
2. thinking 模式配置
3. DeepSeek 1M 上下文
4. 混元 provider 配置
"""

import json
import os
import sys

CONFIG_PATH = "/vol1/@apphome/trim.openclaw/data/home/.openclaw/openclaw.json"

# 标准配置
STANDARD_CONFIG = {
    "gateway": {
        "port": 16878,  # 轻如烟编辑器默认端口
        "mode": "local",
        "bind": "loopback",
        "trustedProxies": ["127.0.0.1", "::1"],
        "controlUi": {
            "enabled": True,
            "basePath": "/app/trim-openclaw/default",
            "allowedOrigins": ["*"],
            "allowInsecureAuth": True,
            "dangerouslyDisableDeviceAuth": True
        }
    },
    "agents": {
        "defaults": {
            "thinkingDefault": "high",  # 思考模式默认高
            "models": {
                "deepseek/deepseek-v4-flash": {},
                "deepseek/deepseek-v4-pro": {},
                "astron2/astron-code-latest": {}
            },
            "workspace": "/vol1/@apphome/trim.openclaw/data/workspace"
        }
    },
    "models": {
        "providers": {
            "deepseek": {
                "api": "openai-completions",
                "baseUrl": "https://api.deepseek.com",
                "contextTokens": 1000000,  # 1M 上下文
                "auth": "api-key"
            },
            "astron2": {
                "api": "openai-completions",
                "baseUrl": "https://maas-coding-api.cn-huabei-1.xf-yun.com/v2"
            },
            # 混元可选（需要配置 API key）
            # "hunyuan": {
            #     "api": "openai-completions",
            #     "baseUrl": "https://api.hunyuan.cloud.tencent.com/v1",
            #     "contextTokens": 256000
            # }
        }
    }
}

def fix_config():
    """读取配置，应用标准值，保存"""
    
    # 读取现有配置
    if not os.path.exists(CONFIG_PATH):
        print(f"❌ 配置文件不存在: {CONFIG_PATH}")
        return False
    
    with open(CONFIG_PATH, 'r') as f:
        config = json.load(f)
    
    print("📋 当前配置问题:")
    issues = []
    
    # 检查 Gateway 端口
    current_port = config.get("gateway", {}).get("port")
    if current_port != 16878:
        issues.append(f"  ❌ Gateway 端口: {current_port} → 应为 16878")
    else:
        print(f"  ✅ Gateway 端口: {current_port}")
    
    # 检查 thinking
    thinking = config.get("agents", {}).get("defaults", {}).get("thinkingDefault")
    if thinking is None:
        issues.append(f"  ❌ thinkingDefault: null → 应为 'high'")
    else:
        print(f"  ✅ thinkingDefault: {thinking}")
    
    # 检查 DeepSeek 上下文
    deepseek_ctx = config.get("models", {}).get("providers", {}).get("deepseek", {}).get("contextTokens")
    if deepseek_ctx != 1000000:
        issues.append(f"  ❌ DeepSeek 上下文: {deepseek_ctx} → 应为 1000000")
    else:
        print(f"  ✅ DeepSeek 上下文: {deepseek_ctx}")
    
    if not issues:
        print("\n✅ 配置正确，无需修复")
        return True
    
    print("\n🔧 需要修复:")
    for issue in issues:
        print(issue)
    
    # 应用修复
    print("\n⚙️ 正在修复...")
    
    # 修复 Gateway 端口
    if "gateway" not in config:
        config["gateway"] = {}
    config["gateway"]["port"] = 16878
    
    # 修复 thinking
    if "agents" not in config:
        config["agents"] = {}
    if "defaults" not in config["agents"]:
        config["agents"]["defaults"] = {}
    config["agents"]["defaults"]["thinkingDefault"] = "high"
    
    # 修复 DeepSeek 上下文（保留已有的 API key）
    if "models" not in config:
        config["models"] = {}
    if "providers" not in config["models"]:
        config["models"]["providers"] = {}
    if "deepseek" not in config["models"]["providers"]:
        config["models"]["providers"]["deepseek"] = {}
    
    deepseek = config["models"]["providers"]["deepseek"]
    deepseek["contextTokens"] = 1000000
    # 保留其他配置（API key、baseUrl 等）
    
    # 保存配置
    with open(CONFIG_PATH, 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"✅ 配置已保存到: {CONFIG_PATH}")
    
    # 验证
    print("\n📋 修复后配置:")
    print(f"  ✅ Gateway 端口: {config['gateway']['port']}")
    print(f"  ✅ thinkingDefault: {config['agents']['defaults']['thinkingDefault']}")
    print(f"  ✅ DeepSeek 上下文: {config['models']['providers']['deepseek']['contextTokens']}")
    
    return True

if __name__ == "__main__":
    print("🌫️ 姐姐 OpenClaw 配置一键修复")
    print("=" * 50)
    success = fix_config()
    if success:
        print("\n💡 提示: 需要重启 Gateway 使配置生效")
        print("   命令: sudo -S -u trim.openclaw openclaw gateway stop && openclaw gateway")
    sys.exit(0 if success else 1)