use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::ai_agent::{run_loop, AgentError, AgentReply, Message, OpenAiCompleter};
use crate::config::{get_api_key, load_config};

const KEYRING_SERVICE: &str = "biaoyue";
const KEYRING_ACCOUNT: &str = "openai";

/// 跑一轮 agent：读配置里的 endpoint/model 与 keyring 里的 key，然后进入工具循环。
#[tauri::command]
pub async fn run_agent_turn(
    app: AppHandle,
    messages: Vec<Value>,
) -> Result<AgentReply, AgentError> {
    let messages: Vec<Message> = messages
        .into_iter()
        .map(|value| {
            serde_json::from_value(value)
                .map_err(|e| AgentError::validation("messages", e.to_string()))
        })
        .collect::<Result<_, _>>()?;

    let config = load_config(&app).await?;
    let endpoint = config.openai_endpoint.unwrap_or_default();
    let model = config.openai_model.unwrap_or_default();
    if endpoint.trim().is_empty() || model.trim().is_empty() {
        return Err(AgentError::validation(
            "provider",
            "请先配置 endpoint 与 model",
        ));
    }
    let api_key = get_api_key(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .await?
        .unwrap_or_default();
    if api_key.is_empty() {
        return Err(AgentError::validation("apiKey", "keyring 中没有 API key"));
    }

    let base = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    let completer = OpenAiCompleter::new(endpoint, model, api_key);
    run_loop(&completer, &base, messages).await
}
