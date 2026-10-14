import type { SubtitleStyle } from '../types/subtitle';

export const STYLE_PRESETS: Record<string, SubtitleStyle> = {
  tiktok: {
    alignment: 'bottom',
    imageSize: 'medium',
    textSize: 'medium',
    font: 'montserrat',
    background: 'box',
    colors: {
      background: '#000000',
      text: '#FFFFFF',
    },
    imageTransition: 'scaleUp',
  },
  minimal: {
    alignment: 'bottom',
    imageSize: 'small',
    textSize: 'small',
    font: 'bebasneue',
    background: 'none',
    colors: {
      background: '#000000',
      text: '#FFFFFF',
    },
    imageTransition: 'fade',
  },
  aesthetic: {
    alignment: 'bottom',
    imageSize: 'medium',
    textSize: 'medium',
    font: 'comfortaa',
    background: 'shadow',
    colors: {
      background: '#000000',
      text: '#FFE4E1', // Misty Rose - soft pink
    },
    imageTransition: 'blur',
  },
  bold: {
    alignment: 'center',
    imageSize: 'large',
    textSize: 'large',
    font: 'bangers',
    background: 'box',
    colors: {
      background: '#FF0000',
      text: '#FFFFFF',
    },
    imageTransition: 'bounce',
  },
} as const;
