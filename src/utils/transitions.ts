import type { ImageTransition } from '../types/subtitle';

interface TransitionState {
  progress: number; // 0.0 to 1.0
}

/**
 * Apply transition effect to image rendering
 * Modifies canvas context state and returns adjusted position/size
 */
export function applyImageTransition(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  transition: ImageTransition,
  state: TransitionState
): { x: number; y: number; size: number; alpha: number } {
  const { progress } = state;
  const easeProgress = easeOutCubic(progress);

  let adjustedX = x;
  let adjustedY = y;
  let adjustedSize = size;
  let alpha = 1;

  switch (transition) {
    case 'fade':
      alpha = easeProgress;
      break;

    case 'slideUp':
      // Slide up from below (reduced from 30 to 20 pixels for snappier movement)
      adjustedY = y + (20 * (1 - easeProgress));
      alpha = easeProgress;
      break;

    case 'slideDown':
      // Slide down from above
      adjustedY = y - (20 * (1 - easeProgress));
      alpha = easeProgress;
      break;

    case 'scaleUp':
      // Pop in - starts at 60% size, grows to 100%
      const scaleUpFactor = 0.6 + (0.4 * easeProgress);
      adjustedSize = size * scaleUpFactor;
      // Center the scaling
      adjustedX = x + (size - adjustedSize) / 2;
      adjustedY = y + (size - adjustedSize) / 2;
      alpha = easeProgress;
      break;

    case 'scaleDown':
      // Zoom in - starts at 140% size, shrinks to 100%
      const scaleDownFactor = 1.4 - (0.4 * easeProgress);
      adjustedSize = size * scaleDownFactor;
      // Center the scaling
      adjustedX = x + (size - adjustedSize) / 2;
      adjustedY = y + (size - adjustedSize) / 2;
      alpha = easeProgress;
      break;

    case 'blur':
      // Start blurred, become sharp
      const blurAmount = (1 - easeProgress) * 8;
      ctx.filter = `blur(${blurAmount}px)`;
      alpha = Math.min(1, easeProgress * 1.5); // Fade in slightly faster
      break;

    case 'pulse':
      // Continuous pulsing effect (slower and subtler)
      const pulseScale = 1 + Math.sin(progress * Math.PI * 4) * 0.05;
      adjustedSize = size * pulseScale;
      adjustedX = x + (size - adjustedSize) / 2;
      adjustedY = y + (size - adjustedSize) / 2;
      break;

    case 'rotate':
      // Rotate from 180° to 0° while fading in
      const rotation = (1 - easeProgress) * Math.PI;
      ctx.save();
      ctx.translate(x + size / 2, y + size / 2);
      ctx.rotate(rotation);
      ctx.translate(-(x + size / 2), -(y + size / 2));
      alpha = easeProgress;
      // Note: caller needs to ctx.restore() after drawing
      break;

    case 'bounce':
      // Elastic bounce effect
      const bounce = easeBounce(progress);
      adjustedY = y - (bounce * 15); // Bounce up by max 15 pixels
      alpha = Math.min(1, progress * 2); // Fade in quickly
      break;

    case 'none':
    default:
      // No transition
      break;
  }

  return { x: adjustedX, y: adjustedY, size: adjustedSize, alpha };
}

/**
 * Easing function for smooth transitions
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Bounce easing function
 */
function easeBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

/**
 * Calculate transition progress based on subtitle timing
 */
export function calculateTransitionProgress(
  currentTime: number,
  subtitleStart: number,
  transitionDuration: number = 300 // milliseconds
): number {
  const elapsed = currentTime - subtitleStart;
  if (elapsed < 0) return 0;
  if (elapsed >= transitionDuration) return 1;
  return elapsed / transitionDuration;
}
