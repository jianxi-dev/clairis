use futures_util::StreamExt;
use reqwest::Client;
use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};
use tracing::info;

use crate::config::load_config;
use crate::errors::AppError;
use crate::types::TranslationChunk;

static CANCELLED: AtomicBool = AtomicBool::new(false);

#[derive(Deserialize)]
pub struct TranslateRequest {
    pub text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub provider: String,
}

async fn translate_ollama(
    client: &Client,
    endpoint: &str,
    prompt: &str,
    request_id: &str,
    app: &AppHandle,
) -> Result<(), AppError> {
    let url = format!("{}/api/chat", endpoint.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": "llama3",
        "stream": true,
        "messages": [{"role": "user", "content": prompt}]
    });

    let mut stream = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e: reqwest::Error| AppError::Translation {
            context: "request".into(),
            source: e.to_string(),
        })?
        .bytes_stream();

    while let Some(chunk) = stream.next().await {
        if CANCELLED.load(Ordering::SeqCst) {
            return Ok(());
        }
        let chunk = chunk.map_err(|e: reqwest::Error| AppError::Translation {
            context: "stream".into(),
            source: e.to_string(),
        })?;
        let raw = String::from_utf8_lossy(&chunk);
        for line in raw.lines() {
            if line.trim().is_empty() {
                continue;
            }
            if let Ok(ollama_resp) = serde_json::from_str::<OllamaChunk>(line) {
                if let Some(content) = ollama_resp.message.and_then(|m| Some(m.content)) {
                    let _ =
                        app.emit("translation-chunk", TranslationChunk {
                            request_id: request_id.to_string(),
                            text: content,
                            done: false,
                            error: None,
                        });
                }
                if ollama_resp.done {
                    let _ =
                        app.emit("translation-chunk", TranslationChunk {
                            request_id: request_id.to_string(),
                            text: String::new(),
                            done: true,
                            error: None,
                        });
                }
            }
        }
    }
    Ok(())
}

async fn translate_openai(
    client: &Client,
    endpoint: &str,
    api_key: &str,
    model: &str,
    prompt: &str,
    request_id: &str,
    app: &AppHandle,
) -> Result<(), AppError> {
    let url = format!("{}/v1/chat/completions", endpoint.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model,
        "stream": true,
        "messages": [{"role": "user", "content": prompt}]
    });

    let mut stream = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e: reqwest::Error| AppError::Translation {
            context: "request".into(),
            source: e.to_string(),
        })?
        .bytes_stream();

    let mut buffer = String::new();
    while let Some(chunk) = stream.next().await {
        if CANCELLED.load(Ordering::SeqCst) {
            return Ok(());
        }
        let chunk = chunk.map_err(|e: reqwest::Error| AppError::Translation {
            context: "stream".into(),
            source: e.to_string(),
        })?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim().to_string();
            buffer.drain(..=line_end);

            if line.is_empty() || line.starts_with(":") {
                continue;
            }
            if line == "data: [DONE]" {
                let _ = app.emit("translation-chunk", TranslationChunk {
                    request_id: request_id.to_string(),
                    text: String::new(),
                    done: true,
                    error: None,
                });
                return Ok(());
            }
            if let Some(data) = line.strip_prefix("data: ") {
                if let Ok(openai_chunk) = serde_json::from_str::<OpenAIChunk>(data) {
                    if let Some(delta) = openai_chunk.choices.first() {
                        if let Some(content) = &delta.delta.content {
                            let _ = app.emit("translation-chunk", TranslationChunk {
                                request_id: request_id.to_string(),
                                text: content.clone(),
                                done: false,
                                error: None,
                            });
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn translate_text(
    app: AppHandle,
    request: TranslateRequest,
) -> Result<(), AppError> {
    let request_id = uuid_v4();
    info!(%request_id, provider = %request.provider, "Translation started");

    // Abort previous request
    CANCELLED.store(true, Ordering::SeqCst);
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
    CANCELLED.store(false, Ordering::SeqCst);

    let config = load_config(&app).await.unwrap_or_default();
    let client = Client::new();
    let prompt = format!(
        "Translate the following text from {} to {}. Return ONLY the translation, no explanations.\n\n{}",
        request.source_lang, request.target_lang, request.text
    );

    match request.provider.as_str() {
        "ollama" => {
            translate_ollama(
                &client,
                &config.ollama_endpoint.unwrap_or_default(),
                &prompt,
                &request_id,
                &app,
            )
            .await
        }
        "openai" => {
            translate_openai(
                &client,
                &config.openai_endpoint.unwrap_or_default(),
                &config.openai_api_key.unwrap_or_default(),
                &config.openai_model.unwrap_or_default(),
                &prompt,
                &request_id,
                &app,
            )
            .await
        }
        _ => Err(AppError::Translation {
            context: "provider".into(),
            source: format!("Unknown provider: {}", request.provider),
        }),
    }
}

/// Cancel the current translation request.
#[tauri::command]
pub async fn stop_translation() -> Result<(), AppError> {
    CANCELLED.store(true, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("req-{:016x}", nanos)
}

#[derive(Deserialize)]
struct OllamaChunk {
    message: Option<OllamaMessage>,
    done: bool,
}

#[derive(Deserialize)]
struct OllamaMessage {
    content: String,
}

#[derive(Deserialize)]
struct OpenAIChunk {
    choices: Vec<OpenAIChoice>,
}

#[derive(Deserialize)]
struct OpenAIChoice {
    delta: OpenAIDelta,
}

#[derive(Deserialize)]
struct OpenAIDelta {
    content: Option<String>,
}
