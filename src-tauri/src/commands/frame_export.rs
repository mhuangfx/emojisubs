use std::process::{Command, Child, Stdio};
use std::io::Write;
use std::sync::Mutex;
use std::path::PathBuf;

/// Global state for the FFmpeg encoding process
pub struct EncodingState {
    ffmpeg_process: Option<Child>,
    frame_count: u32,
}

impl EncodingState {
    pub fn new() -> Self {
        Self {
            ffmpeg_process: None,
            frame_count: 0,
        }
    }
}

/// Start FFmpeg video encoding session
#[tauri::command]
pub async fn start_video_encoding(
    output_path: String,
    width: u32,
    height: u32,
    fps: u32,
    duration: f64,
    app_state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let mut encoding_state = app_state.encoding_state.lock()
        .map_err(|e| format!("Failed to lock encoding state: {}", e))?;

    // Ensure no existing process
    if encoding_state.ffmpeg_process.is_some() {
        return Err("Encoding already in progress".to_string());
    }

    println!("Starting FFmpeg encoding: {}x{} @ {}fps, duration: {}s", width, height, fps, duration);

    // Start FFmpeg process with rawvideo input
    let mut ffmpeg = Command::new("ffmpeg")
        .arg("-y") // Overwrite output
        .arg("-f").arg("rawvideo")
        .arg("-pix_fmt").arg("rgb24")
        .arg("-s").arg(format!("{}x{}", width, height))
        .arg("-r").arg(fps.to_string())
        .arg("-i").arg("-") // Read from stdin
        .arg("-c:v").arg("libx264")
        .arg("-preset").arg("medium")
        .arg("-crf").arg("23")
        .arg("-pix_fmt").arg("yuv420p")
        .arg(&output_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start FFmpeg: {}", e))?;

    println!("FFmpeg process started successfully");

    encoding_state.ffmpeg_process = Some(ffmpeg);
    encoding_state.frame_count = 0;

    Ok(())
}

/// Add a frame to the video (RGB24 data)
#[tauri::command]
pub async fn add_video_frame(
    frame_data: Vec<u8>,
    app_state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let mut encoding_state = app_state.encoding_state.lock()
        .map_err(|e| format!("Failed to lock encoding state: {}", e))?;

    let ffmpeg = encoding_state.ffmpeg_process.as_mut()
        .ok_or("No encoding session in progress")?;

    let stdin = ffmpeg.stdin.as_mut()
        .ok_or("Failed to get FFmpeg stdin")?;

    // Write frame data
    stdin.write_all(&frame_data)
        .map_err(|e| format!("Failed to write frame data: {}", e))?;

    encoding_state.frame_count += 1;

    if encoding_state.frame_count % 30 == 0 {
        println!("Encoded {} frames", encoding_state.frame_count);
    }

    Ok(())
}

/// Finish video encoding
#[tauri::command]
pub async fn finish_video_encoding(
    app_state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let mut encoding_state = app_state.encoding_state.lock()
        .map_err(|e| format!("Failed to lock encoding state: {}", e))?;

    let mut ffmpeg = encoding_state.ffmpeg_process.take()
        .ok_or("No encoding session in progress")?;

    println!("Finishing encoding, total frames: {}", encoding_state.frame_count);

    // Close stdin to signal end of input
    drop(ffmpeg.stdin.take());

    // Wait for FFmpeg to finish
    let output = ffmpeg.wait_with_output()
        .map_err(|e| format!("Failed to wait for FFmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg encoding failed: {}", stderr));
    }

    println!("Video encoding complete!");
    encoding_state.frame_count = 0;

    Ok(())
}

/// Cancel video encoding (cleanup)
#[tauri::command]
pub async fn cancel_video_encoding(
    app_state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let mut encoding_state = app_state.encoding_state.lock()
        .map_err(|e| format!("Failed to lock encoding state: {}", e))?;

    if let Some(mut ffmpeg) = encoding_state.ffmpeg_process.take() {
        println!("Canceling encoding...");
        let _ = ffmpeg.kill();
        let _ = ffmpeg.wait();
    }

    encoding_state.frame_count = 0;

    Ok(())
}
