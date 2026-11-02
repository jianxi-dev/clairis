#!/usr/bin/env python3
"""配色/布局分析：从网站截图中提取主色板、文字密度、亮度分区、留白率。
用法: python3 analyze.py <png> [--crop fold|scroll1|scroll2]
无 PIL，用纯 Python + zlib 解码 PNG。

同源副本：contentweave/scripts/analyze_image.py（改动需同步两处）。
"""
import sys, zlib, struct, math, json
from collections import Counter


def read_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos = 8
    idat = b''
    plte = None
    trns = None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, bd, ct, comp, filt, inter = struct.unpack('>IIBBBBB', chunk)
        elif typ == b'IDAT':
            idat += chunk
        elif typ == b'PLTE':
            plte = chunk
        elif typ == b'tRNS':
            trns = chunk
        pos += 12 + ln
    raw = zlib.decompress(idat)
    channels = {0:1, 2:3, 3:1, 4:2, 6:4}[ct]
    assert bd == 8, f'bit depth {bd} unsupported'
    bpp = channels
    stride = w * bpp
    out = bytearray()
    prev = bytearray(stride)
    i = 0
    for y in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i+stride]); i += stride
        if f == 1:
            for x in range(bpp, stride): line[x] = (line[x] + line[x-bpp]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x-bpp] if x >= bpp else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x-bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x-bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out += line
        prev = line
    # to RGB
    if ct == 2:
        px = [tuple(out[y*stride+x*3:y*stride+x*3+3]) for y in range(h) for x in range(w)]
    elif ct == 6:
        px = [tuple(out[y*stride+x*4:y*stride+x*4+3]) for y in range(h) for x in range(w)]
    elif ct == 3:
        px = [tuple(plte[o*3:o*3+3]) for o in out[y*stride+x] for y in range(h) for x in range(w)]
    elif ct == 0:
        px = [(v, v, v) for v in out]
    elif ct == 4:
        px = [(v, v, v) for v in out[0::2]]
    return w, h, px


def lum(r, g, b):
    return 0.2126*r + 0.7152*g + 0.0722*b


def bucket(c, n=4):
    return (c[0]//n*n, c[1]//n*n, c[2]//n*n)


def analyze(path, regions=('fold','scroll1','scroll2')):
    w, h, px = read_png(path)
    res = {'file': path, 'w': w, 'h': h}
    # 全图主色（量化到 24 级）
    cnt = Counter(bucket(c, 24) for c in px)
    total = len(px)
    res['palette'] = [('#%02x%02x%02x' % c, round(n/total*100, 1)) for c, n in cnt.most_common(10)]
    # 暗/亮占比
    dark = sum(1 for c in px if lum(*c) < 60)
    light = sum(1 for c in px if lum(*c) > 200)
    res['dark_pct'] = round(dark/total*100, 1)
    res['light_pct'] = round(light/total*100, 1)
    # 亮度分区（横 6 带）——看是否有明显暗色 hero 区
    bands = 6
    band_h = h // bands
    bstats = []
    for i in range(bands):
        seg = px[i*band_h*w:(i+1)*band_h*w]
        avg = sum(lum(*c) for c in seg)/len(seg)
        # 该带主色
        bc = Counter(bucket(c, 24) for c in seg)
        top = bc.most_common(1)[0]
        bstats.append({'band': f'{i*100//bands}-{(i+1)*100//bands}%',
                       'avg_lum': round(avg, 1),
                       'top': '#%02x%02x%02x' % top[0],
                       'top_pct': round(top[1]/len(seg)*100, 1)})
    res['bands'] = bstats
    # 饱和度高的"强调色"像素占比与色相
    accent = Counter()
    acc_n = 0
    for c in px:
        mx, mn = max(c), min(c)
        if mx - mn > 60 and mx > 80:  # 明显彩色
            r, g, b = c
            if r > g and r > b: hue = 'red/orange'
            elif g > r and g > b: hue = 'green'
            elif b > r and b > g: hue = 'blue/purple'
            elif r > 150 and g > 120 and b < 110: hue = 'yellow/amber'
            else: hue = 'other'
            accent[hue] += 1
            acc_n += 1
    res['accent_pct'] = round(acc_n/total*100, 2)
    res['accent_hues'] = dict(accent)
    # 边缘复杂度（文本/图形密度粗估）：横向梯度均值
    gy = 0; n = 0
    for y in range(0, h-1, 4):
        for x in range(0, w-1, 4):
            i = y*w+x
            gy += abs(px[i][0]-px[i+1][0]) + abs(px[i][1]-px[i+1][1]) + abs(px[i][2]-px[i+1][2])
            n += 1
    res['texture'] = round(gy/n, 2)
    return res


if __name__ == '__main__':
    for p in sys.argv[1:]:
        print(json.dumps(analyze(p), ensure_ascii=False))
