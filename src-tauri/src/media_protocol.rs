use std::collections::HashSet;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use http::{Response, StatusCode};

/// Paths the media protocol is allowed to serve (registered by the frontend
/// when a media file is opened for preview). Prevents arbitrary local file
/// reads from injected/inline scripts.
static ALLOWED_MEDIA: Mutex<Option<HashSet<PathBuf>>> = Mutex::new(None);

const MEDIA_SCHEME_ORIGINS: &[&str] = &[
    "tauri://localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
];

/// Register a path for media protocol serving.
pub fn register_media_path(path: String) {
    let mut guard = ALLOWED_MEDIA.lock().unwrap();
    guard
        .get_or_insert_with(HashSet::new)
        .insert(PathBuf::from(path));
}

fn is_allowed(path: &Path) -> bool {
    let guard = ALLOWED_MEDIA.lock().unwrap();
    guard
        .as_ref()
        .map(|set| set.contains(path))
        .unwrap_or(false)
}

fn mime_for_path(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => match ext.to_ascii_lowercase().as_str() {
            "mp4" => "video/mp4",
            "mov" => "video/quicktime",
            "m4v" => "video/x-m4v",
            "webm" => "video/webm",
            "mkv" => "video/x-matroska",
            "avi" => "video/x-msvideo",
            "mp3" => "audio/mpeg",
            "m4a" => "audio/mp4",
            "wav" => "audio/wav",
            "flac" => "audio/flac",
            "ogg" => "audio/ogg",
            _ => "application/octet-stream",
        },
        None => "application/octet-stream",
    }
}

fn decode_uri_path(uri_path: &str) -> PathBuf {
    // percent-decode, restore leading slash
    let raw = uri_path.trim_start_matches('/');
    let decoded = percent_encoding::percent_decode_str(raw)
        .decode_utf8_lossy()
        .into_owned();
    PathBuf::from(format!("/{decoded}"))
}

fn read_range(file: &mut File, start: u64, end: u64) -> std::io::Result<Vec<u8>> {
    let len = (end - start + 1) as usize;
    let mut buf = vec![0u8; len];
    file.seek(SeekFrom::Start(start))?;
    file.read_exact(&mut buf)?;
    Ok(buf)
}

/// Parse a `Range: bytes=...` header. Returns (start, end) inclusive, or None when absent/invalid.
fn parse_range(header: Option<&str>, file_len: u64) -> Option<(u64, u64)> {
    let value = header?.trim();
    let spec = value.strip_prefix("bytes=")?;
    let (start_s, end_s) = spec.split_once('-')?;

    if start_s.is_empty() {
        // suffix range: last N bytes
        let n: u64 = end_s.trim().parse().ok()?;
        if n == 0 {
            return None;
        }
        let start = file_len.saturating_sub(n);
        return Some((start, file_len - 1));
    }

    let start: u64 = start_s.trim().parse().ok()?;
    if start >= file_len {
        return None;
    }
    let end = if end_s.trim().is_empty() {
        file_len - 1
    } else {
        end_s.trim().parse::<u64>().ok()?.min(file_len - 1)
    };
    if end < start {
        return None;
    }
    Some((start, end))
}

fn response_from_bytes(bytes: Vec<u8>, status: StatusCode) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("Content-Type", "application/octet-stream")
        .body(bytes)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

/// Handle a `media://localhost/<urlencoded-path>` request with range support.
pub fn media_protocol_handler(request: http::Request<Vec<u8>>) -> Response<Vec<u8>> {
    // Origin guard: allow only main-window origins (media element requests
    // typically carry no Origin; injected cross-origin fetch would be blocked).
    if let Some(origin) = request
        .headers()
        .get("origin")
        .and_then(|v| v.to_str().ok())
    {
        if !MEDIA_SCHEME_ORIGINS.contains(&origin) {
            return response_from_bytes(Vec::new(), StatusCode::FORBIDDEN);
        }
    }

    let uri_path = request.uri().path();
    let path = decode_uri_path(uri_path);
    if !is_allowed(&path) {
        return response_from_bytes(Vec::new(), StatusCode::NOT_FOUND);
    }

    let file = match File::open(&path) {
        Ok(f) => f,
        Err(_) => return response_from_bytes(Vec::new(), StatusCode::NOT_FOUND),
    };
    let file_len = match file.metadata() {
        Ok(m) => m.len(),
        Err(_) => return response_from_bytes(Vec::new(), StatusCode::NOT_FOUND),
    };
    if file_len == 0 {
        return response_from_bytes(Vec::new(), StatusCode::OK);
    }

    let mime = mime_for_path(&path);
    let mut file = file;

    let range = parse_range(
        request.headers().get("range").and_then(|v| v.to_str().ok()),
        file_len,
    );

    match range {
        Some((start, end)) => {
            let bytes = match read_range(&mut file, start, end) {
                Ok(b) => b,
                Err(_) => {
                    return response_from_bytes(Vec::new(), StatusCode::INTERNAL_SERVER_ERROR)
                }
            };
            Response::builder()
                .status(StatusCode::PARTIAL_CONTENT)
                .header("Content-Type", mime)
                .header("Content-Range", format!("bytes {start}-{end}/{file_len}"))
                .header("Content-Length", bytes.len().to_string())
                .header("Accept-Ranges", "bytes")
                .body(bytes)
                .unwrap_or_else(|_| Response::new(Vec::new()))
        }
        None => {
            // No range: serve whole file (small files / non-seek clients)
            let bytes = match read_range(&mut file, 0, file_len - 1) {
                Ok(b) => b,
                Err(_) => {
                    return response_from_bytes(Vec::new(), StatusCode::INTERNAL_SERVER_ERROR)
                }
            };
            Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", mime)
                .header("Content-Length", bytes.len().to_string())
                .body(bytes)
                .unwrap_or_else(|_| Response::new(Vec::new()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_range_basic() {
        assert_eq!(parse_range(Some("bytes=0-499"), 1000), Some((0, 499)));
        assert_eq!(parse_range(Some("bytes=500-"), 1000), Some((500, 999)));
        assert_eq!(parse_range(Some("bytes=-100"), 1000), Some((900, 999)));
        assert_eq!(parse_range(None, 1000), None);
        assert_eq!(parse_range(Some("bytes=2000-"), 1000), None);
        assert_eq!(parse_range(Some("bytes=5-2"), 1000), None);
    }

    #[test]
    fn decode_uri_path_handles_encoding() {
        let p = decode_uri_path("/Users/test/%E6%B5%8B%E8%AF%95%20clip.mp4");
        assert_eq!(p, PathBuf::from("/Users/test/测试 clip.mp4"));
    }

    /// Reset the allowlist so tests are hermetic (parallel tests must not
    /// leak registered paths into each other).
    fn reset_allowlist() {
        *ALLOWED_MEDIA.lock().unwrap() = None;
    }

    fn temp_file(content: &[u8]) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let mut p = std::env::temp_dir().join(format!(
            "clairis_media_test_{}_{}",
            std::process::id(),
            nanos
        ));
        p.set_extension("mp4");
        std::fs::write(&p, content).unwrap();
        p
    }

    /// Requests without a browser Origin are treated as media-element loads — allowed.
    fn handler_request(uri: &str, origin: Option<&str>) -> Response<Vec<u8>> {
        let mut builder = http::Request::builder().uri(uri);
        if let Some(o) = origin {
            builder = builder.header("origin", o);
        }
        media_protocol_handler(builder.body(vec![]).unwrap())
    }

    #[test]
    fn handler_rejects_cross_origin_fetch() {
        reset_allowlist();
        let p = temp_file(b"media-data");
        register_media_path(p.to_string_lossy().into_owned());
        let uri = format!("/{}", p.to_string_lossy().trim_start_matches('/'));
        let resp = handler_request(&uri, Some("https://evil.example"));
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
        let _ = std::fs::remove_file(&p);
    }

    #[test]
    fn handler_serves_only_registered_paths() {
        reset_allowlist();
        let p = temp_file(b"secret");
        // NOT registered → 404 even though the file exists on disk.
        let uri = format!("/{}", p.to_string_lossy().trim_start_matches('/'));
        let resp = handler_request(&uri, None);
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
        let _ = std::fs::remove_file(&p);
    }

    #[test]
    fn handler_serves_registered_file_full_content() {
        reset_allowlist();
        let p = temp_file(b"0123456789");
        register_media_path(p.to_string_lossy().into_owned());
        let uri = format!("/{}", p.to_string_lossy().trim_start_matches('/'));
        let resp = handler_request(&uri, None);
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(resp.body(), b"0123456789");
        let _ = std::fs::remove_file(&p);
    }

    #[test]
    fn handler_returns_partial_content_for_range() {
        reset_allowlist();
        let p = temp_file(b"0123456789");
        register_media_path(p.to_string_lossy().into_owned());
        let uri = format!("/{}", p.to_string_lossy().trim_start_matches('/'));
        let resp = media_protocol_handler(
            http::Request::builder()
                .uri(&uri)
                .header("range", "bytes=2-5")
                .body(vec![])
                .unwrap(),
        );
        assert_eq!(resp.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(resp.body(), b"2345");
        assert_eq!(resp.headers().get("content-range").unwrap(), "bytes 2-5/10");
        let _ = std::fs::remove_file(&p);
    }

    #[test]
    fn handler_empty_file_returns_ok() {
        reset_allowlist();
        let p = temp_file(b"");
        register_media_path(p.to_string_lossy().into_owned());
        let uri = format!("/{}", p.to_string_lossy().trim_start_matches('/'));
        let resp = handler_request(&uri, None);
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(resp.body(), b"");
        let _ = std::fs::remove_file(&p);
    }

    #[test]
    fn handler_missing_file_returns_not_found() {
        reset_allowlist();
        let missing = std::env::temp_dir().join(format!(
            "clairis_media_missing_{}_{}.mp4",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        register_media_path(missing.to_string_lossy().into_owned());
        let uri = format!("/{}", missing.to_string_lossy().trim_start_matches('/'));
        let resp = handler_request(&uri, None);
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }
}
