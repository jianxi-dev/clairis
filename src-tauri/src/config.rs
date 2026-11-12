use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

use crate::errors::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub font_size: Option<f64>,
    pub heading_colors: Option<HeadingColors>,
    // 阅读区设置（预览专用，与编辑器字号解耦）
    pub reader_font_size: Option<f64>,
    pub reader_width: Option<f64>,
    pub reader_skin: Option<String>,
    pub ollama_endpoint: Option<String>,
    pub openai_endpoint: Option<String>,
    pub openai_model: Option<String>,
    #[serde(skip)]
    pub openai_api_key: Option<String>,
    pub translation_provider: Option<String>,
    pub source_lang: Option<String>,
    pub target_lang: Option<String>,
    pub theme: Option<String>,
    pub ai_confirm_density: Option<String>,
    pub sidebar_left_visible: Option<bool>,
    pub sidebar_right_visible: Option<bool>,
    pub sidebar_left_width: Option<f64>,
    pub sidebar_right_width: Option<f64>,
    pub horizontal_split_ratio: Option<f64>,
    pub vertical_split_ratio: Option<f64>,
    pub recent_files: Option<Vec<RecentFile>>,
    pub scroll_positions: Option<HashMap<String, ScrollPosition>>,
    /// 核心能力开关：只记录被关闭的能力，缺省即全开（spec X-3）。
    pub capabilities: Option<HashMap<String, bool>>,
    /// 图标标签级别（Layout Portal §10）：auto / text / icon。
    pub icon_label: Option<String>,
    /// 工作区 pane 递归树（layout-portal 3.1）：序列化后的 JSON 字符串。
    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pane_layout: Option<String>,
    /// 阅读空间栏「设为默认」的视图规格（layout-portal 6.1）。
    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rail_view_spec: Option<RailViewSpec>,
    /// 悬浮预览窗双轨开关（layout-portal 8.1）。
    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_settings: Option<PreviewSettings>,
    /// AI 视图改写规格（layout-portal 9.1）。
    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ai_view_spec: Option<AiViewSpec>,
    /// 轮盘根扇区集合与顺序（ui-command-registry 2.1）。缺省 = 内置默认。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub roulette_sectors: Option<Vec<String>>,
    /// 横向工具条动作集合与顺序（ui-toolbar-slots 1.1）。缺省 = 内置默认。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub html_toolbar_items: Option<Vec<String>>,
    /// 新建文档首次保存的默认目录（ui-polish-batch12 6.1）。
    /// `default` + `skip_serializing_if` 让老配置仍能读、新配置不多出空字段。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_save_path: Option<String>,
    /// 轮盘开关快捷键（ui-polish-batch15 2.1）；缺省 = Mod+Shift+Space。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub roulette_hotkey: Option<String>,
    /// 轮盘默认形态（ui-polish-batch15 2.1）：hub 圆心 / disk 整盘。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub roulette_form: Option<String>,
    /// 轮盘圆心位置（ui-polish-batch15 2.1）：中键拖动后的落点，重载后保持。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub roulette_position: Option<RoulettePosition>,
    /// 提示信息显示时长（秒，ui-polish-batch15 4.1）：0.1–10，最多 1 位小数。
    /// 缺省 = None，消费端按 3 秒处理。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notice_duration: Option<f64>,
}

/// 轮盘位置（ui-polish-batch15 2.1）：中键拖动后的圆心坐标（屏内像素）。
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RoulettePosition {
    pub x: f64,
    pub y: f64,
}

/// AI 视图改写规格：布局 / 密度 / 卡片高度 / 区块颜色 / 图标标签 / 预览开关 /
/// 面板宽窄 / 网格排布与分组 / 未读 / 主题分组 / 置顶段缩放。
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiViewSpec {
    pub rail_layout: Option<String>,
    pub rail_density: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rail_card_height: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block_colors: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_enabled: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rail_pinned_width: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grid_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grid_grouping: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grid_sort: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unread_only: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme_groups: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pinned_and_recent_only: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pinned_segment_scale: Option<f64>,
}

/// 悬浮预览窗开关：阅读空间悬停 / 网格触发方式 / 总开关。
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSettings {
    pub rail_hover: Option<bool>,
    /// hover / click / off；非法值由校验拦下。
    pub grid_mode: Option<String>,
    pub enabled: Option<bool>,
}

/// 阅读空间栏视图规格：布局（堆叠/标签）、密度（紧凑/舒适/卡片）与卡片高度。
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RailViewSpec {
    pub layout: Option<String>,
    pub density: Option<String>,
    /// 卡片档高度 88–160；旧配置无此字段仍可加载（default + skip）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub card_height: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentFile {
    pub path: String,
    pub title: String,
    pub opened_at: String,
    /// 打开时截下的正文开头；门户卡片用它显示真摘要。
    /// `default` + `skip_serializing_if` 保证老配置文件仍能读、新文件不多出空字段。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub excerpt: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScrollPosition {
    pub scroll_pos: f64,
    pub content_height: f64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            font_size: Some(17.0),
            heading_colors: None,
            reader_font_size: Some(17.0),
            reader_width: Some(1080.0),
            reader_skin: Some("paper".into()),
            ollama_endpoint: Some("http://localhost:11434".into()),
            openai_endpoint: Some("https://api.openai.com".into()),
            openai_model: Some("gpt-4o-mini".into()),
            openai_api_key: None,
            translation_provider: Some("ollama".into()),
            source_lang: Some("en".into()),
            target_lang: Some("zh-CN".into()),
            theme: Some("system".into()),
            ai_confirm_density: Some("session-silent".into()),
            icon_label: Some("text".into()),
            pane_layout: None,
            rail_view_spec: None,
            preview_settings: None,
            ai_view_spec: None,
            roulette_sectors: None,
            html_toolbar_items: None,
            default_save_path: None,
            roulette_hotkey: None,
            roulette_form: None,
            roulette_position: None,
            notice_duration: None,
            sidebar_left_visible: Some(true),
            sidebar_right_visible: Some(false),
            sidebar_left_width: Some(220.0),
            sidebar_right_width: Some(320.0),
            horizontal_split_ratio: Some(0.5),
            vertical_split_ratio: Some(0.5),
            recent_files: Some(Vec::new()),
            scroll_positions: Some(HashMap::new()),
            capabilities: Some(HashMap::new()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HeadingColors {
    pub h1: Option<String>,
    pub h2: Option<String>,
    pub h3: Option<String>,
    pub h4: Option<String>,
    pub h5: Option<String>,
    pub h6: Option<String>,
}

// ── 目录布局（design §D1）─────────────────────────────────────

const DEFAULTS_FILE: &str = "settings.json";
const USER_FILE: &str = "settings.json";
const STATE_FILE: &str = "state.json";
const LEGACY_FILE: &str = "app_config.json";
const SNAPSHOT_PREFIX: &str = "settings-";
const SNAPSHOT_LIMIT: usize = 10;

fn defaults_path(base: &Path) -> PathBuf {
    base.join("defaults").join(DEFAULTS_FILE)
}

fn user_path(base: &Path) -> PathBuf {
    base.join("user").join(USER_FILE)
}

fn state_path(base: &Path) -> PathBuf {
    base.join("state").join(STATE_FILE)
}

fn snapshots_dir(base: &Path) -> PathBuf {
    base.join("snapshots")
}

/// 旧版单文件配置（分层改造前的 `app_config.json`）。
fn legacy_path(base: &Path) -> PathBuf {
    base.join(LEGACY_FILE)
}

// ── 原子写（design §D2）───────────────────────────────────────

fn io_err(context: &str, source: std::io::Error) -> AppError {
    AppError::Io {
        context: context.into(),
        source,
    }
}

fn json_err(context: &str, source: serde_json::Error) -> AppError {
    AppError::Serialization {
        context: context.into(),
        source,
    }
}

/// 同目录临时文件 → fsync → rename。任一步失败都删除临时文件并返回错误，
/// 目标文件保持写入前的字节不变（rename 是原子替换）。
fn atomic_write(path: &Path, data: &[u8]) -> Result<(), AppError> {
    let dir = path
        .parent()
        .ok_or_else(|| io_err("atomic write", std::io::Error::other("path has no parent")))?;
    std::fs::create_dir_all(dir).map_err(|e| io_err("create config dir", e))?;

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "config".into());
    let tmp = dir.join(format!(".{file_name}.tmp-{}-{nanos}", std::process::id()));

    let result = (|| -> std::io::Result<()> {
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(data)?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(&tmp, path)
    })();

    if let Err(e) = result {
        let _ = std::fs::remove_file(&tmp);
        return Err(io_err("atomic write", e));
    }
    Ok(())
}

// ── 合并（design §D2）────────────────────────────────────────

fn merge_json(defaults: &Value, user: &Value) -> Value {
    match (defaults, user) {
        (Value::Object(base), Value::Object(over)) => {
            let mut merged = base.clone();
            for (key, value) in over {
                let next = match merged.get(key) {
                    Some(existing) => merge_json(existing, value),
                    None => value.clone(),
                };
                merged.insert(key.clone(), next);
            }
            Value::Object(merged)
        }
        (base, Value::Null) => base.clone(),
        (_, over) => over.clone(),
    }
}

fn read_json(path: &Path) -> Result<Option<Value>, AppError> {
    match std::fs::read_to_string(path) {
        Ok(data) => serde_json::from_str(&data)
            .map(Some)
            .map_err(|e| json_err(&format!("parse {}", path.display()), e)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(io_err(&format!("read {}", path.display()), e)),
    }
}

/// 损坏的文件改名留档后按缺失处理，避免一次手滑就让应用起不来。
fn read_json_or_quarantine(path: &Path) -> Option<Value> {
    match read_json(path) {
        Ok(value) => value,
        Err(e) => {
            warn!(error = %e, path = %path.display(), "配置文件无法解析，已改名留档");
            let _ = std::fs::rename(path, path.with_extension("json.bak"));
            None
        }
    }
}

fn ensure_defaults(base: &Path) -> Result<(), AppError> {
    let path = defaults_path(base);
    if path.exists() {
        return Ok(());
    }
    let data = serde_json::to_vec_pretty(&settings_value(&AppConfig::default())?)
        .map_err(|e| json_err("defaults", e))?;
    atomic_write(&path, &data)
}

/// 设置字段（不含派生状态），用于写入 user 层与快照。
fn settings_value(config: &AppConfig) -> Result<Value, AppError> {
    let mut value = serde_json::to_value(config).map_err(|e| json_err("config", e))?;
    if let Value::Object(map) = &mut value {
        map.remove("recentFiles");
        map.remove("scrollPositions");
    }
    Ok(value)
}

fn state_value(config: &AppConfig) -> Result<Value, AppError> {
    let recent_files = serde_json::to_value(config.recent_files.clone().unwrap_or_default())
        .map_err(|e| json_err("recentFiles", e))?;
    let scroll_positions =
        serde_json::to_value(config.scroll_positions.clone().unwrap_or_default())
            .map_err(|e| json_err("scrollPositions", e))?;
    Ok(serde_json::json!({
        "recentFiles": recent_files,
        "scrollPositions": scroll_positions,
    }))
}

fn effective_config(
    defaults: Value,
    user: Option<Value>,
    state: Option<Value>,
) -> Result<AppConfig, AppError> {
    let mut merged = merge_json(&defaults, user.as_ref().unwrap_or(&Value::Null));
    if let (Value::Object(map), Some(Value::Object(state))) = (&mut merged, state) {
        for key in ["recentFiles", "scrollPositions"] {
            if let Some(value) = state.get(key) {
                map.insert(key.to_string(), value.clone());
            }
        }
    }
    serde_json::from_value(merged).map_err(|e| json_err("effective config", e))
}

/// 旧 `app_config.json` 拆成 user + state。旧文件保留不动，靠 user 层是否
/// 存在判断是否需要迁移，因此重复调用天然幂等。
fn migrate_legacy(base: &Path) -> Result<bool, AppError> {
    let legacy = legacy_path(base);
    if user_path(base).exists() || !legacy.exists() {
        return Ok(false);
    }
    let Some(raw) = read_json_or_quarantine(&legacy) else {
        return Ok(false);
    };
    let config: AppConfig =
        serde_json::from_value(raw).map_err(|e| json_err("legacy config", e))?;
    let user = serde_json::to_vec_pretty(&settings_value(&config)?)
        .map_err(|e| json_err("legacy settings", e))?;
    let state = serde_json::to_vec_pretty(&state_value(&config)?)
        .map_err(|e| json_err("legacy state", e))?;
    atomic_write(&user_path(base), &user)?;
    atomic_write(&state_path(base), &state)?;
    info!(from = %legacy.display(), "旧配置已拆分为 user/state 两层");
    Ok(true)
}

// ── 校验（design §D5）────────────────────────────────────────

fn check_range(field: &str, value: Option<f64>, min: f64, max: f64) -> Result<(), AppError> {
    match value {
        Some(v) if !(min..=max).contains(&v) => Err(AppError::Validation {
            context: field.into(),
            message: format!("{v} 超出范围 {min}–{max}"),
        }),
        _ => Ok(()),
    }
}

fn check_enum(field: &str, value: Option<&str>, allowed: &[&str]) -> Result<(), AppError> {
    match value {
        Some(v) if !allowed.contains(&v) => Err(AppError::Validation {
            context: field.into(),
            message: format!("{v} 不属于 {}", allowed.join("|")),
        }),
        _ => Ok(()),
    }
}

/// 提示时长（ui-polish-batch15 4.1）：有限数、0.1–10、最多 1 位小数。
fn check_notice_duration(value: Option<f64>) -> Result<(), AppError> {
    let Some(v) = value else { return Ok(()) };
    if !v.is_finite() {
        return Err(AppError::Validation {
            context: "noticeDuration".into(),
            message: "必须是有限数值".into(),
        });
    }
    if !(0.1..=10.0).contains(&v) {
        return Err(AppError::Validation {
            context: "noticeDuration".into(),
            message: format!("{v} 超出范围 0.1–10"),
        });
    }
    if (v * 10.0 - (v * 10.0).round()).abs() > 1e-9 {
        return Err(AppError::Validation {
            context: "noticeDuration".into(),
            message: format!("{v} 最多 1 位小数"),
        });
    }
    Ok(())
}

pub fn validate_config(config: &AppConfig) -> Result<(), AppError> {
    check_range("fontSize", config.font_size, 8.0, 96.0)?;
    check_range("readerFontSize", config.reader_font_size, 8.0, 96.0)?;
    check_range("readerWidth", config.reader_width, 480.0, 2400.0)?;
    check_range("sidebarLeftWidth", config.sidebar_left_width, 0.0, 800.0)?;
    check_range("sidebarRightWidth", config.sidebar_right_width, 0.0, 800.0)?;
    check_range(
        "horizontalSplitRatio",
        config.horizontal_split_ratio,
        0.0,
        1.0,
    )?;
    check_range("verticalSplitRatio", config.vertical_split_ratio, 0.0, 1.0)?;
    check_enum(
        "theme",
        config.theme.as_deref(),
        &["light", "dark", "warm", "system"],
    )?;
    check_enum(
        "aiConfirmDensity",
        config.ai_confirm_density.as_deref(),
        &["always", "session-silent", "never"],
    )?;
    check_enum(
        "iconLabel",
        config.icon_label.as_deref(),
        &["auto", "text", "icon"],
    )?;
    check_enum(
        "readerSkin",
        config.reader_skin.as_deref(),
        &["paper", "plain"],
    )?;
    if let Some(spec) = &config.rail_view_spec {
        check_enum(
            "railViewSpec.layout",
            spec.layout.as_deref(),
            &["stacked", "tabs"],
        )?;
        check_enum(
            "railViewSpec.density",
            spec.density.as_deref(),
            &["compact", "comfortable", "card"],
        )?;
        check_range("railViewSpec.cardHeight", spec.card_height, 88.0, 160.0)?;
    }
    if let Some(preview) = &config.preview_settings {
        check_enum(
            "previewSettings.gridMode",
            preview.grid_mode.as_deref(),
            &["hover", "click", "off"],
        )?;
    }
    if let Some(spec) = &config.ai_view_spec {
        check_enum(
            "aiViewSpec.railLayout",
            spec.rail_layout.as_deref(),
            &["stacked", "tabs"],
        )?;
        check_enum(
            "aiViewSpec.railDensity",
            spec.rail_density.as_deref(),
            &["compact", "comfortable", "card"],
        )?;
        check_enum(
            "aiViewSpec.iconLabel",
            spec.icon_label.as_deref(),
            &["auto", "text", "icon"],
        )?;
        check_enum(
            "aiViewSpec.gridMode",
            spec.grid_mode.as_deref(),
            &["grid", "list"],
        )?;
        check_enum(
            "aiViewSpec.gridGrouping",
            spec.grid_grouping.as_deref(),
            &["time", "none", "type"],
        )?;
        check_enum(
            "aiViewSpec.gridSort",
            spec.grid_sort.as_deref(),
            &["recent", "name", "type"],
        )?;
        check_range(
            "aiViewSpec.railCardHeight",
            spec.rail_card_height,
            88.0,
            160.0,
        )?;
        check_range(
            "aiViewSpec.railPinnedWidth",
            spec.rail_pinned_width,
            200.0,
            360.0,
        )?;
        check_range(
            "aiViewSpec.pinnedSegmentScale",
            spec.pinned_segment_scale,
            1.0,
            1.5,
        )?;
    }
    if let Some(sectors) = &config.roulette_sectors {
        const ALLOWED: [&str; 8] = [
            "smart", "convert", "align", "columns", "history", "clear", "format", "color",
        ];
        if sectors.is_empty() || sectors.len() > ALLOWED.len() {
            return Err(AppError::Validation {
                context: "rouletteSectors".into(),
                message: "长度须在 1..=8".into(),
            });
        }
        let mut seen = std::collections::HashSet::new();
        for id in sectors {
            if !ALLOWED.contains(&id.as_str()) {
                return Err(AppError::Validation {
                    context: "rouletteSectors".into(),
                    message: format!("未知扇区: {id}"),
                });
            }
            if !seen.insert(id.as_str()) {
                return Err(AppError::Validation {
                    context: "rouletteSectors".into(),
                    message: format!("重复扇区: {id}"),
                });
            }
        }
    }
    if let Some(form) = &config.roulette_form {
        check_enum("rouletteForm", Some(form.as_str()), &["hub", "disk"])?;
    }
    check_notice_duration(config.notice_duration)?;
    if let Some(pos) = &config.roulette_position {
        check_range("roulettePosition.x", Some(pos.x), -20000.0, 20000.0)?;
        check_range("roulettePosition.y", Some(pos.y), -20000.0, 20000.0)?;
    }
    if let Some(items) = &config.html_toolbar_items {
        const ALLOWED: [&str; 12] = [
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
        if items.is_empty() || items.len() > ALLOWED.len() {
            return Err(AppError::Validation {
                context: "htmlToolbarItems".into(),
                message: "长度须在 1..=12".into(),
            });
        }
        let mut seen = std::collections::HashSet::new();
        for id in items {
            if !ALLOWED.contains(&id.as_str()) {
                return Err(AppError::Validation {
                    context: "htmlToolbarItems".into(),
                    message: format!("未知动作: {id}"),
                });
            }
            if !seen.insert(id.as_str()) {
                return Err(AppError::Validation {
                    context: "htmlToolbarItems".into(),
                    message: format!("重复动作: {id}"),
                });
            }
        }
    }
    Ok(())
}

// ── 快照（design §D4）────────────────────────────────────────

fn snapshot_name() -> String {
    let stamp = chrono::Utc::now()
        .format("%Y-%m-%dT%H-%M-%S-%6fZ")
        .to_string();
    format!("{SNAPSHOT_PREFIX}{stamp}.json")
}

/// 快照文件名只接受 `settings-` 前缀与安全字符，拒绝路径穿越。
fn is_safe_snapshot_name(name: &str) -> bool {
    name.starts_with(SNAPSHOT_PREFIX)
        && name.ends_with(".json")
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

/// 把当前 user 层复制进 snapshots/。user 层不存在时跳过。
fn snapshot_user(base: &Path) -> Result<(), AppError> {
    let source = user_path(base);
    if !source.exists() {
        return Ok(());
    }
    let data = std::fs::read(&source).map_err(|e| io_err("read user config", e))?;
    atomic_write(&snapshots_dir(base).join(snapshot_name()), &data)
}

/// 只保留最新 10 份；文件名按时间升序，因此保留字典序最大的 10 个。
fn prune_snapshots(base: &Path) -> Result<(), AppError> {
    let mut names = list_snapshots(base)?;
    if names.len() <= SNAPSHOT_LIMIT {
        return Ok(());
    }
    names.sort();
    let dir = snapshots_dir(base);
    for name in &names[..names.len() - SNAPSHOT_LIMIT] {
        std::fs::remove_file(dir.join(name)).map_err(|e| io_err("prune snapshot", e))?;
    }
    Ok(())
}

/// 快照名列表，按时间升序（最旧在前）。
pub fn list_snapshots(base: &Path) -> Result<Vec<String>, AppError> {
    let dir = snapshots_dir(base);
    let entries = match std::fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(io_err("list snapshots", e)),
    };
    let mut names = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| io_err("list snapshots", e))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if is_safe_snapshot_name(&name) && entry.path().is_file() {
            names.push(name);
        }
    }
    names.sort();
    Ok(names)
}

/// 恢复前先给当前状态拍一份快照，因此「恢复」本身也可再回滚。
pub fn restore_snapshot(base: &Path, name: &str) -> Result<AppConfig, AppError> {
    if !is_safe_snapshot_name(name) {
        return Err(AppError::Validation {
            context: "snapshot".into(),
            message: format!("非法的快照名 {name}"),
        });
    }
    let source = snapshots_dir(base).join(name);
    let data = std::fs::read(&source).map_err(|e| io_err("read snapshot", e))?;
    // 先确认快照可解析，避免把坏内容写进 user 层。
    serde_json::from_slice::<Value>(&data).map_err(|e| json_err("snapshot", e))?;
    snapshot_user(base)?;
    atomic_write(&user_path(base), &data)?;
    prune_snapshots(base)?;
    load_config_at(base)
}

// ── 加载 / 保存 ──────────────────────────────────────────────

pub fn load_config_at(base: &Path) -> Result<AppConfig, AppError> {
    ensure_defaults(base)?;
    migrate_legacy(base)?;
    let code_defaults =
        serde_json::to_value(AppConfig::default()).map_err(|e| json_err("code defaults", e))?;
    let file_defaults = read_json_or_quarantine(&defaults_path(base)).unwrap_or(Value::Null);
    let defaults = merge_json(&code_defaults, &file_defaults);
    let user = read_json_or_quarantine(&user_path(base));
    let state = read_json_or_quarantine(&state_path(base));
    effective_config(defaults, user, state)
}

pub fn save_config_at(base: &Path, config: &AppConfig) -> Result<(), AppError> {
    validate_config(config)?;
    ensure_defaults(base)?;
    snapshot_user(base)?;
    let user = serde_json::to_vec_pretty(&settings_value(config)?)
        .map_err(|e| json_err("user config", e))?;
    let state =
        serde_json::to_vec_pretty(&state_value(config)?).map_err(|e| json_err("state", e))?;
    atomic_write(&user_path(base), &user)?;
    atomic_write(&state_path(base), &state)?;
    prune_snapshots(base)?;
    Ok(())
}

/// 把 JSON 合并补丁打进 user 层，复用 C2 的校验 / 快照 / 原子写语义。
///
/// 顺序：读 user（缺失按 `{}`）→ `merge_json` 深合并 → 反序列化 → 校验 →
/// 快照当前 user → 原子写 user + state。任一步失败都不落盘；返回新的有效配置。
pub fn apply_patch_at(base: &Path, patch: &Value) -> Result<AppConfig, AppError> {
    if !patch.is_object() {
        return Err(AppError::Validation {
            context: "patch".into(),
            message: "补丁必须是 JSON 对象".into(),
        });
    }
    ensure_defaults(base)?;
    migrate_legacy(base)?;
    let current_user = read_json_or_quarantine(&user_path(base)).unwrap_or(Value::Null);
    let merged = merge_json(&current_user, patch);
    let config: AppConfig =
        serde_json::from_value(merged).map_err(|e| json_err("patched config", e))?;
    validate_config(&config)?;

    snapshot_user(base)?;
    let user = serde_json::to_vec_pretty(&settings_value(&config)?)
        .map_err(|e| json_err("user config", e))?;
    let state =
        serde_json::to_vec_pretty(&state_value(&config)?).map_err(|e| json_err("state", e))?;
    atomic_write(&user_path(base), &user)?;
    atomic_write(&state_path(base), &state)?;
    prune_snapshots(base)?;

    load_config_at(base)
}

/// 首次启动写一份给 AI 读的配置地图；文件已存在则保留用户改动，不覆盖。
pub fn seed_skill_map(app: &AppHandle) {
    let path = config_base(app)
        .join("skills")
        .join("biaoyue")
        .join("SKILL.md");
    if path.exists() {
        return;
    }
    if let Err(e) = atomic_write(&path, SKILL_MAP.as_bytes()) {
        warn!(error = %e, path = %path.display(), "SKILL.md 写入失败");
    }
}

const SKILL_MAP: &str = r#"# Biaoyue 配置地图

这是标月的配置心智地图，供 AI agent 读取。配置分三层，都位于应用配置目录下：

| 层 | 路径 | 作用 |
| --- | --- | --- |
| defaults | `defaults/settings.json` | 代码默认值，首次运行生成 |
| user | `user/settings.json` | 用户设置，`patch_config` 写这里 |
| state | `state/state.json` | 派生状态（recentFiles / scrollPositions），不归 patch 管 |
| snapshots | `snapshots/settings-*.json` | 每次写入前的 user 层副本，保留最新 10 份 |

## 可用工具

- `read_config`：返回合并后的有效配置。
- `patch_config`：`{"patch": {...}}`，深合并进 user 层，写入前校验并生成快照；非法值不落盘。
- `list_snapshots`：返回快照文件名，最旧在前。

## 可改键与取值范围（camelCase）

| 键 | 范围 / 取值 |
| --- | --- |
| `fontSize` | 8–96 |
| `readerFontSize` | 8–96 |
| `readerWidth` | 480–2400 |
| `sidebarLeftWidth` / `sidebarRightWidth` | 0–800 |
| `horizontalSplitRatio` / `verticalSplitRatio` | 0–1 |
| `theme` | `light` / `dark` / `warm` / `system` |
| `aiConfirmDensity` | `always` / `session-silent` / `never` |
| `readerSkin` | `paper` / `plain` |
| `openaiEndpoint` / `openaiModel` | 任意字符串 |

## 禁止项

- API key 只存操作系统 keyring，绝不写进配置文件、日志或本文件。
- 不要手改 `state/state.json`；它由应用维护。
"#;

/// 应用配置目录（用户层根目录）。扩展点扫描复用同一目录解析。
pub fn config_base(app: &AppHandle) -> PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

const LEGACY_BUNDLE_IDENTIFIER: &str = "com.clairis.app";

/// 更早版本把配置放在旧 bundle id 目录下；只读复制，旧文件保留。
async fn migrate_legacy_bundle(app: &AppHandle, base: &Path) {
    if user_path(base).exists() || legacy_path(base).exists() {
        return;
    }
    let Ok(config_dir) = app.path().config_dir() else {
        return;
    };
    let legacy = config_dir.join(LEGACY_BUNDLE_IDENTIFIER).join(LEGACY_FILE);
    if legacy == legacy_path(base) || !legacy.exists() {
        return;
    }
    let Ok(data) = tokio::fs::read(&legacy).await else {
        return;
    };
    if atomic_write(&legacy_path(base), &data).is_ok() {
        info!(from = %legacy.display(), "旧 bundle 配置已复制到当前目录");
    }
}

/// Load config from disk, return default on missing/corrupt.
pub async fn load_config(app: &AppHandle) -> Result<AppConfig, AppError> {
    let base = config_base(app);
    migrate_legacy_bundle(app, &base).await;
    load_config_at(&base)
}

/// Save config to disk.
pub async fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), AppError> {
    save_config_at(&config_base(app), config)
}

pub async fn list_config_snapshots(app: &AppHandle) -> Result<Vec<String>, AppError> {
    list_snapshots(&config_base(app))
}

pub async fn restore_config_snapshot(app: &AppHandle, name: &str) -> Result<AppConfig, AppError> {
    restore_snapshot(&config_base(app), name)
}

/// 轮询 `user/settings.json` 的 (mtime, len)，变化时发 `config-changed`。
/// 按路径取状态，文件被 rename 替换也能发现；首轮只记录基线。
pub fn spawn_config_watcher(app: AppHandle) {
    let path = user_path(&config_base(&app));
    tauri::async_runtime::spawn(async move {
        use tauri::Emitter;
        let fingerprint = |path: &Path| -> Option<(SystemTime, u64)> {
            let meta = std::fs::metadata(path).ok()?;
            Some((meta.modified().ok()?, meta.len()))
        };
        let mut last = fingerprint(&path);
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let current = fingerprint(&path);
            if current != last {
                last = current;
                info!(path = %path.display(), "配置文件被外部修改，通知前端热应用");
                #[cfg(debug_assertions)]
                eprintln!("[config] 外部修改已检测，发送 config-changed");
                let _ = app.emit("config-changed", ());
            }
        }
    });
}

/// Get API key from system keyring.
pub async fn get_api_key(service: &str, account: &str) -> Result<Option<String>, AppError> {
    let entry = keyring::Entry::new(service, account).map_err(|e| AppError::Keyring {
        context: "create entry".into(),
        source: e.to_string(),
    })?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keyring {
            context: "get password".into(),
            source: e.to_string(),
        }),
    }
}

/// Set API key in system keyring.
pub async fn set_api_key(service: &str, account: &str, key: &str) -> Result<(), AppError> {
    let entry = keyring::Entry::new(service, account).map_err(|e| AppError::Keyring {
        context: "create entry".into(),
        source: e.to_string(),
    })?;
    entry.set_password(key).map_err(|e| AppError::Keyring {
        context: "set password".into(),
        source: e.to_string(),
    })?;
    Ok(())
}

/// Delete API key from system keyring.
pub async fn delete_api_key(service: &str, account: &str) -> Result<(), AppError> {
    let entry = keyring::Entry::new(service, account).map_err(|e| AppError::Keyring {
        context: "create entry".into(),
        source: e.to_string(),
    })?;
    entry.delete_credential().map_err(|e| AppError::Keyring {
        context: "delete password".into(),
        source: e.to_string(),
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_base(tag: &str) -> tempfile::TempDir {
        tempfile::Builder::new()
            .prefix(&format!("biaoyue_config_{tag}_"))
            .tempdir()
            .expect("create temp dir")
    }

    fn write_user(base: &Path, json: &str) {
        let path = user_path(base);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, json).unwrap();
    }

    fn read_user(base: &Path) -> String {
        std::fs::read_to_string(user_path(base)).unwrap()
    }

    #[test]
    fn user_overrides_defaults() {
        let dir = temp_base("merge");
        let base = dir.path();
        write_user(base, r#"{"theme":"dark"}"#);

        let config = load_config_at(base).unwrap();

        assert_eq!(config.theme.as_deref(), Some("dark"));
        // 未覆盖的键仍来自 defaults
        assert_eq!(config.font_size, Some(17.0));
        assert_eq!(config.reader_width, Some(1080.0));
    }

    #[test]
    fn save_keeps_derived_state_out_of_user_file() {
        let dir = temp_base("split");
        let base = dir.path();
        let mut config = AppConfig::default();
        config.recent_files = Some(vec![RecentFile {
            path: "/tmp/a.md".into(),
            title: "a.md".into(),
            opened_at: "2026-01-01T00:00:00Z".into(),
            excerpt: None,
        }]);

        save_config_at(base, &config).unwrap();

        let user = read_user(base);
        assert!(
            !user.contains("recentFiles"),
            "user 层不应含 recentFiles: {user}"
        );
        assert!(
            !user.contains("scrollPositions"),
            "user 层不应含 scrollPositions: {user}"
        );
        let state = std::fs::read_to_string(state_path(base)).unwrap();
        assert!(state.contains("recentFiles"));
        assert_eq!(load_config_at(base).unwrap().recent_files.unwrap().len(), 1);
    }

    #[test]
    fn atomic_write_failure_keeps_original_bytes() {
        let dir = temp_base("atomic");
        let base = dir.path();
        write_user(base, r#"{"theme":"warm"}"#);
        let before = read_user(base);

        // 目标路径被目录占用 → rename 必然失败
        let target = user_path(base);
        std::fs::remove_file(&target).unwrap();
        std::fs::create_dir(&target).unwrap();

        let err = atomic_write(&target, b"{\"theme\":\"dark\"}").unwrap_err();
        assert!(matches!(err, AppError::Io { .. }));

        std::fs::remove_dir(&target).unwrap();
        std::fs::write(&target, &before).unwrap();
        assert_eq!(read_user(base), before);

        // 目录里不残留临时文件
        let leftovers: Vec<_> = std::fs::read_dir(target.parent().unwrap())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".tmp-"))
            .collect();
        assert!(leftovers.is_empty(), "临时文件未清理: {leftovers:?}");
    }

    #[test]
    fn invalid_font_size_is_rejected_without_writing() {
        let dir = temp_base("validate");
        let base = dir.path();
        write_user(base, r#"{"theme":"light"}"#);
        let before = read_user(base);

        let mut config = AppConfig::default();
        config.font_size = Some(200.0);
        let err = save_config_at(base, &config).unwrap_err();

        assert!(matches!(err, AppError::Validation { .. }), "got {err:?}");
        assert_eq!(read_user(base), before);
    }

    #[test]
    fn validation_covers_every_rule() {
        let mut config = AppConfig::default();
        assert!(validate_config(&config).is_ok());

        config.reader_width = Some(479.0);
        assert!(validate_config(&config).is_err());
        config.reader_width = Some(2400.0);
        assert!(validate_config(&config).is_ok());

        config.theme = Some("neon".into());
        assert!(validate_config(&config).is_err());
        config.theme = Some("warm".into());
        assert!(validate_config(&config).is_ok());

        config.ai_confirm_density = Some("sometimes".into());
        assert!(validate_config(&config).is_err());
        config.ai_confirm_density = Some("always".into());
        assert!(validate_config(&config).is_ok());

        config.reader_skin = Some("indigo".into());
        assert!(validate_config(&config).is_err());
        config.reader_skin = Some("plain".into());
        assert!(validate_config(&config).is_ok());

        config.horizontal_split_ratio = Some(1.5);
        assert!(validate_config(&config).is_err());
        config.horizontal_split_ratio = Some(1.0);
        assert!(validate_config(&config).is_ok());

        config.sidebar_left_width = Some(-1.0);
        assert!(validate_config(&config).is_err());
        config.sidebar_left_width = Some(0.0);
        assert!(validate_config(&config).is_ok());

        config.reader_font_size = Some(7.9);
        assert!(validate_config(&config).is_err());
    }

    #[test]
    fn twelve_saves_keep_newest_ten_snapshots() {
        let dir = temp_base("prune");
        let base = dir.path();
        let mut config = AppConfig::default();

        for i in 0..12 {
            config.font_size = Some(10.0 + i as f64);
            save_config_at(base, &config).unwrap();
        }

        let snapshots = list_snapshots(base).unwrap();
        assert_eq!(snapshots.len(), 10, "快照数应为 10: {snapshots:?}");

        // 最新一份快照是第 11 次保存前的状态（fontSize = 20）
        let newest = snapshots.last().unwrap();
        let data = std::fs::read_to_string(snapshots_dir(base).join(newest)).unwrap();
        assert!(data.contains("\"fontSize\": 20.0"), "got {data}");
        // 最旧一份应是第 2 次保存前的状态（fontSize = 11）
        let oldest = &snapshots[0];
        let data = std::fs::read_to_string(snapshots_dir(base).join(oldest)).unwrap();
        assert!(data.contains("\"fontSize\": 11.0"), "got {data}");
    }

    #[test]
    fn restore_snapshots_current_state_first() {
        let dir = temp_base("restore");
        let base = dir.path();
        let mut config = AppConfig::default();
        config.theme = Some("light".into());
        save_config_at(base, &config).unwrap();

        config.theme = Some("dark".into());
        save_config_at(base, &config).unwrap();
        let snapshots = list_snapshots(base).unwrap();
        // 最新快照保存的是 light 状态
        let light_snapshot = snapshots.last().unwrap().clone();

        config.theme = Some("warm".into());
        save_config_at(base, &config).unwrap();

        let restored = restore_snapshot(base, &light_snapshot).unwrap();
        assert_eq!(restored.theme.as_deref(), Some("light"));

        // 恢复前的 warm 状态已作为新快照存在
        let after = list_snapshots(base).unwrap();
        assert!(after.len() > snapshots.len());
        let newest = after.last().unwrap();
        let data = std::fs::read_to_string(snapshots_dir(base).join(newest)).unwrap();
        assert!(data.contains("\"warm\""), "got {data}");
    }

    #[test]
    fn restore_rejects_path_traversal() {
        let dir = temp_base("traversal");
        let base = dir.path();
        for name in [
            "../settings.json",
            "settings-x/../y.json",
            "other.json",
            "settings-a b.json",
        ] {
            let err = restore_snapshot(base, name).unwrap_err();
            assert!(
                matches!(err, AppError::Validation { .. }),
                "{name} → {err:?}"
            );
        }
    }

    #[test]
    fn legacy_config_is_split_and_migration_is_idempotent() {
        let dir = temp_base("legacy");
        let base = dir.path();
        std::fs::write(
            legacy_path(base),
            r#"{"theme":"dark","fontSize":19.0,"recentFiles":[{"path":"/tmp/a.md","title":"a.md","openedAt":"2026-01-01T00:00:00Z"}],"scrollPositions":{}}"#,
        )
        .unwrap();

        let config = load_config_at(base).unwrap();
        assert_eq!(config.theme.as_deref(), Some("dark"));
        assert_eq!(config.font_size, Some(19.0));
        assert_eq!(config.recent_files.as_ref().unwrap().len(), 1);

        let user = read_user(base);
        assert!(!user.contains("recentFiles"));
        assert!(state_path(base).exists());
        assert!(legacy_path(base).exists(), "旧文件应保留");

        // 二次加载不重复迁移，也不覆盖用户后续修改
        write_user(base, r#"{"theme":"warm"}"#);
        let again = load_config_at(base).unwrap();
        assert_eq!(again.theme.as_deref(), Some("warm"));
        assert!(read_user(base).contains("warm"));
    }

    #[test]
    fn defaults_layer_is_created_once() {
        let dir = temp_base("defaults");
        let base = dir.path();
        load_config_at(base).unwrap();
        let path = defaults_path(base);
        assert!(path.exists());

        // 已存在的 defaults 不再被覆盖（用户/测试改过也保留）
        std::fs::write(&path, r#"{"theme":"light"}"#).unwrap();
        let config = load_config_at(base).unwrap();
        assert_eq!(config.theme.as_deref(), Some("light"));
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            r#"{"theme":"light"}"#
        );
        // 其余键仍来自代码内默认
        assert_eq!(config.font_size, Some(17.0));
    }

    #[test]
    fn state_layer_supplies_recent_files() {
        let dir = temp_base("state");
        let base = dir.path();
        write_user(base, r#"{"theme":"dark"}"#);
        std::fs::create_dir_all(state_path(base).parent().unwrap()).unwrap();
        std::fs::write(
            state_path(base),
            r#"{"recentFiles":[{"path":"/tmp/b.md","title":"b.md","openedAt":"2026-01-02T00:00:00Z"}],"scrollPositions":{}}"#,
        )
        .unwrap();

        let config = load_config_at(base).unwrap();
        assert_eq!(config.theme.as_deref(), Some("dark"));
        let recent = config.recent_files.unwrap();
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].path, "/tmp/b.md");
    }

    #[test]
    fn rail_view_spec_round_trips_and_defaults_for_old_configs() {
        let dir = temp_base("rail");
        let base = dir.path();

        // 老配置（无字段）→ 默认 None，读得进
        write_user(base, r#"{"theme":"dark"}"#);
        assert_eq!(load_config_at(base).unwrap().rail_view_spec, None);

        // 写入规格 → 落盘 → 读回严格相等
        let mut config = AppConfig::default();
        config.rail_view_spec = Some(RailViewSpec {
            layout: Some("tabs".into()),
            density: Some("compact".into()),
            card_height: Some(112.0),
        });
        save_config_at(base, &config).unwrap();
        let user = read_user(base);
        assert!(
            user.contains("railViewSpec"),
            "user 层应含 railViewSpec: {user}"
        );
        let loaded = load_config_at(base).unwrap().rail_view_spec.unwrap();
        assert_eq!(loaded.layout.as_deref(), Some("tabs"));
        assert_eq!(loaded.density.as_deref(), Some("compact"));
        assert_eq!(loaded.card_height, Some(112.0));

        // 非法取值被校验拦下，不落盘
        config.rail_view_spec = Some(RailViewSpec {
            layout: Some("diagonal".into()),
            density: Some("comfortable".into()),
            card_height: None,
        });
        assert!(validate_config(&config).is_err());

        // 卡片高度越界同样拦下
        config.rail_view_spec = Some(RailViewSpec {
            layout: Some("stacked".into()),
            density: Some("card".into()),
            card_height: Some(200.0),
        });
        assert!(validate_config(&config).is_err());
    }

    #[test]
    fn preview_settings_round_trips_and_defaults_for_old_configs() {
        let dir = temp_base("preview");
        let base = dir.path();

        // 老配置（无字段）→ None，读得进
        write_user(base, r#"{"theme":"dark"}"#);
        assert_eq!(load_config_at(base).unwrap().preview_settings, None);

        // 写入开关 → 落盘 → 读回严格相等
        let mut config = AppConfig::default();
        config.preview_settings = Some(PreviewSettings {
            rail_hover: Some(false),
            grid_mode: Some("hover".into()),
            enabled: Some(true),
        });
        save_config_at(base, &config).unwrap();
        let user = read_user(base);
        assert!(
            user.contains("previewSettings"),
            "user 层应含 previewSettings: {user}"
        );
        let loaded = load_config_at(base).unwrap().preview_settings.unwrap();
        assert_eq!(loaded.rail_hover, Some(false));
        assert_eq!(loaded.grid_mode.as_deref(), Some("hover"));
        assert_eq!(loaded.enabled, Some(true));

        // 非法 gridMode 被校验拦下，不落盘
        config.preview_settings = Some(PreviewSettings {
            rail_hover: Some(true),
            grid_mode: Some("diagonal".into()),
            enabled: Some(true),
        });
        assert!(validate_config(&config).is_err());

        config.preview_settings = Some(PreviewSettings {
            rail_hover: Some(true),
            grid_mode: Some("off".into()),
            enabled: Some(false),
        });
        assert!(validate_config(&config).is_ok());
    }

    #[test]
    fn ai_view_spec_round_trips_and_defaults_for_old_configs() {
        let dir = temp_base("aispec");
        let base = dir.path();

        // 老配置（无字段）→ None，读得进
        write_user(base, r#"{"theme":"dark"}"#);
        assert_eq!(load_config_at(base).unwrap().ai_view_spec, None);

        // 完整规格 → 落盘 → 读回严格相等
        let mut config = AppConfig::default();
        config.ai_view_spec = Some(AiViewSpec {
            rail_layout: Some("tabs".into()),
            rail_density: Some("compact".into()),
            rail_card_height: Some(112.0),
            block_colors: Some(false),
            icon_label: Some("icon".into()),
            preview_enabled: Some(false),
            rail_pinned_width: Some(300.0),
            grid_mode: Some("list".into()),
            grid_grouping: Some("type".into()),
            grid_sort: Some("name".into()),
            unread_only: Some(true),
            theme_groups: Some(true),
            pinned_and_recent_only: Some(true),
            pinned_segment_scale: Some(1.25),
        });
        save_config_at(base, &config).unwrap();
        let user = read_user(base);
        assert!(
            user.contains("aiViewSpec"),
            "user 层应含 aiViewSpec: {user}"
        );
        let loaded = load_config_at(base).unwrap().ai_view_spec.unwrap();
        assert_eq!(loaded.rail_layout.as_deref(), Some("tabs"));
        assert_eq!(loaded.grid_mode.as_deref(), Some("list"));
        assert_eq!(loaded.grid_grouping.as_deref(), Some("type"));
        assert_eq!(loaded.grid_sort.as_deref(), Some("name"));
        assert_eq!(loaded.icon_label.as_deref(), Some("icon"));
        assert_eq!(loaded.preview_enabled, Some(false));
        assert_eq!(loaded.rail_pinned_width, Some(300.0));
        assert_eq!(loaded.pinned_segment_scale, Some(1.25));

        // 非法枚举被校验拦下，不落盘
        let valid = config.ai_view_spec.clone().unwrap();
        config.ai_view_spec = Some(AiViewSpec {
            rail_layout: Some("diagonal".into()),
            ..valid.clone()
        });
        assert!(validate_config(&config).is_err());

        config.ai_view_spec = Some(AiViewSpec {
            grid_sort: Some("size".into()),
            ..valid.clone()
        });
        assert!(validate_config(&config).is_err());

        // 越界数值同样拦下
        config.ai_view_spec = Some(AiViewSpec {
            rail_layout: Some("stacked".into()),
            pinned_segment_scale: Some(2.0),
            ..valid
        });
        assert!(validate_config(&config).is_err());
    }

    #[test]
    fn html_toolbar_items_accepts_subset_and_rejects_bad_input() {
        let mut config = AppConfig::default();
        config.html_toolbar_items = Some(vec!["format-bold".into(), "ai-polish".into()]);
        assert!(validate_config(&config).is_ok());

        config.html_toolbar_items = Some(vec!["format-bold".into(), "nope".into()]);
        assert!(validate_config(&config).is_err());

        config.html_toolbar_items = Some(vec!["format-bold".into(), "format-bold".into()]);
        assert!(validate_config(&config).is_err());

        config.html_toolbar_items = Some(Vec::new());
        assert!(validate_config(&config).is_err());
    }

    #[test]
    fn roulette_sectors_accepts_subset_and_rejects_bad_input() {
        let mut config = AppConfig::default();
        config.roulette_sectors = Some(vec!["format".into(), "smart".into()]);
        assert!(validate_config(&config).is_ok());

        config.roulette_sectors = Some(vec!["format".into(), "nope".into()]);
        assert!(validate_config(&config).is_err());

        config.roulette_sectors = Some(vec!["format".into(), "format".into()]);
        assert!(validate_config(&config).is_err());

        config.roulette_sectors = Some(Vec::new());
        assert!(validate_config(&config).is_err());
    }

    #[test]
    fn roulette_form_and_position_accept_good_and_reject_bad() {
        let mut config = AppConfig::default();
        config.roulette_hotkey = Some("Mod+Shift+Space".into());
        config.roulette_form = Some("hub".into());
        config.roulette_position = Some(RoulettePosition { x: 120.0, y: -40.0 });
        assert!(validate_config(&config).is_ok());

        // 形态白名单：core/full 是设计稿旧名，落库只认 hub/disk
        config.roulette_form = Some("core".into());
        assert!(validate_config(&config).is_err());
        config.roulette_form = Some("full".into());
        assert!(validate_config(&config).is_err());

        // 位置必须有限且夹在合法范围内
        config.roulette_form = Some("disk".into());
        config.roulette_position = Some(RoulettePosition {
            x: f64::NAN,
            y: 0.0,
        });
        assert!(validate_config(&config).is_err());
        config.roulette_position = Some(RoulettePosition {
            x: 0.0,
            y: f64::INFINITY,
        });
        assert!(validate_config(&config).is_err());
        config.roulette_position = Some(RoulettePosition { x: 99999.0, y: 0.0 });
        assert!(validate_config(&config).is_err());
    }

    #[test]
    fn roulette_new_fields_default_none_for_old_configs() {
        let dir = temp_base("roulette21");
        let base = dir.path();
        write_user(base, r#"{"theme":"dark"}"#);
        let loaded = load_config_at(base).unwrap();
        assert_eq!(loaded.roulette_hotkey, None);
        assert_eq!(loaded.roulette_form, None);
        assert_eq!(loaded.roulette_position, None);
    }

    #[test]
    fn notice_duration_accepts_good_and_rejects_bad() {
        let mut config = AppConfig::default();
        assert_eq!(config.notice_duration, None);
        assert!(validate_config(&config).is_ok());

        for good in [0.1, 1.5, 3.0, 10.0] {
            config.notice_duration = Some(good);
            assert!(validate_config(&config).is_ok(), "{good} 应被接受");
        }

        for bad in [
            0.0,
            0.05,
            1.55,
            10.1,
            f64::NAN,
            f64::INFINITY,
            f64::NEG_INFINITY,
        ] {
            config.notice_duration = Some(bad);
            assert!(validate_config(&config).is_err(), "{bad} 应被拒绝");
        }
    }

    #[test]
    fn notice_duration_round_trips_and_snapshot_restores() {
        let dir = temp_base("notice");
        let base = dir.path();
        write_user(base, r#"{"theme":"dark"}"#);
        assert_eq!(load_config_at(base).unwrap().notice_duration, None);

        let mut config = AppConfig::default();
        config.notice_duration = Some(1.5);
        save_config_at(base, &config).unwrap();
        let user = read_user(base);
        assert!(
            user.contains("\"noticeDuration\": 1.5"),
            "user 层应含 noticeDuration: {user}"
        );
        assert_eq!(load_config_at(base).unwrap().notice_duration, Some(1.5));

        // 改成 5.0 后，最新快照仍是 1.5 保存前的状态
        config.notice_duration = Some(5.0);
        save_config_at(base, &config).unwrap();
        let snapshots = list_snapshots(base).unwrap();
        let snap = snapshots.last().unwrap().clone();
        let restored = restore_snapshot(base, &snap).unwrap();
        assert_eq!(restored.notice_duration, Some(1.5));

        // 非法值：校验拦下，user 文件字节不变
        let before = read_user(base);
        config.notice_duration = Some(1.55);
        assert!(validate_config(&config).is_err());
        assert!(save_config_at(base, &config).is_err());
        assert_eq!(read_user(base), before);
    }
}
