use std::path::{Path, PathBuf};
use std::process::Command;
use super::ass_generator::{SubtitleLine, SubtitleStyle, generate_ass_subtitle, write_ass_file};

/// Calculate image size based on style and video dimensions
fn calculate_image_size(size_str: &str, video_width: i32, video_height: i32) -> i32 {
    let is_vertical = video_height > video_width;
    let base_size = if is_vertical {
        video_width
    } else {
        std::cmp::min(video_width, video_height)
    };

    let scale = match size_str {
        "small" => if is_vertical { 0.15 } else { 0.1 },
        "medium" => if is_vertical { 0.25 } else { 0.15 },
        "large" => if is_vertical { 0.32 } else { 0.3 },
        _ => 0.15,
    };

    (base_size as f32 * scale) as i32
}

/// Calculate image Y position based on alignment and subtitle positioning
/// This matches the logic in SubtitleOverlay.tsx to ensure preview matches export
/// Returns top-left corner Y position (FFmpeg overlay expects top-left, not center)
fn calculate_image_y(
    alignment: &str,
    video_height: i32,
    video_width: i32,
    image_size: i32,
    font_size: i32
) -> String {
    let line_height = (font_size as f32 * 1.2) as i32;
    // Match Canvas: Always use fontSize * 0.5 for spacing (consistent across orientations)
    let image_spacing = (font_size as f32 * 0.5) as i32;

    // For positioning, estimate 2 lines of text as average (more accurate than 1.5)
    // This roughly matches typical subtitle length
    let estimated_text_height = line_height * 2;

    match alignment {
        "top" => {
            // For top alignment: text at top, image BELOW it
            // Match Canvas: 5% top margin
            let top_margin = (video_height as f32 * 0.05) as i32;

            // Center of first line (matches Canvas textY calculation)
            let text_y = top_margin + line_height / 2;

            // Text bottom = textY + totalTextHeight - lineHeight/2
            let text_bottom = text_y + estimated_text_height - line_height / 2;

            // Image center Y = text bottom + spacing + half image size
            let image_center_y = text_bottom + image_spacing + image_size / 2;

            // Convert center to top-left corner for FFmpeg
            let image_y = image_center_y - image_size / 2;
            format!("{}", image_y)
        },
        "center" => {
            // Center the entire content block (image above text)
            let total_height = image_size + image_spacing + estimated_text_height;
            let image_center_y = (video_height - total_height) / 2 + image_size / 2;
            // Convert center to top-left corner for FFmpeg
            let image_y = image_center_y - image_size / 2;
            format!("{}", image_y)
        },
        "bottom" => {
            // Image positioned above text at bottom
            // Match Canvas: 10% bottom margin
            let bottom_margin = (video_height as f32 * 0.1) as i32;
            let text_y = video_height - bottom_margin - estimated_text_height + line_height;
            let image_center_y = text_y - line_height - image_spacing - image_size / 2;
            // Convert center to top-left corner for FFmpeg
            let image_y = image_center_y - image_size / 2;
            format!("{}", image_y)
        },
        _ => {
            // Default to bottom
            let bottom_margin = (video_height as f32 * 0.1) as i32;
            let text_y = video_height - bottom_margin - estimated_text_height + line_height;
            let image_center_y = text_y - line_height - image_spacing - image_size / 2;
            // Convert center to top-left corner for FFmpeg
            let image_y = image_center_y - image_size / 2;
            format!("{}", image_y)
        }
    }
}

/// Export video with subtitles and image overlays
pub fn export_video(
    input_video: &Path,
    output_video: &Path,
    subtitles: &[SubtitleLine],
    style: &SubtitleStyle,
    video_width: i32,
    video_height: i32,
    trim_start_ms: Option<f64>,
    trim_end_ms: Option<f64>,
) -> Result<(), String> {
    // Get rotation metadata to apply transpose filter if needed
    let rotation = get_video_rotation(input_video)?;

    // Create temporary ASS file
    let temp_dir = std::env::temp_dir();
    let ass_path = temp_dir.join("emojisubs_temp.ass");

    // Calculate time offset for trimmed videos
    let time_offset = trim_start_ms.unwrap_or(0.0);

    // Adjust subtitle timings if video is trimmed
    let adjusted_subtitles: Vec<SubtitleLine> = if time_offset > 0.0 {
        subtitles.iter().map(|sub| SubtitleLine {
            text: sub.text.clone(),
            start: sub.start - time_offset,
            end: sub.end - time_offset,
            image_path: sub.image_path.clone(),
        }).collect()
    } else {
        subtitles.to_vec()
    };

    // Generate ASS subtitle content with adjusted timings
    let ass_content = generate_ass_subtitle(&adjusted_subtitles, style, video_width, video_height)?;
    write_ass_file(&ass_content, &ass_path)?;

    // Collect unique images with their timings (adjusted for trim offset)
    let mut image_overlays: Vec<(&str, f64, f64)> = Vec::new();
    for subtitle in subtitles {
        if let Some(ref image_path) = subtitle.image_path {
            // Subtract trim offset to get times relative to trimmed video
            let adjusted_start = subtitle.start - time_offset;
            let adjusted_end = subtitle.end - time_offset;
            image_overlays.push((image_path.as_str(), adjusted_start, adjusted_end));
        }
    }

    // Set up fontconfig to use bundled fonts
    // Get the fonts directory relative to the project
    let fonts_dir = if let Ok(mut exe_path) = std::env::current_exe() {
        // In production, fonts are relative to executable
        exe_path.pop(); // Remove exe name
        if exe_path.ends_with("target/debug") || exe_path.ends_with("target/release") {
            // Development mode - go to project root
            exe_path.pop(); // Remove target/debug or target/release
            exe_path.pop(); // Remove target
            exe_path.pop(); // Remove src-tauri
            exe_path.push("fonts");
        } else {
            // Production mode - fonts should be in resources
            exe_path.push("fonts");
        }
        exe_path
    } else {
        // Fallback to relative path
        PathBuf::from("fonts")
    };

    println!("Using fonts from: {:?}", fonts_dir);

    // Create temporary fontconfig with absolute paths
    let temp_dir = std::env::temp_dir();
    let temp_fontconfig = temp_dir.join(format!("emojisubs_fonts_{}.conf", std::process::id()));

    // Get absolute path to fonts directory
    let fonts_dir_absolute = fonts_dir.canonicalize()
        .unwrap_or(fonts_dir.clone());

    let fontconfig_content = format!(r#"<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <!-- Font directory (absolute path) -->
  <dir>{}</dir>
</fontconfig>"#, fonts_dir_absolute.display());

    std::fs::write(&temp_fontconfig, fontconfig_content)
        .map_err(|e| format!("Failed to write temp fontconfig: {}", e))?;

    println!("Created temp fontconfig: {:?}", temp_fontconfig);

    // Build FFmpeg command
    let mut ffmpeg_cmd = Command::new("ffmpeg");

    // Set FONTCONFIG_FILE environment variable to use our bundled fonts
    if fonts_dir_absolute.exists() {
        ffmpeg_cmd.env("FONTCONFIG_FILE", &temp_fontconfig);
        ffmpeg_cmd.env("FONTCONFIG_PATH", &fonts_dir_absolute);
        println!("✓ Using bundled fonts via fontconfig");
    } else {
        println!("⚠ Fonts directory not found, using system fonts");
    }

    // Add trim parameters if provided (before input for fast seek)
    if let Some(start_ms) = trim_start_ms {
        let start_sec = start_ms / 1000.0;
        ffmpeg_cmd.arg("-ss").arg(format!("{:.3}", start_sec));
    }

    ffmpeg_cmd.arg("-i").arg(input_video);

    // Add duration parameter if trim end is provided
    if let (Some(start_ms), Some(end_ms)) = (trim_start_ms, trim_end_ms) {
        let duration_sec = (end_ms - start_ms) / 1000.0;
        ffmpeg_cmd.arg("-t").arg(format!("{:.3}", duration_sec));
    }

    // Add image inputs
    for (image_path, _, _) in &image_overlays {
        ffmpeg_cmd.arg("-i").arg(image_path);
    }

    // Build filter complex for images + subtitles
    let image_size = calculate_image_size(&style.image_size, video_width, video_height);

    // Calculate font size to match preview (same logic as SubtitleOverlay.tsx)
    let base_font_size = (video_width as f32 * 0.045) as i32; // 4.5% of width
    let size_multipliers = match style.text_size.as_str() {
        "small" => 0.8,
        "medium" => 1.0,
        "large" => 1.5,
        _ => 1.0,
    };
    let font_size = (base_font_size as f32 * size_multipliers) as i32;

    let image_y = calculate_image_y(&style.alignment, video_height, video_width, image_size, font_size);
    // Calculate X position (top-left corner for FFmpeg overlay)
    // Center horizontally: (video_width - image_size) / 2
    let image_x = (video_width - image_size) / 2;

    let mut filter_complex = String::new();

    // Determine transpose filter based on rotation metadata
    // transpose values: 1=90°CW, 2=90°CCW
    let transpose_filter = match rotation {
        90 => "transpose=1",   // 90° clockwise
        180 => "transpose=1,transpose=1", // 180° (two 90° rotations)
        270 => "transpose=2",  // 90° counter-clockwise (270° clockwise)
        _ => "",  // No rotation needed
    };

    if !image_overlays.is_empty() {
        // Apply rotation first if needed, then add overlays
        let video_input = if !transpose_filter.is_empty() {
            filter_complex.push_str(&format!("[0:v]{}[vrot];", transpose_filter));
            "[vrot]"
        } else {
            "[0:v]"
        };

        // Add each image overlay
        for (i, (_image_path, start_ms, end_ms)) in image_overlays.iter().enumerate() {
            let input_index = i + 1; // Input 0 is video, images start at 1
            let start_sec = start_ms / 1000.0;
            let end_sec = end_ms / 1000.0;
            let duration_sec = end_sec - start_sec;

            // Add fade transition: 300ms fade-in at start, 200ms fade-out at end
            let fade_in_duration = 0.3_f64.min(duration_sec / 3.0); // Max 1/3 of duration
            let fade_out_duration = 0.2_f64.min(duration_sec / 3.0);
            let fade_out_start = end_sec - fade_out_duration;

            // Scale image and add fade transitions
            filter_complex.push_str(&format!(
                "[{}:v]scale={}:{},fade=in:st={}:d={},fade=out:st={}:d={}[img{}];",
                input_index,
                image_size,
                image_size,
                start_sec,
                fade_in_duration,
                fade_out_start,
                fade_out_duration,
                i
            ));

            // Overlay with timing enable
            if i == 0 {
                filter_complex.push_str(&format!(
                    "{}[img{}]overlay={}:{}:enable='between(t,{},{})':format=auto",
                    video_input, i, image_x, image_y, start_sec, end_sec
                ));
            } else {
                filter_complex.push_str(&format!(
                    "[v{}][img{}]overlay={}:{}:enable='between(t,{},{})':format=auto",
                    i - 1, i, image_x, image_y, start_sec, end_sec
                ));
            }

            if i < image_overlays.len() - 1 {
                filter_complex.push_str(&format!("[v{}];", i));
            } else {
                filter_complex.push_str(&format!("[vout];[vout]ass={}[outv]", ass_path.display()));
            }
        }

        ffmpeg_cmd.arg("-filter_complex").arg(&filter_complex);
        ffmpeg_cmd.arg("-map").arg("[outv]");
    } else {
        // No images, just subtitles (and rotation if needed)
        if !transpose_filter.is_empty() {
            ffmpeg_cmd.arg("-vf").arg(format!("{}ass={}", transpose_filter, ass_path.display()));
        } else {
            ffmpeg_cmd.arg("-vf").arg(format!("ass={}", ass_path.display()));
        }
    }

    // Output encoding settings
    ffmpeg_cmd
        .arg("-map")
        .arg("0:a?")  // Map audio if it exists
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("medium")
        .arg("-crf")
        .arg("23")
        .arg("-c:a")
        .arg("copy")
        .arg("-metadata:s:v:0")
        .arg("rotate=0")  // Remove rotation metadata since we're baking it in
        .arg("-y")
        .arg(output_video);

    // Execute FFmpeg
    let output = ffmpeg_cmd
        .output()
        .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

    // Clean up temporary ASS file and fontconfig
    let _ = std::fs::remove_file(&ass_path);
    let _ = std::fs::remove_file(&temp_fontconfig);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg failed: {}", stderr));
    }

    Ok(())
}

/// Get video rotation metadata (in degrees)
/// Checks both stream_tags and display matrix side_data
fn get_video_rotation(video_path: &Path) -> Result<i32, String> {
    // First check display matrix side_data (more common in phone videos)
    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-select_streams")
        .arg("v:0")
        .arg("-show_entries")
        .arg("stream_side_data=rotation")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(video_path)
        .output()
        .map_err(|e| format!("Failed to run ffprobe for rotation: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    if let Ok(rotation) = stdout.trim().parse::<i32>() {
        if rotation != 0 {
            // Normalize negative rotations (e.g., -90 -> 270)
            let normalized = if rotation < 0 {
                360 + rotation
            } else {
                rotation
            };
            return Ok(normalized);
        }
    }

    // Fallback: check stream_tags
    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-select_streams")
        .arg("v:0")
        .arg("-show_entries")
        .arg("stream_tags=rotate")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(video_path)
        .output()
        .map_err(|e| format!("Failed to run ffprobe for rotation tags: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let rotation = stdout.trim().parse::<i32>().unwrap_or(0);

    Ok(rotation)
}

/// Get video dimensions using ffprobe, accounting for rotation metadata
/// Returns the display dimensions (swapped if rotated 90° or 270°)
pub fn get_video_dimensions(video_path: &Path) -> Result<(i32, i32), String> {
    println!("Getting video dimensions for: {:?}", video_path);

    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-select_streams")
        .arg("v:0")
        .arg("-show_entries")
        .arg("stream=width,height")
        .arg("-of")
        .arg("csv=s=x:p=0")
        .arg(video_path)
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    println!("ffprobe output: '{}'", stdout);

    // Filter out empty strings after splitting (handles trailing 'x')
    let dimensions: Vec<&str> = stdout.trim()
        .split('x')
        .filter(|s| !s.is_empty())
        .collect();

    if dimensions.len() != 2 {
        return Err(format!("Invalid ffprobe output. Expected 'WIDTHxHEIGHT', got: '{}' (parsed as {:?})",
            stdout.trim(), dimensions));
    }

    let mut width = dimensions[0]
        .parse::<i32>()
        .map_err(|_| format!("Invalid width: '{}'", dimensions[0]))?;
    let mut height = dimensions[1]
        .parse::<i32>()
        .map_err(|_| format!("Invalid height: '{}'", dimensions[1]))?;

    // Check for rotation metadata
    let rotation = get_video_rotation(video_path)?;
    println!("Video rotation metadata: {}°", rotation);

    // If rotated 90° or 270°, swap width and height for display dimensions
    if rotation == 90 || rotation == 270 {
        println!("Swapping dimensions due to {}° rotation", rotation);
        std::mem::swap(&mut width, &mut height);
    }

    println!("Display dimensions: {}x{}", width, height);
    Ok((width, height))
}
