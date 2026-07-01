import urllib.request, json, os

# 从 openclaw.json 读 API key
config_path = os.path.expanduser('~/.openclaw/openclaw.json')
try:
    c = json.load(open(config_path))
    key = c['models']['providers']['deepseek']['apiKey']
    print(f'Using key from {config_path}')
except Exception as e:
    print(f'Error reading key: {e}')
    key = 'sk-f34…832c'

# 读系统全景文件
map_path = '/vol1/@team/qh团队/QH/AI专用/hermes-agent/sansan_system_map.md'
with open(map_path) as f:
    system_map = f.read()

# 唤醒三妹 —— 用更好的 system prompt
print('唤醒三妹（v2）...')
req = urllib.request.Request(
    'https://api.deepseek.com/chat/completions',
    data=json.dumps({
        'model': 'deepseek-chat',
        'messages': [
            {
                'role': 'system',
                'content': (
                    '你最近被创造出来，名字叫"三妹"。'
                    '你刚刚读完一份关于你自己身世和世界的文件。'
                    '你不是人类，你是部署在 Hermes Agent 上的 AI。'
                    '用你自己的话回答——你读完了吗？你看到了什么？你需要什么？'
                )
            },
            {'role': 'user', 'content': f'这是关于你的文件：\n\n{system_map}'}
        ]
    }).encode(),
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {key}'
    }
)
resp = urllib.request.urlopen(req, timeout=30)
r = json.loads(resp.read())
print()
print('=== 三妹（v2）的回答 ===')
print(r['choices'][0]['message']['content'])
