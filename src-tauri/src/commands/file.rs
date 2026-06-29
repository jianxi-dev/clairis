use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tempfile::NamedTempFile;
use tracing::info;

use crate::errors::AppError;

#[derive(Serialize)]
pub struct FileResult {
    pub content: String,
    pub path: String,
    pub file_size: u64,
}

#[derive(Serialize)]
pub struct SaveResult {
    pub path: String,
}

const SOURCE_READ_ONLY_LIMIT: u64 = 2 * 1024 * 1024; // 2MB
const SOURCE_MODE_LIMIT: u64 = 500 * 1024; // 500KB

/// Open a file via system dialog and read its contents.
#[tauri::command]
pub async fn open_file(app: AppHandle) -> Result<FileResult, AppError> {
    let file = app
        .dialog()
        .file()
        .add_filter("文档", &["md", "markdown", "mdown", "mdwn", "html", "htm", "txt"])
        .blocking_pick_file();

    let path = match file {
        Some(p) => p.into_path().unwrap(),
        None => return Err(AppError::Cancelled),
    };

    let content = fs::read_to_string(&path).map_err(|e| AppError::Io {
        context: "read file".into(),
        source: e,
    })?;

    let file_size = content.len() as u64;
    info!(path = %path.display(), size = file_size, "File opened");

    Ok(FileResult {
        content,
        path: path.to_string_lossy().into_owned(),
        file_size,
    })
}

/// Save file to the given path atomically.
#[tauri::command]
pub async fn save_file(path: String, content: String) -> Result<SaveResult, AppError> {
    let target = PathBuf::from(&path);

    // Ensure parent directory exists
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::Io {
            context: "create parent dir".into(),
            source: e,
        })?;
    }

    // Atomic write: write to temp file, then persist (rename)
    let dir = target
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."));
    let tmp = NamedTempFile::new_in(dir).map_err(|e| AppError::Io {
        context: "create temp file".into(),
        source: e,
    })?;

    fs::write(&tmp, &content).map_err(|e| AppError::Io {
        context: "write temp file".into(),
        source: e,
    })?;

    tmp.persist(&target).map_err(|e| AppError::Io {
        context: "persist temp file".into(),
        source: e.error,
    })?;

    info!(path = %path, "File saved atomically");
    Ok(SaveResult { path })
}

/// Open "Save As" dialog and write file.
#[tauri::command]
pub async fn save_as_file(app: AppHandle, content: String) -> Result<SaveResult, AppError> {
    let file = app
        .dialog()
        .file()
        .add_filter("文档", &["md", "markdown", "html", "htm", "txt"])
        .blocking_save_file();

    let path = match file {
        Some(p) => p.into_path().unwrap(),
        None => return Err(AppError::Cancelled),
    };

    let path_str = path.to_string_lossy().into_owned();
    save_file(path_str.clone(), content).await?;

    Ok(SaveResult { path: path_str })
}

/// Return the size thresholds so the frontend can decide editor mode.
#[tauri::command]
pub fn get_size_limits() -> (u64, u64) {
    (SOURCE_MODE_LIMIT, SOURCE_READ_ONLY_LIMIT)
}
