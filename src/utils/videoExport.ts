import type { SubtitleLine, SubtitleStyle } from '../types/subtitle';
import { FONT_FAMILIES } from '../constants/fonts';
import { applyImageTransition, calculateTransitionProgress } from './transitions';

interface ExportProgress {
  phase: 'loading' | 'rendering' | 'encoding' | 'complete';
  progress: number; // 0-100
  message: string;
}

/**
 * Export video with subtitles using Canvas + MediaRecorder
 * This ensures the export matches the preview exactly
 */
export async function exportVideoWithCanvas(
  videoUrl: string,
  subtitles: SubtitleLine[],
  style: SubtitleStyle,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    onProgress?.({ phase: 'loading', progress: 0, message: 'Loading video...' });

    // Create video element
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.muted = false; // We need audio

    video.onerror = () => reject(new Error('Failed to load video'));

    video.onloadedmetadata = async () => {
      try {
        const blob = await processVideo(video, subtitles, style, onProgress);
        resolve(blob);
      } catch (error) {
        reject(error);
      }
    };

    video.load();
  });
}

async function processVideo(
  video: HTMLVideoElement,
  subtitles: SubtitleLine[],
  style: SubtitleStyle,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  // Create canvas with exact video dimensions
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d', {
    alpha: false,
    desynchronized: true,
    willReadFrequently: false,
  });

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);

  // Pre-load all images
  onProgress?.({ phase: 'loading', progress: 10, message: 'Loading images...' });
  const imageCache = await loadAllImages(subtitles);

  // Set up audio context for capturing audio
  const audioContext = new AudioContext();
  const audioSource = audioContext.createMediaElementSource(video);
  const audioDestination = audioContext.createMediaStreamDestination();
  audioSource.connect(audioDestination);
  audioSource.connect(audioContext.destination); // Also play for monitoring

  // Create canvas stream
  const canvasStream = canvas.captureStream(30); // 30 fps
  const canvasVideoTrack = canvasStream.getVideoTracks()[0];

  // Combine video and audio streams
  const combinedStream = new MediaStream([
    canvasVideoTrack,
    ...audioDestination.stream.getAudioTracks(),
  ]);

  // Configure MediaRecorder
  const isHighRes = canvas.width * canvas.height > 1280 * 720;
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : 'video/webm;codecs=vp8,opus';

  const mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: isHighRes ? 5000000 : 3000000, // 5Mbps for high-res, 3Mbps otherwise
    audioBitsPerSecond: 128000,
  });

  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const recordingComplete = new Promise<Blob>((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };

    mediaRecorder.onerror = (event) => {
      reject(new Error(`MediaRecorder error: ${event}`));
    };
  });

  // Start recording
  mediaRecorder.start(1000); // Emit data every second

  onProgress?.({ phase: 'rendering', progress: 20, message: 'Rendering video...' });

  // Render frames
  await renderFrames(video, canvas, ctx, subtitles, style, imageCache, onProgress);

  onProgress?.({ phase: 'encoding', progress: 90, message: 'Finalizing export...' });

  // Stop recording
  mediaRecorder.stop();

  // Wait for final blob
  const blob = await recordingComplete;

  // Cleanup
  audioContext.close();
  canvasStream.getTracks().forEach((track) => track.stop());

  onProgress?.({ phase: 'complete', progress: 100, message: 'Export complete!' });

  return blob;
}

async function loadAllImages(subtitles: SubtitleLine[]): Promise<Record<string, HTMLImageElement>> {
  const imageCache: Record<string, HTMLImageElement> = {};
  const uniqueImages = new Set<string>();

  // Collect unique image paths
  subtitles.forEach((sub) => {
    if (sub.imagePath) {
      uniqueImages.add(sub.imagePath);
    }
  });

  // Load all images
  await Promise.all(
    Array.from(uniqueImages).map((imagePath) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          imageCache[imagePath] = img;
          resolve();
        };

        img.onerror = () => {
          console.error('Failed to load image:', imagePath);
          resolve(); // Don't fail the entire export
        };

        img.src = imagePath;
      });
    })
  );

  return imageCache;
}

async function renderFrames(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  subtitles: SubtitleLine[],
  style: SubtitleStyle,
  imageCache: Record<string, HTMLImageElement>,
  onProgress?: (progress: ExportProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = video.duration * 1000; // ms
    let lastProgressUpdate = 0;

    const drawFrame = () => {
      const currentTime = video.currentTime * 1000; // ms

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Find current subtitle
      const currentSubtitle = subtitles.find(
        (sub) => currentTime >= sub.start && currentTime <= sub.end
      );

      // Render subtitle if active
      if (currentSubtitle) {
        renderSubtitle(ctx, canvas, currentSubtitle, style, imageCache, currentTime);
      }

      // Update progress (every 500ms)
      if (currentTime - lastProgressUpdate > 500) {
        const progress = 20 + ((currentTime / duration) * 70); // 20-90%
        onProgress?.({
          phase: 'rendering',
          progress,
          message: `Rendering: ${Math.floor((currentTime / duration) * 100)}%`,
        });
        lastProgressUpdate = currentTime;
      }

      // Continue rendering
      if (!video.ended && !video.paused) {
        requestAnimationFrame(drawFrame);
      } else if (video.ended) {
        resolve();
      }
    };

    video.onended = () => {
      // Draw final frame
      drawFrame();
    };

    video.onerror = () => {
      reject(new Error('Video playback error during export'));
    };

    // Start playback and rendering
    video.play().then(() => {
      requestAnimationFrame(drawFrame);
    }).catch(reject);
  });
}

function renderSubtitle(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  subtitle: SubtitleLine,
  style: SubtitleStyle,
  imageCache: Record<string, HTMLImageElement>,
  currentTime: number
) {
  const text = subtitle.text;

  // Dynamic size multipliers based on style
  const sizeMultipliers = {
    small: 0.8,
    medium: 1.0,
    large: 1.5,
  };

  // Calculate font size based on text size setting (matches SubtitleOverlay.tsx)
  const baseFontSize = Math.floor(canvas.width * 0.045); // 4.5% of width
  const fontSize = Math.floor(baseFontSize * sizeMultipliers[style.textSize]);
  const lineHeight = fontSize * 1.2;
  const maxWidth = canvas.width * 0.85; // 85% of width for text
  const padding = fontSize * 0.5;

  // Apply font and styling
  ctx.font = `bold ${fontSize}px ${FONT_FAMILIES[style.font]}`;
  ctx.fillStyle = style.colors.text;
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

  // Calculate image size based on style setting (matches SubtitleOverlay.tsx)
  const isVertical = canvas.height > canvas.width;
  const baseSize = isVertical ? canvas.width : Math.min(canvas.width, canvas.height);

  const imageSizeScales = isVertical
    ? { small: 0.15, medium: 0.25, large: 0.32 }
    : { small: 0.1, medium: 0.15, large: 0.3 };

  const imageSize = baseSize * imageSizeScales[style.imageSize];
  const imageSpacing = fontSize * 0.5;

  // Check if we have an image to render
  const imagePath = subtitle.imagePath;
  const hasImage = imagePath && imageCache[imagePath];
  const image = hasImage && imagePath ? imageCache[imagePath] : null;

  // Calculate positions based on alignment (matches SubtitleOverlay.tsx)
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

  // Draw image if available (with transition)
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

    // Center-crop image to square
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

  // Draw text with background
  let y = textY;

  lines.forEach((line, index) => {
    const lineY = y + (index * lineHeight);
    const metrics = ctx.measureText(line);
    const lineWidth = metrics.width;

    // Draw background based on style
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

    // Draw text
    ctx.fillStyle = style.colors.text;
    ctx.fillText(line, x, lineY);
  });
}
