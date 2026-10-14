import type { SubtitleFont } from '../types/subtitle';

export const FONT_FAMILIES: Record<SubtitleFont, string> = {
  montserrat: '"Montserrat", system-ui, -apple-system, sans-serif',
  pacifico: '"Pacifico", cursive',
  bebasneue: '"Bebas Neue", system-ui, sans-serif',
  bangers: '"Bangers", cursive',
  comfortaa: '"Comfortaa", cursive',
  orbitron: '"Orbitron", system-ui, sans-serif',
} as const;

export const FONT_DISPLAY_NAMES: Record<SubtitleFont, string> = {
  montserrat: 'Montserrat',
  pacifico: 'Pacifico',
  bebasneue: 'Bebas Neue',
  bangers: 'Bangers',
  comfortaa: 'Comfortaa',
  orbitron: 'Orbitron',
} as const;
