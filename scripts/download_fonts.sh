#!/bin/bash

# Font Download Script for EmojiSubs
# Downloads fonts from Google Fonts and organizes them for bundling

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FONTS_DIR="$PROJECT_ROOT/fonts"

echo "=== EmojiSubs Font Downloader ==="
echo "Fonts will be downloaded to: $FONTS_DIR"
echo ""

# Create fonts directory
mkdir -p "$FONTS_DIR"

# Function to download a font from Google Fonts
download_font() {
    local font_name="$1"
    local font_family="$2"

    echo "Downloading $font_name..."

    # Get the font CSS from Google Fonts
    local css_url="https://fonts.googleapis.com/css2?family=${font_family}:wght@400;700;900&display=swap"
    local css_content=$(curl -s "$css_url")

    # Extract TTF URLs (for Latin characters, regular weight)
    local ttf_urls=$(echo "$css_content" | grep -oP 'https://[^)]+\.ttf' | head -1)

    if [ -z "$ttf_urls" ]; then
        echo "  ⚠️  Warning: Could not find TTF URL for $font_name"
        return
    fi

    # Download the TTF file
    local output_file="$FONTS_DIR/${font_name}.ttf"
    curl -s -L -o "$output_file" "$ttf_urls"

    if [ -f "$output_file" ]; then
        echo "  ✓ Downloaded: ${font_name}.ttf"
    else
        echo "  ✗ Failed to download $font_name"
    fi
}

# Download all required fonts
download_font "Montserrat" "Montserrat"
download_font "Pacifico" "Pacifico"
download_font "BebasNeue" "Bebas+Neue"
download_font "Bangers" "Bangers"
download_font "Comfortaa" "Comfortaa"
download_font "Orbitron" "Orbitron"

echo ""
echo "=== Font Download Complete ==="
echo ""
echo "Downloaded fonts:"
ls -lh "$FONTS_DIR"/*.ttf 2>/dev/null || echo "No fonts found!"
echo ""
echo "Total size: $(du -sh "$FONTS_DIR" | cut -f1)"
echo ""
echo "Fonts are ready for bundling!"
