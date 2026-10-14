use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleLine {
    pub text: String,
    pub start: f64,    // milliseconds
    pub end: f64,      // milliseconds
    #[serde(rename = "imagePath")]
    pub image_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubtitleStyle {
    pub alignment: String,     // "top", "center", "bottom"
    #[serde(rename = "imageSize")]
    pub image_size: String,    // "small", "medium", "large"
    #[serde(rename = "textSize")]
    pub text_size: String,     // "small", "medium", "large"
    pub font: String,
    pub background: String,    // "box", "outline", "shadow", "none"
    pub colors: StyleColors,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StyleColors {
    pub background: String,    // hex color
    pub text: String,          // hex color
}

/// Convert milliseconds to ASS time format (H:MM:SS.CS)
fn ms_to_ass_time(ms: f64) -> String {
    let total_seconds = ms / 1000.0;
    let hours = (total_seconds / 3600.0) as i32;
    let minutes = ((total_seconds % 3600.0) / 60.0) as i32;
    let seconds = total_seconds % 60.0;
    format!("{}:{:02}:{:05.2}", hours, minutes, seconds)
}

/// Convert hex color to ASS color format (&HAABBGGRR)
fn hex_to_ass_color(hex: &str) -> String {
    let hex = hex.trim_start_matches('#');
    if hex.len() == 6 {
        let r = &hex[0..2];
        let g = &hex[2..4];
        let b = &hex[4..6];
        // ASS format is BGR, not RGB
        format!("&H00{}{}{}", b, g, r)
    } else {
        "&H00FFFFFF".to_string() // Default to white
    }
}

/// Map font names from frontend to system fonts
fn map_font_name(font: &str) -> &str {
    match font {
        "montserrat" => "Montserrat",
        "pacifico" => "Pacifico",
        "bebasneue" => "Bebas Neue",
        "bangers" => "Bangers",
        "comfortaa" => "Comfortaa",
        "orbitron" => "Orbitron",
        _ => "Arial",
    }
}

/// Calculate font size based on video width (matches preview calculation)
fn calculate_font_size(size: &str, video_width: i32) -> i32 {
    // Use 4.5% of video width as base (same as SubtitleOverlay.tsx)
    let base_font_size = (video_width as f32 * 0.045) as i32;

    match size {
        "small" => (base_font_size as f32 * 0.8) as i32,
        "medium" => base_font_size,
        "large" => (base_font_size as f32 * 1.5) as i32,
        _ => base_font_size,
    }
}

/// Map alignment to ASS alignment number
fn map_alignment(alignment: &str) -> i32 {
    match alignment {
        "top" => 8,      // Top center
        "center" => 5,   // Middle center
        "bottom" => 2,   // Bottom center
        _ => 2,
    }
}

/// Generate ASS subtitle file content
pub fn generate_ass_subtitle(
    subtitles: &[SubtitleLine],
    style: &SubtitleStyle,
    video_width: i32,
    video_height: i32,
) -> Result<String, String> {
    // Get style parameters
    let font_name = map_font_name(&style.font);
    let font_size = calculate_font_size(&style.text_size, video_width);
    let alignment = map_alignment(&style.alignment);
    let primary_color = hex_to_ass_color(&style.colors.text);
    let outline_color = hex_to_ass_color(&style.colors.background);

    // Determine border and shadow based on background style
    // For box background, we need BorderStyle=3 (opaque box) with proper padding
    let (border_style, outline, shadow) = match style.background.as_str() {
        "box" => (3, 4, 0),        // Box background with padding (outline controls padding)
        "outline" => (1, 3, 0),    // Text outline
        "shadow" => (1, 0, 3),     // Drop shadow
        "none" | _ => (1, 0, 0),   // No background
    };

    // Build ASS file content
    let mut ass_content = String::new();

    // Script Info
    ass_content.push_str("[Script Info]\n");
    ass_content.push_str("Title: EmojiSubs Export\n");
    ass_content.push_str("ScriptType: v4.00+\n");
    ass_content.push_str(&format!("PlayResX: {}\n", video_width));
    ass_content.push_str(&format!("PlayResY: {}\n", video_height));
    ass_content.push_str("WrapStyle: 0\n\n");

    // Calculate vertical margin to match preview positioning
    // Use smaller margin for top alignment (5%), standard margin (10%) for bottom/center
    let margin_v = if style.alignment == "top" {
        (video_height as f32 * 0.05) as i32
    } else {
        (video_height as f32 * 0.1) as i32
    };

    // Styles
    ass_content.push_str("[V4+ Styles]\n");
    ass_content.push_str("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n");
    ass_content.push_str(&format!(
        "Style: Default,{},{},{},{},{},{},1,0,0,0,100,100,0,0,{},{},{},{},10,10,{},1\n\n",
        font_name,
        font_size,
        primary_color,
        "&H000000FF",  // Secondary color (not used)
        outline_color,
        outline_color, // Back color (for box background)
        border_style,
        outline,
        shadow,
        alignment,
        margin_v      // Use calculated vertical margin
    ));

    // Events
    ass_content.push_str("[Events]\n");
    ass_content.push_str("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n");

    for subtitle in subtitles {
        let start_time = ms_to_ass_time(subtitle.start);
        let end_time = ms_to_ass_time(subtitle.end);

        // Escape special ASS characters
        let text = subtitle.text.replace('\\', "\\\\").replace('\n', "\\N");

        ass_content.push_str(&format!(
            "Dialogue: 0,{},{},Default,,0,0,0,,{}\n",
            start_time, end_time, text
        ));
    }

    Ok(ass_content)
}

/// Write ASS subtitle to file
pub fn write_ass_file(content: &str, output_path: &Path) -> Result<(), String> {
    fs::write(output_path, content)
        .map_err(|e| format!("Failed to write ASS file: {}", e))
}
