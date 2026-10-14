# EmojiSubs Bundled Fonts

This directory contains bundled fonts for the EmojiSubs application to ensure consistent rendering between preview and export.

## Included Fonts

All fonts are from Google Fonts and licensed under the Open Font License (OFL):

- **Montserrat** - Modern sans-serif, default font
- **Pacifico** - Casual script font
- **Bebas Neue** - Condensed display font
- **Bangers** - Comic style display font
- **Comfortaa** - Rounded geometric sans-serif
- **Orbitron** - Futuristic geometric sans-serif

## Setup

To download all fonts, run:

```bash
bash scripts/download_fonts.sh
```

This will:
1. Download the latest versions of all fonts from Google Fonts
2. Place them in this directory
3. Create the fontconfig configuration

## How It Works

- `fonts.conf` - Fontconfig configuration that tells FFmpeg where to find our fonts
- `*.ttf` - TrueType font files downloaded from Google Fonts
- During export, FFmpeg uses the `FONTCONFIG_FILE` environment variable to load our bundled fonts

## License

All fonts are licensed under the [SIL Open Font License](https://scripts.sil.org/OFL):

- ✅ Free for commercial use
- ✅ Can be bundled with software
- ✅ Can be redistributed
- ✅ Can be modified

## File Sizes

Total: ~700KB for all 6 fonts
