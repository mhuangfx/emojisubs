import { X, Check } from 'lucide-react';
import { useState } from 'react';
import type { SubtitleStyle, SubtitleFont, SubtitleBackground, ImageTransition } from '../../types/subtitle';
import { FONT_DISPLAY_NAMES, FONT_FAMILIES } from '../../constants/fonts';
import { STYLE_PRESETS } from '../../constants/presets';

interface SubtitleStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStyle: SubtitleStyle;
  onApply: (style: SubtitleStyle) => void;
}

export function SubtitleStyleModal({ isOpen, onClose, currentStyle, onApply }: SubtitleStyleModalProps) {
  const [style, setStyle] = useState<SubtitleStyle>(currentStyle);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(style);
    onClose();
  };

  const handlePresetClick = (presetName: string) => {
    setStyle(STYLE_PRESETS[presetName]);
  };

  const fonts: SubtitleFont[] = ['montserrat', 'pacifico', 'bebasneue', 'bangers', 'comfortaa', 'orbitron'];
  const backgrounds: SubtitleBackground[] = ['box', 'outline', 'shadow', 'none'];
  const transitions: ImageTransition[] = ['none', 'fade', 'slideUp', 'slideDown', 'scaleUp', 'scaleDown', 'blur', 'pulse', 'rotate', 'bounce'];

  const transitionDisplayNames: Record<ImageTransition, string> = {
    none: 'None',
    fade: 'Fade In',
    slideUp: 'Slide Up',
    slideDown: 'Slide Down',
    scaleUp: 'Scale Up',
    scaleDown: 'Scale Down',
    blur: 'Blur In',
    pulse: 'Pulse',
    rotate: 'Rotate',
    bounce: 'Bounce',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Subtitle Styles</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
            >
              <Check className="w-5 h-5" />
              Apply
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Presets */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Presets</h3>
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => handlePresetClick('tiktok')}
                className="px-4 py-3 rounded-lg hover:opacity-80 transition-all font-bold shadow-md"
                style={{
                  fontFamily: FONT_FAMILIES.montserrat,
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                }}
              >
                TikTok
              </button>
              <button
                onClick={() => handlePresetClick('minimal')}
                className="px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all font-bold"
                style={{
                  fontFamily: FONT_FAMILIES.bebasneue,
                  color: '#333333',
                }}
              >
                Minimal
              </button>
              <button
                onClick={() => handlePresetClick('aesthetic')}
                className="px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all font-bold"
                style={{
                  fontFamily: FONT_FAMILIES.comfortaa,
                  color: '#FFE4E1',
                  textShadow: '0 4px 8px #000000', // Visible shadow effect
                }}
              >
                Aesthetic
              </button>
              <button
                onClick={() => handlePresetClick('bold')}
                className="px-4 py-3 rounded-lg hover:opacity-80 transition-all font-bold shadow-md"
                style={{
                  fontFamily: FONT_FAMILIES.bangers,
                  backgroundColor: '#FF0000',
                  color: '#FFFFFF',
                }}
              >
                Bold
              </button>
            </div>
          </div>

          {/* Font Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Font</h3>
            <div className="grid grid-cols-6 gap-3">
              {fonts.map((font) => (
                <button
                  key={font}
                  onClick={() => setStyle({ ...style, font })}
                  className={`px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                    style.font === font
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                  style={{ fontFamily: FONT_FAMILIES[font] }}
                >
                  {FONT_DISPLAY_NAMES[font]}
                </button>
              ))}
            </div>
          </div>

          {/* Background Style */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Background Style</h3>
            <div className="grid grid-cols-4 gap-3">
              {backgrounds.map((bg) => (
                <button
                  key={bg}
                  onClick={() => setStyle({ ...style, background: bg })}
                  className={`px-4 py-3 rounded-lg border-2 transition-all font-medium capitalize ${
                    style.background === bg
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>

          {/* Image Transition */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Image Transition</h3>
            <div className="grid grid-cols-10 gap-3">
              {transitions.map((transition) => (
                <button
                  key={transition}
                  onClick={() => setStyle({ ...style, imageTransition: transition })}
                  className={`px-3 py-2 rounded-lg border-2 transition-all font-medium text-sm ${
                    style.imageTransition === transition
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {transitionDisplayNames[transition]}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Colors</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Text Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Text Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={style.colors.text}
                    onChange={(e) =>
                      setStyle({
                        ...style,
                        colors: { ...style.colors, text: e.target.value },
                      })
                    }
                    className="w-16 h-12 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={style.colors.text}
                    onChange={(e) =>
                      setStyle({
                        ...style,
                        colors: { ...style.colors, text: e.target.value },
                      })
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>

              {/* Background Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Background Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={style.colors.background}
                    onChange={(e) =>
                      setStyle({
                        ...style,
                        colors: { ...style.colors, background: e.target.value },
                      })
                    }
                    className="w-16 h-12 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={style.colors.background}
                    onChange={(e) =>
                      setStyle({
                        ...style,
                        colors: { ...style.colors, background: e.target.value },
                      })
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Preview</h3>
            <div className="bg-gray-200 rounded-lg p-8 flex items-center justify-center min-h-[200px]">
              <div className="text-center">
                <div
                  className="inline-block px-6 py-3 rounded-lg"
                  style={{
                    fontFamily: FONT_FAMILIES[style.font],
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: style.colors.text,
                    backgroundColor:
                      style.background === 'box'
                        ? style.colors.background + 'CC'
                        : 'transparent',
                    textShadow:
                      style.background === 'shadow'
                        ? `0 2px 4px ${style.colors.background}`
                        : '0 0 0 transparent',
                    WebkitTextStroke:
                      style.background === 'outline'
                        ? `2px ${style.colors.background}`
                        : '0px transparent',
                  }}
                >
                  Sample Subtitle Text
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
