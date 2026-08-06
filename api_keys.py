# 编辑器API密钥配置
# 从环境变量读取，不硬编码在代码中

import os

def get_api_keys():
    """返回模型配置，从环境变量读取密钥"""
    return {
        'deepseek-chat': {
            'url': 'https://api.deepseek.com/chat/completions',
            'key': os.environ.get('DEEPSEEK_API_KEY', ''),
            'provider': 'DeepSeek'
        },
        'GLM-Z1-Flash': {
            'url': 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            'key': os.environ.get('GLM_API_KEY', ''),
            'provider': 'GLM'
        },
        'hunyuan-instruct': {
            'url': 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
            'key': os.environ.get('HUNYUAN_API_KEY', ''),
            'provider': '混元',
            'model': 'hunyuan-2.0-instruct-20251111'
        },
        'hunyuan-thinking': {
            'url': 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
            'key': os.environ.get('HUNYUAN_API_KEY', ''),
            'provider': '混元',
            'model': 'hunyuan-2.0-thinking-20251109'
        },
    }