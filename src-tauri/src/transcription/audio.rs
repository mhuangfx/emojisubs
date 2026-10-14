// FFmpeg-based audio extraction and processing with chunking support
use std::path::{Path, PathBuf};
use std::process::Command;

/// Configuration for audio chunking
#[derive(Debug, Clone)]
pub struct ChunkConfig {
    /// Chunk duration in seconds (recommended: 30-60 seconds)
    pub chunk_duration: u32,
    /// Overlap between chunks in seconds (recommended: 1-2 seconds for smooth transitions)
    pub overlap_duration: u32,
}

impl Default for ChunkConfig {
    fn default() -> Self {
        Self {
            chunk_duration: 30,  // 30 second chunks
            overlap_duration: 1, // 1 second overlap
        }
    }
}

/// Trim video file to a specific time range
/// Returns the path to the trimmed video file
pub fn trim_video(
    video_path: &Path,
    output_path: &Path,
    trim_start_ms: f64,
    trim_end_ms: f64,
) -> Result<(), String> {
    let start_sec = trim_start_ms / 1000.0;
    let duration_sec = (trim_end_ms - trim_start_ms) / 1000.0;

    println!("Trimming video: start={:.3}s, duration={:.3}s", start_sec, duration_sec);

    let output = Command::new("ffmpeg")
        .arg("-ss")
        .arg(format!("{:.3}", start_sec))
        .arg("-i")
        .arg(video_path)
        .arg("-t")
        .arg(format!("{:.3}", duration_sec))
        .arg("-c")
        .arg("copy") // Copy codec (fast, no re-encoding)
        .arg("-y") // Overwrite output file
        .arg(output_path)
        .output()
        .map_err(|e| format!("Failed to run FFmpeg for trimming: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("FFmpeg trim stderr: {}", stderr);
        return Err(format!("FFmpeg failed to trim video. Error: {}", stderr));
    }

    println!("Video trimmed successfully to: {:?}", output_path);
    Ok(())
}

/// Extract audio from video to WAV format (16kHz mono, required by Whisper)
/// Optionally trim to a specific time range
pub fn extract_audio_to_wav(
    video_path: &Path,
    output_path: &Path,
    trim_start_ms: Option<f64>,
    trim_end_ms: Option<f64>,
) -> Result<(), String> {
    let mut cmd = Command::new("ffmpeg");

    // Add trim parameters if provided
    if let Some(start_ms) = trim_start_ms {
        let start_sec = start_ms / 1000.0;
        cmd.arg("-ss").arg(format!("{:.3}", start_sec));
    }

    cmd.arg("-i").arg(video_path);

    // Add duration parameter if end trim is provided
    if let (Some(start_ms), Some(end_ms)) = (trim_start_ms, trim_end_ms) {
        let duration_sec = (end_ms - start_ms) / 1000.0;
        cmd.arg("-t").arg(format!("{:.3}", duration_sec));
    } else if let Some(end_ms) = trim_end_ms {
        let duration_sec = end_ms / 1000.0;
        cmd.arg("-t").arg(format!("{:.3}", duration_sec));
    }

    let output = cmd
        .arg("-ar")
        .arg("16000") // 16kHz sample rate
        .arg("-ac")
        .arg("1") // Mono
        .arg("-c:a")
        .arg("pcm_s16le") // 16-bit PCM
        .arg("-y") // Overwrite output file
        .arg(output_path)
        .output()
        .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("FFmpeg stderr: {}", stderr);
        return Err(format!("FFmpeg failed to extract audio. Error: {}", stderr));
    }

    Ok(())
}

/// Get audio duration in seconds using FFprobe
pub fn get_audio_duration(audio_path: &Path) -> Result<f64, String> {
    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(audio_path)
        .output()
        .map_err(|e| format!("Failed to run FFprobe: {}", e))?;

    if !output.status.success() {
        return Err("FFprobe failed to get audio duration".to_string());
    }

    let duration_str = String::from_utf8_lossy(&output.stdout);
    duration_str
        .trim()
        .parse::<f64>()
        .map_err(|e| format!("Failed to parse duration: {}", e))
}

/// Extract a specific chunk of audio from the full WAV file
pub fn extract_audio_chunk(
    input_path: &Path,
    output_path: &Path,
    start_time: f64,
    duration: f64,
) -> Result<(), String> {
    let status = Command::new("ffmpeg")
        .arg("-ss")
        .arg(format!("{:.2}", start_time))
        .arg("-t")
        .arg(format!("{:.2}", duration))
        .arg("-i")
        .arg(input_path)
        .arg("-ar")
        .arg("16000")
        .arg("-ac")
        .arg("1")
        .arg("-c:a")
        .arg("pcm_s16le")
        .arg("-y")
        .arg(output_path)
        .status()
        .map_err(|e| format!("Failed to run FFmpeg for chunk: {}", e))?;

    if !status.success() {
        return Err("FFmpeg failed to extract audio chunk".to_string());
    }

    Ok(())
}

/// Load WAV file into memory as f32 samples
pub fn load_wav_file(wav_path: &Path) -> Result<Vec<f32>, String> {
    use std::fs::File;
    use std::io::Read;

    let mut file = File::open(wav_path)
        .map_err(|e| format!("Failed to open WAV file: {}", e))?;

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read WAV file: {}", e))?;

    // Skip WAV header (44 bytes) and convert i16 samples to f32
    let samples = buffer[44..]
        .chunks_exact(2)
        .map(|chunk| {
            let sample = i16::from_le_bytes([chunk[0], chunk[1]]);
            sample as f32 / 32768.0 // Normalize to [-1.0, 1.0]
        })
        .collect();

    Ok(samples)
}

/// Information about an audio chunk for processing
#[derive(Debug, Clone)]
pub struct AudioChunk {
    /// Chunk index (0-based)
    pub index: usize,
    /// Start time in the original audio (seconds)
    pub start_time: f64,
    /// Duration of this chunk (seconds)
    pub duration: f64,
    /// Audio samples for this chunk
    pub samples: Vec<f32>,
}

/// Split audio file into chunks for efficient processing
pub fn create_audio_chunks(
    audio_path: &Path,
    config: &ChunkConfig,
) -> Result<Vec<AudioChunk>, String> {
    let total_duration = get_audio_duration(audio_path)?;

    // If audio is short, just return the whole thing
    if total_duration <= config.chunk_duration as f64 {
        let samples = load_wav_file(audio_path)?;
        return Ok(vec![AudioChunk {
            index: 0,
            start_time: 0.0,
            duration: total_duration,
            samples,
        }]);
    }

    // Calculate chunk parameters
    let effective_chunk_duration = config.chunk_duration as f64;
    let overlap = config.overlap_duration as f64;
    let step_size = effective_chunk_duration - overlap;

    let mut chunks = Vec::new();
    let mut current_time = 0.0;
    let mut chunk_index = 0;

    // Create temporary directory for chunks
    let temp_dir = std::env::temp_dir();

    while current_time < total_duration {
        let remaining = total_duration - current_time;
        let chunk_duration = if remaining < effective_chunk_duration {
            remaining
        } else {
            effective_chunk_duration
        };

        // Extract this chunk to a temporary file
        let chunk_path = temp_dir.join(format!("chunk_{}_{}.wav",
            std::process::id(), chunk_index));

        extract_audio_chunk(audio_path, &chunk_path, current_time, chunk_duration)?;

        // Load the chunk samples
        let samples = load_wav_file(&chunk_path)?;

        // Clean up temporary chunk file
        let _ = std::fs::remove_file(&chunk_path);

        chunks.push(AudioChunk {
            index: chunk_index,
            start_time: current_time,
            duration: chunk_duration,
            samples,
        });

        current_time += step_size;
        chunk_index += 1;

        // Break if we've covered the duration
        if remaining < effective_chunk_duration {
            break;
        }
    }

    Ok(chunks)
}
