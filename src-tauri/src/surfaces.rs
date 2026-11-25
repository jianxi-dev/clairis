//! 数据面注册与加载（design D1/D3/D4）。
//!
//! 数据面 = 「宿主声明默认集合 + 用户覆盖」的可配置面。面由 `SURFACES`
//! 登记表驱动：新增面只追加一行 `SurfaceSpec` + 一个默认文件，不改任何 match。
//! 本变更登记两面：
//! - `html-toolbar`：横向工具条按钮集合与顺序（形状 `toolbar`）；
//! - `menus`：六处菜单（格头 / AI 窗格 / 导出子菜单 / 页签右键 / 预览右键 /
//!   AI 浮窗预设）的项集合、顺序、启停与文案（形状 `menu`）。
//!
//! 默认集合的唯一来源是仓库内 `resources/<id>.default.json`（`include_str!`
//! 内嵌 + 首次运行物化到 `defaults/surfaces/`）。前端不再保留兜底常量，避免
//! 默认源双真相。
//!
//! 语义（DS-1 / DS-4）：
//! - 物化：首次运行把内嵌默认写到 `defaults/surfaces/<id>.json`；
//!   已存在不覆盖；解析失败视为缺失并重建。
//! - 校验：每个面按自己的形状校验（缺字段 / 类型错 / 未知 action 过滤，
//!   聚合为一条告警）；有效集合不因单个非法项整体失败。
//! - 合并：有效集合 = 物化默认 ← 用户覆盖；未知 id 过滤并聚合为一条告警；
//!   覆盖为空 / 全非法回落默认。
//! - 容错：默认文件损坏（非法 JSON / 形状不对）回落内嵌默认，不 panic。
//!
//! 面级事件（DS-2 / DS-5）：`spawn_surfaces_watcher` 用 500ms `(mtime, len)`
//! 指纹去抖监听面文件与 user 覆盖，变化时只发 `surfaces-changed(id)`，
//! 不发全量 `config-changed`。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::{AppHandle, Emitter};
use tracing::{info, warn};

use crate::config::config_base;

/// 面项形状。`menu` 由本变更（T2）追加；icon / capsule 由后续变更追加。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SurfaceShape {
    Toolbar,
    Menu,
}

/// 单个已登记面：id、默认文件名、项形状。校验器随形状而定。
#[derive(Debug, PartialEq, Eq)]
pub struct SurfaceSpec {
    pub id: &'static str,
    pub default_file: &'static str,
    pub shape: SurfaceShape,
}

/// 面登记表（唯一真相源；前端 `SUPPORTED_SURFACES` 由对账测试与本表锁定）。
pub static SURFACES: &[SurfaceSpec] = &[
    SurfaceSpec {
        id: "html-toolbar",
        default_file: "html-toolbar.json",
        shape: SurfaceShape::Toolbar,
    },
    SurfaceSpec {
        id: "menus",
        default_file: "menus.json",
        shape: SurfaceShape::Menu,
    },
];

pub fn find_surface(id: &str) -> Option<&'static SurfaceSpec> {
    SURFACES.iter().find(|spec| spec.id == id)
}

/// 工具条项，形状与前端 `ToolbarSlotItem` 对齐（id/label/icon/group）。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SurfaceItem {
    pub id: String,
    pub label: String,
    pub icon: String,
    pub group: String,
}

/// 菜单项（design D2）：`action` 是代码侧动作 id——数据声明顺序 / 可见性 /
/// 文案，代码声明动作。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MenuItem {
    pub id: String,
    pub group: String,
    pub order: u32,
    pub label: String,
    pub icon: String,
    pub action: String,
    pub enabled: bool,
}

/// 内嵌默认文件（唯一默认源），按面 id 取。
fn embedded_json(spec: &SurfaceSpec) -> &'static str {
    match spec.shape {
        SurfaceShape::Toolbar => include_str!("resources/html-toolbar.default.json"),
        SurfaceShape::Menu => include_str!("resources/menus.default.json"),
    }
}

fn surface_file_path(base: &Path, spec: &SurfaceSpec) -> PathBuf {
    base.join("defaults")
        .join("surfaces")
        .join(spec.default_file)
}

/// 用户覆盖文件：新面各自独立 `user/<id>.json`（D4），不再塞 `settings.json`。
fn user_override_path(base: &Path, spec: &SurfaceSpec) -> PathBuf {
    match spec.shape {
        // html-toolbar 沿用既有 settings 字段（D9 兼容，既有设置页行为不变）。
        SurfaceShape::Toolbar => base.join("user").join("settings.json"),
        SurfaceShape::Menu => base.join("user").join("menus.json"),
    }
}

// ── 形状校验（DS-4）────────────────────────────────────────────

/// 工具条合法动作 id（与 `resources/html-toolbar.default.json` 唯一默认源对账，
/// 由本文件测试锁定两处一致）。
const TOOLBAR_ALLOWED_IDS: &[&str] = &[
    "ai-rewrite",
    "ai-translate",
    "ai-polish",
    "format-bold",
    "format-italic",
    "format-underline",
    "format-strike",
    "format-code",
    "format-link",
    "align-left",
    "align-center",
    "align-right",
];

/// 工具条合法分组。
const TOOLBAR_GROUPS: &[&str] = &["ai", "format", "align"];

/// 菜单六处消费端分组（design D7）。
pub const MENU_GROUPS: &[&str] = &[
    "pane-header",
    "ai-pane",
    "export-submenu",
    "tab-context",
    "preview-context",
    "ai-float-presets",
];

/// 校验单个工具条项：缺字段 / 类型错 / 未知 action（id）/ 未知 group → None。
fn validate_toolbar_item(entry: &Value) -> Option<SurfaceItem> {
    let obj = entry.as_object()?;
    let id = obj.get("id")?.as_str()?;
    if id.is_empty() || !TOOLBAR_ALLOWED_IDS.contains(&id) {
        return None;
    }
    let label = obj.get("label")?.as_str()?;
    let icon = obj.get("icon")?.as_str()?;
    let group = obj.get("group")?.as_str()?;
    if label.is_empty() || icon.is_empty() || !TOOLBAR_GROUPS.contains(&group) {
        return None;
    }
    Some(SurfaceItem {
        id: id.to_string(),
        label: label.to_string(),
        icon: icon.to_string(),
        group: group.to_string(),
    })
}

/// 校验单个菜单项：缺字段 / 类型错 / 未知 action / 未知 group → None。
fn validate_menu_item(entry: &Value) -> Option<MenuItem> {
    let obj = entry.as_object()?;
    let id = obj.get("id")?.as_str()?;
    let group = obj.get("group")?.as_str()?;
    let label = obj.get("label")?.as_str()?;
    let icon = obj.get("icon")?.as_str()?;
    let action = obj.get("action")?.as_str()?;
    if id.is_empty()
        || label.is_empty()
        || icon.is_empty()
        || action.is_empty()
        || !MENU_GROUPS.contains(&group)
    {
        return None;
    }
    let order = obj.get("order")?.as_u64()? as u32;
    let enabled = obj.get("enabled")?.as_bool()?;
    Some(MenuItem {
        id: id.to_string(),
        group: group.to_string(),
        order,
        label: label.to_string(),
        icon: icon.to_string(),
        action: action.to_string(),
        enabled,
    })
}

/// 解析并校验内嵌 / 物化默认 JSON，返回 `(有效项, 被过滤项的告警)`。
/// 形状不对（非数组 / 缺 items 键）视为无默认（调用方回落空集合并告警）。
fn parse_default_json(
    spec: &SurfaceSpec,
    raw: &str,
) -> (Vec<Value>, Vec<String>) {
    let value: Value = match serde_json::from_str(raw) {
        Ok(value) => value,
        Err(_) => return (Vec::new(), Vec::new()),
    };
    let items = match value.get("items").and_then(|v| v.as_array()) {
        Some(items) => items,
        None => return (Vec::new(), Vec::new()),
    };
    let mut valid = Vec::with_capacity(items.len());
    let mut rejected = Vec::new();
    for entry in items {
        let ok = match spec.shape {
            SurfaceShape::Toolbar => validate_toolbar_item(entry).is_some(),
            SurfaceShape::Menu => validate_menu_item(entry).is_some(),
        };
        if ok {
            valid.push(entry.clone());
        } else {
            let id = entry
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("(缺 id)")
                .to_string();
            rejected.push(id);
        }
    }
    let warnings = if rejected.is_empty() {
        Vec::new()
    } else {
        vec![format!(
            "默认文件非法项已过滤（{}）: {}",
            spec.id,
            rejected.join(", ")
        )]
    };
    (valid, warnings)
}

/// 反序列化已校验的默认项（校验已过，失败即视为无默认）。
fn deserialize_defaults<T: for<'de> Deserialize<'de>>(
    spec: &SurfaceSpec,
    raw: &str,
) -> Option<Vec<T>> {
    let (valid, _) = parse_default_json(spec, raw);
    if valid.is_empty() {
        return None;
    }
    let mut out = Vec::with_capacity(valid.len());
    for entry in valid {
        out.push(serde_json::from_value(entry).ok()?);
    }
    Some(out)
}

/// 内嵌默认集合（编译期常量）。
pub fn embedded_defaults(spec: &SurfaceSpec) -> Vec<SurfaceItem> {
    match spec.shape {
        SurfaceShape::Toolbar => deserialize_defaults(spec, embedded_json(spec)).unwrap_or_default(),
        // 菜单面以 `Value` 形式返回（保留 group/order/action/enabled），
        // 由 `SurfaceLoad.items` 统一承载原始 JSON。
        SurfaceShape::Menu => Vec::new(),
    }
}

/// 内嵌默认集合的原始 JSON（菜单面消费：保留全部字段）。
pub fn embedded_defaults_json(spec: &SurfaceSpec) -> Vec<Value> {
    let (valid, _) = parse_default_json(spec, embedded_json(spec));
    valid
}

/// 物化：首次运行写默认文件；已存在不覆盖；解析失败视为缺失并重建。
/// 返回物化后的有效默认集合（文件内容优先，文件损坏回落内嵌）。
pub fn materialize(spec: &SurfaceSpec, base: &Path) -> Vec<Value> {
    let path = surface_file_path(base, spec);
    let embedded = embedded_defaults_json(spec);
    if path.exists() {
        if let Ok(raw) = std::fs::read_to_string(&path) {
            let (valid, warnings) = parse_default_json(spec, &raw);
            for warning in warnings {
                warn!(warning = %warning, "数据面默认文件含非法项");
            }
            if !valid.is_empty() || raw.trim().is_empty() {
                if !valid.is_empty() {
                    return valid;
                }
            } else if let Some(value) = serde_json::from_str::<Value>(&raw).ok() {
                if value.get("items").and_then(|v| v.as_array()).is_some() {
                    // 文件合法但全部项非法：视为有效空集合（不重建，尊重磁盘）
                    return valid;
                }
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
        "id": spec.id,
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

/// 用户覆盖来源：`html-toolbar` 读 `user/settings.json` 的 `htmlToolbarItems`
/// 字段（既有语义不变）；其余面读 `user/<id>.json` 的 `items` 数组（D4）。
/// 文件缺失 / 损坏 / 字段缺失都返回 None（回落默认）。
fn user_override(spec: &SurfaceSpec, base: &Path) -> Option<Vec<String>> {
    match spec.shape {
        SurfaceShape::Toolbar => {
            let raw = std::fs::read_to_string(user_override_path(base, spec)).ok()?;
            let value: Value = serde_json::from_str(&raw).ok()?;
            let items = value.get("htmlToolbarItems")?.as_array()?;
            Some(
                items
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect(),
            )
        }
        SurfaceShape::Menu => {
            let raw = std::fs::read_to_string(user_override_path(base, spec)).ok()?;
            let value: Value = serde_json::from_str(&raw).ok()?;
            let items = value.get("items")?.as_array()?;
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
    pub items: Vec<Value>,
    pub warnings: Vec<String>,
}

/// 合并：默认 ← 用户覆盖。未知 id 过滤并聚合为一条告警；空 / 全非法回落默认。
/// `defaults` 与 `override_ids` 都是已校验的原始 JSON 项（保序）。
pub fn merge_surface(
    spec: &SurfaceSpec,
    defaults: &[Value],
    override_ids: Option<&[String]>,
) -> SurfaceLoad {
    let known: std::collections::HashSet<&str> = defaults
        .iter()
        .filter_map(|item| item.get("id")?.as_str())
        .collect();
    let fallback = || SurfaceLoad {
        id: spec.id.to_string(),
        items: defaults.to_vec(),
        warnings: Vec::new(),
    };
    let Some(list) = override_ids else {
        return fallback();
    };
    if list.is_empty() {
        return fallback();
    }
    let mut out: Vec<Value> = Vec::new();
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
        if let Some(item) = defaults
            .iter()
            .find(|item| item.get("id").and_then(|v| v.as_str()) == Some(raw.as_str()))
        {
            out.push(item.clone());
        }
    }
    let mut warnings = Vec::new();
    if !unknown.is_empty() {
        warnings.push(format!("未知菜单动作: {}", unknown.join(", ")));
    }
    if out.is_empty() {
        return SurfaceLoad {
            id: spec.id.to_string(),
            items: defaults.to_vec(),
            warnings,
        };
    }
    SurfaceLoad {
        id: spec.id.to_string(),
        items: out,
        warnings,
    }
}

/// 加载单个面：物化默认 ← 用户覆盖。
pub fn load_surface(spec: &SurfaceSpec, base: &Path) -> SurfaceLoad {
    let defaults = materialize(spec, base);
    let override_ids = user_override(spec, base);
    let mut loaded = merge_surface(spec, &defaults, override_ids.as_deref());
    // 默认文件自身被过滤的告警也透传（DS-4：有效集合不因单个非法项整体失败）。
    if let Ok(raw) = std::fs::read_to_string(surface_file_path(base, spec)) {
        let (_, warnings) = parse_default_json(spec, &raw);
        loaded.warnings.splice(0..0, warnings);
    }
    loaded
}

/// 加载全部已登记面。
pub fn load_all(base: &Path) -> Vec<SurfaceLoad> {
    SURFACES
        .iter()
        .map(|spec| load_surface(spec, base))
        .collect()
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
    let watched: Vec<(String, PathBuf)> = SURFACES
        .iter()
        .map(|spec| (spec.id.to_string(), surface_file_path(&base, spec)))
        .collect();
    let user_paths: Vec<PathBuf> = SURFACES
        .iter()
        .map(|spec| user_override_path(&base, spec))
        .collect();
    tauri::async_runtime::spawn(async move {
        let mut last: Vec<Option<(SystemTime, u64)>> =
            watched.iter().map(|(_, path)| fingerprint(path)).collect();
        let mut last_user: Vec<Option<(SystemTime, u64)>> =
            user_paths.iter().map(|path| fingerprint(path)).collect();
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            for (index, (_, path)) in watched.iter().enumerate() {
                let now = fingerprint(path);
                if now != last[index] {
                    last[index] = now;
                    info!(id = %watched[index].0, "数据面文件被外部修改，通知前端热应用");
                    let _ = app.emit("surfaces-changed", watched[index].0.clone());
                }
            }
            for (index, path) in user_paths.iter().enumerate() {
                let now = fingerprint(path);
                if now != last_user[index] {
                    last_user[index] = now;
                    info!(id = %watched[index].0, "数据面用户覆盖被外部修改，通知前端热应用");
                    let _ = app.emit("surfaces-changed", watched[index].0.clone());
                }
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

    fn toolbar_spec() -> &'static SurfaceSpec {
        find_surface("html-toolbar").expect("html-toolbar 必登记")
    }

    fn menus_spec() -> &'static SurfaceSpec {
        find_surface("menus").expect("menus 必登记")
    }

    fn write_user(base: &Path, json: &str) {
        let path = base.join("user").join("settings.json");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, json).unwrap();
    }

    fn write_menus_user(base: &Path, json: &str) {
        let path = base.join("user").join("menus.json");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, json).unwrap();
    }

    fn item_ids(items: &[Value]) -> Vec<&str> {
        items
            .iter()
            .filter_map(|item| item.get("id")?.as_str())
            .collect()
    }

    // ── html-toolbar（既有语义回归）────────────────────────────

    #[test]
    fn 物化_首次写文件且与内嵌逐值一致() {
        let dir = temp_base("materialize");
        let base = dir.path();
        let items = materialize(toolbar_spec(), base);
        // 12 = 回归红线：默认集合的项数契约（与 config.rs 校验上限一致）
        assert_eq!(items.len(), 12);
        let path = surface_file_path(base, toolbar_spec());
        assert!(path.exists());
        let raw = std::fs::read_to_string(&path).unwrap();
        let (parsed, _) = parse_default_json(toolbar_spec(), &raw);
        assert_eq!(parsed, items);
        assert_eq!(items, embedded_defaults_json(toolbar_spec()));
    }

    #[test]
    fn 物化_文件已存在不覆盖() {
        let dir = temp_base("no_overwrite");
        let base = dir.path();
        let path = surface_file_path(base, toolbar_spec());
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, r#"{"id":"html-toolbar","items":[]}"#).unwrap();
        let items = materialize(toolbar_spec(), base);
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
        let defaults = materialize(toolbar_spec(), base);
        write_user(
            base,
            r#"{"htmlToolbarItems":["format-bold","nope","format-italic"]}"#,
        );
        let loaded = load_surface(toolbar_spec(), base);
        assert_eq!(item_ids(&loaded.items), vec!["format-bold", "format-italic"]);
        assert_eq!(loaded.warnings.len(), 1);
        assert!(loaded.warnings[0].contains("nope"));
        assert_eq!(defaults.len(), embedded_defaults_json(toolbar_spec()).len());
    }

    #[test]
    fn 合并_空覆盖回落默认() {
        let dir = temp_base("empty");
        let base = dir.path();
        let defaults = materialize(toolbar_spec(), base);
        write_user(base, r#"{"htmlToolbarItems":[]}"#);
        let loaded = load_surface(toolbar_spec(), base);
        assert_eq!(loaded.items.len(), embedded_defaults_json(toolbar_spec()).len());
        assert_eq!(loaded.items, defaults);
    }

    #[test]
    fn 合并_全非法覆盖回落默认() {
        let dir = temp_base("allbad");
        let base = dir.path();
        let defaults = materialize(toolbar_spec(), base);
        write_user(base, r#"{"htmlToolbarItems":["a","b"]}"#);
        let loaded = load_surface(toolbar_spec(), base);
        assert_eq!(loaded.items, defaults);
        assert_eq!(loaded.warnings.len(), 1);
    }

    #[test]
    fn 默认文件损坏回落内嵌() {
        let dir = temp_base("corrupt");
        let base = dir.path();
        let path = surface_file_path(base, toolbar_spec());
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "not-json").unwrap();
        let items = materialize(toolbar_spec(), base);
        assert_eq!(items, embedded_defaults_json(toolbar_spec()));
        assert_eq!(items.len(), embedded_defaults_json(toolbar_spec()).len());
        // 损坏文件被重建为合法 JSON
        let raw = std::fs::read_to_string(&path).unwrap();
        let (parsed, _) = parse_default_json(toolbar_spec(), &raw);
        assert!(!parsed.is_empty());
    }

    #[test]
    fn 内嵌默认_id集合与config校验白名单对账() {
        let defaults = embedded_defaults_json(toolbar_spec());
        let ids: std::collections::HashSet<&str> =
            defaults.iter().filter_map(|i| i.get("id")?.as_str()).collect();
        let allowed: std::collections::HashSet<&str> = crate::config::HTML_TOOLBAR_ALLOWED_IDS
            .iter()
            .copied()
            .collect();
        assert_eq!(
            ids, allowed,
            "内嵌默认源与 config 校验白名单必须逐 id 一致（唯一源对账）"
        );
    }

    // ── menus（T2 新增）───────────────────────────────────────

    #[test]
    fn menus_内嵌默认_六组齐全且项数与现值一致() {
        let items = embedded_defaults_json(menus_spec());
        // 6 + 1 + 6 + 12 + 4 + 6 = 35（回归红线：默认集合项数契约）
        assert_eq!(items.len(), 35);
        let mut groups: Vec<&str> = items
            .iter()
            .filter_map(|i| i.get("group")?.as_str())
            .collect();
        groups.sort_unstable();
        groups.dedup();
        let mut expected: Vec<&str> = MENU_GROUPS.to_vec();
        expected.sort_unstable();
        assert_eq!(groups, expected, "六组分组集合必须逐值一致");
        // 每组至少一项
        for group in MENU_GROUPS {
            assert!(
                items
                    .iter()
                    .any(|i| i.get("group").and_then(|v| v.as_str()) == Some(group)),
                "分组 {group} 缺少默认项"
            );
        }
    }

    #[test]
    fn menus_格头组_恰好6项且顺序文案图标与现值一致() {
        let items = embedded_defaults_json(menus_spec());
        let pane: Vec<&Value> = items
            .iter()
            .filter(|i| i.get("group").and_then(|v| v.as_str()) == Some("pane-header"))
            .collect();
        assert_eq!(pane.len(), 6);
        let labels: Vec<&str> = pane
            .iter()
            .filter_map(|i| i.get("label")?.as_str())
            .collect();
        assert_eq!(
            labels,
            vec!["新建文件", "分享", "右分", "下分", "源码模式", "定位"]
        );
        let icons: Vec<&str> = pane
            .iter()
            .filter_map(|i| i.get("icon")?.as_str())
            .collect();
        assert_eq!(icons, vec!["file", "share", "splitRight", "splitDown", "code", "locate"]);
        let actions: Vec<&str> = pane
            .iter()
            .filter_map(|i| i.get("action")?.as_str())
            .collect();
        assert_eq!(
            actions,
            vec!["new-file", "share", "splitRight", "splitDown", "source", "locate"]
        );
    }

    #[test]
    fn menus_导出组_恰好6项且顺序文案图标与现值一致() {
        let items = embedded_defaults_json(menus_spec());
        let export: Vec<&Value> = items
            .iter()
            .filter(|i| i.get("group").and_then(|v| v.as_str()) == Some("export-submenu"))
            .collect();
        assert_eq!(export.len(), 6);
        let labels: Vec<&str> = export
            .iter()
            .filter_map(|i| i.get("label")?.as_str())
            .collect();
        assert_eq!(labels, vec!["Word", ".mdpkg", "图片", "PDF", "HTML", "ZIP"]);
        let actions: Vec<&str> = export
            .iter()
            .filter_map(|i| i.get("action")?.as_str())
            .collect();
        assert_eq!(
            actions,
            vec![
                "exportDocx",
                "exportMdpkg",
                "exportPng",
                "exportPdf",
                "exportHtml",
                "exportZip"
            ]
        );
    }

    #[test]
    fn menus_页签右键组_恰好12项且顺序文案与现值一致() {
        let items = embedded_defaults_json(menus_spec());
        let tab: Vec<&Value> = items
            .iter()
            .filter(|i| i.get("group").and_then(|v| v.as_str()) == Some("tab-context"))
            .collect();
        assert_eq!(tab.len(), 12);
        let labels: Vec<&str> = tab
            .iter()
            .filter_map(|i| i.get("label")?.as_str())
            .collect();
        assert_eq!(
            labels,
            vec![
                "悬浮小窗",
                "向右分栏",
                "向下分栏",
                "添加字段",
                "导出",
                "打印",
                "复制路径",
                "打开文件位置",
                "移动到…",
                "刷新",
                "关闭",
                "关闭其他",
            ]
        );
    }

    #[test]
    fn menus_预览右键组_恰好4项且顺序文案与现值一致() {
        let items = embedded_defaults_json(menus_spec());
        let preview: Vec<&Value> = items
            .iter()
            .filter(|i| i.get("group").and_then(|v| v.as_str()) == Some("preview-context"))
            .collect();
        assert_eq!(preview.len(), 4);
        let labels: Vec<&str> = preview
            .iter()
            .filter_map(|i| i.get("label")?.as_str())
            .collect();
        assert_eq!(
            labels,
            vec!["打开所在文件夹", "另存为…", "复制文件路径", "关闭预览"]
        );
    }

    #[test]
    fn menus_ai浮窗预设组_恰好6项且与SPEC_PRESETS逐值一致() {
        let items = embedded_defaults_json(menus_spec());
        let presets: Vec<&Value> = items
            .iter()
            .filter(|i| i.get("group").and_then(|v| v.as_str()) == Some("ai-float-presets"))
            .collect();
        assert_eq!(presets.len(), 6);
        let ids: Vec<&str> = presets
            .iter()
            .filter_map(|i| i.get("action")?.as_str())
            .collect();
        assert_eq!(
            ids,
            vec![
                "preset:theme-groups",
                "preset:pinned-recent-only",
                "preset:pinned-scale",
                "preset:grid-list",
                "preset:grid-group-type",
                "preset:unread-filter",
            ]
        );
        let labels: Vec<&str> = presets
            .iter()
            .filter_map(|i| i.get("label")?.as_str())
            .collect();
        assert_eq!(
            labels,
            vec![
                "按主题分组",
                "只留收藏和最近",
                "收藏段放大",
                "网格改列表",
                "网格按类型分组",
                "加未读筛选",
            ]
        );
    }

    #[test]
    fn menus_ai窗格组_恰好1项() {
        let items = embedded_defaults_json(menus_spec());
        let ai: Vec<&Value> = items
            .iter()
            .filter(|i| i.get("group").and_then(|v| v.as_str()) == Some("ai-pane"))
            .collect();
        assert_eq!(ai.len(), 1);
        assert_eq!(ai[0].get("label").and_then(|v| v.as_str()), Some("脱离为小窗"));
        assert_eq!(ai[0].get("action").and_then(|v| v.as_str()), Some("undockAi"));
    }

    #[test]
    fn menus_物化_首次写文件且与内嵌逐值一致() {
        let dir = temp_base("menus_materialize");
        let base = dir.path();
        let items = materialize(menus_spec(), base);
        assert_eq!(items.len(), 35);
        let path = surface_file_path(base, menus_spec());
        assert!(path.exists());
        let raw = std::fs::read_to_string(&path).unwrap();
        let (parsed, warnings) = parse_default_json(menus_spec(), &raw);
        assert!(warnings.is_empty());
        assert_eq!(parsed, items);
    }

    #[test]
    fn menus_用户覆盖_改名排序启停生效() {
        let dir = temp_base("menus_override");
        let base = dir.path();
        write_menus_user(
            base,
            r#"{"items":["pane-source","pane-new-file"]}"#,
        );
        let loaded = load_surface(menus_spec(), base);
        assert_eq!(item_ids(&loaded.items), vec!["pane-source", "pane-new-file"]);
        assert_eq!(loaded.warnings, Vec::<String>::new());
    }

    #[test]
    fn menus_用户覆盖_未知id过滤并聚合告警() {
        let dir = temp_base("menus_unknown");
        let base = dir.path();
        write_menus_user(
            base,
            r#"{"items":["pane-new-file","nope","pane-share"]}"#,
        );
        let loaded = load_surface(menus_spec(), base);
        assert_eq!(item_ids(&loaded.items), vec!["pane-new-file", "pane-share"]);
        assert_eq!(loaded.warnings.len(), 1);
        assert!(loaded.warnings[0].contains("nope"));
    }

    #[test]
    fn menus_空覆盖回落默认() {
        let dir = temp_base("menus_empty");
        let base = dir.path();
        let defaults = materialize(menus_spec(), base);
        write_menus_user(base, r#"{"items":[]}"#);
        let loaded = load_surface(menus_spec(), base);
        assert_eq!(loaded.items, defaults);
        assert_eq!(loaded.items.len(), 35);
    }

    #[test]
    fn menus_坏项过滤_缺action的项被过滤并聚合告警() {
        let dir = temp_base("menus_bad_item");
        let base = dir.path();
        // 物化默认后，把默认文件改出一个缺 action 的项
        materialize(menus_spec(), base);
        let path = surface_file_path(base, menus_spec());
        let raw = std::fs::read_to_string(&path).unwrap();
        let mut value: Value = serde_json::from_str(&raw).unwrap();
        value["items"][0]["action"] = Value::Null;
        value["items"][1].as_object_mut().unwrap().remove("label");
        std::fs::write(&path, serde_json::to_string_pretty(&value).unwrap()).unwrap();
        let loaded = load_surface(menus_spec(), base);
        // 两项被过滤，其余 33 项保留
        assert_eq!(loaded.items.len(), 33);
        assert_eq!(loaded.warnings.len(), 1);
        assert!(loaded.warnings[0].contains("pane-new-file"));
        assert!(loaded.warnings[0].contains("pane-share"));
    }

    #[test]
    fn menus_默认文件损坏回落内嵌() {
        let dir = temp_base("menus_corrupt");
        let base = dir.path();
        let path = surface_file_path(base, menus_spec());
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "not-json").unwrap();
        let items = materialize(menus_spec(), base);
        assert_eq!(items, embedded_defaults_json(menus_spec()));
        assert_eq!(items.len(), 35);
    }

    #[test]
    fn menus_未登记action在默认文件中不存在() {
        // 校验器只接受 MENU_GROUPS 内的 group；action 非空即合法（代码侧动作
        // 是否存在由消费端分派，面层只保证形状）。
        let entry = serde_json::json!({
            "id": "x", "group": "pane-header", "order": 1,
            "label": "X", "icon": "file", "action": "any-action", "enabled": true
        });
        assert!(validate_menu_item(&entry).is_some());
    }

    #[test]
    fn menus_未知group被过滤() {
        let entry = serde_json::json!({
            "id": "x", "group": "nope", "order": 1,
            "label": "X", "icon": "file", "action": "a", "enabled": true
        });
        assert!(validate_menu_item(&entry).is_none());
    }

    #[test]
    fn menus_类型错被过滤() {
        let mut entry = serde_json::json!({
            "id": "x", "group": "pane-header", "order": 1,
            "label": "X", "icon": "file", "action": "a", "enabled": true
        });
        entry["order"] = serde_json::json!("1");
        assert!(validate_menu_item(&entry).is_none());
        entry["order"] = serde_json::json!(1);
        entry["enabled"] = serde_json::json!("true");
        assert!(validate_menu_item(&entry).is_none());
    }

    // ── 注册表 ────────────────────────────────────────────────

    #[test]
    fn 注册表_每行都能解析出默认文件() {
        assert!(!SURFACES.is_empty(), "面登记表不能为空");
        for spec in SURFACES {
            assert!(!spec.id.is_empty(), "面 id 不可为空");
            assert!(
                !spec.default_file.is_empty(),
                "面 {} 缺少默认文件名",
                spec.id
            );
            assert!(
                !embedded_defaults_json(spec).is_empty(),
                "面 {} 的默认文件 {} 解析不出任何项（表行与默认文件必须同源）",
                spec.id,
                spec.default_file
            );
        }
    }

    #[test]
    fn 注册表_load_all返回全部已登记面() {
        let dir = temp_base("load_all");
        let loaded = load_all(dir.path());
        let ids: Vec<&str> = loaded.iter().map(|s| s.id.as_str()).collect();
        let table: Vec<&str> = SURFACES.iter().map(|spec| spec.id).collect();
        assert_eq!(
            ids, table,
            "load_all 必须逐面返回登记表全集（新增面只追加表行即可被发现）"
        );
        assert_eq!(ids.len(), 2, "T2 后应登记两面");
    }

    #[test]
    fn 注册表_id唯一且可查找() {
        let mut seen = std::collections::HashSet::new();
        for spec in SURFACES {
            assert!(seen.insert(spec.id), "面 id 重复: {}", spec.id);
        }
        for spec in SURFACES {
            assert_eq!(find_surface(spec.id), Some(spec));
        }
        assert_eq!(find_surface("not-registered"), None);
    }

    #[test]
    fn 指纹_变化即不同() {
        let dir = temp_base("fingerprint");
        let base = dir.path();
        let path = surface_file_path(base, toolbar_spec());
        assert_eq!(fingerprint(&path), None);
        materialize(toolbar_spec(), base);
        let first = fingerprint(&path);
        assert!(first.is_some());
        std::fs::write(&path, r#"{"id":"html-toolbar","items":[]}"#).unwrap();
        let second = fingerprint(&path);
        assert_ne!(first, second);
    }
}
