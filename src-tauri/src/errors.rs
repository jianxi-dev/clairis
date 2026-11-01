use serde::Serialize;
use tracing::error;

#[derive(Debug, Serialize)]
pub enum AppError {
    Cancelled,
    Io {
        context: String,
        #[serde(skip)]
        source: std::io::Error,
    },
    Serialization {
        context: String,
        #[serde(skip)]
        source: serde_json::Error,
    },
    Keyring {
        context: String,
        source: String,
    },
    Translation {
        context: String,
        source: String,
    },
    InvalidEndpoint {
        url: String,
        reason: String,
    },
    EndpointBlocked {
        host: String,
        ip: String,
    },
    Validation {
        context: String,
        message: String,
    },
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io {
            context: "IO operation failed".into(),
            source: e,
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::Cancelled => write!(f, "Operation cancelled"),
            AppError::Io { context, source } => {
                write!(f, "IO error ({context}): {source}")
            }
            AppError::Serialization { context, source } => {
                write!(f, "Serialization error ({context}): {source}")
            }
            AppError::Keyring { context, source } => {
                write!(f, "Keyring error ({context}): {source}")
            }
            AppError::Translation { context, source } => {
                write!(f, "Translation error ({context}): {source}")
            }
            AppError::InvalidEndpoint { url, reason } => {
                write!(f, "Invalid endpoint ({url}): {reason}")
            }
            AppError::EndpointBlocked { host, ip } => {
                write!(f, "Endpoint blocked: {host} resolves to {ip}")
            }
            AppError::Validation { context, message } => {
                write!(f, "Validation error ({context}): {message}")
            }
        }
    }
}

impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        error!("{err}");
        err.to_string()
    }
}
