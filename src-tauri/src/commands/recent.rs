use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tracing::info;

use crate::commands::file::{is_binary_extension, is_supported_document};
use crate::config::RecentFile;
use crate::errors::AppError;

const MAX_DEPTH: usize = 2;
const MAX_RESULTS: usize = 50;
const EXCERPT_LIMIT: usize = 400;
/// 摘要读取窗口：足够覆盖常见 `<script>` / `<style>` 块，避免闭标签落在窗口外导致正文泄露。
const EXCERPT_READ_LIMIT: u64 = 8192;
pub(crate) const SCAN_DIRS: &[&str] = &["Documents", "Desktop", "Downloads"];

/// 应用能打开的类型：文档 + 图片/视频/PDF/音频（最近文件卡片要显示这些类型）。
fn is_supported(path: &Path) -> bool {
    is_supported_document(path) || is_binary_extension(path)
}

pub(crate) fn is_html(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .as_deref(),
        Some("html") | Some("htm")
    )
}

struct ScanItem {
    path: PathBuf,
    modified: SystemTime,
}

pub(crate) fn is_heavy_dir(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | ".git"
            | "target"
            | "dist"
            | ".next"
            | "__pycache__"
            | "vendor"
            | ".cache"
            | "Library"
            | "Applications"
    )
}

fn scan_dir(dir: &Path, depth: usize, out: &mut Vec<ScanItem>) {
    if depth > MAX_DEPTH {
        return;
    }
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name,
            None => continue,
        };
        if name.starts_with('.') {
            continue;
        }
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if metadata.is_dir() {
            if is_heavy_dir(name) {
                continue;
            }
            scan_dir(&path, depth + 1, out);
        } else if metadata.is_file() && is_supported(&path) {
            let modified = metadata.modified().unwrap_or(UNIX_EPOCH);
            out.push(ScanItem { path, modified });
        }
    }
}

pub(crate) fn to_iso8601(time: SystemTime) -> String {
    chrono::DateTime::<chrono::Utc>::from(time).to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn decode_entities(text: &str) -> String {
    text.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
}

pub(crate) fn strip_html_tags(html: &str) -> String {
    let lower = html.to_ascii_lowercase();
    let mut out = String::with_capacity(html.len());
    let mut index = 0;
    while index < html.len() {
        let Some(offset) = lower[index..].find('<') else {
            out.push_str(&html[index..]);
            break;
        };
        let start = index + offset;
        out.push_str(&html[index..start]);
        let after = &lower[start..];
        let (close, tag_len) = if after.starts_with("<script") {
            ("</script", 7)
        } else if after.starts_with("<style") {
            ("</style", 6)
        } else {
            ("", 0)
        };
        if tag_len > 0 {
            if let Some(pos) = lower[start..].find(close) {
                let mut end = start + pos + close.len();
                if let Some(gt) = lower[end..].find('>') {
                    end += gt + 1;
                }
                out.push(' ');
                index = end;
                continue;
            }
        }
        match lower[start..].find('>') {
            Some(pos) => {
                let end = start + pos + 1;
                out.push(' ');
                index = end;
            }
            None => break,
        }
    }
    decode_entities(&out)
}

/// 读取正文开头（≤400 字节）：HTML 先剥掉 script/style 与标签。
fn read_excerpt(path: &Path, strip_tags: bool) -> Option<String> {
    use std::io::Read;
    let file = fs::File::open(path).ok()?;
    let mut buf = Vec::new();
    file.take(EXCERPT_READ_LIMIT).read_to_end(&mut buf).ok()?;
    let raw = String::from_utf8_lossy(&buf);
    let mut text = if strip_tags {
        strip_html_tags(&raw)
    } else {
        raw.into_owned()
    };
    text = text.trim().to_string();
    if text.is_empty() {
        return None;
    }
    if text.len() <= EXCERPT_LIMIT {
        return Some(text);
    }
    let mut end = EXCERPT_LIMIT;
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }
    Some(text[..end].to_string())
}

/// 扫描 home 下 Documents / Desktop / Downloads 的最近文档：深度 ≤2、mtime 倒序、限量 50。
pub fn collect_recent_documents(home: &Path) -> Vec<RecentFile> {
    let mut items: Vec<ScanItem> = Vec::new();
    for name in SCAN_DIRS {
        let dir = home.join(name);
        if dir.is_dir() {
            scan_dir(&dir, 0, &mut items);
        }
    }

    items.sort_by(|a, b| b.modified.cmp(&a.modified));

    items
        .into_iter()
        .take(MAX_RESULTS)
        .map(|item| {
            let excerpt = if is_binary_extension(&item.path) {
                None
            } else {
                read_excerpt(&item.path, is_html(&item.path))
            };
            RecentFile {
                path: item.path.to_string_lossy().into_owned(),
                title: item
                    .path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string(),
                opened_at: to_iso8601(item.modified),
                excerpt,
            }
        })
        .collect()
}

/// 列出本机最近文档（mtime 倒序，最多 50 条）。
#[tauri::command]
pub async fn list_recent_documents() -> Result<Vec<RecentFile>, AppError> {
    let home = dirs::home_dir().ok_or(AppError::Io {
        context: "Cannot determine home dir".into(),
        source: std::io::Error::other("no home"),
    })?;
    let docs = tokio::task::spawn_blocking(move || collect_recent_documents(&home))
        .await
        .map_err(|e| AppError::Io {
            context: "list_recent_documents join".into(),
            source: std::io::Error::other(e.to_string()),
        })?;
    info!(count = docs.len(), "本机最近文档扫描完成");
    Ok(docs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_home(tag: &str) -> PathBuf {
        let dir = tempfile::Builder::new()
            .prefix(&format!("biaoyue_recent_{tag}_"))
            .tempdir()
            .unwrap()
            .keep();
        dir
    }

    fn write_with_mtime(path: &Path, modified: SystemTime) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, b"doc").unwrap();
        fs::File::open(path)
            .unwrap()
            .set_modified(modified)
            .unwrap();
    }

    fn at(secs: u64) -> SystemTime {
        UNIX_EPOCH + std::time::Duration::from_secs(secs)
    }

    #[test]
    fn scans_three_roots_and_sorts_by_mtime_desc() {
        let home = temp_home("roots");
        let documents = home.join("Documents");
        let desktop = home.join("Desktop");
        let downloads = home.join("Downloads");

        write_with_mtime(&documents.join("old.md"), at(1000));
        write_with_mtime(&desktop.join("newer.md"), at(2000));
        write_with_mtime(&downloads.join("newest.md"), at(3000));

        let docs = collect_recent_documents(&home);
        let names: Vec<&str> = docs
            .iter()
            .map(|d| d.path.rsplit('/').next().unwrap())
            .collect();
        assert_eq!(names, vec!["newest.md", "newer.md", "old.md"]);
        assert!(docs[0].opened_at.starts_with("1970-01-01T00:50:00"));

        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn depth_two_is_included_and_depth_three_is_excluded() {
        let home = temp_home("depth");
        let root = home.join("Documents");
        write_with_mtime(&root.join("d0.md"), at(10));
        write_with_mtime(&root.join("a").join("d1.md"), at(20));
        write_with_mtime(&root.join("a").join("b").join("d2.md"), at(30));
        write_with_mtime(&root.join("a").join("b").join("c").join("d3.md"), at(40));

        let docs = collect_recent_documents(&home);
        let names: Vec<&str> = docs
            .iter()
            .map(|d| d.path.rsplit('/').next().unwrap())
            .collect();
        assert!(names.contains(&"d0.md"));
        assert!(names.contains(&"d1.md"));
        assert!(names.contains(&"d2.md"));
        assert!(!names.contains(&"d3.md"));

        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn only_supported_extensions_and_skips_hidden_and_heavy_dirs() {
        let home = temp_home("filter");
        let root = home.join("Documents");
        write_with_mtime(&root.join("a.md"), at(10));
        write_with_mtime(&root.join("b.html"), at(20));
        write_with_mtime(&root.join("c.htm"), at(30));
        write_with_mtime(&root.join("d.txt"), at(40));
        write_with_mtime(&root.join("e.png"), at(50));
        write_with_mtime(&root.join("f.pdf"), at(60));
        write_with_mtime(&root.join("g.xyz"), at(65));
        write_with_mtime(&root.join(".hidden.md"), at(70));
        write_with_mtime(&root.join("node_modules").join("h.md"), at(80));

        let docs = collect_recent_documents(&home);
        let names: Vec<&str> = docs
            .iter()
            .map(|d| d.path.rsplit('/').next().unwrap())
            .collect();
        assert_eq!(names.len(), 6);
        for expected in ["a.md", "b.html", "c.htm", "d.txt", "e.png", "f.pdf"] {
            assert!(names.contains(&expected), "missing {expected}: {names:?}");
        }
        assert!(!names.contains(&"g.xyz"));
        assert!(!names.contains(&".hidden.md"));

        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn excerpts_are_truncated_and_html_is_stripped() {
        let home = temp_home("excerpt");
        let root = home.join("Documents");
        let md = root.join("note.md");
        let html = root.join("page.html");
        write_with_mtime(&md, at(10));
        write_with_mtime(&html, at(20));
        fs::write(&md, "# 标题\n\n正文内容。".as_bytes()).unwrap();
        fs::write(
            &html,
            "<html><head><style>body{color:red}</style></head><body><h1>页面</h1><p>HTML &amp; 预览</p></body></html>",
        )
        .unwrap();

        let docs = collect_recent_documents(&home);
        let md_excerpt = docs
            .iter()
            .find(|d| d.path.ends_with("note.md"))
            .and_then(|d| d.excerpt.clone())
            .unwrap_or_default();
        let html_excerpt = docs
            .iter()
            .find(|d| d.path.ends_with("page.html"))
            .and_then(|d| d.excerpt.clone())
            .unwrap_or_default();

        assert!(md_excerpt.contains("正文内容"));
        assert!(html_excerpt.contains("页面"));
        assert!(html_excerpt.contains("HTML & 预览"));
        assert!(!html_excerpt.contains('<'));
        assert!(html_excerpt.len() <= EXCERPT_LIMIT);

        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn long_style_block_is_stripped_before_excerpt() {
        let home = temp_home("style");
        let root = home.join("Documents");
        let html = root.join("page.html");
        write_with_mtime(&html, at(10));
        let mut content = String::from("<html><head><style>");
        content.push_str(&"body{color:red;}".repeat(200));
        content.push_str("</style></head><body><h1>标题</h1></body></html>");
        fs::write(&html, content).unwrap();

        let docs = collect_recent_documents(&home);
        let excerpt = docs
            .iter()
            .find(|d| d.path.ends_with("page.html"))
            .and_then(|d| d.excerpt.clone())
            .unwrap_or_default();
        assert!(excerpt.contains("标题"));
        assert!(!excerpt.contains("color"));
        assert!(!excerpt.contains('<'));

        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn limit_is_fifty() {
        let home = temp_home("limit");
        let root = home.join("Documents");
        for i in 0..60 {
            write_with_mtime(&root.join(format!("f{i:03}.md")), at(1_000 + i));
        }

        let docs = collect_recent_documents(&home);
        assert_eq!(docs.len(), MAX_RESULTS);
        assert!(docs[0].opened_at > docs[1].opened_at);
        assert!(docs[0].path.ends_with("f059.md"));

        let _ = fs::remove_dir_all(&home);
    }
}
