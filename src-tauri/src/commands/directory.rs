use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tracing::warn;

use crate::errors::AppError;
use crate::media_protocol::register_media_path;

#[derive(Debug, Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Debug, Serialize)]
pub struct FlatEntry {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Debug, Serialize)]
pub struct DirectoryResult {
    pub entries: Vec<DirEntry>,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct FileInfo {
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub modified: u64,
}

/// Recursively read a directory (max_depth=3).
/// Excludes .git, node_modules, and hidden files (dotfiles).
#[tauri::command]
pub async fn read_directory(path: String) -> Result<DirectoryResult, AppError> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(AppError::Io {
            context: format!("not a directory: {}", path),
            source: std::io::Error::new(std::io::ErrorKind::NotADirectory, "not a directory"),
        });
    }

    let root2 = root.clone();
    let entries = tokio::task::spawn_blocking(move || {
        let mut entries = Vec::new();
        collect_entries(&root2, &root2, 0, 3, &mut entries)?;
        Ok::<Vec<DirEntry>, AppError>(entries)
    })
    .await
    .map_err(|e| AppError::Io {
        context: "read directory task join".into(),
        source: std::io::Error::other(e.to_string()),
    })??;

    Ok(DirectoryResult { entries, path })
}

fn collect_entries(
    root: &PathBuf,
    current: &PathBuf,
    depth: usize,
    max_depth: usize,
    entries: &mut Vec<DirEntry>,
) -> Result<(), AppError> {
    if depth > max_depth {
        return Ok(());
    }

    let dir = match fs::read_dir(current) {
        Ok(d) => d,
        Err(e) => {
            warn!(path = %current.display(), error = %e, "Skipping unreadable directory");
            return Ok(());
        }
    };

    for entry in dir.flatten() {
        let path = entry.path();

        // Skip hidden files/directories (dotfiles)
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') {
                continue;
            }
        }

        // Skip symlinks
        if path.is_symlink() {
            continue;
        }

        let metadata = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .into_owned();

        entries.push(DirEntry {
            name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            path: relative,
            is_dir: metadata.is_dir(),
            size: metadata.len(),
        });

        if metadata.is_dir() {
            collect_entries(root, &path, depth + 1, max_depth, entries)?;
        }
    }

    Ok(())
}

/// Get file metadata info.
#[tauri::command]
pub async fn get_file_info(path: String) -> Result<FileInfo, AppError> {
    let p = PathBuf::from(&path);
    let metadata = fs::metadata(&p).map_err(|e| AppError::Io {
        context: format!("get info for {}", path),
        source: e,
    })?;

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(FileInfo {
        path,
        size: metadata.len(),
        is_dir: metadata.is_dir(),
        modified,
    })
}

/// Heuristic heavy directories to skip during recursive scan.
fn is_heavy_dir(name: &str) -> bool {
    matches!(
        name,
        "node_modules" | ".git" | "target" | "dist" | ".next" | "__pycache__" | "vendor" | ".cache"
    )
}

/// Recursively list supported files as a flat list with relative paths.
/// Runs on blocking thread pool to avoid freezing the UI.
/// Max 2000 files, depth 5, skips heavy dirs.
#[tauri::command]
pub async fn flatten_files(path: String) -> Result<FlattenResult, AppError> {
    let base = PathBuf::from(&path);
    if !base.is_dir() {
        return Err(AppError::Io {
            context: "not a directory".into(),
            source: std::io::Error::new(std::io::ErrorKind::NotADirectory, path),
        });
    }

    tokio::task::spawn_blocking(move || {
        let supported = |name: &str| -> bool {
            name.ends_with(".md")
                || name.ends_with(".markdown")
                || name.ends_with(".html")
                || name.ends_with(".htm")
                || name.ends_with(".txt")
        };

        let mut entries: Vec<FlatEntry> = Vec::new();
        let mut truncated = false;
        collect_flat(&base, &base, 0, 5, &supported, &mut entries, &mut truncated);

        entries.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

        Ok(FlattenResult { entries, truncated })
    })
    .await
    .map_err(|e| AppError::Io {
        context: "flatten_files join error".into(),
        source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
    })?
}

#[derive(Debug, Serialize)]
pub struct FlattenResult {
    pub entries: Vec<FlatEntry>,
    pub truncated: bool,
}

const MAX_FILES: usize = 2000;

fn collect_flat(
    base: &PathBuf,
    current: &PathBuf,
    depth: u32,
    max_depth: u32,
    supported: &dyn Fn(&str) -> bool,
    entries: &mut Vec<FlatEntry>,
    truncated: &mut bool,
) {
    if depth > max_depth || *truncated {
        return;
    }

    let dir = match fs::read_dir(current) {
        Ok(d) => d,
        Err(_) => return,
    };

    for entry in dir.flatten() {
        if *truncated {
            break;
        }

        let path = entry.path();
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        // Skip hidden
        if name.starts_with('.') {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let relative_path = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();

        if metadata.is_dir() {
            if is_heavy_dir(&name) {
                continue;
            }
            entries.push(FlatEntry {
                name: name.clone(),
                path: path.to_string_lossy().to_string(),
                relative_path,
                is_dir: true,
                size: 0,
            });
            collect_flat(
                base,
                &path,
                depth + 1,
                max_depth,
                supported,
                entries,
                truncated,
            );
        } else if supported(&name) {
            if entries.len() >= MAX_FILES {
                *truncated = true;
                break;
            }
            entries.push(FlatEntry {
                name,
                path: path.to_string_lossy().to_string(),
                relative_path,
                is_dir: false,
                size: metadata.len(),
            });
        }
    }
}

#[derive(Debug, Serialize)]
pub struct MediaEntry {
    pub path: String,
    pub name: String,
    pub kind: String,
    /// For subtitle entries: the media file (without extension) this subtitle belongs to.
    /// Empty for video/audio entries.
    pub target: String,
}

const VIDEO_EXTS: &[&str] = &["mp4", "mov", "webm", "m4v", "mkv", "avi"];
const AUDIO_EXTS: &[&str] = &["mp3", "m4a", "wav", "flac", "ogg"];
const SUBTITLE_EXTS: &[&str] = &["srt", "ass", "vtt"];

fn kind_for_name(name: &str) -> Option<&'static str> {
    let ext = Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if VIDEO_EXTS.contains(&ext.as_str()) {
        Some("video")
    } else if AUDIO_EXTS.contains(&ext.as_str()) {
        Some("audio")
    } else {
        None
    }
}

fn collect_media_entries(parent: &Path) -> Vec<MediaEntry> {
    let mut media: Vec<MediaEntry> = Vec::new();
    let mut subtitles: Vec<MediaEntry> = Vec::new();
    let mut media_stems: std::collections::HashSet<String> = std::collections::HashSet::new();

    let entries: Vec<PathBuf> = match fs::read_dir(parent) {
        Ok(d) => d.flatten().map(|e| e.path()).collect(),
        Err(e) => {
            warn!(path = %parent.display(), error = %e, "list_media_in_dir: unreadable directory");
            return Vec::new();
        }
    };

    for p in &entries {
        if !p.is_file() {
            continue;
        }
        let name = p
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        if name.starts_with('.') {
            continue;
        }

        let abs = p.to_string_lossy().into_owned();
        if let Some(kind) = kind_for_name(&name) {
            media.push(MediaEntry {
                path: abs,
                name: name.clone(),
                kind: kind.to_string(),
                target: String::new(),
            });
            if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                media_stems.insert(stem.to_string());
            }
        }
    }

    for p in &entries {
        if !p.is_file() {
            continue;
        }
        let name = p
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        if name.starts_with('.') {
            continue;
        }
        let ext = p
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .unwrap_or_default();
        if SUBTITLE_EXTS.contains(&ext.as_str()) {
            let target_stem = p
                .file_stem()
                .and_then(|s| s.to_str())
                .map(|stem| stem.to_string())
                .unwrap_or_default();
            if media_stems.contains(&target_stem) {
                let abs = p.to_string_lossy().into_owned();
                subtitles.push(MediaEntry {
                    path: abs,
                    name: name.clone(),
                    kind: "subtitle".to_string(),
                    target: target_stem,
                });
            }
        }
    }

    media.sort_by(|a, b| a.name.cmp(&b.name));
    subtitles.sort_by(|a, b| a.name.cmp(&b.name));
    media.extend(subtitles);
    media
}

/// List media files (video/audio) in the same directory as the given file,
/// plus same-basename subtitle files (.srt/.ass/.vtt).
/// Registers every listed file into the media:// allowlist so the media
/// protocol can serve them for preview/playlist.
#[tauri::command]
pub async fn list_media_in_dir(path: String) -> Result<Vec<MediaEntry>, AppError> {
    let target = PathBuf::from(&path);
    let parent = target.parent().unwrap_or(&target).to_path_buf();
    if !parent.is_dir() {
        return Err(AppError::Io {
            context: format!("not a directory: {}", parent.display()),
            source: std::io::Error::new(std::io::ErrorKind::NotADirectory, path),
        });
    }

    let entries: Vec<MediaEntry> =
        tokio::task::spawn_blocking(move || collect_media_entries(&parent))
            .await
            .map_err(|e| AppError::Io {
                context: "list_media_in_dir join error".into(),
                source: std::io::Error::new(std::io::ErrorKind::Other, e.to_string()),
            })?;

    for e in &entries {
        register_media_path(e.path.clone());
    }
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_test_dir(label: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("clairis_test_{}_{}", label, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("subdir")).unwrap();
        fs::write(dir.join("file1.md"), "# Hello").unwrap();
        fs::write(dir.join("subdir").join("file2.md"), "## Nested").unwrap();
        // Hidden file (should be excluded)
        fs::write(dir.join(".hidden"), "secret").unwrap();
        dir
    }

    #[test]
    fn test_read_directory_basic() {
        let dir = setup_test_dir("basic");
        let mut entries = Vec::new();
        let result = collect_entries(&dir, &dir, 0, 3, &mut entries);
        assert!(result.is_ok());

        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert!(
            names.contains(&"file1.md"),
            "should contain file1.md: {:?}",
            names
        );
        assert!(
            names.contains(&"subdir"),
            "should contain subdir: {:?}",
            names
        );
        assert!(
            !names.contains(&".hidden"),
            "should not contain hidden files: {:?}",
            names
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_read_directory_max_depth() {
        let dir = setup_test_dir("maxdepth");
        let mut entries = Vec::new();
        let result = collect_entries(&dir, &dir, 0, 0, &mut entries);
        assert!(result.is_ok());

        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert!(
            names.contains(&"file1.md"),
            "should contain file1.md at depth 0"
        );
        // subdir should appear but its children should not
        assert!(names.contains(&"subdir"), "should contain subdir");
        assert!(
            !names.contains(&"file2.md"),
            "should NOT contain file2.md beyond max_depth"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_read_directory_nonexistent() {
        let mut entries = Vec::new();
        let result = collect_entries(
            &PathBuf::from("/nonexistent_path_xyz"),
            &PathBuf::from("/nonexistent_path_xyz"),
            0,
            3,
            &mut entries,
        );
        assert!(result.is_ok());
        assert!(entries.is_empty());
    }

    #[test]
    fn test_get_file_info() {
        let dir = setup_test_dir("fileinfo");
        let file_path = dir.join("file1.md");
        let metadata = fs::metadata(&file_path).unwrap();
        assert!(metadata.len() > 0);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_list_media_in_dir_filters_and_registers() {
        let dir = std::env::temp_dir().join(format!("clairis_test_media_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("clip.mp4"), "v").unwrap();
        fs::write(dir.join("song.mp3"), "a").unwrap();
        fs::write(dir.join("clip.srt"), "s").unwrap();
        fs::write(dir.join("notes.md"), "n").unwrap();
        fs::write(dir.join(".hidden.mp4"), "h").unwrap();

        let entries = collect_media_entries(&dir);

        let names: Vec<(&str, &str)> = entries
            .iter()
            .map(|e| (e.name.as_str(), e.kind.as_str()))
            .collect();
        assert!(names.contains(&("clip.mp4", "video")));
        assert!(names.contains(&("song.mp3", "audio")));
        assert!(names.contains(&("clip.srt", "subtitle")));
        assert!(!names.iter().any(|(n, _)| *n == "notes.md"));
        assert!(!names.iter().any(|(n, _)| *n == ".hidden.mp4"));
        let clip_sub = entries.iter().find(|e| e.name == "clip.srt").unwrap();
        assert_eq!(clip_sub.target, "clip");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_kind_for_name() {
        assert_eq!(kind_for_name("a.MP4"), Some("video"));
        assert_eq!(kind_for_name("a.mkv"), Some("video"));
        assert_eq!(kind_for_name("a.flac"), Some("audio"));
        assert_eq!(kind_for_name("a.txt"), None);
    }
}
