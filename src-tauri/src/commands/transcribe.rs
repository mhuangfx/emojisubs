use std::path::{Path, PathBuf};
use crate::transcription::{WhisperTranscriber, TranscriptionResult, audio};

/// Trim a video file to a specific time range
/// Returns the path to the trimmed video file
#[tauri::command]
pub async fn trim_video_file(
    video_path: String,
    trim_start_ms: f64,
    trim_end_ms: f64,
) -> Result<String, String> {
    println!("Trimming video: {}", video_path);

    // Create output path in temp directory
    let temp_dir = std::env::temp_dir();
    let original_name = Path::new(&video_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("video.mp4");

    let trimmed_path = temp_dir.join(format!("trimmed_{}_{}",
        std::process::id(),
        original_name
    ));

    // Trim the video
    audio::trim_video(
        Path::new(&video_path),
        &trimmed_path,
        trim_start_ms,
        trim_end_ms,
    )?;

    Ok(trimmed_path.to_string_lossy().to_string())
}

/// Transcribe a video file using Whisper
#[tauri::command]
pub async fn transcribe_video(
    video_path: String,
    model_size: String,
) -> Result<TranscriptionResult, String> {
    println!("Starting transcription for: {}", video_path);
    println!("Using model: {}", model_size);

    // Get model path
    let model_path = get_model_path(&model_size)?;
    println!("Model path: {}", model_path.display());

    // Extract audio to temporary WAV file
    let temp_dir = std::env::temp_dir();
    let audio_path = temp_dir.join(format!("audio_{}_{}.wav",
        std::process::id(),
        chrono::Utc::now().timestamp()
    ));

    println!("Extracting audio to: {}", audio_path.display());
    audio::extract_audio_to_wav(Path::new(&video_path), &audio_path, None, None)?;

    // Create audio chunks for efficient processing
    println!("Creating audio chunks...");
    let chunk_config = audio::ChunkConfig::default();
    let chunks = audio::create_audio_chunks(&audio_path, &chunk_config)?;
    println!("Created {} chunks", chunks.len());

    // Load Whisper model
    println!("Loading Whisper model...");
    let transcriber = WhisperTranscriber::new(&model_path)?;

    // Transcribe with progress callback
    println!("Starting transcription...");
    let result = transcriber.transcribe_with_chunks(
        &chunks,
        Some("en"), // English
        Some(Box::new(|progress| {
            println!("Transcription progress: {:.1}%", progress);
        }))
    )?;

    // Clean up temporary audio file
    let _ = std::fs::remove_file(&audio_path);

    println!("Transcription complete! Found {} words", result.words.len());
    Ok(result)
}

/// Get available Whisper models
#[tauri::command]
pub fn get_available_models() -> Result<Vec<String>, String> {
    let models_dir = get_models_dir()?;

    let mut models = Vec::new();

    // Check for common model files
    let model_names = vec!["tiny.en", "base.en", "small.en"];

    for name in model_names {
        let model_path = models_dir.join(format!("ggml-{}.bin", name));
        if model_path.exists() {
            models.push(name.to_string());
        }
    }

    if models.is_empty() {
        return Err("No Whisper models found in models/ directory".to_string());
    }

    Ok(models)
}

/// Helper to get the models directory
fn get_models_dir() -> Result<PathBuf, String> {
    // In development, models are in project root
    // In production, models should be bundled with the app or in a known location

    // Try current working directory first
    let mut cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;

    // If we're in src-tauri directory (dev mode), go up one level to project root
    if cwd.ends_with("src-tauri") {
        cwd = cwd.parent()
            .ok_or("Failed to get parent directory of src-tauri")?
            .to_path_buf();
    }

    let models_dir = cwd.join("models");
    if models_dir.exists() {
        println!("Found models directory at: {}", models_dir.display());
        return Ok(models_dir);
    }

    // Try relative to executable (for production)
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable directory: {}", e))?;

    let project_root = exe_dir
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .ok_or("Failed to find project root")?;

    let models_dir_alt = project_root.join("models");
    if models_dir_alt.exists() {
        println!("Found models directory at: {}", models_dir_alt.display());
        return Ok(models_dir_alt);
    }

    Err(format!(
        "Models directory not found. Tried:\n  - {}\n  - {}",
        models_dir.display(),
        models_dir_alt.display()
    ))
}

/// Helper to get the full path to a model file
fn get_model_path(model_size: &str) -> Result<PathBuf, String> {
    let models_dir = get_models_dir()?;
    let model_path = models_dir.join(format!("ggml-{}.bin", model_size));

    if !model_path.exists() {
        return Err(format!(
            "Model file not found: {}. Available models: {:?}",
            model_path.display(),
            get_available_models()?
        ));
    }

    Ok(model_path)
}
