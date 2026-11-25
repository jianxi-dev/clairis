use std::future::Future;
use std::path::Path;
use std::pin::Pin;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::config::{apply_patch_at, list_snapshots, load_config_at};
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: Value,
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
                "name": "read_data_surface",
                "description": "读取已登记数据面的有效集合。返回 {effective, defaults, warnings} 三段：有效集合（默认←用户覆盖合并后）、默认集合、告警列表。",
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

/// 写 list 型面用户覆盖：未知 id 拒绝（不落盘），写前快照 + 原子写
/// `user/<id>.json`。html-toolbar 走 settings 字段（既有语义），其余面各写
/// 自己的覆盖文件。
fn write_list_override(
    base: &Path,
    spec: &crate::surfaces::SurfaceSpec,
    ids: &[String],
) -> Result<(), AppError> {
    let defaults = crate::surfaces::embedded_defaults_json(spec);
    let known: std::collections::HashSet<&str> = defaults
        .iter()
        .filter_map(|item| item.get("id")?.as_str())
        .collect();
    let mut unknown: Vec<&str> = Vec::new();
    for id in ids {
        if !known.contains(id.as_str()) && !unknown.contains(&id.as_str()) {
            unknown.push(id.as_str());
        }
    }
    if !unknown.is_empty() {
        return Err(AppError::Validation {
            context: "items".into(),
            message: format!("未知动作 id（{}）: {}", spec.id, unknown.join(", ")),
        });
    }
    snapshot_surface_override(base, spec)?;
    if spec.shape == crate::surfaces::SurfaceShape::Toolbar {
        // html-toolbar 沿用既有 settings 字段（D9 兼容）。
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
    let payload = json!({ "id": spec.id, "items": ids });
    let data = serde_json::to_vec_pretty(&payload).map_err(|e| AppError::Serialization {
        context: "patch_data_surface".into(),
        source: e,
    })?;
    crate::config::atomic_write(&path, &data)
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
                let ids: Vec<String> = list
                    .iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect();
                if ids.len() != list.len() {
                    return Ok(tool_err(&AgentError::validation(
                        "patch",
                        "items 数组元素必须都是字符串",
                    )));
                }
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
                .map_err(|e| AgentError::Provider {
                    status: 0,
                    body: e.to_string(),
                })?;

            let status = response.status().as_u16();
            let text = response.text().await.map_err(|e| AgentError::Provider {
                status,
                body: e.to_string(),
            })?;
            if !(200..300).contains(&status) {
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
    fn tool_schemas_cover_five_tools() {
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
            &json!({ "id": "menus", "patch": { "items": ["pane-source", "pane-new-file"] } }),
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
        assert_eq!(ids, vec!["pane-source", "pane-new-file"]);
        let override_path = base.join("user").join("menus.json");
        let written = std::fs::read_to_string(&override_path).unwrap();
        let value: Value = serde_json::from_str(&written).unwrap();
        let items: Vec<&str> = value["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_str().unwrap())
            .collect();
        assert_eq!(items, vec!["pane-source", "pane-new-file"]);
    }

    #[test]
    fn patch_data_surface_menus_rejects_unknown_id_without_write() {
        let dir = temp_base("patch_menus_bad");
        let base = dir.path();
        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "menus", "patch": { "items": ["nope"] } }),
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
        write_surface_user(base, "capsules", r#"{"items":["format-bold"]}"#);
        let before_snapshots = surface_snapshot_count(base, "capsules");

        let raw = dispatch_tool(
            base,
            "patch_data_surface",
            &json!({ "id": "capsules", "patch": { "items": ["format-bold", "format-italic", "capsule-bg"] } }),
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
            .map(|v| v.as_str().unwrap())
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
            .map(|v| v.as_str().unwrap())
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
                json!({ "id": id, "patch": { "items": ["pane-source", "pane-new-file"] } })
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
            &json!({ "id": "capsules", "patch": { "items": ["nope"] } }),
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
}
