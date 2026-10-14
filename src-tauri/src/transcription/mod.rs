// Transcription modules
pub mod whisper;
pub mod audio;
pub mod models;

// Re-export commonly used types
pub use models::{Word, TranscriptionResult, TranscriptLine};
pub use whisper::WhisperTranscriber;
pub use audio::{AudioChunk, ChunkConfig};
