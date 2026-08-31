use tauri::AppHandle;

use crate::config;
use crate::config::AppConfig;
use crate::errors::AppError;

/// Load configuration from disk.
#[tauri::command]
pub async fn load_config(app: AppHandle) -> Result<AppConfig, AppError> {
    config::load_config(&app).await
}

/// Save configuration to disk.
#[tauri::command]
pub async fn save_config(app: AppHandle, config: AppConfig) -> Result<(), AppError> {
    config::save_config(&app, &config).await
}

/// Get API key from system keyring.
#[tauri::command]
pub async fn get_api_key(service: String, account: String) -> Result<Option<String>, AppError> {
    config::get_api_key(&service, &account).await
}

/// Set API key in system keyring.
#[tauri::command]
pub async fn set_api_key(service: String, account: String, key: String) -> Result<(), AppError> {
    config::set_api_key(&service, &account, &key).await
}

/// Delete API key from system keyring.
#[tauri::command]
pub async fn delete_api_key(service: String, account: String) -> Result<(), AppError> {
    config::delete_api_key(&service, &account).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = AppConfig::default();
        assert_eq!(config.font_size, Some(17.0));
        assert_eq!(
            config.ollama_endpoint,
            Some("http://localhost:11434".into())
        );
        assert_eq!(config.translation_provider, Some("ollama".into()));
    }
}
