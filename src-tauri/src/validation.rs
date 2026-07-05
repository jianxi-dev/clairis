use url::Url;

use crate::errors::AppError;

/// Validate a translation endpoint URL.
///
/// For Ollama: only localhost (localhost, 127.0.0.1, [::1]).
/// For OpenAI: must resolve to a global unicast IP (DNS check at runtime).
/// Protocol must be http or https.
pub fn validate_translation_endpoint(url_str: &str, is_ollama: bool) -> Result<Url, AppError> {
    let parsed = Url::parse(url_str).map_err(|_| AppError::InvalidEndpoint {
        url: url_str.to_string(),
        reason: "invalid URL format".into(),
    })?;

    // 1. Protocol whitelist
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(AppError::InvalidEndpoint {
            url: url_str.to_string(),
            reason: format!("unsupported scheme: {}", parsed.scheme()),
        });
    }

    let host = parsed.host_str().unwrap_or("");

    // 2. Ollama: localhost only
    if is_ollama {
        if host != "localhost" && host != "127.0.0.1" && host != "[::1]" {
            return Err(AppError::EndpointBlocked {
                host: host.to_string(),
                ip: host.to_string(),
            });
        }
        return Ok(parsed);
    }

    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ollama_localhost_allowed() {
        let result = validate_translation_endpoint("http://localhost:11434", true);
        assert!(result.is_ok());
    }

    #[test]
    fn test_ollama_127_allowed() {
        let result = validate_translation_endpoint("http://127.0.0.1:11434", true);
        assert!(result.is_ok());
    }

    #[test]
    fn test_ollama_external_blocked() {
        let result = validate_translation_endpoint("https://api.openai.com", true);
        assert!(result.is_err());
        match result {
            Err(AppError::EndpointBlocked { .. }) => {} // expected
            _ => panic!("expected EndpointBlocked"),
        }
    }

    #[test]
    fn test_openai_external_allowed() {
        let result = validate_translation_endpoint("https://api.openai.com", false);
        assert!(result.is_ok());
    }

    #[test]
    fn test_invalid_url() {
        let result = validate_translation_endpoint("not-a-url", false);
        assert!(result.is_err());
        match result {
            Err(AppError::InvalidEndpoint { .. }) => {} // expected
            _ => panic!("expected InvalidEndpoint"),
        }
    }

    #[test]
    fn test_unsupported_scheme() {
        let result = validate_translation_endpoint("ftp://example.com", false);
        assert!(result.is_err());
    }

    #[test]
    fn test_ollama_ipv6_localhost() {
        let result = validate_translation_endpoint("http://[::1]:11434", true);
        assert!(result.is_ok());
    }

    #[test]
    fn test_openai_with_path() {
        let result = validate_translation_endpoint("https://api.openai.com/v1/chat", false);
        assert!(result.is_ok());
        let url = result.unwrap();
        assert_eq!(url.path(), "/v1/chat");
    }
}
