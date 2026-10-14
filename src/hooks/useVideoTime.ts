import { useEffect, useState, RefObject } from 'react';
import type { SubtitleLine } from '../types/subtitle';

export function useVideoTime(
  videoRef: RefObject<HTMLVideoElement | null>,
  subtitles: SubtitleLine[]
) {
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleLine | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const timeMs = video.currentTime * 1000;
      setCurrentTime(timeMs);

      // Find active subtitle
      const active = subtitles.find(
        (sub) => timeMs >= sub.start && timeMs <= sub.end
      );

      // Only update if subtitle changed (compare by id)
      setCurrentSubtitle(prev => {
        if (!active && !prev) return null;
        if (!active || !prev) return active || null;
        if (active.id === prev.id) {
          // Same subtitle but might have updated properties (like imagePath)
          // Always return the new one to pick up changes
          return active;
        }
        return active;
      });
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoRef, subtitles]);

  // Force re-evaluation when subtitles array changes (e.g., image added)
  // This handles the case when video is paused and timeupdate doesn't fire
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const timeMs = video.currentTime * 1000;
    const active = subtitles.find(
      (sub) => timeMs >= sub.start && timeMs <= sub.end
    );

    setCurrentSubtitle(prev => {
      if (!active && !prev) return null;
      if (!active || !prev) return active || null;
      if (active.id === prev.id) {
        // Return new subtitle object to pick up property changes (like imagePath)
        return active;
      }
      return active;
    });
  }, [subtitles, videoRef]);

  return { currentTime, currentSubtitle };
}
