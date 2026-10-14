import { useRef, useEffect, useState } from 'react';

interface VideoTrimmerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  duration: number; // milliseconds
  onTrimChange: (start: number, end: number) => void;
  initialStart?: number;
  initialEnd?: number;
}

export function VideoTrimmer({
  videoRef,
  duration,
  onTrimChange,
  initialStart = 0,
  initialEnd,
}: VideoTrimmerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [trimStart, setTrimStart] = useState(initialStart);
  const [trimEnd, setTrimEnd] = useState(initialEnd || duration);
  const [dragging, setDragging] = useState<'start' | 'end' | 'move' | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTrimStart, setDragStartTrimStart] = useState(0);
  const [dragStartTrimEnd, setDragStartTrimEnd] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);

    const initialWidth = container.getBoundingClientRect().width;
    if (initialWidth > 0) {
      setWidth(initialWidth);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setTrimEnd(initialEnd || duration);
  }, [duration, initialEnd]);

  // Track video current time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime * 1000);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [videoRef]);

  const timeToPosition = (time: number) => {
    if (duration === 0 || width === 0) return 0;
    return (time / duration) * width;
  };

  const positionToTime = (position: number) => {
    if (width === 0) return 0;
    return (position / width) * duration;
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(type);
    setHasDragged(false);
  };

  const handleMoveMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current || !videoRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    setDragStartX(e.clientX - rect.left);
    setDragStartTrimStart(trimStart);
    setDragStartTrimEnd(trimEnd);
    setDragging('move');
    setHasDragged(false);

    // Seek to center of trim window
    const center = (trimStart + trimEnd) / 2;
    videoRef.current.currentTime = center / 1000;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging || !containerRef.current) return;

    setHasDragged(true);

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, width));

    if (dragging === 'move') {
      // Calculate the delta from the start of the drag
      const deltaX = x - dragStartX;
      const deltaTime = positionToTime(deltaX) - positionToTime(0);

      const trimDuration = dragStartTrimEnd - dragStartTrimStart;
      let newStart = dragStartTrimStart + deltaTime;
      let newEnd = dragStartTrimEnd + deltaTime;

      // Clamp to duration boundaries
      if (newStart < 0) {
        newStart = 0;
        newEnd = trimDuration;
      } else if (newEnd > duration) {
        newEnd = duration;
        newStart = duration - trimDuration;
      }

      setTrimStart(newStart);
      setTrimEnd(newEnd);
      onTrimChange(newStart, newEnd);

      // Update playhead to center of move box
      if (videoRef.current) {
        const center = (newStart + newEnd) / 2;
        videoRef.current.currentTime = center / 1000;
      }
    } else {
      const time = positionToTime(x);

      if (dragging === 'start') {
        const newStart = Math.max(0, Math.min(time, trimEnd - 1000)); // Min 1 second segment
        setTrimStart(newStart);
        onTrimChange(newStart, trimEnd);
        if (videoRef.current) {
          videoRef.current.currentTime = newStart / 1000;
        }
      } else if (dragging === 'end') {
        const newEnd = Math.min(duration, Math.max(time, trimStart + 1000)); // Min 1 second segment
        setTrimEnd(newEnd);
        onTrimChange(trimStart, newEnd);
        if (videoRef.current) {
          videoRef.current.currentTime = newEnd / 1000;
        }
      }
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    // Don't process click if we just finished dragging
    if (hasDragged) {
      setHasDragged(false);
      return;
    }

    if (dragging || !containerRef.current || !videoRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, width));
    const time = positionToTime(x);

    // Clicking on timeline (outside selected region) -> seek
    videoRef.current.currentTime = time / 1000;
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, trimStart, trimEnd]);

  const startPos = timeToPosition(trimStart);
  const endPos = timeToPosition(trimEnd);
  const currentPos = timeToPosition(currentTime);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-sm text-gray-300 mb-1">Trim your video (optional)</p>
        <p className="text-xs text-gray-500">
          {formatTime(trimStart)} - {formatTime(trimEnd)} ({formatTime(trimEnd - trimStart)} total)
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative h-16 bg-gray-700 rounded-lg cursor-pointer"
        style={{ minWidth: '200px' }}
        onClick={handleTimelineClick}
      >
        {/* Dimmed regions */}
        <div
          className="absolute top-0 bottom-0 bg-black opacity-50 rounded-l-lg"
          style={{
            left: 0,
            width: `${startPos}px`,
          }}
        />
        <div
          className="absolute top-0 bottom-0 bg-black opacity-50 rounded-r-lg"
          style={{
            left: `${endPos}px`,
            right: 0,
          }}
        />

        {/* Selected region */}
        <div
          className="absolute top-0 bottom-0 border-t-2 border-b-2 border-blue-500"
          style={{
            left: `${startPos}px`,
            width: `${endPos - startPos}px`,
          }}
        />

        {/* Move area (between handles) - invisible overlay with move cursor */}
        <div
          className="absolute top-0 bottom-0 cursor-move z-5"
          style={{
            left: `${startPos + 8}px`,
            width: `${Math.max(0, endPos - startPos - 16)}px`,
          }}
          onMouseDown={handleMoveMouseDown}
        />

        {/* Current time playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
          style={{ left: `${currentPos}px` }}
        >
          <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
        </div>

        {/* Start handle */}
        <div
          className="absolute top-0 bottom-0 w-2 bg-blue-500 cursor-ew-resize hover:bg-blue-400 rounded-l z-10"
          style={{ left: `${startPos}px` }}
          onMouseDown={(e) => handleMouseDown(e, 'start')}
        >
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded" />
        </div>

        {/* End handle */}
        <div
          className="absolute top-0 bottom-0 w-2 bg-blue-500 cursor-ew-resize hover:bg-blue-400 rounded-r z-10"
          style={{ left: `${endPos - 8}px` }}
          onMouseDown={(e) => handleMouseDown(e, 'end')}
        >
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded" />
        </div>
      </div>
    </div>
  );
}
