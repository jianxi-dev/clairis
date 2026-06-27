use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationChunk {
    pub request_id: String,
    pub text: String,
    pub done: bool,
    pub error: Option<String>,
}
