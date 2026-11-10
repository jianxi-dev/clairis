// Tauri API Mock + Store bridge — injected before app loads
window.__TAURI_INTERNALS__ = {
  metadata: {},
  invoke: mockInvoke,
  // 与真实 Tauri convertFileSrc 一致：整个路径 encodeURIComponent
  // （buildAssetUrl 依赖前缀提取，不编码会取错 lastIndexOf("/") 导致路径重复）
  convertFileSrc: function (path) {
    return "asset://localhost/" + encodeURIComponent(path);
  },
};

// Expose store access for E2E tests
window.__biaoyue_store__ = null;
window.__biaoyue_saved_files__ = [];
window.__biaoyue_saved_binaries__ = [];
window.__biaoyue_openFile__ = function(path, content, title) {
  if (!window.__biaoyue_store__) return false;
  var store = window.__biaoyue_store__.getState();
  store.openFile(path, content);
  store.addRecentFile(path, title || path.split('/').pop());
  return true;
};

// ── AI entry (C4) mock state ─────────────────────────────────
// config 持久化到 localStorage：模拟真实「配置文件在重启后仍在」，
// 否则 reload 后 load_config 又回到默认响应，无法测持久化。
var aiState = { config: null, snapshots: [], seq: 0 };
try {
  var __persisted = localStorage.getItem("__mock_config");
  if (__persisted) { aiState.config = JSON.parse(__persisted); }
} catch (e) { /* 忽略 */ }

// ── 扩展包管理（#184）mock state ─────────────────────────────
var extensionPackages = [
  {
    id: "builtin-reading",
    name: "阅读增强",
    version: "1.0.0",
    description: "内置阅读扩展",
    source: "builtin",
    enabled: true,
    dir: null,
    skill: "# 阅读增强\n\n内置扩展：提供阅读辅助能力。",
  },
  {
    id: "builtin-outline",
    name: "大纲导航",
    version: "1.0.0",
    description: "内置大纲扩展",
    source: "builtin",
    enabled: true,
    dir: null,
    skill: "# 大纲导航\n\n内置扩展：提供文档大纲导航。",
  },
];
window.__biaoyue_extension_packages__ = extensionPackages;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function findExtensionPackage(id) {
  for (var i = 0; i < extensionPackages.length; i++) {
    if (extensionPackages[i].id === id) return extensionPackages[i];
  }
  return null;
}

// 系统钥匙串 mock：只存 service:account → key，绝不落配置/存储
window.__biaoyue_keyring__ = {};
window.__biaoyue_ai_config__ = function () {
  return aiState.config ? JSON.parse(JSON.stringify(aiState.config)) : null;
};

function aiPad(n, w) {
  var s = String(n);
  while (s.length < (w || 2)) s = "0" + s;
  return s;
}

function aiSnapshotName() {
  aiState.seq += 1;
  var d = new Date();
  var stamp =
    d.getUTCFullYear() + "-" + aiPad(d.getUTCMonth() + 1) + "-" + aiPad(d.getUTCDate()) +
    "T" + aiPad(d.getUTCHours()) + "-" + aiPad(d.getUTCMinutes()) + "-" + aiPad(d.getUTCSeconds()) +
    "-" + aiPad(d.getUTCMilliseconds() * 1000, 6) + "Z";
  return "settings-" + stamp + "-" + aiState.seq + ".json";
}

function aiSnapshot() {
  var name = aiSnapshotName();
  aiState.snapshots.push({ name: name, config: JSON.parse(JSON.stringify(aiState.config)) });
  while (aiState.snapshots.length > 10) aiState.snapshots.shift();
  return name;
}

// 模拟「AI 改了配置」：先快照当前状态，再应用新值（与真实 patch_config 语义一致）
window.__biaoyue_ai_theme__ = function(theme) {
  if (!aiState.config) return null;
  aiSnapshot();
  aiState.config.theme = theme;
  return JSON.parse(JSON.stringify(aiState.config));
};

function aiRunAgentTurn(messages) {
  var text = (messages || []).map(function (m) { return (m && m.content) || ""; }).join("\n");
  if (text.indexOf("深色") >= 0 || text.indexOf("dark") >= 0) {
    window.__biaoyue_ai_theme__("dark");
    return { text: "已切换到深色主题。", turns: 2, tool_calls: ["patch_config"] };
  }
  if (text.indexOf("浅色") >= 0 || text.indexOf("light") >= 0) {
    window.__biaoyue_ai_theme__("light");
    return { text: "已切换到浅色主题。", turns: 2, tool_calls: ["patch_config"] };
  }
  if (text.indexOf("字号") >= 0) {
    aiSnapshot();
    aiState.config.fontSize = 18;
    return { text: "已把字号调到 18。", turns: 2, tool_calls: ["patch_config"] };
  }
  if (text.indexOf("翻译") >= 0) return { text: "这是翻译后的文本。", turns: 1, tool_calls: [] };
  if (text.indexOf("润色") >= 0) return { text: "这是润色后的文本。", turns: 1, tool_calls: [] };
  if (text.indexOf("改写") >= 0) return { text: "这是改写后的文本。", turns: 1, tool_calls: [] };
  return { text: "收到。", turns: 1, tool_calls: [] };
}

function mockInvoke(cmd, args) {
  var responses = {
    load_config: { fontSize:16, headingColors:null, ollamaEndpoint:"http://localhost:11434", openaiEndpoint:"https://api.openai.com", openaiModel:"gpt-4o-mini", translationProvider:"ollama", sourceLang:"en", targetLang:"zh-CN", theme:"system", sidebarLeftVisible:true, sidebarRightVisible:false, sidebarLeftWidth:220, sidebarRightWidth:320, recentFiles:[
      { path:"/Users/test/测试文档.md", title:"测试文档.md", openedAt:"2020-01-02T10:00:00.000Z", excerpt:"这是从文件里截下来的真实开头，不是占位文案。" },
      { path:"/Users/test/另一个.md", title:"另一个.md", openedAt:"2020-01-01T09:00:00.000Z", excerpt:"另一份文档的开头。" },
    ] },
    open_file: { content: "# 测试文档\n\n## 第一节\n\n这是测试内容。\n\n## 第二节\n\n更多内容。\n\n### 子节\n\n嵌套标题。\n\n- 列表项1\n- 列表项2\n\n```js\nconsole.log('hello')\n```\n\n> 引用文本\n\n**粗体** 和 *斜体*\n\n- [ ] 待办\n- [x] 已完成", path:"/Users/test/测试文档.md", file_size:350 },
    save_file: { path:"/Users/test/测试文档.md" },
    save_as_file: { path:"/Users/test/新文件.md" },
    pick_folder: "/Users/test",
    flatten_files: { entries:[
      {name:"测试文档.md",path:"/Users/test/测试文档.md",relative_path:"测试文档.md",is_dir:false,size:350},
      {name:"另一个.md",path:"/Users/test/另一个.md",relative_path:"另一个.md",is_dir:false,size:40},
      {name:"笔记",path:"/Users/test/笔记",relative_path:"笔记",is_dir:true,size:0},
      {name:"周报.md",path:"/Users/test/笔记/周报.md",relative_path:"笔记/周报.md",is_dir:false,size:120},
      {name:"会议.md",path:"/Users/test/笔记/会议.md",relative_path:"笔记/会议.md",is_dir:false,size:200}
    ], truncated:false },
    read_directory: { entries:[
      {name:"测试文档.md",path:"/Users/test/测试文档.md",is_dir:false,size:350},
      {name:"笔记",path:"/Users/test/笔记",is_dir:true,size:0}
    ], path:"/Users/test" },
    get_file_info: { path:"/Users/test/测试文档.md", size:350, is_dir:false, modified:1719000000 },
  };
  if (cmd === "read_file_base64" && args && args.path) {
    // /Users/test/doc.pdf 返回真实小 PDF（e2e/fixtures/mini.pdf，2 页，含 "BiaoyuePDFTest"）
    if (args.path === "/Users/test/doc.pdf" || args.path === "/tmp/rc/report.pdf") {
      return "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUiA2IDAgUl0gL0NvdW50IDIgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NSA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDcyIDcyMCBUZCAoQmlhb3l1ZVBERlRlc3QpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCjYgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNyAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjcgMCBvYmoKPDwgL0xlbmd0aCA0MSA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDcyIDcyMCBUZCAoU2Vjb25kUGFnZSkgVGogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTIxIDAwMDAwIG4gCjAwMDAwMDAyNDcgMDAwMDAgbiAKMDAwMDAwMDM0MiAwMDAwMCBuIAowMDAwMDAwNDEyIDAwMDAwIG4gCjAwMDAwMDA1MzggMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA4IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo2MjkKJSVFT0YK";
    }
    return "AAECAwQ=";
  }
  if (cmd === "open_file_direct" && args && args.path) {
    return { content:"# "+args.path.split("/").pop()+"\n\n文件内容。", path:args.path, file_size:100 };
  }
  if (cmd === "save_as_file") {
    window.__lastSaveAs = args || {};
    return { path: "/Users/test/" + ((args && args.defaultName) || "新文件.md") };
  }
  if (cmd === "move_file" && args && args.from && args.toDir) {
    var name = args.from.split("/").pop();
    return args.toDir.replace(/\/$/, "") + "/" + name;
  }
  if (!aiState.config) {
    aiState.config = JSON.parse(JSON.stringify(responses.load_config));
    aiSnapshot();
  }
  if (cmd === "load_config") return JSON.parse(JSON.stringify(aiState.config));
  if (cmd === "save_config" && args && args.config) {
    aiSnapshot();
    aiState.config = JSON.parse(JSON.stringify(args.config));
    try { localStorage.setItem("__mock_config", JSON.stringify(aiState.config)); } catch (e) { /* 忽略 */ }
    return null;
  }
  if (cmd === "set_api_key" && args) {
    window.__biaoyue_keyring__[args.service + ":" + args.account] = args.key;
    return null;
  }
  if (cmd === "get_api_key" && args) {
    return window.__biaoyue_keyring__[args.service + ":" + args.account] || null;
  }
  if (cmd === "delete_api_key" && args) {
    delete window.__biaoyue_keyring__[args.service + ":" + args.account];
    return null;
  }
  if (cmd === "list_config_snapshots") return aiState.snapshots.map(function (s) { return s.name; });
  if (cmd === "restore_config_snapshot" && args && args.name) {
    var hit = null;
    for (var i = 0; i < aiState.snapshots.length; i++) {
      if (aiState.snapshots[i].name === args.name) { hit = aiState.snapshots[i]; break; }
    }
    if (!hit) throw new Error("快照不存在: " + args.name);
    aiSnapshot();
    aiState.config = JSON.parse(JSON.stringify(hit.config));
    return JSON.parse(JSON.stringify(aiState.config));
  }
  if (cmd === "run_agent_turn" && args && args.messages) return aiRunAgentTurn(args.messages);
  if (cmd === "save_as_file" && args) {
    window.__biaoyue_saved_files__.push({
      content: args.content,
      defaultName: args.defaultName,
    });
    return { path: "/Users/test/测试文档.html" };
  }
  if (cmd === "save_binary_as_file" && args) {
    window.__biaoyue_saved_binaries__.push({
      base64: args.base64,
      defaultName: args.defaultName,
    });
    return "/Users/test/" + (args.defaultName || "导出.png");
  }
  if (cmd === "list_extensions") {
    // 测试通过 window.__biaoyue_extensions__ 注入用户片段；未注入时返回空快照。
    var ext = window.__biaoyue_extensions__;
    if (!ext) return { snippets: [], templates: [], theme: { tokens: {}, warnings: [] }, warnings: [] };
    return ext;
  }
  if (cmd === "save_file" && args) {
    // 记录写盘内容，供 e2e 断言"存下来的字节里没有编辑痕迹"
    const w = typeof window !== "undefined" ? window : globalThis;
    w.__saved_files__ = w.__saved_files__ || {};
    w.__saved_files__[args.path] = args.content;
    w.__save_calls__ = w.__save_calls__ || [];
    w.__save_calls__.push({ path: args.path, at: Date.now(), content: args.content });
    return { path:args.path };
  }
  if (cmd === "flatten_files") return responses.flatten_files;
  if (cmd === "pick_folder") return responses.pick_folder;
  if (cmd === "list_recent_documents") {
    // 默认空扫描：本机最近文件是可选能力，测试用 __biaoyue_recent_documents__ 注入。
    var docs = window.__biaoyue_recent_documents__;
    return Array.isArray(docs) ? cloneJson(docs) : [];
  }
  if (cmd === "search_documents") {
    // 本机检索：测试用 __biaoyue_search_documents__ 注入固定样例；
    // 按 query 过滤 title/excerpt/path，模拟 Rust 侧大小写不敏感子串匹配。
    var hits = window.__biaoyue_search_documents__;
    if (!Array.isArray(hits)) return [];
    var q = args && args.query ? String(args.query).toLowerCase() : "";
    var matched = [];
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      var hay = ((h.title || "") + " " + (h.excerpt || "") + " " + (h.path || "")).toLowerCase();
      if (!q || hay.indexOf(q) >= 0) matched.push(cloneJson(h));
    }
    return matched;
  }
  if (cmd === "reveal_in_finder" && args) {
    const w = typeof window !== "undefined" ? window : globalThis;
    w.__reveal_calls__ = w.__reveal_calls__ || [];
    w.__reveal_calls__.push(args.path);
    return null;
  }
  if (cmd === "list_extension_packages") return cloneJson(extensionPackages);
  if (cmd === "import_extension_package" && args && args.path) {
    var base = String(args.path).split("/").pop() || "extension";
    var existing = findExtensionPackage(base);
    var imported = {
      id: base,
      name: base,
      version: "1.0.0",
      description: "从 " + args.path + " 导入",
      source: "user",
      enabled: true,
      dir: args.path,
      skill: "# " + base + "\n\n用户导入的扩展。",
    };
    if (existing) {
      extensionPackages[extensionPackages.indexOf(existing)] = imported;
    } else {
      extensionPackages.push(imported);
    }
    return cloneJson(imported);
  }
  if (cmd === "set_extension_package_enabled" && args) {
    var target = findExtensionPackage(args.id);
    if (target) target.enabled = !!args.enabled;
    return null;
  }
  if (cmd === "remove_extension_package" && args) {
    var victim = findExtensionPackage(args.id);
    if (victim) extensionPackages.splice(extensionPackages.indexOf(victim), 1);
    return null;
  }
  if (cmd === "package_extension_package" && args) {
    return "/tmp/extensions-export/" + args.id + ".zip";
  }
  if (cmd === "pick_extension_source" && args) {
    if (args.kind === "folder") return "/tmp/extensions-import/demo";
    if (args.kind === "zip") return "/tmp/extensions-import/demo.zip";
    return null;
  }
  if (cmd === "generate_extension_package" && args) {
    var prompt = String(args.prompt || "");
    return new Promise(function (resolve) {
      setTimeout(function () {
        var id = "ai-" + Date.now();
        var generated = {
          id: id,
          name: prompt.slice(0, 20) || "AI 扩展",
          version: "1.0.0",
          description: "AI 生成的扩展",
          source: "ai",
          enabled: true,
          dir: "/tmp/extensions-ai/" + id,
          skill: "# " + (prompt.slice(0, 20) || "AI 扩展") + "\n\n" + prompt,
        };
        extensionPackages.push(generated);
        resolve(cloneJson(generated));
      }, 250);
    });
  }
  if (cmd === "list_media_in_dir") {
    return window.__biaoyue_media__ || [];
  }
  if (cmd === "register_media_path") return null;
  if (responses[cmd]) return responses[cmd];
  console.warn("[TauriMock] unknown command:", cmd);
  return null;
}
