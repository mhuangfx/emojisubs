use std::path::PathBuf;
use std::fs;

/// Save a video blob to disk
/// Used by Canvas-based export from frontend
#[tauri::command]
pub async fn save_video_blob(
    blob_data: Vec<u8>,
    output_path: String,
) -> Result<(), String> {
    let path = PathBuf::from(&output_path);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    // Write blob to file
    fs::write(&path, &blob_data)
        .map_err(|e| format!("Failed to write video file: {}", e))?;

    println!("Video saved to: {:?}", path);
    Ok(())
}
