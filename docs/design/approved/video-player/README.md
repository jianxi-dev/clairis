---
title: "已批准的视频播放器增强设计（播放列表 / 循环 / 快捷键 / 多字幕 / 音频 / 笔记联动）。"
type: design
status: accepted
last_updated: 2026-08-30
source_of_truth: supporting
---

# video-player

已批准的视频播放器增强设计：播放列表（同目录媒体文件）+ 三态循环 + 快捷键体系（N/P/L/C/X/T）+ 多字幕（上下位置切换）+ MP3 音频 + 时间戳笔记（一期）。

## 设计要点

ArtPlayer 5.4.0 之上增强：播放列表抽屉（`switchUrl` 切集，不重建实例）、单集/列表循环状态机（与 `option.loop` 互斥）、控制条自定义控件（播放列表/循环/字幕/笔记/快捷键说明）、字幕轨道切换与上下位置、音频类型接入（`FileKind` 加 `"audio"`）、时间戳笔记写入 inbox 或插入当前 md 编辑器。

## 权威位置

- **行为规格（canonical）**：`openspec/specs/`（本设计实施后需同步 delta spec；当前为 supporting 设计稿）
- **本目录**：批准设计稿（supporting），不参与行为裁定

## 文件清单

| 文件 | 说明 |
| --- | --- |
| [spec.md](./spec.md) | 批准设计规格 |