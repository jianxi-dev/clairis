use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tracing::info;

use crate::commands::file::is_supported_document;
use crate::commands::recent::{is_heavy_dir, is_html, strip_html_tags, to_iso8601, SCAN_DIRS};
use crate::errors::AppError;

/// 目录递归深度上限：从 Documents / Desktop / Downloads 起算，向下最多 5 层
/// （第 6 层目录里的文件不扫）。2 层时 `Desktop/AI学习/skill集合/x.html`
/// 这类三层目录下的文件会漏检，故提到 5。heavy dir 与 MAX_SCAN_FILES
/// 仍然兜底，不会把整个 home 扫穿。
const MAX_DEPTH: usize = 5;
/// 默认返回条数：防止全盘扫描后一次性回传过多。
const DEFAULT_LIMIT: usize = 30;
/// 单次检索最多回传的条数。
const MAX_LIMIT: usize = 100;
/// 最多扫描的文件数：超过即停止，避免大目录卡住 UI。
const MAX_SCAN_FILES: usize = 5_000;
/// 正文匹配读取上限：只读前 64KB，避免整读大文件。
const MATCH_READ_LIMIT: u64 = 64 * 1024;
/// 命中片段窗口半径（命中词前后各取这么多字符）。
const EXCERPT_RADIUS: usize = 60;

/// 本机检索命中：路径、标题、修改时间与命中片段。
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    /// frontmatter title 优先，缺省用文件名。
    pub title: String,
    pub opened_at: String,
    /// 命中片段（含命中词上下文），供前端高亮。
    pub excerpt: String,
    /// 命中字段：filename / title / h1 / content。
    pub matched_in: String,
}

struct ScanDoc {
    path: PathBuf,
    modified: SystemTime,
}

fn scan_documents(dir: &Path, depth: usize, out: &mut Vec<ScanDoc>) {
    if depth > MAX_DEPTH || out.len() >= MAX_SCAN_FILES {
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
            scan_documents(&path, depth + 1, out);
        } else if metadata.is_file() && is_supported_document(&path) {
            out.push(ScanDoc {
                path,
                modified: metadata.modified().unwrap_or(UNIX_EPOCH),
            });
        }
    }
}

/// 取 YAML frontmatter 里的 `title:`（不含引号）。无 frontmatter 或无 title 时返回 None。
fn frontmatter_title(text: &str) -> Option<String> {
    let mut lines = text.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }
    for line in lines {
        let t = line.trim();
        if t == "---" {
            break;
        }
        if let Some(rest) = t.strip_prefix("title:") {
            let value = rest.trim().trim_matches('"').trim_matches('\'').trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

/// 取第一个 H1：Markdown 的首个 `# ` 行；HTML 的首个 `<h1>` 内容（去标签）。
fn first_h1(raw: &str, html: bool) -> Option<String> {
    if html {
        let lower = raw.to_ascii_lowercase();
        let start = lower.find("<h1")?;
        let rest = &raw[start..];
        let open_end = start + rest.find('>')? + 1;
        let close_rel = lower[open_end..].find("</h1>")?;
        let inner = &raw[open_end..open_end + close_rel];
        let text = strip_html_tags(inner).trim().to_string();
        if text.is_empty() {
            None
        } else {
            Some(text)
        }
    } else {
        for line in raw.lines() {
            if let Some(rest) = line.trim_start().strip_prefix("# ") {
                let h = rest.trim();
                if !h.is_empty() {
                    return Some(h.to_string());
                }
            }
        }
        None
    }
}

/// 大小写不敏感地找 needle 在 text 中的首个字符下标（needle 已小写）。
fn find_char_pos(text: &str, needle: &str) -> Option<usize> {
    let needle: Vec<char> = needle.chars().collect();
    if needle.is_empty() {
        return Some(0);
    }
    let hay: Vec<char> = text.chars().collect();
    if needle.len() > hay.len() {
        return None;
    }
    for i in 0..=hay.len() - needle.len() {
        let mut ok = true;
        for j in 0..needle.len() {
            if !char_eq_ci(hay[i + j], needle[j]) {
                ok = false;
                break;
            }
        }
        if ok {
            return Some(i);
        }
    }
    None
}

/// `b` 已是小写；仅在小写化后相等时认为命中。
fn char_eq_ci(a: char, b: char) -> bool {
    if a == b {
        return true;
    }
    let mut it = a.to_lowercase();
    it.next() == Some(b) && it.next().is_none()
}

/// 截取命中词前后各 `EXCERPT_RADIUS` 个字符的片段，首尾用 `…` 标注截断。
fn snippet_around(text: &str, query: &str) -> String {
    let Some(pos) = find_char_pos(text, &query.to_lowercase()) else {
        return String::new();
    };
    let needle_len = query.chars().count();
    let chars: Vec<char> = text.chars().collect();
    let start = pos.saturating_sub(EXCERPT_RADIUS);
    let end = (pos + needle_len + EXCERPT_RADIUS).min(chars.len());
    let mut out = String::new();
    if start > 0 {
        out.push('…');
    }
    out.extend(chars[start..end].iter().copied());
    if end < chars.len() {
        out.push('…');
    }
    out
}

/// 匹配单个文档：文件名 → title → H1 → 正文，返回首个命中字段与片段。
fn match_document(doc: &ScanDoc, query: &str, lower_query: &str) -> Option<SearchHit> {
    use std::io::Read;
    let file = fs::File::open(&doc.path).ok()?;
    let mut buf = Vec::new();
    file.take(MATCH_READ_LIMIT).read_to_end(&mut buf).ok()?;
    let raw = String::from_utf8_lossy(&buf);
    let html = is_html(&doc.path);
    let body = if html {
        strip_html_tags(&raw)
    } else {
        raw.to_string()
    };
    let filename = doc
        .path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    if filename.is_empty() {
        return None;
    }
    let title = frontmatter_title(&raw).unwrap_or_else(|| filename.clone());
    let h1 = first_h1(&raw, html);

    let matched_in = if filename.to_lowercase().contains(lower_query) {
        "filename"
    } else if title.to_lowercase().contains(lower_query) {
        "title"
    } else if h1
        .as_deref()
        .map(|h| h.to_lowercase().contains(lower_query))
        .unwrap_or(false)
    {
        "h1"
    } else if body.to_lowercase().contains(lower_query) {
        "content"
    } else {
        return None;
    };

    let excerpt = match matched_in {
        "content" => snippet_around(&body, query),
        "h1" => h1.clone().unwrap_or_default(),
        "title" => title.clone(),
        _ => filename.clone(),
    };

    Some(SearchHit {
        path: doc.path.to_string_lossy().into_owned(),
        title,
        opened_at: to_iso8601(doc.modified),
        excerpt,
        matched_in: matched_in.to_string(),
    })
}

/// 扫描 home 下 Documents / Desktop / Downloads，按 mtime 倒序返回前 `limit` 条命中。
pub fn collect_search_hits(home: &Path, query: &str, limit: usize) -> Vec<SearchHit> {
    let query = query.trim();
    if query.is_empty() {
        return Vec::new();
    }
    let lower_query = query.to_lowercase();
    let mut docs: Vec<ScanDoc> = Vec::new();
    for name in SCAN_DIRS {
        let dir = home.join(name);
        if dir.is_dir() {
            scan_documents(&dir, 0, &mut docs);
        }
    }
    let mut hits: Vec<SearchHit> = docs
        .iter()
        .filter_map(|doc| match_document(doc, query, &lower_query))
        .collect();
    // RFC3339（固定格式、毫秒、Z）字典序即时间序
    hits.sort_by(|a, b| b.opened_at.cmp(&a.opened_at));
    hits.truncate(limit);
    hits
}

/// 本机全文检索：文件名 / frontmatter title / H1 / 正文，大小写不敏感，限量返回。
#[tauri::command]
pub async fn search_documents(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchHit>, AppError> {
    let home = dirs::home_dir().ok_or(AppError::Io {
        context: "Cannot determine home dir".into(),
        source: std::io::Error::other("no home"),
    })?;
    let limit = limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let hits = tokio::task::spawn_blocking(move || collect_search_hits(&home, &query, limit))
        .await
        .map_err(|e| AppError::Io {
            context: "search_documents join".into(),
            source: std::io::Error::other(e.to_string()),
        })?;
    info!(count = hits.len(), "本机检索完成");
    Ok(hits)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_home(tag: &str) -> PathBuf {
        tempfile::Builder::new()
            .prefix(&format!("biaoyue_search_{tag}_"))
            .tempdir()
            .unwrap()
            .keep()
    }

    fn write_with_mtime(path: &Path, modified: SystemTime, content: &[u8]) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
        fs::File::open(path)
            .unwrap()
            .set_modified(modified)
            .unwrap();
    }

    fn at(secs: u64) -> SystemTime {
        UNIX_EPOCH + std::time::Duration::from_secs(secs)
    }

    #[test]
    fn body_match_is_case_insensitive_and_excerpt_keeps_hit() {
        let home = temp_home("body");
        let root = home.join("Documents");
        write_with_mtime(
            &root.join("note.md"),
            at(1000),
            "# 标题\n\n这是正文，其中包含 Alpha 关键词。\n".as_bytes(),
        );

        let hits = collect_search_hits(&home, "alpha", 30);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].matched_in, "content");
        assert!(hits[0].excerpt.contains("Alpha"), "片段应含命中词");
        assert!(hits[0].title.contains("note"));

        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn filename_title_and_h1_all_match_in_order() {
        let home = temp_home("fields");
        let root = home.join("Documents");
        let content = "---\ntitle: 年度报告\n---\n\n# 总结\n\n正文。\n";
        write_with_mtime(&root.join("报告.md"), at(1000), content.as_bytes());

        let by_query = |q: &str| {
            collect_search_hits(&home, q, 30)
                .into_iter()
                .next()
                .map(|h| (h.matched_in, h.title))
        };

        assert_eq!(
            by_query("年度"),
            Some(("title".to_string(), "年度报告".to_string()))
        );
        assert_eq!(
            by_query("总结"),
            Some(("h1".to_string(), "年度报告".to_string()))
        );
        assert_eq!(
            by_query("报告"),
            Some(("filename".to_string(), "年度报告".to_string()))
        );
        assert_eq!(by_query("不存在"), None);

        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn html_body_is_tag_stripped_before_match() {
        let home = temp_home("html");
        let root = home.join("Documents");
        write_with_mtime(
            &root.join("page.html"),
            at(1000),
            "<html><head><style>body{color:red}</style></head><body><h1>标题</h1><p>正文里的秘密关键词</p></body></html>".as_bytes(),
        );

        let hits = collect_search_hits(&home, "秘密", 30);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].matched_in, "content");
        assert!(hits[0].excerpt.contains("秘密"));
        assert!(!hits[0].excerpt.contains('<'), "片段不应含标签");

        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn limit_is_applied_and_results_are_mtime_desc() {
        let home = temp_home("limit");
        let root = home.join("Documents");
        for i in 0..40 {
            write_with_mtime(
                &root.join(format!("f{i:03}.md")),
                at(1_000 + i),
                "关键词".as_bytes(),
            );
        }

        let hits = collect_search_hits(&home, "关键词", 10);
        assert_eq!(hits.len(), 10);
        assert!(hits[0].path.ends_with("f039.md"));
        assert!(hits[0].opened_at > hits[1].opened_at);

        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn skips_hidden_and_heavy_dirs() {
        let home = temp_home("filter");
        let root = home.join("Documents");
        write_with_mtime(&root.join("ok.md"), at(10), "关键词".as_bytes());
        write_with_mtime(
            &root.join(".hidden").join("a.md"),
            at(20),
            "关键词".as_bytes(),
        );
        write_with_mtime(
            &root.join("node_modules").join("b.md"),
            at(30),
            "关键词".as_bytes(),
        );
        write_with_mtime(
            &root.join("target").join("c.md"),
            at(40),
            "关键词".as_bytes(),
        );

        let hits = collect_search_hits(&home, "关键词", 30);
        assert_eq!(hits.len(), 1);
        assert!(hits[0].path.ends_with("ok.md"));

        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn scans_up_to_depth_five_but_not_deeper() {
        let home = temp_home("depth");
        let root = home.join("Documents");
        // 第 2 层目录里的文件（旧 MAX_DEPTH=2 的边界）
        write_with_mtime(
            &root.join("AI学习").join("skill集合").join("x.html"),
            at(1000),
            "<html><body>深层关键词</body></html>".as_bytes(),
        );
        // 第 5 层目录里的文件（新上限之内）
        write_with_mtime(
            &root.join("a/b/c/d/e").join("deep.md"),
            at(2000),
            "深层关键词".as_bytes(),
        );
        // 第 6 层目录里的文件（超出上限，不应扫到）
        write_with_mtime(
            &root.join("a/b/c/d/e/f").join("toodeep.md"),
            at(3000),
            "深层关键词".as_bytes(),
        );

        let hits = collect_search_hits(&home, "深层关键词", 30);
        assert_eq!(hits.len(), 2, "第 2、5 层应命中，第 6 层应被挡下");
        assert!(hits.iter().any(|h| h.path.ends_with("x.html")));
        assert!(hits.iter().any(|h| h.path.ends_with("deep.md")));
        assert!(!hits.iter().any(|h| h.path.ends_with("toodeep.md")));

        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn empty_query_returns_no_hits() {
        let home = temp_home("empty");
        let root = home.join("Documents");
        write_with_mtime(&root.join("a.md"), at(10), b"keyword");

        assert!(collect_search_hits(&home, "", 30).is_empty());
        assert!(collect_search_hits(&home, "   ", 30).is_empty());

        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn query_beyond_read_window_is_not_matched() {
        let home = temp_home("window");
        let root = home.join("Documents");
        let mut content = vec![b'a'; (MATCH_READ_LIMIT as usize) + 8 * 1024];
        content.extend_from_slice("关键词".as_bytes());
        write_with_mtime(&root.join("big.md"), at(10), &content);

        assert!(collect_search_hits(&home, "关键词", 30).is_empty());

        let _ = fs::remove_dir_all(&home);
    }
}
