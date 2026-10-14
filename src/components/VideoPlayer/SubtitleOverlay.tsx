import { useEffect, useRef, useState } from 'react';
import type { SubtitleLine, SubtitleStyle } from '../../types/subtitle';
import { FONT_FAMILIES } from '../../constants/fonts';
import { SUBTITLE_STYLES } from '../../constants/styles';
import { applyImageTransition, calculateTransitionProgress } from '../../utils/transitions';

interface SubtitleOverlayProps {
  currentSubtitle: SubtitleLine | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoWidth: number;
  videoHeight: number;
  subtitleStyle: SubtitleStyle;
}

export function SubtitleOverlay({ currentSubtitle, videoRef, videoWidth, videoHeight, subtitleStyle }: SubtitleOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageCache, setImageCache] = useState<{ [key: string]: HTMLImageElement }>({});
  const [currentTime, setCurrentTime] = useState(0);
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Load images for subtitles - reloads when currentSubtitle changes
  useEffect(() => {
    if (!currentSubtitle?.imagePath) return;

    const imagePath = currentSubtitle.imagePath;

    // Check if already cached (use prev state to avoid dependency)
    setImageCache(prev => {
      if (prev[imagePath]) return prev; // Already cached, no change

      // Load new image
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        setImageCache(current => ({ ...current, [imagePath]: img }));
      };

      img.onerror = () => {
        console.error('Failed to load subtitle image:', imagePath);
      };

      img.src = imagePath;

      return prev; // Return unchanged while loading
    });
  }, [currentSubtitle]);

  // Set canvas dimensions to match video dimensions (not container)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || videoWidth === 0 || videoHeight === 0) return;

    // Use actual video dimensions, not displayed size
    canvas.width = videoWidth;
    canvas.height = videoHeight;
  }, [videoWidth, videoHeight]);

  // Track video time for smooth transitions
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateFrame = () => {
      setCurrentTime(video.currentTime * 1000); // Convert to milliseconds
      animationFrameRef.current = requestAnimationFrame(updateFrame);
    };

    animationFrameRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoRef]);

  // Render subtitle on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || videoWidth === 0 || videoHeight === 0) return;

    const ctx = canvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
      willReadFrequently: false, // Performance optimization
    });

    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If no subtitle, nothing to render
    if (!currentSubtitle) return;

    const text = currentSubtitle.text;

    // Dynamic size multipliers based on style
    const sizeMultipliers = {
      small: 0.8,
      medium: 1.0,
      large: 1.5,
    };

    // Calculate font size based on text size setting
    const baseFontSize = Math.floor(canvas.width * 0.045); // 4.5% of width
    const fontSize = Math.floor(baseFontSize * sizeMultipliers[subtitleStyle.textSize]);
    const lineHeight = fontSize * 1.2;
    const maxWidth = canvas.width * 0.85; // 85% of width for text
    const padding = fontSize * 0.5;

    // Apply font and styling
    ctx.font = `bold ${fontSize}px ${FONT_FAMILIES[subtitleStyle.font]}`;
    ctx.fillStyle = subtitleStyle.colors.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text wrapping helper function
    const wrapText = (text: string, maxWidth: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = words[0] || '';

      for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);
      return lines;
    };

    const lines = wrapText(text, maxWidth);

    // Calculate image size based on style setting
    const isVertical = canvas.height > canvas.width;
    const baseSize = isVertical ? canvas.width : Math.min(canvas.width, canvas.height);

    const imageSizeScales = isVertical
      ? { small: 0.15, medium: 0.25, large: 0.32 }
      : { small: 0.1, medium: 0.15, large: 0.3 };

    const imageSize = baseSize * imageSizeScales[subtitleStyle.imageSize];
    const imageSpacing = fontSize * 0.5;

    // Check if we have an image to render
    const imagePath = currentSubtitle.imagePath;
    const hasImage = imagePath && imageCache[imagePath];
    const image = hasImage && imagePath ? imageCache[imagePath] : null;

    // Calculate positions based on alignment
    const x = canvas.width / 2;
    const totalTextHeight = lines.length * lineHeight;
    const totalHeight = totalTextHeight + (hasImage ? imageSize + imageSpacing : 0);

    let textY: number;
    let imageY: number;

    switch (subtitleStyle.alignment) {
      case 'top':
        // Text at top, image BELOW it (user preference)
        // Use smaller margin for top (5% instead of 10% for better positioning)
        const topMargin = canvas.height * 0.05;
        textY = topMargin + lineHeight / 2; // Center of first line
        // Image should be below text with proper spacing
        // Text bottom = textY + (lines.length - 1) * lineHeight + lineHeight/2
        // Simplified: textY + totalTextHeight - lineHeight/2
        const textBottom = textY + totalTextHeight - lineHeight / 2;
        imageY = textBottom + imageSpacing + imageSize / 2;
        break;
      case 'center':
        // Center the entire content block (image + text)
        textY = canvas.height / 2 - totalTextHeight / 2 + lineHeight + (hasImage ? (imageSize + imageSpacing) / 2 : 0);
        imageY = canvas.height / 2 - totalHeight / 2 + imageSize / 2;
        break;
      case 'bottom':
      default:
        // Keep text at fixed position from bottom, image above it
        const bottomMargin = canvas.height * 0.1;
        textY = canvas.height - bottomMargin - totalTextHeight + lineHeight;
        imageY = textY - lineHeight - imageSpacing - imageSize / 2;
        break;
    }

    // Draw image if available (above text) with transition
    if (image && hasImage) {
      // Calculate transition progress
      const progress = calculateTransitionProgress(
        currentTime,
        currentSubtitle.start
      );

      // Apply transition effect
      const transition = applyImageTransition(
        ctx,
        x - imageSize / 2,
        imageY - imageSize / 2,
        imageSize,
        subtitleStyle.imageTransition,
        { progress }
      );

      // Apply alpha for fade effects
      ctx.globalAlpha = transition.alpha;

      // Center-crop image to square
      const sourceSize = Math.min(image.width, image.height);
      const sourceX = (image.width - sourceSize) / 2;
      const sourceY = (image.height - sourceSize) / 2;

      // Draw image with transition-adjusted position and size
      ctx.drawImage(
        image,
        sourceX, sourceY, sourceSize, sourceSize,  // Source (cropped to square)
        transition.x, transition.y,  // Destination (with transition offset)
        transition.size, transition.size
      );

      // Reset alpha and filter
      ctx.globalAlpha = 1;
      ctx.filter = 'none';

      // Restore context if rotation was applied
      if (subtitleStyle.imageTransition === 'rotate') {
        ctx.restore();
      }
    }

    // Adjust text Y position
    let y = textY;

    // Draw background and text for each line
    lines.forEach((line, index) => {
      const lineY = y + (index * lineHeight);
      const metrics = ctx.measureText(line);
      const lineWidth = metrics.width;

      // Render background based on style
      if (subtitleStyle.background === 'box') {
        // Box background (square corners to match export)
        const boxX = x - lineWidth / 2 - padding;
        const boxY = lineY - lineHeight / 2;
        const boxWidth = lineWidth + padding * 2;
        const boxHeight = lineHeight;

        ctx.fillStyle = subtitleStyle.colors.background + SUBTITLE_STYLES.boxOpacity;
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      } else if (subtitleStyle.background === 'outline') {
        // Text outline
        ctx.strokeStyle = subtitleStyle.colors.background;
        ctx.lineWidth = fontSize * 0.15;
        ctx.strokeText(line, x, lineY);
      } else if (subtitleStyle.background === 'shadow') {
        // Drop shadow
        ctx.shadowColor = subtitleStyle.colors.background;
        ctx.shadowBlur = fontSize * 0.2;
        ctx.shadowOffsetX = fontSize * 0.05;
        ctx.shadowOffsetY = fontSize * 0.05;
      }
      // 'none' = no background

      // Draw text
      ctx.fillStyle = subtitleStyle.colors.text;
      ctx.fillText(line, x, lineY);

      // Reset shadow
      if (subtitleStyle.background === 'shadow') {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    });

  }, [currentSubtitle, imageCache, videoWidth, videoHeight, subtitleStyle, currentTime]);

  const isVertical = videoHeight > videoWidth;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-contain"
      style={{
        maxWidth: isVertical ? 'auto' : '100%',
        maxHeight: isVertical ? '100%' : 'auto'
      }}
    />
  );
}
