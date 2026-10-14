// Data structures for transcription
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Word {
    pub text: String,
    pub start: f64,  // milliseconds
    pub end: f64,    // milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub words: Vec<Word>,
    pub full_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptLine {
    pub id: String,
    pub text: String,
    pub start: f64,  // milliseconds
    pub end: f64,    // milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,
}

impl From<Word> for TranscriptLine {
    fn from(word: Word) -> Self {
        TranscriptLine {
            id: uuid::Uuid::new_v4().to_string(),
            text: word.text,
            start: word.start,
            end: word.end,
            image_url: None,
            text_color: None,
        }
    }
}
