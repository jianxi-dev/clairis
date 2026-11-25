//! 数据面注册与加载（design D3/D4）。
//!
//! 数据面 = 「宿主声明默认集合 + 用户覆盖」的可配置面。本变更登记
//! `html-toolbar`（横向工具条按钮集合与顺序），默认集合的唯一来源是仓库内
//! `resources/html-toolbar.default.json`（`include_str!` 内嵌 + 首次运行物化到
//! `defaults/surfaces/`）。前端不再保留兜底常量，避免默认源双真相。
//!
//! 语义（DS-1）：
//! - 物化：首次运行把内嵌默认写到 `defaults/surfaces/html-toolbar.json`；
//!   已存在不覆盖；解析失败视为缺失并重建。
//! - 合并：有效集合 = 物化默认 ← 用户覆盖（`htmlToolbarItems`）；未知 id 过滤
//!   并聚合为一条告警；覆盖为空 / 全非法回落默认。
//! - 容错：默认文件损坏（非法 JSON / 形状不对）回落内嵌默认，不 panic。
//!
//! 面级事件（DS-2）：`spawn_surfaces_watcher` 用 500ms `(mtime, len)` 指纹去抖
//! 监听面文件与 user 覆盖，变化时只发 `surfaces-changed(id)`，不发全量
//! `config-changed`。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::{AppHandle, Emitter};
use tracing::{info, warn};

use crate::config::config_base;

/// 已登记数据面。新增面时在此加变体，并在 `surfaces()` / `default_file_name()`
/// / `user_override()` 三处登记（P1 再抽象为注册表）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SurfaceId {
    HtmlToolbar,
}

impl SurfaceId {
    /// 面 id 字符串（事件 payload 与前端 store 的键）。
    pub fn as_str(self) -> &'static str {
        match self {
            SurfaceId::HtmlToolbar => "html-toolbar",
        }
    }
}

/// 单个面项，形状与前端 `ToolbarSlotItem` 对齐（id/label/icon/group）。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SurfaceItem {
    pub id: String,
    pub label: String,
    pub icon: String,
    pub group: String,
}

/// 内嵌默认文件（唯一默认源）。
const SURFACE_DEFAULTS: &str = include_str!("resources/html-toolbar.default.json");

/// 物化落点：`<config_base>/defaults/surfaces/<file>`。
fn surface_file_path(base: &Path, id: SurfaceId) -> PathBuf {
    base.join("defaults")
        .join("surfaces")
        .join(default_file_name(id))
}

fn default_file_name(id: SurfaceId) -> &'static str {
    match id {
        SurfaceId::HtmlToolbar => "html-toolbar.json",
    }
}

/// 解析内嵌默认 JSON；形状不对视为无默认（调用方回落空集合并告警）。
fn parse_default_json(raw: &str) -> Option<Vec<SurfaceItem>> {
    let value: Value = serde_json::from_str(raw).ok()?;
    let items = value.get("items")?.as_array()?;
    let mut out = Vec::with_capacity(items.len());
    for entry in items {
        let item: SurfaceItem = serde_json::from_value(entry.clone()).ok()?;
        out.push(item);
    }
    Some(out)
}

/// 内嵌默认集合（编译期常量）。
pub fn embedded_defaults(id: SurfaceId) -> Vec<SurfaceItem> {
    match id {
        SurfaceId::HtmlToolbar => parse_default_json(SURFACE_DEFAULTS).unwrap_or_default(),
    }
}

/// 物化：首次运行写默认文件；已存在不覆盖；解析失败视为缺失并重建。
/// 返回物化后的有效默认集合（文件内容优先，文件损坏回落内嵌）。
pub fn materialize(id: SurfaceId, base: &Path) -> Vec<SurfaceItem> {
    let path = surface_file_path(base, id);
    let embedded = embedded_defaults(id);
    if path.exists() {
        if let Ok(raw) = std::fs::read_to_string(&path) {
            if let Some(items) = parse_default_json(&raw) {
                return items;
            }
            warn!(path = %path.display(), "数据面默认文件损坏，回落内嵌默认");
        } else {
            warn!(path = %path.display(), "数据面默认文件不可读，回落内嵌默认");
        }
    }
    // 缺失 / 损坏 → 重建（写失败不致命：读取仍走内嵌）
    if let Some(parent) = path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            warn!(error = %e, "创建数据面目录失败");
            return embedded;
        }
    }
    let data = serde_json::to_vec_pretty(&serde_json::json!({
        "id": id.as_str(),
        "items": embedded,
    }))
    .unwrap_or_default();
    if let Err(e) = atomic_write(&path, &data) {
        warn!(error = %e, path = %path.display(), "数据面默认文件写入失败");
    }
    embedded
}

/// 同目录临时文件 → fsync → rename（与 config.rs 的 atomic_write 同语义）。
fn atomic_write(path: &Path, data: &[u8]) -> std::io::Result<()> {
    let dir = path
        .parent()
        .ok_or_else(|| std::io::Error::other("数据面路径无父目录"))?;
    let nanos = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "surface.json".into());
    let tmp = dir.join(format!(".{file_name}.tmp-{}-{nanos}", std::process::id()));
    {
        use std::io::Write;
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(data)?;
        file.sync_all()?;
    }
    std::fs::rename(&tmp, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        e
    })
}

/// 用户覆盖来源：读 `user/settings.json` 的 `htmlToolbarItems` 字段。
/// 文件缺失 / 损坏 / 字段缺失都返回 None（回落默认）。
fn user_override(id: SurfaceId, base: &Path) -> Option<Vec<String>> {
    match id {
        SurfaceId::HtmlToolbar => {
            let path = base.join("user").join("settings.json");
            let raw = std::fs::read_to_string(path).ok()?;
            let value: Value = serde_json::from_str(&raw).ok()?;
            let items = value.get("htmlToolbarItems")?.as_array()?;
            Some(
                items
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect(),
            )
        }
    }
}

/// 单个面的有效集合与告警。
#[derive(Debug, Clone, Serialize)]
pub struct SurfaceLoad {
    pub id: String,
    pub items: Vec<SurfaceItem>,
    pub warnings: Vec<String>,
}

/// 合并：默认 ← 用户覆盖。未知 id 过滤并聚合为一条告警；空 / 全非法回落默认。
pub fn merge_surface(
    id: SurfaceId,
    defaults: &[SurfaceItem],
    override_ids: Option<&[String]>,
) -> SurfaceLoad {
    let known: std::collections::HashSet<&str> =
        defaults.iter().map(|item| item.id.as_str()).collect();
    let Some(list) = override_ids else {
        return SurfaceLoad {
            id: id.as_str().to_string(),
            items: defaults.to_vec(),
            warnings: Vec::new(),
        };
    };
    if list.is_empty() {
        return SurfaceLoad {
            id: id.as_str().to_string(),
            items: defaults.to_vec(),
            warnings: Vec::new(),
        };
    }
    let mut out: Vec<SurfaceItem> = Vec::new();
    let mut seen: std::collections::HashSet<&str> = std::collections::HashSet::new();
    let mut unknown: Vec<String> = Vec::new();
    for raw in list {
        if !known.contains(raw.as_str()) {
            if !unknown.contains(raw) {
                unknown.push(raw.clone());
            }
            continue;
        }
        if !seen.insert(raw.as_str()) {
            continue;
        }
        if let Some(item) = defaults.iter().find(|item| item.id == *raw) {
            out.push(item.clone());
        }
    }
    let mut warnings = Vec::new();
    if !unknown.is_empty() {
        warnings.push(format!("未知工具条动作: {}", unknown.join(", ")));
    }
    if out.is_empty() {
        return SurfaceLoad {
            id: id.as_str().to_string(),
            items: defaults.to_vec(),
            warnings,
        };
    }
    SurfaceLoad {
        id: id.as_str().to_string(),
        items: out,
        warnings,
    }
}

/// 加载单个面：物化默认 ← 用户覆盖。
pub fn load_surface(id: SurfaceId, base: &Path) -> SurfaceLoad {
    let defaults = materialize(id, base);
    let override_ids = user_override(id, base);
    merge_surface(id, &defaults, override_ids.as_deref())
}

/// 加载全部已登记面。
pub fn load_all(base: &Path) -> Vec<SurfaceLoad> {
    vec![load_surface(SurfaceId::HtmlToolbar, base)]
}

/// 面文件指纹（mtime, len）；文件不存在返回 None。
fn fingerprint(path: &Path) -> Option<(SystemTime, u64)> {
    let meta = std::fs::metadata(path).ok()?;
    Some((meta.modified().ok()?, meta.len()))
}

/// 轮询面文件与 user 覆盖的 `(mtime, len)`，变化时发 `surfaces-changed(id)`。
/// 按路径取状态，文件被 rename 替换也能发现；首轮只记录基线。
pub fn spawn_surfaces_watcher(app: AppHandle) {
    let base = config_base(&app);
    let surface_path = surface_file_path(&base, SurfaceId::HtmlToolbar);
    let user_path = base.join("user").join("settings.json");
    tauri::async_runtime::spawn(async move {
        let mut last_surface = fingerprint(&surface_path);
        let mut last_user = fingerprint(&user_path);
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let surface = fingerprint(&surface_path);
            let user = fingerprint(&user_path);
            if surface != last_surface || user != last_user {
                last_surface = surface;
                last_user = user;
                info!("数据面文件被外部修改，通知前端热应用");
                let _ = app.emit("surfaces-changed", SurfaceId::HtmlToolbar.as_str());
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_base(tag: &str) -> tempfile::TempDir {
        tempfile::Builder::new()
            .prefix(&format!("biaoyue_surfaces_{tag}_"))
            .tempdir()
            .expect("create temp dir")
    }

    fn write_user(base: &Path, json: &str) {
        let path = base.join("user").join("settings.json");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, json).unwrap();
    }

    #[test]
    fn 物化_首次写文件且与内嵌逐值一致() {
        let dir = temp_base("materialize");
        let base = dir.path();
        let items = materialize(SurfaceId::HtmlToolbar, base);
        // 12 = 回归红线：默认集合的项数契约（与 config.rs 校验上限一致）
        assert_eq!(items.len(), 12);
        let path = surface_file_path(base, SurfaceId::HtmlToolbar);
        assert!(path.exists());
        let raw = std::fs::read_to_string(&path).unwrap();
        let parsed = parse_default_json(&raw).unwrap();
        assert_eq!(parsed, items);
        assert_eq!(items, embedded_defaults(SurfaceId::HtmlToolbar));
    }

    #[test]
    fn 物化_文件已存在不覆盖() {
        let dir = temp_base("no_overwrite");
        let base = dir.path();
        let path = surface_file_path(base, SurfaceId::HtmlToolbar);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, r#"{"id":"html-toolbar","items":[]}"#).unwrap();
        let items = materialize(SurfaceId::HtmlToolbar, base);
        // 已存在（即使形状为空）不重建，读取文件内容
        assert!(items.is_empty());
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            r#"{"id":"html-toolbar","items":[]}"#
        );
    }

    #[test]
    fn 合并_过滤未知id且告警恰一条() {
        let dir = temp_base("merge");
        let base = dir.path();
        let defaults = materialize(SurfaceId::HtmlToolbar, base);
        write_user(
            base,
            r#"{"htmlToolbarItems":["format-bold","nope","format-italic"]}"#,
        );
        let loaded = load_surface(SurfaceId::HtmlToolbar, base);
        let ids: Vec<&str> = loaded.items.iter().map(|i| i.id.as_str()).collect();
        assert_eq!(ids, vec!["format-bold", "format-italic"]);
        assert_eq!(loaded.warnings.len(), 1);
        assert!(loaded.warnings[0].contains("nope"));
        assert_eq!(
            defaults.len(),
            embedded_defaults(SurfaceId::HtmlToolbar).len()
        );
    }

    #[test]
    fn 合并_空覆盖回落默认() {
        let dir = temp_base("empty");
        let base = dir.path();
        let defaults = materialize(SurfaceId::HtmlToolbar, base);
        write_user(base, r#"{"htmlToolbarItems":[]}"#);
        let loaded = load_surface(SurfaceId::HtmlToolbar, base);
        assert_eq!(
            loaded.items.len(),
            embedded_defaults(SurfaceId::HtmlToolbar).len()
        );
        assert_eq!(loaded.items, defaults);
    }

    #[test]
    fn 合并_全非法覆盖回落默认() {
        let dir = temp_base("allbad");
        let base = dir.path();
        let defaults = materialize(SurfaceId::HtmlToolbar, base);
        write_user(base, r#"{"htmlToolbarItems":["a","b"]}"#);
        let loaded = load_surface(SurfaceId::HtmlToolbar, base);
        assert_eq!(loaded.items, defaults);
        assert_eq!(loaded.warnings.len(), 1);
    }

    #[test]
    fn 默认文件损坏回落内嵌() {
        let dir = temp_base("corrupt");
        let base = dir.path();
        let path = surface_file_path(base, SurfaceId::HtmlToolbar);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "not-json").unwrap();
        let items = materialize(SurfaceId::HtmlToolbar, base);
        assert_eq!(items, embedded_defaults(SurfaceId::HtmlToolbar));
        assert_eq!(items.len(), embedded_defaults(SurfaceId::HtmlToolbar).len());
        // 损坏文件被重建为合法 JSON
        let raw = std::fs::read_to_string(&path).unwrap();
        assert!(parse_default_json(&raw).is_some());
    }

    #[test]
    fn 内嵌默认_id集合与config校验白名单对账() {
        let defaults = embedded_defaults(SurfaceId::HtmlToolbar);
        let ids: std::collections::HashSet<&str> =
            defaults.iter().map(|item| item.id.as_str()).collect();
        let allowed: std::collections::HashSet<&str> = crate::config::HTML_TOOLBAR_ALLOWED_IDS
            .iter()
            .copied()
            .collect();
        assert_eq!(
            ids, allowed,
            "内嵌默认源与 config 校验白名单必须逐 id 一致（唯一源对账）"
        );
    }

    #[test]
    fn 指纹_变化即不同() {
        let dir = temp_base("fingerprint");
        let base = dir.path();
        let path = surface_file_path(base, SurfaceId::HtmlToolbar);
        assert_eq!(fingerprint(&path), None);
        materialize(SurfaceId::HtmlToolbar, base);
        let first = fingerprint(&path);
        assert!(first.is_some());
        std::fs::write(&path, r#"{"id":"html-toolbar","items":[]}"#).unwrap();
        let second = fingerprint(&path);
        assert_ne!(first, second);
    }
}
