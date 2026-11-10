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
    "jsonc", "js", "mjs", "cjs", "jsx", "ts", "tsx", "yaml", "yml", "csv", "sh", "bash", "zsh",
    "fish", "ps1",
];

const IMAGE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "avif", "heif", "heic",
];

const AUDIO_EXTENSIONS: &[&str] = &["mp3", "m4a", "wav", "flac", "ogg", "aac"];

const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mov", "webm", "m4v", "mkv", "avi"];

const BINARY_EXTENSIONS: &[&str] = &[
    "pdf", "png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "avif", "heif", "heic", "mp4",
    "mov", "webm", "m4v", "mkv", "avi", "mp3", "m4a", "wav", "flac", "ogg", "aac",
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

/// 应用支持的文档扩展名（与打开对话框的「文档」过滤一致）。本机最近文件扫描复用。
pub(crate) fn is_supported_document(path: &Path) -> bool {
    matches!(
        extension_of(path),
        Some(ref ext) if DOC_EXTENSIONS.contains(&ext.as_str())
    )
}

/// 在系统文件管理器中显示给定路径（定位）。只定位，不读取文件内容。
#[tauri::command]
pub async fn reveal_in_finder(path: String) -> Result<(), AppError> {
    let target = PathBuf::from(&path);
    reveal_path(&target).await.map_err(|e| AppError::Io {
        context: format!("reveal_in_finder: {path}"),
        source: e,
    })
}

#[cfg(target_os = "macos")]
async fn reveal_path(target: &Path) -> std::io::Result<()> {
    let status = tokio::process::Command::new("open")
        .arg("-R")
        .arg(target)
        .status()
        .await?;
    if status.success() {
        Ok(())
    } else {
        Err(std::io::Error::other(format!("open -R 退出码 {status}")))
    }
}

#[cfg(target_os = "windows")]
async fn reveal_path(target: &Path) -> std::io::Result<()> {
    let status = tokio::process::Command::new("explorer")
        .arg("/select,")
        .arg(target)
        .status()
        .await?;
    if status.success() {
        Ok(())
    } else {
        Err(std::io::Error::other(format!(
            "explorer /select 退出码 {status}"
        )))
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
async fn reveal_path(target: &Path) -> std::io::Result<()> {
    let dir = target.parent().unwrap_or(target);
    let status = tokio::process::Command::new("xdg-open")
        .arg(dir)
        .status()
        .await?;
    if status.success() {
        Ok(())
    } else {
        Err(std::io::Error::other(format!("xdg-open 退出码 {status}")))
    }
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
        .add_filter("音频", AUDIO_EXTENSIONS)
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
pub async fn save_as_file(
    app: AppHandle,
    content: String,
    default_name: Option<String>,
    default_dir: Option<String>,
) -> Result<SaveResult, AppError> {
    let ext = default_name
        .as_deref()
        .and_then(|name| Path::new(name).extension())
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    let (label, patterns): (&str, Vec<&str>) = match ext.as_deref() {
        Some("html") | Some("htm") => ("HTML 文档", vec!["html", "htm"]),
        Some("md") | Some("markdown") | Some("mdown") | Some("mdwn") | Some("txt") => {
            ("文档", DOC_EXTENSIONS.to_vec())
        }
        _ => ("文档", DOC_EXTENSIONS.to_vec()),
    };

    let mut dialog = app.dialog().file();
    if let Some(dir) = default_dir.as_deref() {
        if !dir.is_empty() {
            dialog = dialog.set_directory(dir);
        }
    }
    if let Some(name) = default_name.as_deref() {
        dialog = dialog.set_file_name(name);
    }
    let file = dialog.add_filter(label, &patterns).blocking_save_file();

    let path = match file {
        Some(p) => p.into_path().unwrap(),
        None => return Err(AppError::Cancelled),
    };

    let path_str = path.to_string_lossy().into_owned();
    save_file(path_str.clone(), content).await?;

    Ok(SaveResult { path: path_str })
}

/// Write raw bytes to `target` atomically (temp file in the same dir, then rename).
fn write_bytes_atomic(target: &Path, bytes: &[u8]) -> Result<(), AppError> {
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| AppError::Io {
                context: "create parent dir".into(),
                source: e,
            })?;
        }
    }
    let dir = target.parent().unwrap_or_else(|| std::path::Path::new("."));
    let tmp = NamedTempFile::new_in(dir).map_err(|e| AppError::Io {
        context: "create temp file".into(),
        source: e,
    })?;
    fs::write(&tmp, bytes).map_err(|e| AppError::Io {
        context: "write temp file".into(),
        source: e,
    })?;
    tmp.persist(target).map_err(|e| AppError::Io {
        context: "persist temp file".into(),
        source: e.error,
    })?;
    Ok(())
}

/// Decode base64 and write the bytes atomically. Returns the written byte count.
fn save_base64_to_path(path: &str, base64: &str) -> Result<usize, AppError> {
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64.trim())
        .map_err(|e| AppError::Validation {
            context: "save binary".into(),
            message: format!("base64 解码失败: {e}"),
        })?;
    write_bytes_atomic(Path::new(path), &bytes)?;
    Ok(bytes.len())
}

/// Open "Save As" dialog (PNG) and write decoded base64 bytes.
/// Cancel is not an error: returns `None`.
#[tauri::command]
pub async fn save_binary_as_file(
    app: AppHandle,
    base64: String,
    default_name: String,
) -> Result<Option<String>, AppError> {
    let ext = std::path::Path::new(&default_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let (label, patterns): (&str, Vec<&str>) = match ext.as_str() {
        "docx" => ("Word 文档", vec!["docx"]),
        "png" => ("PNG 图片", vec!["png"]),
        "mdpkg" => ("MDPKG 包", vec!["mdpkg"]),
        "zip" => ("ZIP 压缩包", vec!["zip"]),
        _ => ("文件", vec!["png", "docx", "mdpkg", "zip"]),
    };
    let file = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter(label, &patterns)
        .blocking_save_file();

    let path = match file {
        Some(p) => p.into_path().map_err(|e| AppError::Validation {
            context: "save binary".into(),
            message: e.to_string(),
        })?,
        None => return Ok(None),
    };

    let path_str = path.to_string_lossy().into_owned();
    let write_path = path_str.clone();
    let written = tokio::task::spawn_blocking(move || save_base64_to_path(&write_path, &base64))
        .await
        .map_err(|e| AppError::Io {
            context: "save binary task join".into(),
            source: std::io::Error::other(e.to_string()),
        })??;

    info!(path = %path_str, bytes = written, "Binary file saved atomically");
    Ok(Some(path_str))
}

/// Move a file into `to_dir`, returning the new absolute path.
///
/// 同名冲突时追加 `-1`/`-2` 序号，不覆盖已有文件；跨设备 `rename` 失败时
/// 回退为 copy + remove。
#[tauri::command]
pub async fn move_file(from: String, to_dir: String) -> Result<String, AppError> {
    let src = PathBuf::from(&from);
    if !src.is_file() {
        return Err(AppError::Io {
            context: format!("move_file: source not a file: {from}"),
            source: std::io::Error::new(std::io::ErrorKind::NotFound, "source missing"),
        });
    }
    let dest_dir = PathBuf::from(&to_dir);
    fs::create_dir_all(&dest_dir).map_err(|e| AppError::Io {
        context: format!("move_file: create dir {to_dir}"),
        source: e,
    })?;

    let file_name = src
        .file_name()
        .map(|n| n.to_os_string())
        .ok_or_else(|| AppError::Io {
            context: "move_file: source has no file name".into(),
            source: std::io::Error::new(std::io::ErrorKind::InvalidInput, "no file name"),
        })?;

    let stem = src
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let ext = src
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();

    let mut dest = dest_dir.join(&file_name);
    let mut seq = 1;
    while dest.exists() {
        dest = dest_dir.join(format!("{stem}-{seq}{ext}"));
        seq += 1;
    }

    if fs::rename(&src, &dest).is_err() {
        fs::copy(&src, &dest).map_err(|e| AppError::Io {
            context: format!("move_file: copy to {}", dest.display()),
            source: e,
        })?;
        fs::remove_file(&src).map_err(|e| AppError::Io {
            context: format!("move_file: remove source {from}"),
            source: e,
        })?;
    }

    let dest_str = dest.to_string_lossy().into_owned();
    info!(from = %from, to = %dest_str, "file moved");
    Ok(dest_str)
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
    fn save_binary_decodes_and_writes_atomically() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("out.png");
        let path = target.to_string_lossy().into_owned();

        // "iVBORw0KGgo=" decodes to the PNG signature prefix 89 50 4E 47 0D 0A 1A.
        let written = save_base64_to_path(&path, "iVBORw0KGgo=").unwrap();
        assert_eq!(written, 8);
        assert_eq!(fs::read(&target).unwrap(), b"\x89PNG\r\n\x1a\n");

        // Overwrite is atomic and leaves no temp files behind.
        save_base64_to_path(&path, "AAECAwQ=").unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"\x00\x01\x02\x03\x04");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn save_binary_rejects_invalid_base64() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bad.png").to_string_lossy().into_owned();
        assert!(save_base64_to_path(&path, "not base64!!").is_err());
        assert!(!Path::new(&path).exists());
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

/// `import_media_file` 的结果：写入后的绝对路径与相对文档目录的引用名。
#[derive(Serialize)]
pub struct ImportedMedia {
    pub path: String,
    pub name: String,
}

/// 把一张媒体文件复制到文档同级的 `assets/` 下，返回可写进 markdown 的相对名。
///
/// 为什么复制而不是引用原路径：markdown 里写绝对路径在这台机器能看、换台机器
/// 就裂图；写 `assets/名字` 跟着文档走，doc 一起搬也不丢。
///
/// 重名不覆盖：同名但大小不同会退到 `名字-1.ext`、`名字-2.ext`；大小相同的
/// 直接复用已有文件，重复插入同一张图不会堆出一串副本。
fn copy_into_assets(doc_path: &str, src_path: &str) -> Result<ImportedMedia, AppError> {
    let src = PathBuf::from(src_path);
    let meta = fs::metadata(&src).map_err(|e| AppError::Io {
        context: "stat media source".into(),
        source: e,
    })?;
    if !meta.is_file() {
        return Err(AppError::Io {
            context: "media source is not a file".into(),
            source: std::io::Error::new(std::io::ErrorKind::InvalidInput, "not a file"),
        });
    }

    let doc_dir = Path::new(doc_path)
        .parent()
        .ok_or_else(|| AppError::Io {
            context: "document has no parent directory".into(),
            source: std::io::Error::new(std::io::ErrorKind::InvalidInput, "no parent"),
        })?
        .to_path_buf();
    let assets = doc_dir.join("assets");
    fs::create_dir_all(&assets).map_err(|e| AppError::Io {
        context: "create assets dir".into(),
        source: e,
    })?;

    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("asset")
        .to_string();
    let ext = src
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| format!(".{s}"))
        .unwrap_or_default();

    for attempt in 0..1000u32 {
        let candidate = if attempt == 0 {
            format!("{stem}{ext}")
        } else {
            format!("{stem}-{attempt}{ext}")
        };
        let dest = assets.join(&candidate);
        if dest.exists() {
            let existing = fs::metadata(&dest).map(|m| m.len()).unwrap_or(u64::MAX);
            if existing == meta.len() {
                return Ok(ImportedMedia {
                    path: dest.to_string_lossy().to_string(),
                    name: format!("assets/{candidate}"),
                });
            }
            continue;
        }
        fs::copy(&src, &dest).map_err(|e| AppError::Io {
            context: "copy media into assets".into(),
            source: e,
        })?;
        return Ok(ImportedMedia {
            path: dest.to_string_lossy().to_string(),
            name: format!("assets/{candidate}"),
        });
    }
    Err(AppError::Io {
        context: "too many files with the same name".into(),
        source: std::io::Error::new(std::io::ErrorKind::AlreadyExists, "duplicate"),
    })
}

#[tauri::command]
pub async fn import_media_file(
    doc_path: String,
    src_path: String,
) -> Result<ImportedMedia, AppError> {
    tokio::task::spawn_blocking(move || copy_into_assets(&doc_path, &src_path))
        .await
        .map_err(|e| AppError::Io {
            context: "import media task".into(),
            source: std::io::Error::other(e.to_string()),
        })?
}

#[cfg(test)]
mod import_media_tests {
    use super::copy_into_assets;
    use std::fs;

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("biaoyue-media-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn copies_next_to_document_and_returns_relative_name() {
        let dir = temp_dir("copy");
        let doc = dir.join("note.md");
        fs::write(&doc, "# t").unwrap();
        let src = dir.join("pic.png");
        fs::write(&src, b"PNG").unwrap();

        let got = copy_into_assets(doc.to_str().unwrap(), src.to_str().unwrap()).unwrap();
        assert_eq!(got.name, "assets/pic.png");
        assert_eq!(fs::read(dir.join("assets/pic.png")).unwrap(), b"PNG");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn same_content_is_reused_and_different_content_gets_a_suffix() {
        let dir = temp_dir("dedupe");
        let doc = dir.join("note.md");
        fs::write(&doc, "# t").unwrap();
        let src = dir.join("pic.png");
        fs::write(&src, b"AAA").unwrap();

        assert_eq!(
            copy_into_assets(doc.to_str().unwrap(), src.to_str().unwrap())
                .unwrap()
                .name,
            "assets/pic.png"
        );
        // 同样大小：复用，不产生副本
        assert_eq!(
            copy_into_assets(doc.to_str().unwrap(), src.to_str().unwrap())
                .unwrap()
                .name,
            "assets/pic.png"
        );
        // 同名不同大小：退位
        fs::write(&src, b"BBBB").unwrap();
        assert_eq!(
            copy_into_assets(doc.to_str().unwrap(), src.to_str().unwrap())
                .unwrap()
                .name,
            "assets/pic-1.png"
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
