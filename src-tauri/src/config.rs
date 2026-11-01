use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
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
    pub sidebar_left_visible: Option<bool>,
    pub sidebar_right_visible: Option<bool>,
    pub sidebar_left_width: Option<f64>,
    pub sidebar_right_width: Option<f64>,
    pub horizontal_split_ratio: Option<f64>,
    pub vertical_split_ratio: Option<f64>,
    pub recent_files: Option<Vec<RecentFile>>,
    pub scroll_positions: Option<HashMap<String, ScrollPosition>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentFile {
    pub path: String,
    pub title: String,
    pub opened_at: String,
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
            sidebar_left_visible: Some(true),
            sidebar_right_visible: Some(false),
            sidebar_left_width: Some(220.0),
            sidebar_right_width: Some(320.0),
            horizontal_split_ratio: Some(0.5),
            vertical_split_ratio: Some(0.5),
            recent_files: Some(Vec::new()),
            scroll_positions: Some(HashMap::new()),
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

const LEGACY_BUNDLE_IDENTIFIER: &str = "com.clairis.app";

fn legacy_config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .config_dir()
        .ok()
        .map(|dir| dir.join(LEGACY_BUNDLE_IDENTIFIER).join("app_config.json"))
}

/// 仅当目标缺失且旧文件可读可解析时迁移；旧文件保留，便于回滚。
async fn migrate_legacy_config(legacy: &Path, target: &Path) -> Option<AppConfig> {
    if target.exists() || legacy == target {
        return None;
    }
    let data = tokio::fs::read_to_string(legacy).await.ok()?;
    let config: AppConfig = serde_json::from_str(&data).ok()?;
    if let Some(parent) = target.parent() {
        if tokio::fs::create_dir_all(parent).await.is_ok() {
            let _ = tokio::fs::copy(legacy, target).await;
        }
    }
    info!(from = %legacy.display(), to = %target.display(), "旧配置已迁移到新目录");
    Some(config)
}

/// Load config from disk, return default on missing/corrupt.
pub async fn load_config(app: &AppHandle) -> Result<AppConfig, AppError> {
    let path = config_path(app);
    let data = match tokio::fs::read_to_string(&path).await {
        Ok(d) => d,
        Err(_) => {
            if let Some(legacy) = legacy_config_path(app) {
                if let Some(config) = migrate_legacy_config(&legacy, &path).await {
                    return Ok(config);
                }
            }
            return Ok(AppConfig::default());
        }
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
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| AppError::Io {
                context: "create config dir".into(),
                source: e,
            })?;
    }
    let data = serde_json::to_string_pretty(config).map_err(|e| AppError::Serialization {
        context: "config".into(),
        source: e,
    })?;
    tokio::fs::write(&path, &data)
        .await
        .map_err(|e| AppError::Io {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn unique_dir(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "biaoyue_test_config_migrate_{}_{}_{}",
            tag,
            std::process::id(),
            nanos
        ))
    }

    #[tokio::test]
    async fn migrates_legacy_config_when_target_missing() {
        let root = unique_dir("migrate");
        let legacy = root.join("com.clairis.app").join("app_config.json");
        let target = root.join("dev.biaoyue.app").join("app_config.json");
        tokio::fs::create_dir_all(legacy.parent().unwrap())
            .await
            .unwrap();
        tokio::fs::write(&legacy, r#"{"theme":"dark","readerFontSize":19.0}"#)
            .await
            .unwrap();

        let config = migrate_legacy_config(&legacy, &target).await;

        let config = config.expect("legacy config should be migrated");
        assert_eq!(config.theme.as_deref(), Some("dark"));
        assert_eq!(config.reader_font_size, Some(19.0));
        assert!(target.exists());
        assert!(legacy.exists());
        let _ = tokio::fs::remove_dir_all(&root).await;
    }

    #[tokio::test]
    async fn does_not_overwrite_existing_target() {
        let root = unique_dir("keep");
        let legacy = root.join("com.clairis.app").join("app_config.json");
        let target = root.join("dev.biaoyue.app").join("app_config.json");
        tokio::fs::create_dir_all(legacy.parent().unwrap())
            .await
            .unwrap();
        tokio::fs::create_dir_all(target.parent().unwrap())
            .await
            .unwrap();
        tokio::fs::write(&legacy, r#"{"theme":"dark"}"#)
            .await
            .unwrap();
        tokio::fs::write(&target, r#"{"theme":"warm"}"#)
            .await
            .unwrap();

        let config = migrate_legacy_config(&legacy, &target).await;

        assert!(config.is_none());
        let kept = tokio::fs::read_to_string(&target).await.unwrap();
        assert!(kept.contains("warm"));
        let _ = tokio::fs::remove_dir_all(&root).await;
    }
}
