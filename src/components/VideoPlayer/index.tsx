import { forwardRef, useState, useEffect } from 'react';
import { SubtitleOverlay } from './SubtitleOverlay';
import type { SubtitleLine, SubtitleStyle } from '../../types/subtitle';
import { DEFAULT_SUBTITLE_STYLE } from '../../types/subtitle';

interface VideoPlayerProps {
  videoUrl: string;
  currentSubtitle?: SubtitleLine | null;
  subtitleStyle?: SubtitleStyle;
  onPlayingChange?: (isPlaying: boolean) => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ videoUrl, currentSubtitle, subtitleStyle = DEFAULT_SUBTITLE_STYLE, onPlayingChange }, ref) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

    const isVertical = videoDimensions.height > videoDimensions.width;

    useEffect(() => {
      const videoElement = ref && 'current' in ref ? ref.current : null;
      if (!videoElement) return;

      const handlePlay = () => {
        setIsPlaying(true);
        onPlayingChange?.(true);
      };

      const handlePause = () => {
        setIsPlaying(false);
        onPlayingChange?.(false);
      };

      const handleLoadedMetadata = () => {
        setVideoDimensions({
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
        });
      };

      videoElement.addEventListener('play', handlePlay);
      videoElement.addEventListener('pause', handlePause);
      videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);

      // Check if metadata already loaded
      if (videoElement.videoWidth > 0) {
        handleLoadedMetadata();
      }

      return () => {
        videoElement.removeEventListener('play', handlePlay);
        videoElement.removeEventListener('pause', handlePause);
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }, [ref, onPlayingChange]);

    return (
      <div className="relative w-full bg-black">
        <div className="relative aspect-video bg-black">
          <div className={`absolute inset-0 ${isVertical ? 'flex items-center justify-center' : ''}`}>
            <div
              className={isVertical ? 'h-full relative' : 'w-full h-full'}
              style={isVertical && videoDimensions.width > 0 ? {
                width: 'auto',
                aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}`,
              } : undefined}
            >
              <video
                ref={ref}
                src={videoUrl}
                className={isVertical ? 'h-full w-auto' : 'w-full h-full'}
                controls
                playsInline
                crossOrigin="anonymous"
              />
              {ref && 'current' in ref && videoDimensions.width > 0 && videoDimensions.height > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  <SubtitleOverlay
                    key={`${videoDimensions.width}-${videoDimensions.height}`}
                    currentSubtitle={currentSubtitle || null}
                    videoRef={ref}
                    videoWidth={videoDimensions.width}
                    videoHeight={videoDimensions.height}
                    subtitleStyle={subtitleStyle}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
