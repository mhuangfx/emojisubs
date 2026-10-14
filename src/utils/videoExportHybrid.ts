import type { SubtitleLine, SubtitleStyle } from '../types/subtitle';
import { FONT_FAMILIES } from '../constants/fonts';
import { applyImageTransition, calculateTransitionProgress } from './transitions';
import { invoke } from '@tauri-apps/api/core';

interface ExportProgress {
  phase: 'loading' | 'rendering' | 'encoding' | 'complete';
  progress: number; // 0-100
  message: string;
  currentFrame?: number;
  totalFrames?: number;
}

interface FrameData {
  width: number;
  height: number;
  data: number[]; // RGB24 data
}

/**
 * Export video using Canvas for rendering and FFmpeg for encoding
 * This ensures the export matches the preview exactly while using reliable encoding
 */
export async function exportVideoWithCanvasFFmpeg(
  videoUrl: string,
  subtitles: SubtitleLine[],
  style: SubtitleStyle,
  outputPath: string,
  onProgress?: (progress: ExportProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Export cancelled');
  }
  onProgress?.({ phase: 'loading', progress: 0, message: 'Loading video...' });

  // Create video element
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.src = videoUrl;
  video.muted = true; // We'll handle audio separately

  await new Promise<void>((resolve, reject) => {
    video.onerror = () => reject(new Error('Failed to load video'));
    video.onloadedmetadata = () => resolve();
    video.load();
  });

  // Get video properties
  let width = video.videoWidth;
  let height = video.videoHeight;
  const duration = video.duration;
  const fps = 24; // Use 24fps (cinema standard) instead of 30fps for faster export

  // Limit max resolution to 2K (2560x1440) to prevent freezing
  const MAX_WIDTH = 2560;
  const MAX_HEIGHT = 1440;
  const MAX_PIXELS = MAX_WIDTH * MAX_HEIGHT;

  const currentPixels = width * height;
  let scaleFactor = 1;

  if (currentPixels > MAX_PIXELS) {
    scaleFactor = Math.sqrt(MAX_PIXELS / currentPixels);
    const newWidth = Math.floor(width * scaleFactor);
    const newHeight = Math.floor(height * scaleFactor);

    console.log(`Scaling video from ${width}x${height} to ${newWidth}x${newHeight} (scale: ${scaleFactor.toFixed(2)})`);

    width = newWidth;
    height = newHeight;
  }

  console.log(`Export dimensions: ${width}x${height}, ${duration}s, ${fps}fps`);

  // Create canvas with scaled dimensions
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', {
    alpha: false,
    willReadFrequently: true, // We'll be reading pixels
  });

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Pre-load all images
  onProgress?.({ phase: 'loading', progress: 10, message: 'Loading images...' });
  const imageCache = await loadAllImages(subtitles);

  // Start FFmpeg encoding session
  onProgress?.({ phase: 'rendering', progress: 20, message: 'Starting encoder...' });

  await invoke('start_video_encoding', {
    outputPath,
    width,
    height,
    fps,
    duration,
  });

  // Render and send frames
  try {
    await renderAndSendFrames(
      video,
      canvas,
      ctx,
      subtitles,
      style,
      imageCache,
      fps,
      duration,
      onProgress,
      signal
    );

    // Check for cancellation before finalizing
    if (signal?.aborted) {
      throw new Error('Export cancelled');
    }

    // Finalize encoding
    onProgress?.({ phase: 'encoding', progress: 90, message: 'Finalizing video...' });
    await invoke('finish_video_encoding');

    onProgress?.({ phase: 'complete', progress: 100, message: 'Export complete!' });
  } catch (error) {
    // Clean up on error or cancellation
    await invoke('cancel_video_encoding').catch(() => {});
    throw error;
  }
}

async function loadAllImages(subtitles: SubtitleLine[]): Promise<Record<string, HTMLImageElement>> {
  const imageCache: Record<string, HTMLImageElement> = {};
  const uniqueImages = new Set<string>();

  subtitles.forEach((sub) => {
    if (sub.imagePath) {
      uniqueImages.add(sub.imagePath);
    }
  });

  await Promise.all(
    Array.from(uniqueImages).map((imagePath) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          imageCache[imagePath] = img;
          resolve();
        };

        img.onerror = () => {
          console.error('Failed to load image:', imagePath);
          resolve();
        };

        img.src = imagePath;
      });
    })
  );

  return imageCache;
}

async function renderAndSendFrames(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  subtitles: SubtitleLine[],
  style: SubtitleStyle,
  imageCache: Record<string, HTMLImageElement>,
  fps: number,
  duration: number,
  onProgress?: (progress: ExportProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const frameInterval = 1 / fps;

  // Build timeline of when subtitles are active
  const subtitleTimeline = buildSubtitleTimeline(subtitles, duration * 1000);

  // Calculate frames to render (only during subtitle segments + padding)
  const framesToRender = calculateFramesToRender(subtitleTimeline, duration, fps);
  const totalFrames = framesToRender.length;
  let frameCount = 0;

  console.log(`Optimized rendering: ${totalFrames} frames (skipping ${Math.ceil(duration * fps) - totalFrames} frames without subtitles)`);

  for (const time of framesToRender) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Export cancelled');
    }

    // Seek to frame time and wait for it to complete
    const seekPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Seek timeout at ${time.toFixed(2)}s`));
      }, 5000);

      const onSeeked = () => {
        clearTimeout(timeout);
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };

      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });

    await seekPromise;

    // Render frame
    const currentTime = time * 1000; // Convert to ms

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Find and render current subtitle
    const currentSubtitle = subtitles.find(
      (sub) => currentTime >= sub.start && currentTime <= sub.end
    );

    if (currentSubtitle) {
      renderSubtitle(ctx, canvas, currentSubtitle, style, imageCache, currentTime);
    }

    // Get frame data as RGB24
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgbData = extractRGB24(imageData);

    // Send frame to backend (use Uint8Array directly - much faster than Array.from)
    await invoke('add_video_frame', {
      frameData: rgbData,
    });

    frameCount++;

    // Update progress and yield to event loop more frequently
    if (frameCount % 10 === 0) {
      const progress = 20 + ((frameCount / totalFrames) * 70);
      onProgress?.({
        phase: 'rendering',
        progress,
        message: `Rendering frames...`,
        currentFrame: frameCount,
        totalFrames,
      });

      // Yield to event loop to keep UI responsive
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Log progress
    if (frameCount % 30 === 0) {
      console.log(`Rendered ${frameCount}/${totalFrames} frames`);
    }
  }

  console.log(`Frame rendering complete: ${frameCount} frames`);
}

/**
 * Build timeline of subtitle activity (start/end times)
 */
function buildSubtitleTimeline(subtitles: SubtitleLine[], durationMs: number): Array<{ start: number; end: number }> {
  if (subtitles.length === 0) {
    // No subtitles - still need to export video, so return full duration
    return [{ start: 0, end: durationMs }];
  }

  // Merge overlapping/adjacent subtitle segments
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];

  let current = { start: sorted[0].start, end: sorted[0].end };

  for (let i = 1; i < sorted.length; i++) {
    const sub = sorted[i];

    // If overlapping or adjacent (within 100ms), merge
    if (sub.start <= current.end + 100) {
      current.end = Math.max(current.end, sub.end);
    } else {
      merged.push(current);
      current = { start: sub.start, end: sub.end };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Calculate which frames need rendering based on subtitle timeline
 * Only render frames during subtitle segments + small padding
 */
function calculateFramesToRender(
  timeline: Array<{ start: number; end: number }>,
  durationSec: number,
  fps: number
): number[] {
  const frameInterval = 1 / fps;
  const frames: number[] = [];
  const PADDING_SEC = 0.5; // Add 0.5s padding before/after subtitles

  for (const segment of timeline) {
    const startSec = Math.max(0, (segment.start / 1000) - PADDING_SEC);
    const endSec = Math.min(durationSec, (segment.end / 1000) + PADDING_SEC);

    // Generate frame times for this segment
    for (let time = startSec; time < endSec; time += frameInterval) {
      frames.push(time);
    }
  }

  // Always include first and last frame
  if (frames.length === 0 || frames[0] > 0) {
    frames.unshift(0);
  }
  if (frames[frames.length - 1] < durationSec - frameInterval) {
    frames.push(durationSec - frameInterval);
  }

  return frames;
}

function extractRGB24(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const rgb = new Uint8Array(width * height * 3);

  for (let i = 0; i < data.length; i += 4) {
    const j = (i / 4) * 3;
    rgb[j] = data[i];       // R
    rgb[j + 1] = data[i + 1]; // G
    rgb[j + 2] = data[i + 2]; // B
    // Skip alpha (data[i + 3])
  }

  return rgb;
}

function renderSubtitle(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  subtitle: SubtitleLine,
  style: SubtitleStyle,
  imageCache: Record<string, HTMLImageElement>,
  currentTime: number
) {
  // This is identical to SubtitleOverlay.tsx rendering
  const text = subtitle.text;

  const sizeMultipliers = {
    small: 0.8,
    medium: 1.0,
    large: 1.5,
  };

  const baseFontSize = Math.floor(canvas.width * 0.045);
  const fontSize = Math.floor(baseFontSize * sizeMultipliers[style.textSize]);
  const lineHeight = fontSize * 1.2;
  const maxWidth = canvas.width * 0.85;
  const padding = fontSize * 0.5;

  ctx.font = `bold ${fontSize}px ${FONT_FAMILIES[style.font]}`;
  ctx.fillStyle = style.colors.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

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

  const isVertical = canvas.height > canvas.width;
  const baseSize = isVertical ? canvas.width : Math.min(canvas.width, canvas.height);

  const imageSizeScales = isVertical
    ? { small: 0.15, medium: 0.25, large: 0.32 }
    : { small: 0.1, medium: 0.15, large: 0.3 };

  const imageSize = baseSize * imageSizeScales[style.imageSize];
  const imageSpacing = fontSize * 0.5;

  const imagePath = subtitle.imagePath;
  const hasImage = imagePath && imageCache[imagePath];
  const image = hasImage && imagePath ? imageCache[imagePath] : null;

  const x = canvas.width / 2;
  const totalTextHeight = lines.length * lineHeight;
  const totalHeight = totalTextHeight + (hasImage ? imageSize + imageSpacing : 0);

  let textY: number;
  let imageY: number;

  switch (style.alignment) {
    case 'top':
      const topMargin = canvas.height * 0.05;
      textY = topMargin + lineHeight / 2;
      const textBottom = textY + totalTextHeight - lineHeight / 2;
      imageY = textBottom + imageSpacing + imageSize / 2;
      break;
    case 'center':
      textY = canvas.height / 2 - totalTextHeight / 2 + lineHeight + (hasImage ? (imageSize + imageSpacing) / 2 : 0);
      imageY = canvas.height / 2 - totalHeight / 2 + imageSize / 2;
      break;
    case 'bottom':
    default:
      const bottomMargin = canvas.height * 0.1;
      textY = canvas.height - bottomMargin - totalTextHeight + lineHeight;
      imageY = textY - lineHeight - imageSpacing - imageSize / 2;
      break;
  }

  // Draw image
  if (image && hasImage) {
    const progress = calculateTransitionProgress(currentTime, subtitle.start);

    const transition = applyImageTransition(
      ctx,
      x - imageSize / 2,
      imageY - imageSize / 2,
      imageSize,
      style.imageTransition,
      { progress }
    );

    ctx.globalAlpha = transition.alpha;

    const sourceSize = Math.min(image.width, image.height);
    const sourceX = (image.width - sourceSize) / 2;
    const sourceY = (image.height - sourceSize) / 2;

    ctx.drawImage(
      image,
      sourceX, sourceY, sourceSize, sourceSize,
      transition.x, transition.y,
      transition.size, transition.size
    );

    ctx.globalAlpha = 1;
    ctx.filter = 'none';

    if (style.imageTransition === 'rotate') {
      ctx.restore();
    }
  }

  // Draw text
  let y = textY;

  lines.forEach((line, index) => {
    const lineY = y + (index * lineHeight);
    const metrics = ctx.measureText(line);
    const lineWidth = metrics.width;

    if (style.background === 'box') {
      const bgPadding = padding;
      const bgX = x - lineWidth / 2 - bgPadding;
      const bgY = lineY - fontSize / 2 - bgPadding / 2;
      const bgWidth = lineWidth + bgPadding * 2;
      const bgHeight = fontSize + bgPadding;

      ctx.fillStyle = style.colors.background;
      ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
    } else if (style.background === 'outline') {
      ctx.strokeStyle = style.colors.background;
      ctx.lineWidth = Math.max(2, fontSize * 0.08);
      ctx.lineJoin = 'round';
      ctx.strokeText(line, x, lineY);
    }

    ctx.fillStyle = style.colors.text;
    ctx.fillText(line, x, lineY);
  });
}
