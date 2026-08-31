use std::fs;
use std::path::{Path, PathBuf};

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

const DOC_EXTENSIONS: &[&str] = &[
    "md", "markdown", "mdown", "mdwn", "html", "htm", "txt", "log", "css", "py", "pyw", "json",
    "jsonc", "js", "mjs", "cjs", "jsx", "ts", "tsx", "yaml", "yml", "csv",
];

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"];

const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mov", "webm", "m4v", "mkv", "avi"];

const BINARY_EXTENSIONS: &[&str] = &[
    "pdf", "png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "mp4", "mov", "webm", "m4v",
    "mkv", "avi", "mp3", "m4a", "wav", "flac", "ogg",
];

fn extension_of(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
}

/// Media/binary files are opened without reading content (rendered via asset protocol).
pub fn is_binary_extension(path: &Path) -> bool {
    matches!(
        extension_of(path),
        Some(ref ext) if BINARY_EXTENSIONS.contains(&ext.as_str())
    )
}

/// Open a file via system dialog and read its contents.
#[tauri::command]
pub async fn open_file(app: AppHandle) -> Result<FileResult, AppError> {
    let file = app
        .dialog()
        .file()
        .add_filter("文档", DOC_EXTENSIONS)
        .add_filter("图片", IMAGE_EXTENSIONS)
        .add_filter("视频", VIDEO_EXTENSIONS)
        .add_filter("PDF", &["pdf"])
        .blocking_pick_file();

    let path = match file {
        Some(p) => p.into_path().unwrap(),
        None => return Err(AppError::Cancelled),
    };

    let path_buf = path.clone();
    let (file_size, content) = tokio::task::spawn_blocking(move || {
        let file_size = fs::metadata(&path_buf).map(|m| m.len()).unwrap_or(0);
        let content = if is_binary_extension(&path_buf) {
            String::new()
        } else {
            fs::read_to_string(&path_buf).map_err(|e| AppError::Io {
                context: "read file".into(),
                source: e,
            })?
        };
        Ok::<(u64, String), AppError>((file_size, content))
    })
    .await
    .map_err(|e| AppError::Io {
        context: "open file task join".into(),
        source: std::io::Error::other(e.to_string()),
    })??;
    info!(path = %path.display(), size = file_size, binary = content.is_empty(), "File opened");

    Ok(FileResult {
        content,
        path: path.to_string_lossy().into_owned(),
        file_size,
    })
}

/// Open a file by direct path (used for drag-and-drop).
/// Supports `~` expansion for home directory.
#[tauri::command]
pub async fn open_file_direct(path: String) -> Result<FileResult, AppError> {
    let expanded = if path.starts_with("~/") || path.starts_with("~\\") {
        if let Some(home) = dirs::home_dir() {
            home.join(&path[2..]).to_string_lossy().to_string()
        } else {
            path.clone()
        }
    } else {
        path.clone()
    };
    let path_buf = PathBuf::from(&expanded);
    let read_path = path_buf.clone();
    let (file_size, content) = tokio::task::spawn_blocking(move || {
        let file_size = fs::metadata(&read_path).map(|m| m.len()).unwrap_or(0);
        let content = if is_binary_extension(&read_path) {
            String::new()
        } else {
            fs::read_to_string(&read_path).map_err(|e| AppError::Io {
                context: "read file".into(),
                source: e,
            })?
        };
        Ok::<(u64, String), AppError>((file_size, content))
    })
    .await
    .map_err(|e| AppError::Io {
        context: "open file task join".into(),
        source: std::io::Error::other(e.to_string()),
    })??;
    info!(path = %expanded, size = file_size, binary = content.is_empty(), "File opened via direct path");

    Ok(FileResult {
        content,
        path: expanded,
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
    let dir = target.parent().unwrap_or_else(|| std::path::Path::new("."));
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
        .add_filter("文档", DOC_EXTENSIONS)
        .blocking_save_file();

    let path = match file {
        Some(p) => p.into_path().unwrap(),
        None => return Err(AppError::Cancelled),
    };

    let path_str = path.to_string_lossy().into_owned();
    save_file(path_str.clone(), content).await?;

    Ok(SaveResult { path: path_str })
}

/// Open a folder picker dialog and return the selected path.
#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Result<String, AppError> {
    let folder = app.dialog().file().blocking_pick_folder();
    match folder {
        Some(p) => Ok(p.into_path().unwrap().to_string_lossy().into_owned()),
        None => Err(AppError::Cancelled),
    }
}

/// Return the size thresholds so the frontend can decide editor mode.
#[tauri::command]
pub fn get_size_limits() -> (u64, u64) {
    (SOURCE_MODE_LIMIT, SOURCE_READ_ONLY_LIMIT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn binary_extensions_classified() {
        let cases = [
            ("a.md", false),
            ("a.markdown", false),
            ("a.html", false),
            ("a.txt", false),
            ("a.py", false),
            ("a.json", false),
            ("a.yaml", false),
            ("a.csv", false),
            ("a.png", true),
            ("a.JPG", true),
            ("a.gif", true),
            ("a.svg", true),
            ("a.pdf", true),
            ("a.mp4", true),
            ("a.MOV", true),
            ("a.mp3", true),
            ("a", false),
            ("a.foo", false),
        ];
        for (name, expected) in cases {
            assert_eq!(
                is_binary_extension(Path::new(name)),
                expected,
                "case {name}"
            );
        }
    }

    #[test]
    fn doc_extensions_are_not_binary() {
        for ext in DOC_EXTENSIONS {
            let name = format!("file.{ext}");
            let p = Path::new(&name);
            assert!(!is_binary_extension(p), "doc ext {ext} must not be binary");
        }
    }
}

/// Read a media file as base64 for in-app preview (videos bypass the asset
/// protocol, whose range responses are capped at 1MB and break playback).
pub const MEDIA_PREVIEW_LIMIT: u64 = 100 * 1024 * 1024; // 100MB

#[tauri::command]
pub async fn read_file_base64(path: String) -> Result<String, AppError> {
    let bytes = tokio::task::spawn_blocking(move || {
        let path_buf = PathBuf::from(&path);
        let meta = fs::metadata(&path_buf).map_err(|e| AppError::Io {
            context: "stat file".into(),
            source: e,
        })?;
        if meta.len() > MEDIA_PREVIEW_LIMIT {
            return Err(AppError::Io {
                context: "file too large for preview (>100MB)".into(),
                source: std::io::Error::new(std::io::ErrorKind::InvalidData, "too large"),
            });
        }
        fs::read(&path_buf).map_err(|e| AppError::Io {
            context: "read file".into(),
            source: e,
        })
    })
    .await
    .map_err(|e| AppError::Io {
        context: "read file task join".into(),
        source: std::io::Error::other(e.to_string()),
    })??;
    use base64::Engine as _;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}
