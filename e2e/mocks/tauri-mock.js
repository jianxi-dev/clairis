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
window.__clairis_store__ = null;
window.__clairis_openFile__ = function(path, content, title) {
  if (!window.__clairis_store__) return false;
  var store = window.__clairis_store__.getState();
  store.openFile(path, content);
  store.addRecentFile(path, title || path.split('/').pop());
  return true;
};

function mockInvoke(cmd, args) {
  var responses = {
    load_config: { fontSize:16, headingColors:null, ollamaEndpoint:"http://localhost:11434", openaiEndpoint:"https://api.openai.com", openaiModel:"gpt-4o-mini", translationProvider:"ollama", sourceLang:"en", targetLang:"zh-CN", theme:"system", sidebarLeftVisible:true, sidebarRightVisible:false, sidebarLeftWidth:220, sidebarRightWidth:320, recentFiles:[] },
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
    return "AAECAwQ=";
  }
  if (cmd === "open_file_direct" && args && args.path) {
    return { content:"# "+args.path.split("/").pop()+"\n\n文件内容。", path:args.path, file_size:100 };
  }
  if (cmd === "save_file" && args) return { path:args.path };
  if (cmd === "flatten_files") return responses.flatten_files;
  if (cmd === "pick_folder") return responses.pick_folder;
  if (responses[cmd]) return responses[cmd];
  console.warn("[TauriMock] unknown command:", cmd);
  return null;
}
