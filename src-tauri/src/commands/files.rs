use std::path::Path;
use std::fs;
use serde::{Serialize, Deserialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
}

/// Copy video file to cache directory and return the cached path
#[tauri::command]
pub async fn copy_video_to_cache(
    video_path: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let source = Path::new(&video_path);

    if !source.exists() {
        return Err(format!("Video file not found: {}", video_path));
    }

    // Get cache directory
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Failed to get cache directory: {}", e))?
        .join("videos");

    // Create cache/videos directory if it doesn't exist
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {}", e))?;

    // Get filename
    let filename = source
        .file_name()
        .ok_or("Invalid filename")?
        .to_str()
        .ok_or("Invalid filename encoding")?;

    let dest = cache_dir.join(filename);

    // Copy file
    println!("Copying {} to {}", source.display(), dest.display());
    fs::copy(source, &dest)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    // Return just the filename (not the full path)
    Ok(filename.to_string())
}

/// Get information about a file
#[tauri::command]
pub fn get_file_info(file_path: String) -> Result<FileInfo, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let metadata = path.metadata()
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    Ok(FileInfo {
        path: file_path,
        name,
        size: metadata.len(),
    })
}

/// Get the URL for serving a cached video
#[tauri::command]
pub fn get_video_url(
    filename: String,
    port: u16,
) -> Result<String, String> {
    Ok(format!("http://localhost:{}/videos/{}", port, filename))
}

/// Copy image file to cache directory and return the cached filename
#[tauri::command]
pub async fn copy_image_to_cache(
    image_path: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let source = Path::new(&image_path);

    if !source.exists() {
        return Err(format!("Image file not found: {}", image_path));
    }

    // Get cache directory
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Failed to get cache directory: {}", e))?
        .join("images");

    // Create cache/images directory if it doesn't exist
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {}", e))?;

    // Get filename
    let filename = source
        .file_name()
        .ok_or("Invalid filename")?
        .to_str()
        .ok_or("Invalid filename encoding")?;

    let dest = cache_dir.join(filename);

    // Copy file (preserving original format for transparency and animation)
    println!("Copying {} to {}", source.display(), dest.display());
    fs::copy(source, &dest)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    // Return just the filename (not the full path)
    Ok(filename.to_string())
}

/// Get the URL for serving a cached image
#[tauri::command]
pub fn get_image_url(
    filename: String,
    port: u16,
) -> Result<String, String> {
    Ok(format!("http://localhost:{}/images/{}", port, filename))
}
