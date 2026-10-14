import { useRef, useEffect, useState } from 'react';
import { TimelineSubtitle } from './TimelineSubtitle';
import type { SubtitleLine } from '../../types/subtitle';

interface TimelineProps {
  duration: number; // milliseconds
  currentTime: number; // milliseconds
  subtitles: SubtitleLine[];
  onSeek: (time: number) => void;
  onSubtitleClick?: (subtitle: SubtitleLine) => void;
  onSubtitleUpdate?: (id: string, start: number, end: number) => void;
}

export function Timeline({
  duration,
  currentTime,
  subtitles,
  onSeek,
  onSubtitleClick,
  onSubtitleUpdate,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);

    // Also set initial width immediately
    const initialWidth = container.getBoundingClientRect().width;
    if (initialWidth > 0) {
      setWidth(initialWidth);
    }

    return () => observer.disconnect();
  }, [duration]);

  const timeToPosition = (time: number) => {
    if (duration === 0) {
      console.warn('Duration is 0, cannot calculate position');
      return 0;
    }
    if (width === 0) {
      console.warn('Width is 0, cannot calculate position');
      return 0;
    }
    const position = (time / duration) * width;
    return position;
  };

  const positionToTime = (position: number) => {
    if (width === 0) return 0;
    return (position / width) * duration;
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return; // Don't seek while dragging
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = positionToTime(x);
    onSeek(time);
  };

  const playheadPosition = timeToPosition(currentTime);

  return (
    <div className="w-full h-full flex flex-col">
      <div
        ref={containerRef}
        className="relative flex-1 bg-gray-700 rounded-lg cursor-pointer"
        onClick={handleClick}
      >
        {/* Debug info */}
        {(width === 0 || duration === 0) && (
          <div className="absolute inset-0 flex items-center justify-center text-red-400 text-xs">
            {width === 0 && <span>Width: 0 | </span>}
            {duration === 0 && <span>Duration: 0</span>}
          </div>
        )}

        {/* Subtitle blocks */}
        {subtitles.map((subtitle, index) => (
          <TimelineSubtitle
            key={subtitle.id}
            subtitle={subtitle}
            duration={duration}
            timelineWidth={width}
            prevSubtitle={index > 0 ? subtitles[index - 1] : undefined}
            nextSubtitle={index < subtitles.length - 1 ? subtitles[index + 1] : undefined}
            onDrag={(newStart, newEnd) => {
              onSubtitleUpdate?.(subtitle.id, newStart, newEnd);
            }}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
            onClick={() => onSubtitleClick?.(subtitle)}
          />
        ))}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
          style={{
            left: `${playheadPosition}px`,
            transition: isDragging ? 'none' : 'left 0.1s linear'
          }}
        >
          <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
        </div>
      </div>

      {/* Time indicators */}
      <div className="flex justify-between mt-2 text-xs text-gray-400">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
