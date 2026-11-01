use std::future::Future;
use std::path::Path;
use std::pin::Pin;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::config::{apply_patch_at, list_snapshots, load_config_at};
use crate::errors::AppError;

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
    ]
}

fn tool_ok(value: Value) -> String {
    json!({ "ok": true, "result": value }).to_string()
}

fn tool_err(err: &AgentError) -> String {
    json!({ "ok": false, "error": err }).to_string()
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
    fn tool_schemas_cover_three_tools() {
        let names: Vec<String> = tool_schemas()
            .iter()
            .map(|s| s["function"]["name"].as_str().unwrap().to_string())
            .collect();
        assert_eq!(names, vec!["read_config", "patch_config", "list_snapshots"]);
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
