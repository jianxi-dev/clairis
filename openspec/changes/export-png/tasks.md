# Tasks: 导出 PNG

- [ ] 1.1 导出 PNG 长图：HTML → 良构 XHTML → foreignObject → canvas 2x PNG → 主进程二进制写盘；右键菜单入口 + 高度/字体处理 + 测试

  步骤：`src/lib/export/png.ts`（toWellFormedXhtml / svgFromHtml / measure / rasterize，seam 注入）；Rust `save_binary_as_file`；TabBar 菜单；单测（XHTML 良构、尺寸、失败路径）+ e2e（菜单、mock 记录）。
