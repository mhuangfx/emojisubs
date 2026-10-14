import { useRef, useCallback } from 'react';
import type { SubtitleLine } from '../../types/subtitle';

interface TimelineSubtitleProps {
  subtitle: SubtitleLine;
  duration: number;
  timelineWidth: number;
  prevSubtitle?: SubtitleLine;
  nextSubtitle?: SubtitleLine;
  onDrag: (newStart: number, newEnd: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}

export function TimelineSubtitle({
  subtitle,
  duration,
  timelineWidth,
  prevSubtitle,
  nextSubtitle,
  onDrag,
  onDragStart,
  onDragEnd,
  onClick,
}: TimelineSubtitleProps) {
  const dragInfo = useRef<{
    startX: number;
    type: 'start' | 'end' | 'move';
    originalStart: number;
    originalEnd: number;
    isDragging: boolean;
  } | null>(null);

  const timeToPosition = useCallback((time: number) => {
    if (duration === 0) return 0;
    return (time / duration) * timelineWidth;
  }, [duration, timelineWidth]);

  const positionToTime = useCallback((position: number) => {
    if (timelineWidth === 0) return 0;
    return (position / timelineWidth) * duration;
  }, [duration, timelineWidth]);

  const checkCollision = useCallback((newStart: number, newEnd: number, dragType: 'start' | 'end' | 'move'): boolean => {
    const minGap = 50; // Minimum gap between subtitles (50ms) - only for move operations
    const minLength = 100; // Minimum subtitle length (100ms)

    // Check if start is before end
    if (newStart >= newEnd - minLength) return true;

    // For trim operations (start/end handles), only prevent actual overlaps
    // For move operations, enforce the minimum gap
    const gapRequired = dragType === 'move' ? minGap : 0;

    // Check overlap with previous subtitle
    if (prevSubtitle && newStart < prevSubtitle.end + gapRequired) {
      return true;
    }

    // Check overlap with next subtitle
    if (nextSubtitle && newEnd > nextSubtitle.start - gapRequired) {
      return true;
    }

    return false;
  }, [prevSubtitle, nextSubtitle]);

  const handleMouseDown = useCallback((e: React.MouseEvent, type: 'start' | 'end' | 'move') => {
    e.preventDefault();
    e.stopPropagation();

    onDragStart();
    dragInfo.current = {
      startX: e.clientX,
      type,
      originalStart: subtitle.start,
      originalEnd: subtitle.end,
      isDragging: true,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragInfo.current?.isDragging) return;

      const delta = e.clientX - dragInfo.current.startX;
      const timeDeltaMs = positionToTime(delta);

      let newStart = dragInfo.current.originalStart;
      let newEnd = dragInfo.current.originalEnd;

      switch (dragInfo.current.type) {
        case 'start':
          // Drag left edge
          newStart = Math.max(0, dragInfo.current.originalStart + timeDeltaMs);
          if (!checkCollision(newStart, newEnd, 'start')) {
            onDrag(newStart, newEnd);
          }
          break;
        case 'end':
          // Drag right edge
          newEnd = Math.min(duration, dragInfo.current.originalEnd + timeDeltaMs);
          if (!checkCollision(newStart, newEnd, 'end')) {
            onDrag(newStart, newEnd);
          }
          break;
        case 'move':
          // Drag entire box
          const length = dragInfo.current.originalEnd - dragInfo.current.originalStart;
          newStart = Math.max(0, dragInfo.current.originalStart + timeDeltaMs);
          newEnd = newStart + length;

          // Ensure we don't go past duration
          if (newEnd > duration) {
            newEnd = duration;
            newStart = newEnd - length;
          }

          if (!checkCollision(newStart, newEnd, 'move')) {
            onDrag(newStart, newEnd);
          }
          break;
      }
    };

    const handleMouseUp = () => {
      if (dragInfo.current) {
        dragInfo.current.isDragging = false;
        dragInfo.current = null;
      }
      onDragEnd();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [subtitle, duration, positionToTime, checkCollision, onDrag, onDragStart, onDragEnd]);

  const left = timeToPosition(subtitle.start);
  const width = timeToPosition(subtitle.end) - left;

  return (
    <div
      className="absolute"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: '50%',
        transform: 'translateY(-50%)',
        height: '32px',
        zIndex: 10,
      }}
    >
      {/* Main box for moving entire subtitle */}
      <div
        className="h-full bg-blue-600 hover:bg-blue-500 rounded cursor-move relative transition-colors border border-blue-400"
        style={{ zIndex: 1 }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <div className="absolute inset-0 px-2 py-1 text-xs text-white truncate flex items-center pointer-events-none">
          {subtitle.text}
        </div>
      </div>

      {/* Left edge for adjusting start time */}
      <div
        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-blue-300 bg-blue-800 rounded-l"
        style={{ zIndex: 2 }}
        onMouseDown={(e) => handleMouseDown(e, 'start')}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Right edge for adjusting end time */}
      <div
        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-blue-300 bg-blue-800 rounded-r"
        style={{ zIndex: 2 }}
        onMouseDown={(e) => handleMouseDown(e, 'end')}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
