import { useState } from 'react';
import { Link2, Scissors } from 'lucide-react';
import type { SubtitleLine } from '../../types/subtitle';

interface TranscriptEditorProps {
  subtitles: SubtitleLine[];
  currentTime: number;
  onSubtitleClick?: (subtitle: SubtitleLine) => void;
  onSubtitleEdit?: (id: string, newText: string) => void;
  onSubtitleSplit?: (id: string, wordIndex: number) => void;
  onSubtitleMerge?: (id: string) => void;
  onImageSelect?: (id: string) => void;
  onImageRemove?: (id: string) => void;
}

export function TranscriptEditor({
  subtitles,
  currentTime,
  onSubtitleClick,
  onSubtitleEdit,
  onSubtitleSplit,
  onSubtitleMerge,
  onImageSelect,
  onImageRemove,
}: TranscriptEditorProps) {
  const [splittingId, setSplittingId] = useState<string | null>(null);

  const isActive = (subtitle: SubtitleLine) => {
    return currentTime >= subtitle.start && currentTime <= subtitle.end;
  };

  const handleSplitClick = (subtitleId: string) => {
    setSplittingId(splittingId === subtitleId ? null : subtitleId);
  };

  const handleWordClick = (subtitleId: string, wordIndex: number) => {
    onSubtitleSplit?.(subtitleId, wordIndex);
    setSplittingId(null);
  };

  const canMerge = (index: number) => {
    return index < subtitles.length - 1;
  };

  return (
    <div className="space-y-1 p-2">
      {subtitles.length === 0 ? (
        <p className="text-gray-400 text-center py-8 text-sm">
          No subtitles yet. Transcribe a video to get started.
        </p>
      ) : (
        subtitles.map((subtitle, index) => {
          const isSplitting = splittingId === subtitle.id;

          return (
            <div
              key={subtitle.id}
              className={`border rounded px-2 py-1.5 transition-colors ${
                isActive(subtitle)
                  ? 'border-blue-500 bg-blue-900 bg-opacity-30'
                  : 'border-gray-600 hover:border-gray-500 bg-gray-750'
              }`}
            >
              {isSplitting ? (
                // Split mode: show clickable words
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-gray-200">
                    Click between words to split:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(subtitle.words || []).map((word, wordIdx) => (
                      <span key={wordIdx} className="inline-flex items-center">
                        <span className="px-1.5 py-0.5 bg-gray-600 text-gray-100 rounded text-xs">
                          {word.text}
                        </span>
                        {wordIdx < (subtitle.words?.length || 0) - 1 && (
                          <button
                            onClick={() => handleWordClick(subtitle.id, wordIdx + 1)}
                            className="mx-0.5 w-5 h-5 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full text-xs font-bold"
                            title={`Split after "${word.text}"`}
                          >
                            ✂
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => setSplittingId(null)}
                    className="text-xs text-gray-300 hover:text-gray-100 px-1.5 py-0.5 rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                // Normal mode: show textarea and image
                <div className="flex items-center gap-2">
                  {/* Image Section */}
                  <div className="flex-shrink-0">
                    {subtitle.imagePath ? (
                      <div className="relative w-10 h-10 rounded border border-gray-500 overflow-hidden bg-gray-700">
                        <img
                          src={subtitle.imagePath}
                          alt="Subtitle"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => onImageRemove?.(subtitle.id)}
                          className="absolute top-0 right-0 w-4 h-4 bg-red-500 hover:bg-red-600 text-white text-xs flex items-center justify-center rounded-bl"
                          title="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onImageSelect?.(subtitle.id)}
                        className="w-10 h-10 rounded border border-dashed border-gray-500 hover:border-blue-500 bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-blue-400 transition-colors"
                        title="Add image"
                      >
                        <span className="text-lg">🖼️</span>
                      </button>
                    )}
                  </div>

                  {/* Text Section */}
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={subtitle.text}
                      onChange={(e) => onSubtitleEdit?.(subtitle.id, e.target.value)}
                      onClick={() => onSubtitleClick?.(subtitle)}
                      className="w-full bg-transparent text-gray-100 text-sm border-none focus:outline-none resize-none leading-tight"
                      rows={1}
                      style={{ minHeight: '20px' }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canMerge(index) && (
                      <button
                        onClick={() => onSubtitleMerge?.(subtitle.id)}
                        className="w-6 h-6 flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                        title="Merge with next"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {subtitle.words && Array.isArray(subtitle.words) && subtitle.words.length > 1 && (
                      <button
                        onClick={() => handleSplitClick(subtitle.id)}
                        className="w-6 h-6 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                        title="Split subtitle"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
