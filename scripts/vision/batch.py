#!/usr/bin/env python3
"""批量读图：每屏一次调用，输出紧凑结构化结果到 JSONL。

【用法】
    python3 scripts/vision/batch.py <截图目录> <out.jsonl> [文件名前缀...]

    截图按 `<站号>-<名字>-<屏>` 命名，末段决定 KIND：
        fold     首屏
        scroll1  第二屏
        scroll2  第三屏

    大图自动缩到 1600px 宽（macOS sips），缓存到缓存目录避免重复处理。

【为什么用它而不是 vision.py】
强制模型只输出 SERIF/LAYOUT/VISUAL/SCHEME/ACCENT/DETAIL 六个字段，
下游可直接解析成表；vision.py 是自由描述，适合单张深看。

【输出】
每行一条 JSON：{"shot": "...", "SERIF": "...", ...}；失败行带 "ERROR"。
"""
import base64
import glob
import json
import mimetypes
import os
import subprocess
import sys
import urllib.request

AUTH = os.path.expanduser('~/.pi/agent/auth.json')
URL = 'https://api.deepseek.com/chat/completions'
MODEL = 'deepseek-flash'
OPT = os.environ.get('VISION_OPT_DIR') or '/tmp/shots/opt'

PROMPT = """分析这张截图（{kind}）。严格只输出下面 6 行，每行以键名冒号开头，不要任何其它文字、不要编号、不要 markdown：

SERIF: 主标题是 serif 还是 sans-serif？若画面无标题写 none
LAYOUT: 布局形态，选一个：left / center / split / fullmedia / minimal
VISUAL: 主视觉类型，可多选逗号分隔：typography / productscreenshot / photo / abstract / gradient / illustration / video
SCHEME: 明暗，选一个：light / dark / mixed
ACCENT: 识别得到的主强调色，写中文色名+大致色值，如 电光蓝#3060f0；无强调色写 none
DETAIL: 用中文 60-100 字描述构图、背景图形具体是什么、有哪些非文字元素、CTA 位置"""

KIND = {'fold': '首屏', 'scroll1': '第二屏', 'scroll2': '第三屏'}
FIELDS = ('SERIF', 'LAYOUT', 'VISUAL', 'SCHEME', 'ACCENT', 'DETAIL')


def load_key():
    path = os.environ.get('VISION_AUTH') or AUTH
    with open(path) as fh:
        return json.load(fh)['deepseek']['key']


def shrink(path):
    """超过 2MB 的图缩到 1600px 宽，返回实际要读的路径。"""
    if os.stat(path).st_size <= 2_000_000:
        return path
    os.makedirs(OPT, exist_ok=True)
    out = os.path.join(OPT, os.path.basename(path))
    if not os.path.exists(out):
        subprocess.run(['sips', '-Z', '1600', path, '--out', out],
                       capture_output=True)
    return out if os.path.exists(out) else path


def ask(path, kind, key):
    mime = mimetypes.guess_type(path)[0] or 'image/png'
    with open(shrink(path), 'rb') as fh:
        b64 = base64.b64encode(fh.read()).decode()
    body = json.dumps({
        'model': MODEL,
        'messages': [{'role': 'user', 'content': [
            {'type': 'text', 'text': PROMPT.format(kind=kind)},
            {'type': 'image_url',
             'image_url': {'url': 'data:%s;base64,%s' % (mime, b64)}},
        ]}],
        'max_tokens': 4000,
    }).encode()
    req = urllib.request.Request(URL, data=body, headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
    })
    with urllib.request.urlopen(req, timeout=600) as resp:
        msg = json.load(resp)['choices'][0]['message']
    txt = (msg.get('content') or '').strip() or (msg.get('reasoning_content') or '')
    parsed = {}
    for line in txt.splitlines():
        line = line.strip().lstrip('*-# ')
        upper = line.upper()
        for k in FIELDS:
            if upper.startswith(k + ':') or upper.startswith(k + '：'):
                parsed[k] = line.split(':', 1)[-1].split('：', 1)[-1].strip()
    return parsed, txt


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    src_dir, out_path = argv[1], argv[2]
    prefixes = argv[3:] or None
    key = load_key()
    files = sorted(glob.glob(os.path.join(src_dir, '*.png')))
    with open(out_path, 'w') as fh:
        for path in files:
            base = os.path.basename(path)[:-4]
            if prefixes and not any(base.startswith(x) for x in prefixes):
                continue
            kind = KIND.get(base.rsplit('-', 1)[-1], base.rsplit('-', 1)[-1])
            try:
                res, _raw = ask(path, kind, key)
            except Exception as exc:  # noqa: BLE001 - 逐张容错，单张失败不中断批次
                res = {'ERROR': str(exc)}
            fh.write(json.dumps({'shot': base, **res}, ensure_ascii=False) + '\n')
            fh.flush()
            print(base, '->', 'OK' if 'ERROR' not in res else res['ERROR'], flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
