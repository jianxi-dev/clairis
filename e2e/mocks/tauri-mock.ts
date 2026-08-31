/**
 * Tauri API Mock — enables full E2E testing in browser.
 * Injected via Playwright addInitScript before the app loads.
 */

// Mock invoke responses per command
const mockResponses: Record<string, unknown> = {
  load_config: {
    fontSize: 16,
    headingColors: null,
    ollamaEndpoint: "http://localhost:11434",
    openaiEndpoint: "https://api.openai.com",
    openaiModel: "gpt-4o-mini",
    translationProvider: "ollama",
    sourceLang: "en",
    targetLang: "zh-CN",
    theme: "system",
    sidebarLeftVisible: true,
    sidebarRightVisible: false,
    sidebarLeftWidth: 220,
    sidebarRightWidth: 320,
    recentFiles: [],
  },
  open_file: {
    content: `# 测试文档\n\n## 第一节\n\n这是测试内容。\n\n## 第二节\n\n更多内容。\n\n### 子节\n\n嵌套标题。\n\n- 列表项1\n- 列表项2\n\n\`\`\`js\nconsole.log("hello")\n\`\`\`\n\n> 引用文本\n\n**粗体** 和 *斜体*\n\n- [ ] 待办\n- [x] 已完成`,
    path: "/Users/test/documents/测试文档.md",
    file_size: 350,
  },
  open_file_direct: {
    content: `# 另一个文件\n\n不同内容。`,
    path: "/Users/test/documents/另一个.md",
    file_size: 40,
  },
  save_file: { path: "/Users/test/documents/测试文档.md" },
  save_as_file: { path: "/Users/test/documents/新文件.md" },
  flatten_files: {
    entries: [
      {
        name: "测试文档.md",
        path: "/Users/test/测试文档.md",
        relative_path: "测试文档.md",
        is_dir: false,
        size: 350,
      },
      {
        name: "另一个.md",
        path: "/Users/test/另一个.md",
        relative_path: "另一个.md",
        is_dir: false,
        size: 40,
      },
      {
        name: "笔记",
        path: "/Users/test/笔记",
        relative_path: "笔记",
        is_dir: true,
        size: 0,
      },
      {
        name: "周报.md",
        path: "/Users/test/笔记/周报.md",
        relative_path: "笔记/周报.md",
        is_dir: false,
        size: 120,
      },
      {
        name: "会议.md",
        path: "/Users/test/笔记/会议.md",
        relative_path: "笔记/会议.md",
        is_dir: false,
        size: 200,
      },
    ],
    truncated: false,
  },
  pick_folder: "/Users/test/documents",
  read_directory: {
    entries: [
      {
        name: "测试文档.md",
        path: "/Users/test/测试文档.md",
        is_dir: false,
        size: 350,
      },
      {
        name: "另一个.md",
        path: "/Users/test/另一个.md",
        is_dir: false,
        size: 40,
      },
      { name: "笔记", path: "/Users/test/笔记", is_dir: true, size: 0 },
    ],
    path: "/Users/test",
  },
  get_file_info: {
    path: "/Users/test/测试文档.md",
    size: 350,
    is_dir: false,
    modified: 1719000000,
  },
  get_size_limits: [500000, 2000000],
  register_media_path: null,
  list_media_in_dir: [
    {
      path: "/Users/test/clip.mp4",
      name: "clip.mp4",
      kind: "video",
      target: "",
    },
    {
      path: "/Users/test/song.mp3",
      name: "song.mp3",
      kind: "audio",
      target: "",
    },
  ],
};

// Mock invoke function
function mockInvoke(cmd: string, args?: Record<string, unknown>): unknown {
  // Handle commands that take args
  if (cmd === "open_file_direct" && args?.path) {
    return {
      content: mockResponses.open_file_direct
        ? (mockResponses.open_file_direct as Record<string, unknown>).content
        : "# File",
      path: args.path as string,
      file_size: 40,
    };
  }
  if (cmd === "save_file" && args) {
    return { path: args.path };
  }
  if (cmd === "flatten_files" && args?.path) {
    return mockResponses.flatten_files;
  }
  if (cmd === "pick_folder") {
    return mockResponses.pick_folder;
  }
  if (cmd === "register_media_path") {
    return null;
  }
  if (cmd === "list_media_in_dir") {
    return [
      {
        path: "/Users/test/clip.mp4",
        name: "clip.mp4",
        kind: "video",
        target: "",
      },
      {
        path: "/Users/test/song.mp3",
        name: "song.mp3",
        kind: "audio",
        target: "",
      },
    ];
  }
  // Default: return stored mock response
  if (cmd in mockResponses) {
    return mockResponses[cmd];
  }
  console.warn(`[TauriMock] No mock for command: ${cmd}`);
  return null;
}

// Set up the mock before any module loads
(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
  metadata: {
    currentWindow: { label: "main" },
    currentWebview: { label: "main" },
  },
  invoke: mockInvoke,
  // 与真实 Tauri convertFileSrc 一致：整个路径 encodeURIComponent
  // （buildAssetUrl 依赖前缀提取，不编码会取错 lastIndexOf("/") 导致路径重复）
  convertFileSrc: (path: string) =>
    `asset://localhost/${encodeURIComponent(path)}`,
};

// Also mock the @tauri-apps/api/core module
// Playwright can't intercept ES module imports, so we patch window.__TAURI_INTERNALS__
// The app checks: window.__TAURI_INTERNALS__ !== undefined

// Mock the webview drag-drop API
(window as unknown as Record<string, unknown>).__TAURI_DRAG_DROP__ = {
  onDragDropEvent: () => Promise.resolve(() => {}),
};
