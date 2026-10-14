import { LoadingSpinner } from './LoadingSpinner';

interface ExportProgressModalProps {
  isOpen: boolean;
  phase: 'loading' | 'rendering' | 'encoding' | 'complete';
  progress: number; // 0-100
  message: string;
  currentFrame?: number;
  totalFrames?: number;
  onCancel?: () => void;
}

export function ExportProgressModal({
  isOpen,
  phase,
  progress,
  message,
  currentFrame,
  totalFrames,
  onCancel,
}: ExportProgressModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <LoadingSpinner size="small" className="border-blue-500 border-t-transparent" />
          <h2 className="text-xl font-bold text-white">Exporting Video</h2>
        </div>

        {/* Progress Message */}
        <p className="text-gray-300 mb-4 text-sm">{message}</p>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300 ease-out rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>{Math.round(progress)}%</span>
            {currentFrame !== undefined && totalFrames !== undefined && (
              <span>Frame {currentFrame} / {totalFrames}</span>
            )}
          </div>
        </div>

        {/* Phase Indicator */}
        <div className="flex gap-2 mt-6">
          <PhaseIndicator active={phase === 'loading'} completed={progress > 10}>
            Loading
          </PhaseIndicator>
          <PhaseIndicator active={phase === 'rendering'} completed={progress > 20 && phase !== 'loading'}>
            Rendering
          </PhaseIndicator>
          <PhaseIndicator active={phase === 'encoding'} completed={progress > 90}>
            Encoding
          </PhaseIndicator>
          <PhaseIndicator active={phase === 'complete'} completed={progress === 100}>
            Complete
          </PhaseIndicator>
        </div>

        {/* Warning */}
        {phase === 'rendering' && (
          <p className="text-xs text-yellow-400 mt-4 text-center">
            Please wait... This may take a few minutes for larger videos.
          </p>
        )}

        {/* Cancel Button */}
        {phase !== 'complete' && onCancel && (
          <button
            onClick={onCancel}
            className="mt-4 w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Cancel Export
          </button>
        )}
      </div>
    </div>
  );
}

function PhaseIndicator({
  active,
  completed,
  children,
}: {
  active: boolean;
  completed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`
        flex-1 text-xs text-center py-1 px-2 rounded
        ${active ? 'bg-blue-600 text-white font-medium' : ''}
        ${completed && !active ? 'bg-green-700 text-green-200' : ''}
        ${!completed && !active ? 'bg-gray-700 text-gray-400' : ''}
      `}
    >
      {children}
    </div>
  );
}
