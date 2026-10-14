export interface Word {
  text: string;
  start: number;  // milliseconds
  end: number;    // milliseconds
  confidence?: number;
}

export interface SubtitleLine {
  id: string;
  text: string;
  start: number;  // milliseconds
  end: number;    // milliseconds
  words: Word[];
  imagePath?: string;  // Optional path to custom image/emoji
}

export type SubtitleFont = 'montserrat' | 'pacifico' | 'bebasneue' | 'bangers' | 'comfortaa' | 'orbitron';
export type SubtitleAlignment = 'top' | 'center' | 'bottom';
export type SubtitleBackground = 'box' | 'outline' | 'shadow' | 'none';
export type SubtitleSize = 'small' | 'medium' | 'large';
export type ImageTransition =
  | 'none'
  | 'fade'
  | 'slideUp'
  | 'slideDown'
  | 'scaleUp'
  | 'scaleDown'
  | 'blur'
  | 'pulse'
  | 'rotate'
  | 'bounce';

export interface SubtitleStyle {
  alignment: SubtitleAlignment;
  imageSize: SubtitleSize;
  textSize: SubtitleSize;
  font: SubtitleFont;
  background: SubtitleBackground;
  colors: {
    background: string;
    text: string;
  };
  imageTransition: ImageTransition;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  alignment: 'bottom',
  imageSize: 'medium',
  textSize: 'medium',
  font: 'montserrat',
  background: 'box',
  colors: {
    background: '#000000',
    text: '#FFFFFF',
  },
  imageTransition: 'none',
};
