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
        }
    }
}

impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        error!("{err}");
        err.to_string()
    }
}
