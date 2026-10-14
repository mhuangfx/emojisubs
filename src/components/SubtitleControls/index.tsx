import { ArrowUp, ArrowDown, ArrowDownUp, Type, Image as ImageIcon } from 'lucide-react';
import type { SubtitleStyle, SubtitleAlignment, SubtitleSize } from '../../types/subtitle';

interface SubtitleControlsProps {
  style: SubtitleStyle;
  onStyleChange: (style: SubtitleStyle) => void;
  onStylesClick?: () => void;
}

export function SubtitleControls({ style, onStyleChange, onStylesClick }: SubtitleControlsProps) {
  const handleAlignmentChange = (alignment: SubtitleAlignment) => {
    onStyleChange({ ...style, alignment });
  };

  const handleTextSizeChange = (textSize: SubtitleSize) => {
    onStyleChange({ ...style, textSize });
  };

  const handleImageSizeChange = (imageSize: SubtitleSize) => {
    onStyleChange({ ...style, imageSize });
  };

  return (
    <div className="bg-gray-750 rounded-lg p-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Alignment Controls */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-gray-300 mr-2">Position:</span>
          <button
            onClick={() => handleAlignmentChange('top')}
            className={`flex items-center px-2 py-1.5 rounded-md transition-colors ${
              style.alignment === 'top'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-600 text-gray-300'
            }`}
            title="Top"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleAlignmentChange('center')}
            className={`flex items-center px-2 py-1.5 rounded-md transition-colors ${
              style.alignment === 'center'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-600 text-gray-300'
            }`}
            title="Center"
          >
            <ArrowDownUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleAlignmentChange('bottom')}
            className={`flex items-center px-2 py-1.5 rounded-md transition-colors ${
              style.alignment === 'bottom'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-600 text-gray-300'
            }`}
            title="Bottom"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-600" />

        {/* Text Size Controls */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-gray-300 mr-2">Text:</span>
          <button
            onClick={() => handleTextSizeChange('small')}
            className={`flex items-center px-2 py-1.5 rounded-md transition-colors ${
              style.textSize === 'small'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-600 text-gray-300'
            }`}
            title="Small text"
          >
            <Type className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleTextSizeChange('medium')}
            className={`flex items-center px-2 py-1.5 rounded-md transition-colors ${
              style.textSize === 'medium'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-600 text-gray-300'
            }`}
            title="Medium text"
          >
            <Type className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleTextSizeChange('large')}
            className={`flex items-center px-2 py-1.5 rounded-md transition-colors ${
              style.textSize === 'large'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-600 text-gray-300'
            }`}
            title="Large text"
          >
            <Type className="w-5 h-5" />
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-600" />

        {/* Image Size Controls */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-gray-300 mr-2">Image:</span>
          <button
            onClick={() => handleImageSizeChange('small')}
            className={`flex items-center px-2 py-1.5 rounded-md transition-colors ${
              style.imageSize === 'small'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-600 text-gray-300'
            }`}
            title="Small image"
          >
            <ImageIcon className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleImageSizeChange('medium')}
            className={`flex items-center px-2 py-1.5 rounded-md transition-colors ${
              style.imageSize === 'medium'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-600 text-gray-300'
            }`}
            title="Medium image"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleImageSizeChange('large')}
            className={`flex items-center px-2 py-1.5 rounded-md transition-colors ${
              style.imageSize === 'large'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-600 text-gray-300'
            }`}
            title="Large image"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-600" />

        {/* Styles Button */}
        <button
          onClick={onStylesClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-xs font-medium"
        >
          <span>Styles</span>
          <span className="text-xs">→</span>
        </button>
      </div>
    </div>
  );
}
