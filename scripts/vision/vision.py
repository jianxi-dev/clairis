#!/usr/bin/env python3
"""用 DeepSeek 视觉 API 直读图片（绕开 pi 对文本模型的 input:["text"] 限制）。

【为什么存在】
本机 pi 的默认 provider 模型只接受文本，内置 read 工具读图会报
"Current model does not support images"。本脚本不依赖模型视觉能力，
直接用 HTTP 调 DeepSeek 多模态端点，把 base64 图片发过去。

【用法】
    python3 scripts/vision/vision.py <img> [<img2> ...] [-p PROMPT] [-n MAXTOKENS]

    -p  提示词（默认是通用界面描述提示词）
    -n  max_tokens（默认 6000；deepseek-flash 是 reasoning 模型，给小了 content 会空）

【输出】
    模型回答正文 + 一行 [finish_reason=...]

【注意】
deepseek-flash 是 reasoning 模型：先吃 reasoning_content，content 可能为空，
因此 max_tokens 要给足，并按 content -> reasoning_content 兜底。

脚本可能编造具体细节（按钮文字、精确色值）。凡是硬数字/精确颜色，
用同目录的 analyze.py 从像素里算，不要信本脚本。

同源副本：contentweave/scripts/vision.py（改动需同步两处）。
"""
import base64
import json
import mimetypes
import os
import sys
import urllib.request

AUTH = os.path.expanduser('~/.pi/agent/auth.json')
URL = 'https://api.deepseek.com/chat/completions'
MODEL = 'deepseek-flash'
DEFAULT = (
    '详细描述这张截图：整体布局、主要区域、排版层级、配色、视觉母题、'
    '非文字元素的位置。只描述真实看到的，不确定的地方明确说不确定。'
)


def load_key():
    path = os.environ.get('VISION_AUTH') or AUTH
    with open(path) as fh:
        return json.load(fh)['deepseek']['key']


def data_url(path):
    mime = mimetypes.guess_type(path)[0] or 'image/png'
    with open(path, 'rb') as fh:
        return 'data:%s;base64,%s' % (mime, base64.b64encode(fh.read()).decode())


def ask(imgs, prompt, max_tokens=6000):
    content = [{'type': 'text', 'text': prompt}]
    for p in imgs:
        content.append({'type': 'image_url', 'image_url': {'url': data_url(p)}})
    body = json.dumps({
        'model': MODEL,
        'messages': [{'role': 'user', 'content': content}],
        'max_tokens': max_tokens,
    }).encode()
    req = urllib.request.Request(URL, data=body, headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + load_key(),
    })
    with urllib.request.urlopen(req, timeout=600) as resp:
        data = json.load(resp)
    choice = data['choices'][0]
    msg = choice['message']
    out = (msg.get('content') or '').strip()
    if not out:
        out = '[content 为空，以下为 reasoning_content]\n' + (msg.get('reasoning_content') or '')
    return out, choice.get('finish_reason')


def main(argv):
    args = list(argv[1:])
    prompt, n = DEFAULT, 6000
    if '-p' in args:
        i = args.index('-p')
        prompt = args[i + 1]
        args = args[:i] + args[i + 2:]
    if '-n' in args:
        i = args.index('-n')
        n = int(args[i + 1])
        args = args[:i] + args[i + 2:]
    if not args:
        print(__doc__)
        return 2
    out, fin = ask(args, prompt, n)
    print(out)
    print('\n[finish_reason=%s]' % fin)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
