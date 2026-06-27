use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

use crate::errors::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub font_size: Option<f64>,
    pub heading_colors: Option<HeadingColors>,
    pub ollama_endpoint: Option<String>,
    pub openai_endpoint: Option<String>,
    pub openai_model: Option<String>,
    #[serde(skip)]
    pub openai_api_key: Option<String>,
    pub translation_provider: Option<String>,
    pub source_lang: Option<String>,
    pub target_lang: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            font_size: Some(16.0),
            heading_colors: None,
            ollama_endpoint: Some("http://localhost:11434".into()),
            openai_endpoint: Some("https://api.openai.com".into()),
            openai_model: Some("gpt-4o-mini".into()),
            openai_api_key: None,
            translation_provider: Some("ollama".into()),
            source_lang: Some("en".into()),
            target_lang: Some("zh-CN".into()),
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

fn config_path(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    dir.join("app_config.json")
}

/// Load config from disk, return default on missing/corrupt.
pub async fn load_config(app: &AppHandle) -> Result<AppConfig, AppError> {
    let path = config_path(app);
    let data = match tokio::fs::read_to_string(&path).await {
        Ok(d) => d,
        Err(_) => return Ok(AppConfig::default()),
    };

    match serde_json::from_str::<AppConfig>(&data) {
        Ok(config) => {
            info!("Config loaded from {:?}", path);
            Ok(config)
        }
        Err(e) => {
            warn!(error = %e, path = %path.display(), "Config corrupt, backing up");
            let backup = path.with_extension("json.bak");
            let _ = tokio::fs::rename(&path, &backup).await;
            Ok(AppConfig::default())
        }
    }
}

/// Save config to disk.
pub async fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), AppError> {
    let path = config_path(app);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| {
            AppError::Io {
                context: "create config dir".into(),
                source: e,
            }
        })?;
    }
    let data = serde_json::to_string_pretty(config).map_err(|e| AppError::Serialization {
        context: "config".into(),
        source: e,
    })?;
    tokio::fs::write(&path, &data).await.map_err(|e| AppError::Io {
        context: "write config".into(),
        source: e,
    })?;
    info!("Config saved to {:?}", path);
    Ok(())
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
