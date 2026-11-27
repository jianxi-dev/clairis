use std::future::Future;
use std::path::Path;
use std::pin::Pin;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::config::{apply_patch_at, list_snapshots, load_config_at, restore_surface_snapshot};
use crate::errors::AppError;
use crate::surfaces::{find_surface, load_surface};

pub const MAX_TURNS: usize = 8;
pub const MAX_REPEATED_TOOL_ERRORS: usize = 3;

// ── 错误 ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AgentError {
    TurnLimit { turns: usize },
    Provider { status: u16, body: String },
    Tool { name: String, message: String },
    Validation { field: String, message: String },
    Io { context: String, message: String },
    Keyring { message: String },
}

impl AgentError {
    pub fn validation(field: impl Into<String>, message: impl Into<String>) -> Self {
        AgentError::Validation {
            field: field.into(),
            message: message.into(),
        }
    }

    pub fn tool(name: impl Into<String>, message: impl Into<String>) -> Self {
        AgentError::Tool {
            name: name.into(),
            message: message.into(),
        }
    }

    fn from_app(name: &str, err: AppError) -> Self {
        match err {
            AppError::Validation { context, message } => AgentError::Validation {
                field: context,
                message,
            },
            AppError::Io { context, source } => AgentError::Io {
                context,
                message: source.to_string(),
            },
            AppError::Serialization { context, source } => AgentError::Io {
                context,
                message: source.to_string(),
            },
            AppError::Keyring { context, source } => AgentError::Keyring {
                message: if context.is_empty() {
                    source
                } else {
                    format!("{context}: {source}")
                },
            },
            other => AgentError::Tool {
                name: name.into(),
                message: other.to_string(),
            },
        }
    }
}

impl std::fmt::Display for AgentError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentError::TurnLimit { turns } => write!(f, "超过 {turns} 轮工具调用上限"),
            AgentError::Provider { status, body } => {
                write!(f, "provider 返回 {status}: {body}")
            }
            AgentError::Tool { name, message } => write!(f, "工具 {name} 失败: {message}"),
            AgentError::Validation { field, message } => {
                write!(f, "校验失败 ({field}): {message}")
            }
            AgentError::Io { context, message } => write!(f, "IO 错误 ({context}): {message}"),
            AgentError::Keyring { message } => write!(f, "钥匙串错误: {message}"),
        }
    }
}

impl std::error::Error for AgentError {}

impl From<AppError> for AgentError {
    fn from(err: AppError) -> Self {
        match err {
            AppError::Validation { context, message } => AgentError::Validation {
                field: context,
                message,
            },
            AppError::Io { context, source } => AgentError::Io {
                context,
                message: source.to_string(),
            },
            AppError::Serialization { context, source } => AgentError::Io {
                context,
                message: source.to_string(),
            },
            AppError::Keyring { context, source } => AgentError::Keyring {
                message: if context.is_empty() {
                    source
                } else {
                    format!("{context}: {source}")
                },
            },
            other => AgentError::Tool {
                name: "config".into(),
                message: other.to_string(),
            },
        }
    }
}

// ── 消息与补全 ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl Message {
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: "user".into(),
            content: Some(content.into()),
            tool_calls: None,
            tool_call_id: None,
        }
    }

    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: "system".into(),
            content: Some(content.into()),
            tool_calls: None,
            tool_call_id: None,
        }
    }

    pub fn assistant(content: Option<String>, tool_calls: Vec<ToolCall>) -> Self {
        Self {
            role: "assistant".into(),
            content,
            tool_calls: if tool_calls.is_empty() {
                None
            } else {
                Some(tool_calls)
            },
            tool_call_id: None,
        }
    }

    pub fn tool_result(tool_call_id: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            role: "tool".into(),
            content: Some(content.into()),
            tool_calls: None,
            tool_call_id: Some(tool_call_id.into()),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: Value,
}

#[derive(Serialize)]
struct ToolCallFunction<'a> {
    name: &'a str,
    arguments: String,
}

impl Serialize for ToolCall {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let arguments = serde_json::to_string(&self.arguments)
            .map_err(<S::Error as serde::ser::Error>::custom)?;
        let mut state = serializer.serialize_struct("ToolCall", 3)?;
        state.serialize_field("id", &self.id)?;
        state.serialize_field("type", "function")?;
        state.serialize_field(
            "function",
            &ToolCallFunction {
                name: &self.name,
                arguments,
            },
        )?;
        state.end()
    }
}

#[derive(Debug, Clone)]
pub struct CompletionRequest {
    pub messages: Vec<Message>,
    pub tools: Vec<Value>,
}

#[derive(Debug, Clone, Default)]
pub struct CompletionResponse {
    pub content: Option<String>,
    pub tool_calls: Vec<ToolCall>,
}

pub type CompletionFuture<'a> =
    Pin<Box<dyn Future<Output = Result<CompletionResponse, AgentError>> + Send + 'a>>;

pub trait Completer: Send + Sync {
    fn complete<'a>(&'a self, req: CompletionRequest) -> CompletionFuture<'a>;
}

// ── 工具 ────────────────────────────────────────────────────

pub fn tool_schemas() -> Vec<Value> {
    vec![
        json!({
            "type": "function",
            "function": {
                "name": "read_config",
                "description": "读取当前生效的应用配置（defaults + user + state 合并后的结果）。",
                "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "patch_config",
                "description": "把 JSON 合并补丁写入 user 层配置。写入前会校验并生成快照，非法值不会落盘。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patch": {
                            "type": "object",
                            "description": "要合并进 user 层的配置补丁，键名用 camelCase，例如 {\"theme\":\"dark\"}"
                        }
                    },
                    "required": ["patch"],
                    "additionalProperties": false
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "list_snapshots",
                "description": "列出配置快照文件名，按时间升序（最旧在前）。",
                "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "restore_surface_snapshot",
                "description": "回滚某个数据面的用户覆盖（只写 user/<id>.json，不动默认文件）。省略 name 时回滚该面最新快照；恢复前会再拍一份，因此恢复本身也可回滚。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "数据面 id，当前已登记: html-toolbar, menus, icons, capsules"
                        },
                        "name": {
                            "type": "string",
                            "description": "可选快照名；省略则用该面最新一份"
                        }
                    },
                    "required": ["id"],
                    "additionalProperties": false
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "read_data_surface",
                "description": "读取已登记数据面的有效集合。返回 {effective, defaults, warnings} 三段：有效集合（默认←用户覆盖合并后）、默认集合（= 仓库内默认文件内容，首次调用可能把默认物化到 defaults 层，故非纯只读）、告警列表。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "数据面 id，当前已登记: html-toolbar, menus, icons, capsules"
                        }
                    },
                    "required": ["id"],
                    "additionalProperties": false
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "patch_data_surface",
                "description": "改写已登记数据面的用户覆盖集合。id 必须是已登记数据面（当前已登记: html-toolbar, menus, icons, capsules）。list 型面（html-toolbar / menus / capsules）patch 为 {\"items\":[\"id\",...]} 整体替换；map 型面（icons）patch 为 {\"items\":{\"概念键\":{...}}} 逐键深合并，接受默认集合外的新概念键。写入走校验+快照+原子写，只作用于 user 覆盖层，不改默认源文件。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "数据面 id，当前已登记: html-toolbar, menus, icons, capsules"
                        },
                        "patch": {
                            "type": "object",
                            "description": "面补丁，恰含 items 键。list 型面为 id 字符串数组，例如 {\"items\":[\"format-bold\",\"format-italic\"]}；icons 面为「概念键 → 定义」对象，例如 {\"items\":{\"close\":{\"label\":\"关窗\",\"s\":\"M1 1\"}}}"
                        }
                    },
                    "required": ["id", "patch"],
                    "additionalProperties": false
                }
            }
        }),
    ]
}

fn tool_ok(value: Value) -> String {
    json!({ "ok": true, "result": value }).to_string()
}

fn tool_err(err: &AgentError) -> String {
    json!({ "ok": false, "error": err }).to_string()
}

/// 面 id 白名单：未登记 id 返回 None（调用方转结构化错误，零写入）。
fn parse_surface_id(id: &str) -> Option<&'static crate::surfaces::SurfaceSpec> {
    find_surface(id)
}

/// 已登记面 id 列表（逗号连接），供未登记 id 的结构化错误复用注册表，
/// 不在工具层硬编码面清单。
fn registered_surface_ids() -> String {
    crate::surfaces::SURFACES
        .iter()
        .map(|spec| spec.id)
        .collect::<Vec<_>>()
        .join(", ")
}

/// 写前快照：html-toolbar 的覆盖在 `user/settings.json` 里，`apply_patch_at`
/// 自带快照，此处不重复；其余面各写独立覆盖文件，`snapshot_user` 拍不到，
/// 走面级快照。
fn snapshot_surface_override(
    base: &Path,
    spec: &crate::surfaces::SurfaceSpec,
) -> Result<(), AppError> {
    if spec.shape == crate::surfaces::SurfaceShape::Toolbar {
        return Ok(());
    }
    crate::surfaces::snapshot_surface(base, spec).map_err(|e| AppError::Io {
        context: "patch_data_surface".into(),
        source: e,
    })
}

/// 恢复某面默认（#1570）：删除用户覆盖，先拍快照保证可回滚。
/// html-toolbar 的覆盖在 `user/settings.json` 的 `htmlToolbarItems`，走
/// `apply_patch_at`（自带快照）；其余面删各自 `user/<id>.json`。
/// 覆盖本就不存在时幂等成功（无旧值可拍）。
fn reset_surface_override(
    base: &Path,
    spec: &crate::surfaces::SurfaceSpec,
) -> Result<(), AppError> {
    if spec.shape == crate::surfaces::SurfaceShape::Toolbar {
        return crate::config::clear_user_keys_at(base, &["htmlToolbarItems"]);
    }
    let path = crate::surfaces::user_override_path(base, spec);
    if !path.exists() {
        return Ok(());
    }
    crate::surfaces::snapshot_surface(base, spec).map_err(|e| AppError::Io {
        context: "patch_data_surface".into(),
        source: e,
    })?;
    std::fs::remove_file(&path).map_err(|e| AppError::Io {
        context: "patch_data_surface".into(),
        source: e,
    })
}

/// 写 list 型面用户覆盖：html-toolbar 是 id 字符串数组（既有语义，设置页按 id
/// 排序）；menus / capsules 是**对象数组**（#1551，全量清单 + 逐项按 id 深合并，
/// 允许 `{id,label}` 部分项）。两者都在写边界拒绝未知 id / 非法项（不落盘），
/// 写前快照 + 原子写 `user/<id>.json`。
fn write_list_override(
    base: &Path,
    spec: &crate::surfaces::SurfaceSpec,
    items: &[Value],
) -> Result<(), AppError> {
    let defaults = crate::surfaces::embedded_defaults_json(spec);
    let known: std::collections::HashSet<&str> = defaults
        .iter()
        .filter_map(|item| item.get("id")?.as_str())
        .collect();
    let mut unknown: Vec<String> = Vec::new();
    let mut invalid: Vec<String> = Vec::new();
    let mut normalized: Vec<Value> = Vec::with_capacity(items.len());
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    // #1579：阅读预设按 id 并入现有有效集合——AI 改一条不清空其余两套。
    let preset_baseline: Vec<Value> =
        if spec.shape == crate::surfaces::SurfaceShape::ReaderPreset {
            crate::surfaces::load_surface(spec, base).items
        } else {
            Vec::new()
        };
    for entry in items {
        // html-toolbar 沿用 id 字符串数组；menus / capsules 要求对象项。
        let partial = if spec.shape == crate::surfaces::SurfaceShape::Toolbar {
            match entry.as_str() {
                Some(id) => json!({ "id": id }),
                None => {
                    invalid.push("(非字符串)".into());
                    continue;
                }
            }
        } else {
            match entry.as_object() {
                Some(_) => entry.clone(),
                None => {
                    invalid.push("(非对象)".into());
                    continue;
                }
            }
        };
        let id = match partial.get("id").and_then(|v| v.as_str()) {
            Some(id) => id.to_string(),
            None => {
                invalid.push("(缺 id)".into());
                continue;
            }
        };
        if !seen.insert(id.clone()) {
            continue;
        }
        let is_known = known.contains(id.as_str());
        let base = if is_known {
            defaults
                .iter()
                .find(|item| item.get("id").and_then(|v| v.as_str()) == Some(id.as_str()))
        } else {
            None
        };
        let merged = match base {
            Some(default_item) => crate::surfaces::merge_public(default_item, &partial),
            None => partial,
        };
        let ok = match spec.shape {
            crate::surfaces::SurfaceShape::Menu => {
                crate::surfaces::validate_menu_item(&merged).is_some()
            }
            crate::surfaces::SurfaceShape::Capsule => {
                crate::surfaces::validate_capsule_item(&merged).is_some()
            }
            crate::surfaces::SurfaceShape::ReaderPreset => {
                crate::surfaces::validate_reader_preset(&merged).is_some()
            }
            crate::surfaces::SurfaceShape::Toolbar => {
                crate::surfaces::validate_toolbar_item(&merged).is_some()
            }
            _ => false,
        };
        if !ok {
            if is_known || spec.shape == crate::surfaces::SurfaceShape::ReaderPreset {
                // 阅读预设允许新 id（自定义预设），但必须自带完整字段，否则 invalid。
                invalid.push(id);
            } else if !unknown.contains(&id) {
                unknown.push(id);
            }
            continue;
        }
        normalized.push(merged);
    }
    let normalized = if spec.shape == crate::surfaces::SurfaceShape::ReaderPreset {
        let mut merged_list = preset_baseline;
        for item in normalized {
            let id = item
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            match merged_list
                .iter_mut()
                .find(|slot| slot.get("id").and_then(|v| v.as_str()) == Some(id.as_str()))
            {
                Some(slot) => *slot = item,
                None => merged_list.push(item),
            }
        }
        merged_list
    } else {
        normalized
    };
    if !unknown.is_empty() {
        return Err(AppError::Validation {
            context: "items".into(),
            message: format!("未知动作 id（{}）: {}", spec.id, unknown.join(", ")),
        });
    }
    if !invalid.is_empty() {
        return Err(AppError::Validation {
            context: "items".into(),
            message: format!("非法动作项（{}）: {}", spec.id, invalid.join(", ")),
        });
    }
    snapshot_surface_override(base, spec)?;
    if spec.shape == crate::surfaces::SurfaceShape::Toolbar {
        // html-toolbar 沿用既有 settings 字段（D9 兼容）：只写 id 顺序。
        let ids: Vec<String> = normalized
            .iter()
            .filter_map(|item| item.get("id")?.as_str().map(str::to_string))
            .collect();
        let config_patch = json!({ "htmlToolbarItems": ids });
        return apply_patch_at(base, &config_patch).map(|_| ());
    }
    let path = crate::surfaces::user_override_path(base, spec);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::Io {
            context: "patch_data_surface".into(),
            source: e,
        })?;
    }
    // menus 按组并入（#1555）：补丁只定义被改的组，与已存储覆盖合并后落盘，
    // 覆盖文件保持「只存用户改过的组」，未改组继续继承新默认。
    let merged: Vec<Value> = if spec.shape == crate::surfaces::SurfaceShape::Menu {
        merge_menu_groups(base, spec, &normalized)?
    } else {
        normalized
    };
    let payload = json!({ "id": spec.id, "items": merged });
    let data = serde_json::to_vec_pretty(&payload).map_err(|e| AppError::Serialization {
        context: "patch_data_surface".into(),
        source: e,
    })?;
    crate::config::atomic_write(&path, &data)
}

/// menus 覆盖按组并入（#1555）：读已存储覆盖，丢弃补丁涉及的组，
/// 追加上本次补丁的组（补丁顺序即组内顺序）。文件缺失 / 损坏按空处理。
/// 补丁项可能只写 `{id}`（组从默认项推导），故组集合按补丁项的 group 字段
/// 判定：缺省时回落该项 id 在默认集合里的组。
fn merge_menu_groups(
    base: &Path,
    spec: &crate::surfaces::SurfaceSpec,
    patch: &[Value],
) -> Result<Vec<Value>, AppError> {
    let defaults = crate::surfaces::embedded_defaults_json(spec);
    let group_of = |item: &Value| -> Option<String> {
        if let Some(group) = item.get("group").and_then(|v| v.as_str()) {
            return Some(group.to_string());
        }
        let id = item.get("id").and_then(|v| v.as_str())?;
        defaults
            .iter()
            .find(|d| d.get("id").and_then(|v| v.as_str()) == Some(id))
            .and_then(|d| d.get("group"))
            .and_then(|v| v.as_str())
            .map(str::to_string)
    };
    let path = crate::surfaces::user_override_path(base, spec);
    let mut out: Vec<Value> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .and_then(|value| value.get("items")?.as_array().cloned())
        .unwrap_or_default();
    let patched_groups: std::collections::HashSet<String> =
        patch.iter().filter_map(group_of).collect();
    out.retain(|item| {
        group_of(item)
            .map(|group| !patched_groups.contains(&group))
            .unwrap_or(true)
    });
    out.extend(patch.iter().cloned());
    Ok(out)
}

/// 写图标面用户覆盖（D4 map 型逐键深合并）：默认集合外的**合法定义**（自带
/// path 组且 label 非空）作为新概念键接受并追加；缺 path 组 / 缺 label 的
/// 定义拒绝（不落盘）。写前快照 + 原子写 `user/icons.json`。
fn write_icon_override(
    base: &Path,
    spec: &crate::surfaces::SurfaceSpec,
    entries: &serde_json::Map<String, Value>,
) -> Result<(), AppError> {
    let mut invalid: Vec<&str> = Vec::new();
    for (key, value) in entries {
        let mut merged = serde_json::Map::new();
        merged.insert("key".into(), Value::String(key.clone()));
        if let Some(obj) = value.as_object() {
            for (field, v) in obj {
                merged.insert(field.clone(), v.clone());
            }
        }
        if crate::surfaces::validate_icon_item(&Value::Object(merged)).is_none() {
            if !invalid.contains(&key.as_str()) {
                invalid.push(key.as_str());
            }
        }
    }
    if !invalid.is_empty() {
        return Err(AppError::Validation {
            context: "items".into(),
            message: format!(
                "非法图标定义（缺 path 组 d/s/parts 或非对象）: {}",
                invalid.join(", ")
            ),
        });
    }
    snapshot_surface_override(base, spec)?;
    let path = crate::surfaces::user_override_path(base, spec);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::Io {
            context: "patch_data_surface".into(),
            source: e,
        })?;
    }
    let payload = json!({ "id": spec.id, "items": entries });
    let data = serde_json::to_vec_pretty(&payload).map_err(|e| AppError::Serialization {
        context: "patch_data_surface".into(),
        source: e,
    })?;
    crate::config::atomic_write(&path, &data)
}

/// 执行一个工具调用。任何失败都转成结构化 JSON 字符串（`{ok:false,error}`），
/// 由循环回灌给模型；只有 `AgentError` 之外的意外才向上冒泡。
pub fn dispatch_tool(base: &Path, name: &str, args: &Value) -> Result<String, AgentError> {
    match name {
        "read_config" => match load_config_at(base) {
            Ok(config) => {
                let value = serde_json::to_value(&config).map_err(|e| AgentError::Io {
                    context: "read_config".into(),
                    message: e.to_string(),
                })?;
                Ok(tool_ok(value))
            }
            Err(e) => Ok(tool_err(&AgentError::from_app(name, e))),
        },
        "patch_config" => {
            let Some(patch) = args.get("patch") else {
                return Ok(tool_err(&AgentError::validation(
                    "patch",
                    "缺少 patch 参数",
                )));
            };
            match apply_patch_at(base, patch) {
                Ok(config) => {
                    let value = serde_json::to_value(&config).map_err(|e| AgentError::Io {
                        context: "patch_config".into(),
                        message: e.to_string(),
                    })?;
                    Ok(tool_ok(value))
                }
                Err(e) => Ok(tool_err(&AgentError::from_app(name, e))),
            }
        }
        "list_snapshots" => match list_snapshots(base) {
            Ok(names) => Ok(tool_ok(json!(names))),
            Err(e) => Ok(tool_err(&AgentError::from_app(name, e))),
        },
        "restore_surface_snapshot" => {
            let Some(id) = args.get("id").and_then(|v| v.as_str()) else {
                return Ok(tool_err(&AgentError::validation("id", "缺少 id 参数")));
            };
            let snapshot = args.get("name").and_then(|v| v.as_str());
            match restore_surface_snapshot(base, id, snapshot) {
                Ok(()) => {
                    let spec = find_surface(id).expect("登记校验已过");
                    let loaded = load_surface(spec, base);
                    let value = json!({
                        "effective": loaded.items,
                        "warnings": loaded.warnings,
                    });
                    Ok(tool_ok(value))
                }
                Err(e) => Ok(tool_err(&AgentError::from_app(name, e))),
            }
        }
        "read_data_surface" => {
            let Some(id) = args.get("id").and_then(|v| v.as_str()) else {
                return Ok(tool_err(&AgentError::validation("id", "缺少 id 参数")));
            };
            let Some(surface_id) = parse_surface_id(id) else {
                return Ok(tool_err(&AgentError::validation(
                    "id",
                    format!(
                        "数据面未登记: {id}（当前已登记: {}）",
                        registered_surface_ids()
                    ),
                )));
            };
            let loaded = load_surface(surface_id, base);
            let value = json!({
                "effective": loaded.items,
                "defaults": crate::surfaces::embedded_defaults_json(surface_id),
                "warnings": loaded.warnings,
            });
            Ok(tool_ok(value))
        }
        "patch_data_surface" => {
            let Some(id) = args.get("id").and_then(|v| v.as_str()) else {
                return Ok(tool_err(&AgentError::validation("id", "缺少 id 参数")));
            };
            let Some(surface_id) = parse_surface_id(id) else {
                return Ok(tool_err(&AgentError::validation(
                    "id",
                    format!(
                        "数据面未登记: {id}（当前已登记: {}）",
                        registered_surface_ids()
                    ),
                )));
            };
            let Some(patch) = args.get("patch") else {
                return Ok(tool_err(&AgentError::validation(
                    "patch",
                    "缺少 patch 参数",
                )));
            };
            // patch 必须是对象且恰含 items 键；list 型面（html-toolbar /
            // menus / capsules）items 为 id 字符串数组（整体替换），map 型面
            // （icons）items 为「概念键 → 定义」对象（D4 逐键深合并）。
            let is_map = surface_id.shape == crate::surfaces::SurfaceShape::Icon;
            let items = match patch.get("items") {
                Some(value) if patch.as_object().map(|m| m.len() == 1).unwrap_or(false) => value,
                _ => {
                    return Ok(tool_err(&AgentError::validation(
                        "patch",
                        "patch 必须是对象且恰含 items 键，例如 {\"items\":[\"format-bold\"]} 或 {\"items\":{\"close\":{...}}}",
                    )));
                }
            };
            // #1570：`{"items": null}` = 恢复该面默认（先快照，可回滚）。
            if items.is_null() {
                return match reset_surface_override(base, surface_id) {
                    Ok(()) => {
                        let loaded = load_surface(surface_id, base);
                        Ok(tool_ok(json!({
                            "effective": loaded.items,
                            "warnings": loaded.warnings,
                        })))
                    }
                    Err(e) => Ok(tool_err(&AgentError::from_app(name, e))),
                };
            }
            let written = if is_map {
                let map = match items.as_object() {
                    Some(map) => map,
                    None => {
                        return Ok(tool_err(&AgentError::validation(
                            "patch",
                            "icons 面 items 必须是对象（概念键 → 定义）",
                        )));
                    }
                };
                write_icon_override(base, surface_id, map)
            } else {
                let list = match items.as_array() {
                    Some(list) => list,
                    None => {
                        return Ok(tool_err(&AgentError::validation(
                            "patch",
                            "items 数组元素必须都是字符串",
                        )));
                    }
                };
                if surface_id.shape == crate::surfaces::SurfaceShape::Toolbar
                    && !list.iter().all(|v| v.is_string())
                {
                    return Ok(tool_err(&AgentError::validation(
                        "patch",
                        "html-toolbar 的 items 必须是 id 字符串数组",
                    )));
                }
                let ids: Vec<Value> = list.to_vec();
                write_list_override(base, surface_id, &ids)
            };
            match written {
                Ok(()) => {
                    let loaded = load_surface(surface_id, base);
                    let value = json!({
                        "effective": loaded.items,
                        "warnings": loaded.warnings,
                    });
                    Ok(tool_ok(value))
                }
                Err(e) => Ok(tool_err(&AgentError::from_app(name, e))),
            }
        }
        other => Ok(tool_err(&AgentError::tool(
            other,
            format!("未知工具 {other}"),
        ))),
    }
}

// ── 循环 ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentReply {
    pub text: String,
    pub turns: usize,
    pub tool_calls: Vec<String>,
}

pub async fn run_loop(
    completer: &dyn Completer,
    base: &Path,
    messages: Vec<Message>,
) -> Result<AgentReply, AgentError> {
    run_loop_with_limit(completer, base, messages, MAX_TURNS).await
}

pub async fn run_loop_with_limit(
    completer: &dyn Completer,
    base: &Path,
    mut messages: Vec<Message>,
    max_turns: usize,
) -> Result<AgentReply, AgentError> {
    let tools = tool_schemas();
    let mut executed: Vec<String> = Vec::new();
    let mut last_error: Option<(String, usize)> = None;

    for turn in 0..max_turns {
        let response = completer
            .complete(CompletionRequest {
                messages: messages.clone(),
                tools: tools.clone(),
            })
            .await?;

        if response.tool_calls.is_empty() {
            return Ok(AgentReply {
                text: response.content.unwrap_or_default(),
                turns: turn + 1,
                tool_calls: executed,
            });
        }

        messages.push(Message::assistant(
            response.content,
            response.tool_calls.clone(),
        ));

        for call in &response.tool_calls {
            let result = dispatch_tool(base, &call.name, &call.arguments)?;
            executed.push(call.name.clone());

            let failed = result.contains("\"ok\":false");
            if failed {
                let count = match &last_error {
                    Some((prev, n)) if prev == &result => n + 1,
                    _ => 1,
                };
                if count >= MAX_REPEATED_TOOL_ERRORS {
                    #[cfg(debug_assertions)]
                    eprintln!("[ai] 工具 {} 连续失败: {result}", call.name);
                    return Err(AgentError::tool(
                        call.name.clone(),
                        format!("连续 {count} 次相同错误，终止: {result}"),
                    ));
                }
                last_error = Some((result.clone(), count));
            } else {
                last_error = None;
            }

            messages.push(Message::tool_result(call.id.clone(), result));
        }
    }

    Err(AgentError::TurnLimit { turns: max_turns })
}

// ── 真实 provider ───────────────────────────────────────────

pub struct OpenAiCompleter {
    client: reqwest::Client,
    endpoint: String,
    model: String,
    api_key: String,
}

impl OpenAiCompleter {
    pub fn new(
        endpoint: impl Into<String>,
        model: impl Into<String>,
        api_key: impl Into<String>,
    ) -> Self {
        Self {
            client: reqwest::Client::new(),
            endpoint: endpoint.into(),
            model: model.into(),
            api_key: api_key.into(),
        }
    }
}

/// 把 provider 的 base endpoint 拼成 chat completions URL。
/// base 已带版本段（`/v1`、`/v4`…）时只补 `/chat/completions`，否则补 `/v1/chat/completions`。
pub fn completions_url(endpoint: &str) -> String {
    let base = endpoint.trim_end_matches('/');
    let has_version = base.rsplit('/').next().is_some_and(|seg| {
        seg.len() >= 2 && seg.starts_with('v') && seg[1..].chars().all(|c| c.is_ascii_digit())
    });
    if has_version {
        format!("{base}/chat/completions")
    } else {
        format!("{base}/v1/chat/completions")
    }
}

fn parse_tool_call(raw: &Value) -> Option<ToolCall> {
    let function = raw.get("function")?;
    let name = function.get("name")?.as_str()?.to_string();
    let id = raw
        .get("id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| format!("call_{name}"));
    let arguments = match function.get("arguments") {
        Some(Value::String(s)) if !s.trim().is_empty() => {
            serde_json::from_str(s).unwrap_or(Value::Null)
        }
        Some(value) => value.clone(),
        None => Value::Null,
    };
    Some(ToolCall {
        id,
        name,
        arguments,
    })
}

impl Completer for OpenAiCompleter {
    fn complete<'a>(&'a self, req: CompletionRequest) -> CompletionFuture<'a> {
        Box::pin(async move {
            let url = completions_url(&self.endpoint);
            let body = json!({
                "model": self.model,
                "stream": false,
                "messages": req.messages,
                "tools": req.tools,
                "tool_choice": "auto",
            });

            let response = self
                .client
                .post(&url)
                .header("Authorization", format!("Bearer {}", self.api_key))
                .json(&body)
                .send()
                .await
                .map_err(|e| {
                    #[cfg(debug_assertions)]
                    eprintln!("[ai] 请求失败: {e}");
                    AgentError::Provider {
                        status: 0,
                        body: e.to_string(),
                    }
                })?;

            let status = response.status().as_u16();
            let text = response.text().await.map_err(|e| AgentError::Provider {
                status,
                body: e.to_string(),
            })?;
            if !(200..300).contains(&status) {
                #[cfg(debug_assertions)]
                eprintln!("[ai] 服务返回 {status}: {text}");
                return Err(AgentError::Provider { status, body: text });
            }

            let parsed: Value = serde_json::from_str(&text).map_err(|e| AgentError::Provider {
                status,
                body: format!("响应不是 JSON: {e}"),
            })?;
            let message = parsed
                .get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("message"))
                .cloned()
                .unwrap_or(Value::Null);

            let content = message
                .get("content")
                .and_then(|v| v.as_str())
                .map(str::to_string)
                .filter(|s| !s.is_empty());
            let tool_calls = message
                .get("tool_calls")
                .and_then(|v| v.as_array())
                .map(|calls| calls.iter().filter_map(parse_tool_call).collect())
                .unwrap_or_default();

            Ok(CompletionResponse {
                content,
                tool_calls,
            })
        })
    }
}

// ── 测试用脚本化 provider ───────────────────────────────────

pub struct ScriptedCompleter {
    responses: std::sync::Mutex<std::collections::VecDeque<CompletionResponse>>,
    requests: std::sync::Mutex<Vec<CompletionRequest>>,
}

impl ScriptedCompleter {
    pub fn new(responses: Vec<CompletionResponse>) -> Self {
        Self {
            responses: std::sync::Mutex::new(responses.into()),
            requests: std::sync::Mutex::new(Vec::new()),
        }
    }

    pub fn request_count(&self) -> usize {
        self.requests.lock().map(|r| r.len()).unwrap_or(0)
    }

    pub fn last_messages(&self) -> Vec<Message> {
        self.requests
            .lock()
            .ok()
            .and_then(|r| r.last().map(|req| req.messages.clone()))
            .unwrap_or_default()
    }
}

impl Completer for ScriptedCompleter {
    fn complete<'a>(&'a self, req: CompletionRequest) -> CompletionFuture<'a> {
        Box::pin(async move {
            if let Ok(mut requests) = self.requests.lock() {
                requests.push(req);
            }
            let next = self.responses.lock().ok().and_then(|mut q| q.pop_front());
            next.ok_or_else(|| AgentError::Provider {
                status: 0,
                body: "脚本已耗尽".into(),
            })
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

    fn temp_base(tag: &str) -> tempfile::TempDir {
        tempfile::Builder::new()
            .prefix(&format!("biaoyue_agent_{tag}_"))
            .tempdir()
            .expect("create temp dir")
    }

    fn user_path(base: &Path) -> PathBuf {
        base.join("user").join("settings.json")
    }

    fn read_user(base: &Path) -> String {
        std::fs::read_to_string(user_path(base)).unwrap()
    }

    fn tool_call(id: &str, name: &str, args: Value) -> CompletionResponse {
        CompletionResponse {
            content: None,
            tool_calls: vec![ToolCall {
                id: id.into(),
                name: name.into(),
                arguments: args,
            }],
        }
    }

    fn text(content: &str) -> CompletionResponse {
        CompletionResponse {
            content: Some(content.into()),
            tool_calls: Vec::new(),
        }
    }

    #[tokio::test]
    async fn two_turn_loop_runs_tool_then_returns_text() {
        let dir = temp_base("two_turn");
        let base = dir.path();
        let completer = ScriptedCompleter::new(vec![
            tool_call("c1", "read_config", json!({})),
            text("当前主题是 system"),
        ]);

        let reply = run_loop(&completer, base, vec![Message::user("配置是什么？")])
            .await
            .unwrap();

        assert_eq!(reply.text, "当前主题是 system");
        assert_eq!(reply.turns, 2);
        assert_eq!(reply.tool_calls, vec!["read_config".to_string()]);

        let messages = completer.last_messages();
        let tool_msg = messages
            .iter()
            .find(|m| m.role == "tool")
            .expect("应回灌 tool 消息");
        assert_eq!(tool_msg.tool_call_id.as_deref(), Some("c1"));
        let content = tool_msg.content.clone().unwrap();
        assert!(content.contains("\"ok\":true"), "got {content}");
        assert!(content.contains("\"theme\":\"system\""), "got {content}");
    }

    #[tokio::test]
    async fn loop_stops_at_turn_limit() {
        let dir = temp_base("limit");
        let base = dir.path();
        let responses = (0..MAX_TURNS)
            .map(|i| tool_call(&format!("c{i}"), "list_snapshots", json!({})))
            .collect();
        let completer = ScriptedCompleter::new(responses);

        let err = run_loop(&completer, base, vec![Message::user("循环")])
            .await
            .unwrap_err();

        assert!(
            matches!(err, AgentError::TurnLimit { turns } if turns == MAX_TURNS),
            "got {err:?}"
        );
        assert_eq!(completer.request_count(), MAX_TURNS, "不应发起第 9 轮");
    }

    #[tokio::test]
    async fn invalid_patch_is_rejected_without_writing() {
        let dir = temp_base("bad_patch");
        let base = dir.path();
        std::fs::create_dir_all(user_path(base).parent().unwrap()).unwrap();
        std::fs::write(user_path(base), r#"{"theme":"light"}"#).unwrap();
        let before = read_user(base);

        let completer = ScriptedCompleter::new(vec![
            tool_call(
                "c1",
                "patch_config",
                json!({ "patch": { "fontSize": 200 } }),
            ),
            text("改不了"),
        ]);
        let reply = run_loop(&completer, base, vec![Message::user("字号调到 200")])
            .await
            .unwrap();

        assert_eq!(reply.text, "改不了");
        assert_eq!(read_user(base), before, "非法补丁不应落盘");
        let tool_msg = completer
            .last_messages()
            .into_iter()
            .find(|m| m.role == "tool")
            .expect("应有 tool 消息");
        let content = tool_msg.content.unwrap();
        assert!(content.contains("\"ok\":false"), "got {content}");
        assert!(content.contains("fontSize"), "got {content}");
    }

    #[tokio::test]
    async fn valid_patch_updates_user_layer_and_snapshots() {
        let dir = temp_base("good_patch");
        let base = dir.path();
        std::fs::create_dir_all(user_path(base).parent().unwrap()).unwrap();
        std::fs::write(user_path(base), r#"{"theme":"light"}"#).unwrap();

        let completer = ScriptedCompleter::new(vec![
            tool_call(
                "c1",
                "patch_config",
                json!({ "patch": { "theme": "dark" } }),
            ),
            tool_call("c2", "list_snapshots", json!({})),
            text("已改为深色"),
        ]);
        let reply = run_loop(&completer, base, vec![Message::user("切深色")])
            .await
            .unwrap();

        assert_eq!(reply.text, "已改为深色");
        assert!(read_user(base).contains("\"dark\""), "{}", read_user(base));
        assert_eq!(load_config_at(base).unwrap().theme.as_deref(), Some("dark"));

        let snapshots = list_snapshots(base).unwrap();
        assert_eq!(snapshots.len(), 1, "写入前应产生一份快照: {snapshots:?}");
        let snapshot = std::fs::read_to_string(base.join("snapshots").join(&snapshots[0])).unwrap();
        assert!(snapshot.contains("\"light\""), "快照应是旧值: {snapshot}");

        let tool_msgs: Vec<String> = completer
            .last_messages()
            .into_iter()
            .filter(|m| m.role == "tool")
            .filter_map(|m| m.content)
            .collect();
        assert_eq!(tool_msgs.len(), 2);
        assert!(tool_msgs[1].contains(&snapshots[0]), "got {}", tool_msgs[1]);
    }

    #[test]
    fn read_config_matches_effective_config() {
        let dir = temp_base("read");
        let base = dir.path();
        std::fs::create_dir_all(user_path(base).parent().unwrap()).unwrap();
        std::fs::write(user_path(base), r#"{"theme":"warm","fontSize":19.0}"#).unwrap();

        let raw = dispatch_tool(base, "read_config", &json!({})).unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        let expected = serde_json::to_value(load_config_at(base).unwrap()).unwrap();

        assert_eq!(parsed["ok"], json!(true));
        assert_eq!(parsed["result"], expected);
        assert_eq!(parsed["result"]["theme"], json!("warm"));
        assert_eq!(parsed["result"]["fontSize"], json!(19.0));
    }

    #[test]
    fn unknown_tool_returns_structured_error() {
        let dir = temp_base("unknown");
        let raw = dispatch_tool(dir.path(), "rm_rf", &json!({})).unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false));
        assert_eq!(parsed["error"]["kind"], json!("tool"));
    }

    #[test]
    fn tool_schemas_cover_six_tools() {
        let names: Vec<String> = tool_schemas()
            .iter()
            .map(|s| s["function"]["name"].as_str().unwrap().to_string())
            .collect();
        assert_eq!(
            names,
            vec![
                "read_config",
                "patch_config",
                "list_snapshots",
                "restore_surface_snapshot",
                "read_data_surface",
                "patch_data_surface",
            ]
        );
    }

    #[test]
    fn read_data_surface_returns_three_sections() {
        let dir = temp_base("read_surface");
        let base = dir.path();
        let raw =
            dispatch_tool(base, "read_data_surface", &json!({ "id": "html-toolbar" })).unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        let result = &parsed["result"];
        // A-6.1：恰含 effective / defaults / warnings 三段
        let obj = result.as_object().expect("result 应为对象");
        let mut keys: Vec<&str> = obj.keys().map(|s| s.as_str()).collect();
        keys.sort();
        assert_eq!(keys, vec!["defaults", "effective", "warnings"]);
        assert_eq!(result["effective"].as_array().unwrap().len(), 12);
        assert_eq!(result["defaults"].as_array().unwrap().len(), 12);
        assert!(result["warnings"].as_array().unwrap().is_empty());
    }

    #[test]
    fn patch_data_surface_updates_override_and_snapshots() {
        let dir = temp_base("patch_surface");
        let base = dir.path();
        std::fs::create_dir_all(user_path(base).parent().unwrap()).unwrap();
        std::fs::write(user_path(base), r#"{"theme":"light"}"#).unwrap();
        let defaults_path = base
            .join("defaults")
            .join("surfaces")
            .join("html-toolbar.json");
        let before_defaults = {
            // 先触发物化，拿到默认文件字节
            let _ = crate::surfaces::materialize(
                crate::surfaces::find_surface("html-toolbar").unwrap(),
                base,
            );
            std::fs::read(&defaults_path).unwrap()
        };
        let before_snapshots = list_snapshots(base).unwrap();

        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "html-toolbar", "patch": { "items": ["format-bold", "format-italic"] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        let effective = parsed["result"]["effective"].as_array().unwrap();
        let ids: Vec<&str> = effective
            .iter()
            .map(|v| v["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, vec!["format-bold", "format-italic"]);

        // A-6.2：写前产生快照
        let after_snapshots = list_snapshots(base).unwrap();
        assert_eq!(
            after_snapshots.len(),
            before_snapshots.len() + 1,
            "patch 前应产生一份快照"
        );

        // A-6.4：defaults 物化文件逐字节不变
        let after_defaults = std::fs::read(&defaults_path).unwrap();
        assert_eq!(
            before_defaults, after_defaults,
            "AI 不得触碰 defaults 物化文件"
        );
    }

    #[test]
    fn patch_data_surface_menus_writes_override_file() {
        let dir = temp_base("patch_menus");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "menus", "patch": { "items": [ {"id":"pane-source","label":"查看源码"}, {"id":"pane-new-file"} ] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        let pane_ids: Vec<&str> = parsed["result"]["effective"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|v| v["group"] == json!("pane-header"))
            .map(|v| v["id"].as_str().unwrap())
            .collect();
        assert_eq!(pane_ids, vec!["pane-source", "pane-new-file"]);
        let override_path = base.join("user").join("menus.json");
        let written = std::fs::read_to_string(&override_path).unwrap();
        let value: Value = serde_json::from_str(&written).unwrap();
        let items: Vec<&str> = value["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v["id"].as_str().unwrap())
            .collect();
        assert_eq!(items, vec!["pane-source", "pane-new-file"]);
    }

    // ── #1555：menus 补丁按组并入已存储覆盖（补丁只定义被改的组）──────

    fn menus_override_groups(base: &Path) -> Vec<String> {
        let raw = std::fs::read_to_string(base.join("user").join("menus.json")).unwrap();
        let value: Value = serde_json::from_str(&raw).unwrap();
        let mut groups: Vec<String> = value["items"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|item| item["group"].as_str().map(str::to_string))
            .collect();
        groups.sort();
        groups.dedup();
        groups
    }

    #[test]
    fn patch_data_surface_menus_单组补丁只写该组() {
        let dir = temp_base("patch_menus_group_one");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "menus", "patch": { "items": [ {"id":"pane-source","label":"查看源码"}, {"id":"pane-new-file"} ] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        // 有效集合：格头组两项 + 其余五组默认（12+4+6+1+6=29）
        assert_eq!(parsed["result"]["effective"].as_array().unwrap().len(), 31);
        // 覆盖文件只含被补丁的组
        assert_eq!(menus_override_groups(base), vec!["pane-header".to_string()]);
        let written: Value = serde_json::from_str(
            &std::fs::read_to_string(base.join("user").join("menus.json")).unwrap(),
        )
        .unwrap();
        let ids: Vec<&str> = written["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, vec!["pane-source", "pane-new-file"]);
    }

    #[test]
    fn patch_data_surface_menus_第二组补丁并入且不覆盖前组() {
        let dir = temp_base("patch_menus_group_two");
        let base = dir.path();
        let first = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "menus", "patch": { "items": [ {"id":"pane-source","label":"查看源码"} ] } }),
        )
        .unwrap();
        assert_eq!(
            serde_json::from_str::<Value>(&first).unwrap()["ok"],
            json!(true)
        );
        let second = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "menus", "patch": { "items": [ {"id":"preview-copy-path","label":"拷贝路径"} ] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&second).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {second}");
        // 覆盖文件含两组，前组未被后补丁清空
        assert_eq!(
            menus_override_groups(base),
            vec!["pane-header".to_string(), "preview-context".to_string()]
        );
        let written: Value = serde_json::from_str(
            &std::fs::read_to_string(base.join("user").join("menus.json")).unwrap(),
        )
        .unwrap();
        let ids: Vec<&str> = written["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, vec!["pane-source", "preview-copy-path"]);
        // 前组改名仍在有效集合
        let labels: Vec<&str> = parsed["result"]["effective"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|i| i["id"] == json!("pane-source"))
            .map(|i| i["label"].as_str().unwrap())
            .collect();
        assert_eq!(labels, vec!["查看源码"]);
    }

    #[test]
    fn patch_data_surface_menus_同组重复补丁幂等() {
        let dir = temp_base("patch_menus_group_idem");
        let base = dir.path();
        let patch = json!({ "id": "menus", "patch": { "items": [ {"id":"pane-source","label":"查看源码"} ] } });
        dispatch_tool(base, "patch_data_surface", &patch).unwrap();
        let after_first = std::fs::read_to_string(base.join("user").join("menus.json")).unwrap();
        dispatch_tool(base, "patch_data_surface", &patch).unwrap();
        let after_second = std::fs::read_to_string(base.join("user").join("menus.json")).unwrap();
        assert_eq!(
            after_first, after_second,
            "同组同内容重复补丁应幂等（字节一致）"
        );
    }

    #[test]
    fn patch_data_surface_menus_rejects_unknown_id_without_write() {
        let dir = temp_base("patch_menus_bad");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "menus", "patch": { "items": [ {"id":"nope","label":"无此项","icon":"file","group":"pane-header","action":"no-such-action","order":1,"enabled":true} ] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "got {raw}");
        assert!(
            parsed["error"]["message"]
                .as_str()
                .unwrap()
                .contains("nope"),
            "got {raw}"
        );
        assert!(
            !base.join("user").join("menus.json").exists(),
            "未知动作不应落盘"
        );
    }

    #[test]
    fn read_data_surface_rejects_unregistered_id_without_write() {
        let dir = temp_base("read_bad_surface");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "read_data_surface",
            &json!({ "id": "not-registered" }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "got {raw}");
        assert!(
            parsed["error"]["message"]
                .as_str()
                .unwrap()
                .contains("未登记"),
            "got {raw}"
        );
        assert!(!user_path(base).exists(), "未登记 id 不应产生任何写入");
    }

    // ── #1579：reader-presets 的 AI 通路（注册表驱动，无需新工具）──────

    #[test]
    fn patch_data_surface_reader_presets_改字号落盘且默认文件不变() {
        let dir = temp_base("patch_presets");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "reader-presets", "patch": { "items": [ {"id":"wide","fontSize":21} ] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        let effective = parsed["result"]["effective"].as_array().unwrap();
        let wide = effective
            .iter()
            .find(|i| i["id"] == json!("wide"))
            .expect("wide 必在有效集合");
        assert_eq!(wide["fontSize"], json!(21));
        // 仅写局部项时其余字段与其余两套保留默认
        assert_eq!(wide["width"], json!(1280));
        assert_eq!(wide["skin"], json!("paper"));
        assert_eq!(effective.len(), 3);
        let written: Value = serde_json::from_str(
            &std::fs::read_to_string(base.join("user").join("reader-presets.json")).unwrap(),
        )
        .unwrap();
        let written_wide = written["items"]
            .as_array()
            .unwrap()
            .iter()
            .find(|i| i["id"] == json!("wide"))
            .unwrap();
        assert_eq!(written_wide["fontSize"], json!(21));
        assert_eq!(written["items"].as_array().unwrap().len(), 3, "其余两套不应被清空");
        // 默认层不被改写
        let read_back: Value = serde_json::from_str(
            &dispatch_tool(base, "read_data_surface", &json!({ "id": "reader-presets" })).unwrap(),
        )
        .unwrap();
        let defaults = read_back["result"]["defaults"].as_array().unwrap();
        let default_wide = defaults
            .iter()
            .find(|i| i["id"] == json!("wide"))
            .unwrap();
        assert_eq!(default_wide["fontSize"], json!(19), "默认文件字节不应被改写");
    }

    #[test]
    fn patch_data_surface_reader_presets_items_null_恢复默认并可回滚() {
        let dir = temp_base("patch_presets_reset");
        let base = dir.path();
        dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "reader-presets", "patch": { "items": [ {"id":"wide","fontSize":21} ] } }),
        )
        .unwrap();
        let override_path = base.join("user").join("reader-presets.json");
        assert!(override_path.exists());

        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "reader-presets", "patch": { "items": null } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        assert!(!override_path.exists(), "重置后覆盖文件应删除");
        let effective = parsed["result"]["effective"].as_array().unwrap();
        assert_eq!(effective.len(), 3);
        let wide = effective.iter().find(|i| i["id"] == json!("wide")).unwrap();
        assert_eq!(wide["fontSize"], json!(19), "重置后不应残留旧值");

        // 回滚到重置前（fontSize 21）
        let back = dispatch_tool(
            base,
            "restore_surface_snapshot",
            &json!({ "id": "reader-presets" }),
        )
        .unwrap();
        let back_parsed: Value = serde_json::from_str(&back).unwrap();
        assert_eq!(back_parsed["ok"], json!(true), "got {back}");
        let read_back: Value = serde_json::from_str(
            &dispatch_tool(base, "read_data_surface", &json!({ "id": "reader-presets" })).unwrap(),
        )
        .unwrap();
        let wide = read_back["result"]["effective"]
            .as_array()
            .unwrap()
            .iter()
            .find(|i| i["id"] == json!("wide"))
            .unwrap();
        assert_eq!(wide["fontSize"], json!(21), "回滚应恢复写入前的覆盖值");
    }

    #[test]
    fn patch_data_surface_reader_presets_越界字号拒绝且零写入() {
        let dir = temp_base("patch_presets_bounds");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "reader-presets", "patch": { "items": [ {"id":"wide","fontSize":120} ] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "越界应拒绝: {raw}");
        assert!(
            !base.join("user").join("reader-presets.json").exists(),
            "拒绝时不得产生任何写入"
        );
        // 未登记 id 的报错须列出已登记面（含 reader-presets）
        let bad = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "nope", "patch": {} }),
        )
        .unwrap();
        assert!(bad.contains("reader-presets"), "got {bad}");
    }

    #[test]
    fn patch_data_surface_rejects_unregistered_id_without_write() {
        let dir = temp_base("bad_surface_id");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "not-registered", "patch": { "items": ["format-bold"] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "got {raw}");
        assert!(
            parsed["error"]["message"]
                .as_str()
                .unwrap()
                .contains("未登记"),
            "got {raw}"
        );
        // 零写入：user 层不存在
        assert!(!user_path(base).exists(), "未登记 id 不应产生任何写入");
    }

    #[test]
    fn read_data_surface_icons_returns_three_sections() {
        let dir = temp_base("read_icons");
        let base = dir.path();
        let raw = dispatch_tool(base, "read_data_surface", &json!({ "id": "icons" })).unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        let result = &parsed["result"];
        assert!(result["effective"].as_array().is_some(), "got {raw}");
        assert!(result["defaults"].as_array().is_some(), "got {raw}");
        assert!(result["warnings"].as_array().is_some(), "got {raw}");
        assert_eq!(result["effective"].as_array().unwrap().len(), 135);
    }

    #[test]
    fn patch_data_surface_icons_writes_override_file() {
        let dir = temp_base("patch_icons");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "icons", "patch": { "items": { "close": { "label": "关窗", "s": "M1 1 L23 23" } } } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        let path = base.join("user").join("icons.json");
        assert!(path.exists(), "icons 覆盖应落盘");
        let written: Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(written["items"]["close"]["label"], json!("关窗"));
        // 有效集合里 close 用新定义，其余键保留默认
        let effective = parsed["result"]["effective"].as_array().unwrap();
        let close = effective
            .iter()
            .find(|i| i["key"] == json!("close"))
            .expect("close 必在有效集合");
        assert_eq!(close["label"], json!("关窗"));
        assert_eq!(close["s"], json!("M1 1 L23 23"));
    }

    #[test]
    fn patch_data_surface_icons_accepts_valid_new_key() {
        let dir = temp_base("patch_icons_new_key");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "icons", "patch": { "items": { "brandNew": { "label": "新图标", "s": "M2 2 L22 22" } } } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(
            parsed["ok"],
            json!(true),
            "合法定义的新概念键应被接受: {raw}"
        );
        let path = base.join("user").join("icons.json");
        let written: Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(written["items"]["brandNew"]["label"], json!("新图标"));
        let effective = parsed["result"]["effective"].as_array().unwrap();
        let brand = effective
            .iter()
            .find(|i| i["key"] == json!("brandNew"))
            .expect("新概念键应出现在有效集合");
        assert_eq!(brand["s"], json!("M2 2 L22 22"));
    }

    #[test]
    fn patch_data_surface_icons_rejects_new_key_missing_label_without_write() {
        let dir = temp_base("patch_icons_new_nolabel");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "icons", "patch": { "items": { "brandNew": { "s": "M2 2 L22 22" } } } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "缺 label 的新键应拒绝: {raw}");
        assert!(
            !base.join("user").join("icons.json").exists(),
            "非法新键不应落盘"
        );
    }

    #[test]
    fn patch_data_surface_icons_rejects_missing_path_without_write() {
        let dir = temp_base("patch_icons_nopath");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "icons", "patch": { "items": { "close": { "label": "关" } } } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "got {raw}");
        assert!(
            parsed["error"]["message"]
                .as_str()
                .unwrap()
                .contains("缺 path 组"),
            "got {raw}"
        );
        assert!(
            !base.join("user").join("icons.json").exists(),
            "缺 path 组的定义不应落盘"
        );
    }

    #[test]
    fn patch_data_surface_rejects_unknown_item_id() {
        let dir = temp_base("bad_item_id");
        let base = dir.path();
        std::fs::create_dir_all(user_path(base).parent().unwrap()).unwrap();
        std::fs::write(user_path(base), r#"{"theme":"light"}"#).unwrap();
        let before = read_user(base);

        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "html-toolbar", "patch": { "items": ["format-bold", "nope"] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "got {raw}");
        assert!(
            parsed["error"]["message"]
                .as_str()
                .unwrap()
                .contains("nope"),
            "got {raw}"
        );
        assert_eq!(read_user(base), before, "未知动作不应落盘");
    }

    // ── T6：四面白名单 + 按形分派 ─────────────────────────────

    fn defaults_path(base: &Path, id: &str) -> PathBuf {
        base.join("defaults")
            .join("surfaces")
            .join(format!("{id}.json"))
    }

    fn surface_snapshot_dir(base: &Path, id: &str) -> PathBuf {
        base.join("snapshots").join("surfaces").join(id)
    }

    fn materialize_defaults(base: &Path, id: &str) -> Vec<u8> {
        let spec = find_surface(id).expect("面必登记");
        crate::surfaces::materialize(spec, base);
        std::fs::read(defaults_path(base, id)).unwrap()
    }

    /// 面级快照文件数（新面的回滚凭据）。
    fn surface_snapshot_count(base: &Path, id: &str) -> usize {
        let dir = surface_snapshot_dir(base, id);
        std::fs::read_dir(&dir)
            .map(|entries| entries.filter_map(|e| e.ok()).count())
            .unwrap_or(0)
    }

    fn write_surface_user(base: &Path, id: &str, json: &str) {
        let path = base.join("user").join(format!("{id}.json"));
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, json).unwrap();
    }

    #[test]
    fn read_data_surface_returns_three_sections_for_all_four() {
        for (id, len) in [
            ("html-toolbar", 12),
            ("menus", 35),
            ("icons", 135),
            ("capsules", 12),
        ] {
            let dir = temp_base(&format!("read_all_{id}"));
            let base = dir.path();
            let raw = dispatch_tool(base, "read_data_surface", &json!({ "id": id })).unwrap();
            let parsed: Value = serde_json::from_str(&raw).unwrap();
            assert_eq!(parsed["ok"], json!(true), "{id}: got {raw}");
            let result = &parsed["result"];
            let mut keys: Vec<&str> = result
                .as_object()
                .unwrap()
                .keys()
                .map(|s| s.as_str())
                .collect();
            keys.sort();
            assert_eq!(keys, vec!["defaults", "effective", "warnings"], "{id}");
            assert_eq!(
                result["effective"].as_array().unwrap().len(),
                len,
                "{id} 有效集合项数"
            );
            assert_eq!(
                result["defaults"].as_array().unwrap().len(),
                len,
                "{id} 默认集合项数"
            );
            assert!(result["warnings"].as_array().unwrap().is_empty(), "{id}");
        }
    }

    #[test]
    fn patch_data_surface_capsules_writes_override_and_keeps_defaults() {
        let dir = temp_base("patch_capsules");
        let base = dir.path();
        let before_defaults = materialize_defaults(base, "capsules");
        // 先写一次覆盖，让「写前快照」有旧值可拍
        write_surface_user(base, "capsules", r#"{"items":[{"id":"format-bold"}]}"#);
        let before_snapshots = surface_snapshot_count(base, "capsules");

        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "capsules", "patch": { "items": [ {"id":"format-bold"}, {"id":"format-italic"}, {"id":"capsule-bg"} ] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        let ids: Vec<&str> = parsed["result"]["effective"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, vec!["format-bold", "format-italic", "capsule-bg"]);
        // 整体替换：被移除的项不残留（无残留旧 label），顺序与补丁一致
        let labels: Vec<&str> = parsed["result"]["effective"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v["label"].as_str().unwrap())
            .collect();
        assert_eq!(labels, vec!["加粗", "斜体", "背景色"]);

        let written: Value = serde_json::from_str(
            &std::fs::read_to_string(base.join("user").join("capsules.json")).unwrap(),
        )
        .unwrap();
        let items: Vec<&str> = written["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v["id"].as_str().unwrap())
            .collect();
        assert_eq!(items, vec!["format-bold", "format-italic", "capsule-bg"]);

        assert_eq!(
            surface_snapshot_count(base, "capsules"),
            before_snapshots + 1,
            "写前应产生一份面级快照"
        );
        // 快照应保存写前旧值（可据此一步回滚）
        let snapshots = surface_snapshot_dir(base, "capsules");
        let snapshot_with_old_value = std::fs::read_dir(&snapshots)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .find(|p| {
                std::fs::read_to_string(p)
                    .map(|s| s.contains("format-bold") && !s.contains("capsule-bg"))
                    .unwrap_or(false)
            })
            .expect("应有保存旧值的快照");
        let value: Value =
            serde_json::from_str(&std::fs::read_to_string(snapshot_with_old_value).unwrap())
                .unwrap();
        let items: Vec<&str> = value["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v["id"].as_str().unwrap())
            .collect();
        assert_eq!(items, vec!["format-bold"], "快照应保存写前旧值");
        assert_eq!(
            before_defaults,
            std::fs::read(defaults_path(base, "capsules")).unwrap(),
            "AI 不得触碰 defaults 物化文件"
        );
    }

    #[test]
    fn patch_data_surface_menus_and_icons_keep_defaults_bytes() {
        for id in ["menus", "icons"] {
            let dir = temp_base(&format!("patch_defaults_{id}"));
            let base = dir.path();
            let before_defaults = materialize_defaults(base, id);
            write_surface_user(base, id, "{}");
            let before_snapshots = surface_snapshot_count(base, id);

            let patch = if id == "menus" {
                json!({ "id": id, "patch": { "items": [ {"id":"pane-source"}, {"id":"pane-new-file"} ] } })
            } else {
                json!({ "id": id, "patch": { "items": { "close": { "label": "关窗", "s": "M1 1 L23 23" } } } })
            };
            let raw = dispatch_tool(base, "patch_data_surface", &patch).unwrap();
            let parsed: Value = serde_json::from_str(&raw).unwrap();
            assert_eq!(parsed["ok"], json!(true), "{id}: got {raw}");
            assert_eq!(
                surface_snapshot_count(base, id),
                before_snapshots + 1,
                "{id}: 写前应产生一份面级快照"
            );
            assert_eq!(
                before_defaults,
                std::fs::read(defaults_path(base, id)).unwrap(),
                "{id}: AI 不得触碰 defaults 物化文件"
            );
        }
    }

    #[test]
    fn patch_data_surface_rejects_unknown_id_with_zero_write() {
        let dir = temp_base("patch_unregistered");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "keybindings", "patch": { "items": ["format-bold"] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "got {raw}");
        assert_eq!(parsed["error"]["kind"], json!("validation"), "got {raw}");
        assert!(
            parsed["error"]["message"]
                .as_str()
                .unwrap()
                .contains("未登记"),
            "got {raw}"
        );
        assert!(!base.join("user").exists(), "未登记 id 不应产生任何写入");
        assert!(!base.join("snapshots").exists(), "未登记 id 不应产生快照");
    }

    #[test]
    fn patch_data_surface_capsules_rejects_unknown_id_without_write() {
        let dir = temp_base("patch_capsules_bad");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "capsules", "patch": { "items": [ {"id":"nope","label":"无此项","icon":"bold","order":1} ] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "got {raw}");
        assert!(
            parsed["error"]["message"]
                .as_str()
                .unwrap()
                .contains("nope"),
            "got {raw}"
        );
        assert!(
            !base.join("user").join("capsules.json").exists(),
            "未知胶囊动作不应落盘"
        );
    }

    #[test]
    fn patch_data_surface_rejects_invalid_shapes_without_write() {
        let dir = temp_base("patch_bad_shapes");
        let base = dir.path();
        // list 型面收到对象 items
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "menus", "patch": { "items": { "pane-source": {} } } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "menus 收对象应拒绝: {raw}");
        // map 型面收到数组 items
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "icons", "patch": { "items": ["close"] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "icons 收数组应拒绝: {raw}");
        // patch 含多余键
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "capsules", "patch": { "items": ["format-bold"], "extra": 1 } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "patch 含多余键应拒绝: {raw}");
        assert!(!base.join("user").exists(), "全非法补丁不应产生任何写入");
    }

    // ── 回滚：面级覆盖写可经 restore 一步回滚 ──────────────────

    fn effective_ids(base: &Path, id: &str) -> Vec<String> {
        let spec = find_surface(id).expect("面必登记");
        load_surface(spec, base)
            .items
            .iter()
            .filter_map(|item| item.get("id")?.as_str().map(str::to_string))
            .collect()
    }

    fn effective_group_ids(base: &Path, id: &str, group: &str) -> Vec<String> {
        let spec = find_surface(id).expect("面必登记");
        load_surface(spec, base)
            .items
            .iter()
            .filter(|item| item.get("group").and_then(|v| v.as_str()) == Some(group))
            .filter_map(|item| item.get("id")?.as_str().map(str::to_string))
            .collect()
    }

    fn effective_keys(base: &Path, id: &str) -> Vec<String> {
        let spec = find_surface(id).expect("面必登记");
        load_surface(spec, base)
            .items
            .iter()
            .filter_map(|item| item.get("key")?.as_str().map(str::to_string))
            .collect()
    }

    #[test]
    fn patch_data_surface_reset_menus_restores_defaults() {
        let dir = temp_base("reset_menus");
        let base = dir.path();
        dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "menus", "patch": { "items": [ {"id":"pane-source","label":"查看源码"} ] } }),
        )
        .unwrap();
        assert!(base.join("user").join("menus.json").exists());

        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "menus", "patch": { "items": null } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        assert!(!base.join("user").join("menus.json").exists(), "覆盖文件应被删除");
        assert_eq!(
            parsed["result"]["effective"].as_array().unwrap().len(),
            35,
            "有效集合应回落默认 35 项"
        );
    }

    #[test]
    fn patch_data_surface_reset_icons_and_capsules_restore_defaults() {
        for (id, default_len) in [("icons", 135usize), ("capsules", 12usize)] {
            let dir = temp_base(&format!("reset_{id}"));
            let base = dir.path();
            let before = surface_snapshot_count(base, id);
            let raw = dispatch_tool(
                base,
                "patch_data_surface",
                &json!({ "id": id, "patch": { "items": null } }),
            )
            .unwrap();
            let parsed: Value = serde_json::from_str(&raw).unwrap();
            assert_eq!(parsed["ok"], json!(true), "{id}: got {raw}");
            assert!(
                !base.join("user").join(format!("{id}.json")).exists(),
                "{id}: 覆盖文件应被删除"
            );
            assert_eq!(
                parsed["result"]["effective"].as_array().unwrap().len(),
                default_len,
                "{id}: 有效集合应回落默认"
            );
            assert_eq!(
                surface_snapshot_count(base, id),
                before,
                "{id}: 本无覆盖时幂等且不产生空快照"
            );
        }
    }

    #[test]
    fn patch_data_surface_reset_is_reversible_by_restore() {
        let dir = temp_base("reset_restore");
        let base = dir.path();
        dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "capsules", "patch": { "items": [ {"id":"format-bold"} ] } }),
        )
        .unwrap();
        dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "capsules", "patch": { "items": null } }),
        )
        .unwrap();
        assert!(!base.join("user").join("capsules.json").exists());

        dispatch_tool(
            base,
            "restore_surface_snapshot",
            &json!({ "id": "capsules" }),
        )
        .unwrap();
        assert!(base.join("user").join("capsules.json").exists());
        assert_eq!(effective_ids(base, "capsules"), vec!["format-bold"]);
    }

    #[test]
    fn patch_data_surface_reset_html_toolbar_clears_field() {
        let dir = temp_base("reset_toolbar");
        let base = dir.path();
        dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "html-toolbar", "patch": { "items": ["format-bold","format-italic"] } }),
        )
        .unwrap();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "html-toolbar", "patch": { "items": null } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        assert_eq!(
            parsed["result"]["effective"].as_array().unwrap().len(),
            12,
            "工具条应回落默认 12 项"
        );
    }

    #[test]
    fn restore_menus_snapshot_rolls_back_effective_set_and_bytes() {
        let dir = temp_base("restore_menus");
        let base = dir.path();
        // 写前状态：两项覆盖
        write_surface_user(
            base,
            "menus",
            r#"{"items":[{"id":"pane-source"},{"id":"pane-new-file"}]}"#,
        );
        let before_bytes = std::fs::read(base.join("user").join("menus.json")).unwrap();
        let before_ids = effective_group_ids(base, "menus", "pane-header");
        assert_eq!(before_ids, vec!["pane-source", "pane-new-file"]);

        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "menus", "patch": { "items": [ {"id":"pane-locate"},{"id":"pane-share"},{"id":"pane-split-right"},{"id":"pane-split-down"} ] } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        // 补丁定义 4 项，但 pane-header 组原覆盖（2 项）被整组替换 → 恰 4 项
        assert_eq!(
            effective_group_ids(base, "menus", "pane-header").len(),
            4,
            "补丁后格头组应为 4 项"
        );

        let raw =
            dispatch_tool(base, "restore_surface_snapshot", &json!({ "id": "menus" })).unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "回滚应成功: {raw}");
        assert_eq!(
            std::fs::read(base.join("user").join("menus.json")).unwrap(),
            before_bytes,
            "回滚后 user 覆盖应回到写前字节"
        );
        assert_eq!(
            effective_group_ids(base, "menus", "pane-header"),
            before_ids,
            "回滚后格头组有效集合应等于写前状态"
        );
        // 默认文件不受影响
        assert!(defaults_path(base, "menus").exists());
    }

    #[test]
    fn restore_icons_snapshot_rolls_back_map_merge() {
        let dir = temp_base("restore_icons");
        let base = dir.path();
        write_surface_user(
            base,
            "icons",
            r#"{"items":{"close":{"label":"关闭窗口","s":"M1 1 L23 23"}}}"#,
        );
        let before_bytes = std::fs::read(base.join("user").join("icons.json")).unwrap();
        let before_keys = effective_keys(base, "icons");
        let before_close_label = load_surface(find_surface("icons").unwrap(), base)
            .items
            .iter()
            .find(|i| i["key"] == json!("close"))
            .unwrap()["label"]
            .clone();

        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "icons", "patch": { "items": { "markdown": { "label": "MD", "s": "M7 4h10" }, "brandNew": { "label": "新", "s": "M2 2" } } } }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "got {raw}");
        assert_eq!(effective_keys(base, "icons").len(), before_keys.len() + 1);

        let raw =
            dispatch_tool(base, "restore_surface_snapshot", &json!({ "id": "icons" })).unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(true), "回滚应成功: {raw}");
        assert_eq!(
            std::fs::read(base.join("user").join("icons.json")).unwrap(),
            before_bytes,
            "回滚后 user 覆盖应回到写前字节"
        );
        assert_eq!(
            effective_keys(base, "icons"),
            before_keys,
            "回滚后有效集合应等于写前状态"
        );
        let restored_label = load_surface(find_surface("icons").unwrap(), base)
            .items
            .iter()
            .find(|i| i["key"] == json!("close"))
            .unwrap()["label"]
            .clone();
        assert_eq!(restored_label, before_close_label, "回滚后 label 应还原");
    }

    #[test]
    fn restore_without_snapshot_is_structured_error_and_writes_nothing() {
        let dir = temp_base("restore_none");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "restore_surface_snapshot",
            &json!({ "id": "capsules" }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "got {raw}");
        assert_eq!(parsed["error"]["kind"], json!("validation"), "got {raw}");
        assert!(
            parsed["error"]["message"]
                .as_str()
                .unwrap()
                .contains("没有可用快照"),
            "got {raw}"
        );
        assert!(!base.join("user").exists(), "无快照回滚不应产生任何写入");
    }

    #[test]
    fn restore_rejects_unregistered_surface() {
        let dir = temp_base("restore_bad_id");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "restore_surface_snapshot",
            &json!({ "id": "keybindings" }),
        )
        .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(parsed["ok"], json!(false), "got {raw}");
        assert!(
            parsed["error"]["message"]
                .as_str()
                .unwrap()
                .contains("未登记"),
            "got {raw}"
        );
    }

    #[test]
    fn restore_is_itself_reversible() {
        let dir = temp_base("restore_twice");
        let base = dir.path();
        write_surface_user(base, "capsules", r#"{"items":[{"id":"format-bold"}]}"#);
        dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "capsules", "patch": { "items": [ {"id":"format-italic"},{"id":"capsule-bg"} ] } }),
        )
        .unwrap();
        // 第一次回滚 → format-bold
        dispatch_tool(
            base,
            "restore_surface_snapshot",
            &json!({ "id": "capsules" }),
        )
        .unwrap();
        assert_eq!(effective_ids(base, "capsules"), vec!["format-bold"]);
        // 第二次回滚 → 回到补丁后的两项（恢复本身被快照）
        dispatch_tool(
            base,
            "restore_surface_snapshot",
            &json!({ "id": "capsules" }),
        )
        .unwrap();
        assert_eq!(
            effective_ids(base, "capsules"),
            vec!["format-italic", "capsule-bg"],
            "恢复本身也应可再回滚"
        );
    }

    #[tokio::test]
    async fn openai_completer_uses_configured_endpoint_and_bearer() {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use std::sync::{Arc, Mutex};

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let captured = Arc::new(Mutex::new(String::new()));
        let server_capture = captured.clone();

        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0u8; 8192];
            let n = stream.read(&mut buf).unwrap();
            server_capture
                .lock()
                .unwrap()
                .push_str(&String::from_utf8_lossy(&buf[..n]));
            let body = r#"{"choices":[{"message":{"content":"ok"}}]}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream.write_all(response.as_bytes()).unwrap();
            stream.flush().unwrap();
        });

        let completer = OpenAiCompleter::new(format!("http://{addr}"), "test-model", "sk-test");
        let response = completer
            .complete(CompletionRequest {
                messages: vec![Message::user("hi")],
                tools: vec![],
            })
            .await
            .unwrap();
        server.join().unwrap();

        assert_eq!(response.content.as_deref(), Some("ok"));
        let request = captured.lock().unwrap().clone();
        assert!(request.contains("POST /v1/chat/completions"), "{request}");
        assert!(request.contains("Bearer sk-test"), "{request}");
        assert!(request.contains("\"model\":\"test-model\""), "{request}");
    }

    #[test]
    fn completions_url_respects_versioned_bases() {
        assert_eq!(
            completions_url("https://api.deepseek.com"),
            "https://api.deepseek.com/v1/chat/completions"
        );
        assert_eq!(
            completions_url("https://open.bigmodel.cn/api/paas/v4/"),
            "https://open.bigmodel.cn/api/paas/v4/chat/completions"
        );
        assert_eq!(
            completions_url("https://dashscope.aliyuncs.com/compatible-mode/v1"),
            "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
        );
    }

    #[test]
    fn tool_calls_serialize_in_openai_wire_shape() {
        let message = Message::assistant(
            None,
            vec![ToolCall {
                id: "call_1".into(),
                name: "read_config".into(),
                arguments: json!({ "a": 1 }),
            }],
        );
        let value = serde_json::to_value(&message).unwrap();
        let call = &value["tool_calls"][0];
        assert_eq!(call["id"], "call_1");
        assert_eq!(call["type"], "function");
        assert_eq!(call["function"]["name"], "read_config");
        assert_eq!(call["function"]["arguments"], "{\"a\":1}");
    }

    #[test]
    fn keyring_failures_map_to_keyring_agent_error() {
        let err: AgentError = AppError::Keyring {
            context: "get password".into(),
            source: "denied".into(),
        }
        .into();
        assert!(matches!(err, AgentError::Keyring { .. }), "{err:?}");
    }
}
