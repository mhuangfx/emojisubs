import { useState, useRef, useEffect } from 'react'
import { selectVideoFile, getVideoServerPort, getFileInfo, copyVideoToCache, getVideoUrl, selectImageFile, copyImageToCache, getImageUrl } from './services/tauri/files'
import { transcribeVideo, trimVideoFile, getAvailableModels } from './services/tauri/transcription'
import type { TranscriptionResult } from './services/tauri/transcription'
import { selectExportPath } from './services/tauri/export'
import { exportVideoWithCanvasFFmpeg } from './utils/videoExportHybrid'
import { VideoPlayer } from './components/VideoPlayer'
import { Timeline } from './components/Timeline'
import { TranscriptEditor } from './components/TranscriptEditor'
import { SubtitleControls } from './components/SubtitleControls'
import { SubtitleStyleModal } from './components/SubtitleStyleModal'
import { VideoTrimmer } from './components/VideoTrimmer'
import { LoadingSpinner } from './components/LoadingSpinner'
import { ExportProgressModal } from './components/ExportProgressModal'
import { useVideoTime } from './hooks/useVideoTime'
import { wordsToSubtitles, getVideoDuration, updateSubtitleText, splitSubtitle, mergeSubtitles } from './utils/subtitles'
import type { SubtitleLine, SubtitleStyle } from './types/subtitle'
import { DEFAULT_SUBTITLE_STYLE } from './types/subtitle'

const MAX_VIDEO_DURATION_MS = 90000 // 90 seconds in milliseconds

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [appLoading, setAppLoading] = useState(true)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [videoFileName, setVideoFileName] = useState<string | null>(null)
  const [transcribedVideoPath, setTranscribedVideoPath] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [transcribing, setTranscribing] = useState(false)
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null)
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE)
  const [styleModalOpen, setStyleModalOpen] = useState(false)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [transcribedTrimStart, setTranscribedTrimStart] = useState(0)
  const [transcribedTrimEnd, setTranscribedTrimEnd] = useState(0)
  const [showNotification, setShowNotification] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState({
    phase: 'loading' as 'loading' | 'rendering' | 'encoding' | 'complete',
    progress: 0,
    message: '',
    currentFrame: 0,
    totalFrames: 0,
  })
  const exportAbortController = useRef<AbortController | null>(null)

  const { currentTime, currentSubtitle } = useVideoTime(videoRef, subtitles)

  // Initial app loading
  useEffect(() => {
    // Simulate initial load time (fonts, assets, etc.)
    const timer = setTimeout(() => {
      setAppLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  // Update video duration when video metadata loads
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      const duration = getVideoDuration(video)
      setVideoDuration(duration)

      // Initialize trim values
      setTrimStart(0)
      setTrimEnd(Math.min(duration, MAX_VIDEO_DURATION_MS))
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)

    // Check if metadata already loaded
    if (video.readyState >= 1 && video.duration) {
      const duration = getVideoDuration(video)
      setVideoDuration(duration)

      setTrimStart(0)
      setTrimEnd(Math.min(duration, MAX_VIDEO_DURATION_MS))
    }

    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata)
  }, [videoUrl, subtitles.length])

  // Auto-hide notifications after 2 seconds
  useEffect(() => {
    if (error || progress) {
      setShowNotification(true)
      const timer = setTimeout(() => {
        setShowNotification(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [error, progress])

  // Check trim selection validity and update error state
  useEffect(() => {
    if (videoDuration === 0) return

    // Floor the trim duration to avoid floating point rounding errors
    const trimDuration = Math.floor(trimEnd - trimStart)
    if (videoDuration > MAX_VIDEO_DURATION_MS && trimDuration > MAX_VIDEO_DURATION_MS) {
      setError(`Video is ${Math.round(videoDuration / 1000)}s. Please trim to 90 seconds or less.`)
    } else if (trimDuration > MAX_VIDEO_DURATION_MS) {
      setError(`Selected duration (${Math.round(trimDuration / 1000)}s) exceeds 90-second limit.`)
    } else {
      setError(null)
    }
  }, [videoDuration, trimStart, trimEnd])

  const handleSelectVideo = async () => {
    try {
      setError(null)
      setUploadingVideo(true)
      const path = await selectVideoFile()
      if (path) {
        setVideoPath(path)
        const info = await getFileInfo(path)
        setVideoFileName(info.name)
        console.log('Selected video:', info)

        // Copy video to cache and get server URL
        console.log('Copying video to cache...')
        const cachedFilename = await copyVideoToCache(path)
        console.log('Cached as:', cachedFilename)

        const port = await getVideoServerPort()
        const url = await getVideoUrl(cachedFilename, port)
        setVideoUrl(url)
        console.log('Video URL:', url)
      }
    } catch (err) {
      setError(`Failed to select video: ${err}`)
      console.error(err)
    } finally {
      setUploadingVideo(false)
    }
  }

  const handleTranscribe = async () => {
    if (!videoPath) return

    try {
      setError(null)
      setTranscribing(true)
      setProgress('Starting transcription...')

      // Check available models
      const models = await getAvailableModels()
      console.log('Available models:', models)

      const modelToUse = models.includes('tiny.en') ? 'tiny.en' : models[0]
      setProgress(`Using model: ${modelToUse}`)

      // Check if video needs trimming
      const isTrimmed = trimStart > 0 || trimEnd < videoDuration
      let videoToTranscribe = videoPath

      if (isTrimmed) {
        // Step 1: Trim the video file
        setProgress('Trimming video...')
        const roundedTrimStart = Math.floor(trimStart)
        const roundedTrimEnd = Math.floor(trimEnd)
        console.log('Trimming video from', roundedTrimStart, 'to', roundedTrimEnd)

        const trimmedPath = await trimVideoFile(videoPath, roundedTrimStart, roundedTrimEnd)
        console.log('Video trimmed to:', trimmedPath)

        // Step 2: Copy trimmed video to cache and get URL
        setProgress('Caching trimmed video...')
        const cachedFilename = await copyVideoToCache(trimmedPath)
        const port = await getVideoServerPort()
        const trimmedUrl = await getVideoUrl(cachedFilename, port)

        // Update video URL to the trimmed version
        setVideoUrl(trimmedUrl)
        videoToTranscribe = trimmedPath

        // Get trimmed video duration
        const tempVideo = document.createElement('video')
        tempVideo.src = trimmedUrl
        await new Promise((resolve) => {
          tempVideo.onloadedmetadata = () => {
            const trimmedDuration = tempVideo.duration * 1000
            setVideoDuration(trimmedDuration)
            setTranscribedTrimStart(0)
            setTranscribedTrimEnd(trimmedDuration)
            resolve(null)
          }
        })
      } else {
        // Full video - use original values
        setTranscribedTrimStart(0)
        setTranscribedTrimEnd(videoDuration)
      }

      // Store the video path that will be transcribed (for export later)
      setTranscribedVideoPath(videoToTranscribe)

      // Step 3: Transcribe the video (trimmed or original)
      setProgress('Transcribing...')
      console.log('Transcribing:', videoToTranscribe)
      const result = await transcribeVideo(videoToTranscribe, modelToUse)

      setTranscriptionResult(result)

      // Convert words to subtitle lines
      const subtitleLines = wordsToSubtitles(result.words)
      setSubtitles(subtitleLines)

      setProgress('Transcription complete!')
      console.log('Transcription result:', result)
      console.log('Generated subtitles:', subtitleLines)
    } catch (err) {
      setError(`Transcription failed: ${err}`)
      console.error(err)
    } finally {
      setTranscribing(false)
    }
  }

  const handleSeek = (timeMs: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeMs / 1000
    }
  }

  const handleSubtitleClick = (subtitle: SubtitleLine) => {
    handleSeek(subtitle.start)
  }

  const handleSubtitleEdit = (id: string, newText: string) => {
    setSubtitles(prev =>
      prev.map(sub =>
        sub.id === id ? updateSubtitleText(sub, newText) : sub
      )
    )
  }

  const handleSubtitleSplit = (id: string, wordIndex: number) => {
    setSubtitles(prev => {
      const index = prev.findIndex(sub => sub.id === id)
      if (index === -1) return prev

      const subtitle = prev[index]
      try {
        const [first, second] = splitSubtitle(subtitle, wordIndex)
        return [
          ...prev.slice(0, index),
          first,
          second,
          ...prev.slice(index + 1)
        ]
      } catch (error) {
        console.error('Failed to split subtitle:', error)
        return prev
      }
    })
  }

  const handleSubtitleMerge = (id: string) => {
    setSubtitles(prev => {
      const index = prev.findIndex(sub => sub.id === id)
      if (index === -1 || index >= prev.length - 1) return prev

      const first = prev[index]
      const second = prev[index + 1]
      const merged = mergeSubtitles(first, second)

      return [
        ...prev.slice(0, index),
        merged,
        ...prev.slice(index + 2)
      ]
    })
  }

  const handleImageSelect = async (id: string) => {
    try {
      setError(null)
      const imagePath = await selectImageFile()
      if (imagePath) {
        // Copy image to cache and get HTTP URL
        console.log('Copying image to cache...')
        const cachedFilename = await copyImageToCache(imagePath)
        console.log('Cached as:', cachedFilename)

        const port = await getVideoServerPort()
        const imageUrl = await getImageUrl(cachedFilename, port)
        console.log('Image URL:', imageUrl)

        // Update subtitle with HTTP URL
        setSubtitles(prev =>
          prev.map(sub =>
            sub.id === id ? { ...sub, imagePath: imageUrl } : sub
          )
        )
      }
    } catch (err) {
      setError(`Failed to select image: ${err}`)
      console.error(err)
    }
  }

  const handleImageRemove = (id: string) => {
    setSubtitles(prev =>
      prev.map(sub =>
        sub.id === id ? { ...sub, imagePath: undefined } : sub
      )
    )
  }

  const handleSubtitleUpdate = (id: string, start: number, end: number) => {
    setSubtitles(prev =>
      prev.map(sub =>
        sub.id === id ? { ...sub, start, end } : sub
      )
    )
  }

  const handleUploadNew = () => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      'Upload a new video? All current work will be lost.\n\nThis action cannot be undone.'
    )

    if (!confirmed) return

    // Reset all state (returns to initial screen where user can click "Select Video")
    setVideoPath(null)
    setVideoFileName(null)
    setTranscribedVideoPath(null)
    setVideoUrl(null)
    setVideoDuration(0)
    setTranscriptionResult(null)
    setSubtitles([])
    setTrimStart(0)
    setTrimEnd(0)
    setTranscribedTrimStart(0)
    setTranscribedTrimEnd(0)
    setError(null)
    setProgress('')
  }

  const handleCancelExport = () => {
    if (exportAbortController.current) {
      exportAbortController.current.abort()
      setExporting(false)
      setError('Export cancelled')
    }
  }

  const handleExport = async () => {
    if (!videoUrl || subtitles.length === 0) return

    try {
      setError(null)
      setExporting(true)
      setProgress('Preparing export...')

      // Create abort controller for this export
      exportAbortController.current = new AbortController()

      // Generate default filename (now MP4 since we're using FFmpeg)
      const defaultName = videoFileName
        ? videoFileName.replace(/\.[^/.]+$/, '_emojisubs.mp4')
        : 'emojisubs_export.mp4'

      // Show save dialog
      const outputPath = await selectExportPath(defaultName)
      if (!outputPath) {
        setExporting(false)
        return
      }

      console.log('Exporting to:', outputPath)
      console.log('Using video URL:', videoUrl)

      // Export using Canvas rendering + FFmpeg encoding (guarantees preview matches export)
      await exportVideoWithCanvasFFmpeg(
        videoUrl,
        subtitles,
        subtitleStyle,
        outputPath,
        (progressData) => {
          setExportProgress({
            phase: progressData.phase,
            progress: progressData.progress,
            message: progressData.message,
            currentFrame: progressData.currentFrame || 0,
            totalFrames: progressData.totalFrames || 0,
          })
        },
        exportAbortController.current.signal
      )

      setExportProgress({
        phase: 'complete',
        progress: 100,
        message: 'Export complete!',
        currentFrame: 0,
        totalFrames: 0,
      })

      // Show completion briefly then close
      await new Promise(resolve => setTimeout(resolve, 1500))

      console.log('Export successful')
    } catch (err) {
      const errorMessage = String(err);
      if (!errorMessage.includes('cancelled')) {
        setError(`Export failed: ${err}`)
        console.error('Export error:', err)
      }
    } finally {
      setExporting(false)
      exportAbortController.current = null
    }
  }

  // Show initial loading screen
  if (appLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">emojisubs v3</h1>
          <p className="text-gray-600 mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0 relative">
        <div className="px-6 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">emojisubs v3</h1>

          {/* Header Actions */}
          <div className="flex items-center gap-3">
            {/* Upload New */}
            {videoPath && (
              <button
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                onClick={handleUploadNew}
                disabled={uploadingVideo || transcribing || exporting}
              >
                Upload New
              </button>
            )}

            {/* Export */}
            {videoPath && subtitles.length > 0 && (
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                onClick={handleExport}
                disabled={exporting || !subtitles.length}
              >
                {exporting && <LoadingSpinner size="small" className="border-white border-t-transparent" />}
                {exporting ? 'Exporting...' : 'Export'}
              </button>
            )}
          </div>
        </div>

        {/* Notification in Header */}
        {(error || progress) && (
          <div
            className={`absolute left-1/2 transform -translate-x-1/2 top-full mt-2 w-full max-w-md px-6 transition-opacity duration-500 ${
              showNotification ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ pointerEvents: showNotification ? 'auto' : 'none' }}
          >
            {/* Error Display */}
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 rounded-lg p-3 shadow-lg">
                <p className="font-semibold text-sm">Error:</p>
                <p className="text-xs">{error}</p>
              </div>
            )}

            {/* Progress */}
            {progress && (
              <div className="bg-blue-900 border border-blue-700 text-blue-200 rounded-lg p-3 shadow-lg">
                <p className="text-xs">{progress}</p>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Workspace */}
      {videoUrl && subtitles.length > 0 ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Transcript Editor */}
          <div className="w-2/5 bg-gray-800 border-r border-gray-700 flex flex-col">
            <div className="px-4 py-3 bg-gray-750 border-b border-gray-700">
              <h2 className="text-sm font-semibold text-gray-200">Transcript</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TranscriptEditor
                subtitles={subtitles}
                currentTime={currentTime}
                onSubtitleClick={handleSubtitleClick}
                onSubtitleEdit={handleSubtitleEdit}
                onSubtitleSplit={handleSubtitleSplit}
                onSubtitleMerge={handleSubtitleMerge}
                onImageSelect={handleImageSelect}
                onImageRemove={handleImageRemove}
              />
            </div>
          </div>

          {/* Right Panel - Video Preview */}
          <div className="flex-1 bg-gray-850 flex flex-col">
            {/* Subtitle Controls */}
            <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
              <SubtitleControls
                style={subtitleStyle}
                onStyleChange={setSubtitleStyle}
                onStylesClick={() => setStyleModalOpen(true)}
              />
            </div>

            {/* Video Player */}
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-4xl">
                <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
                  <VideoPlayer
                    ref={videoRef}
                    videoUrl={videoUrl}
                    currentSubtitle={currentSubtitle}
                    subtitleStyle={subtitleStyle}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            {!videoPath && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-xl text-gray-300">Welcome to emojisubs v3</p>
                <button
                  className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 text-lg font-medium shadow-lg hover:shadow-xl"
                  onClick={handleSelectVideo}
                  disabled={uploadingVideo}
                >
                  {uploadingVideo && <LoadingSpinner size="small" className="border-white border-t-transparent" />}
                  {uploadingVideo ? 'Loading...' : 'Select Video'}
                </button>
                <p className="text-sm text-gray-500">Choose a video file to get started</p>
              </div>
            )}
            {videoPath && !transcriptionResult && (
              <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto px-4">
                <div className="text-center">
                  <p className="text-xl text-gray-300 mb-2">{videoFileName}</p>
                  {videoDuration > 0 ? (
                    <p className="text-sm text-gray-500">
                      Video loaded • Duration: {Math.round(videoDuration / 1000)}s
                    </p>
                  ) : (
                    <div className="text-sm text-gray-500 flex items-center justify-center gap-2">
                      <LoadingSpinner size="small" />
                      Loading video...
                    </div>
                  )}
                </div>

                {/* Video Preview for Trimming */}
                <div className="w-full max-w-md">
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      src={videoUrl || undefined}
                      className="w-full h-full"
                      controls
                    />
                  </div>
                </div>

                {videoDuration > 0 && !transcribing && (
                  <>
                    {/* Video Trimmer */}
                    <div className="w-full">
                      <VideoTrimmer
                        videoRef={videoRef as React.RefObject<HTMLVideoElement>}
                        duration={videoDuration}
                        onTrimChange={(start, end) => {
                          setTrimStart(start)
                          setTrimEnd(end)
                        }}
                        initialStart={trimStart}
                        initialEnd={trimEnd}
                      />
                    </div>

                    {/* Transcribe Button */}
                    <button
                      className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 font-medium"
                      onClick={handleTranscribe}
                      disabled={transcribing || (trimEnd - trimStart) > MAX_VIDEO_DURATION_MS}
                    >
                      {transcribing && <LoadingSpinner size="small" className="border-white border-t-transparent" />}
                      {transcribing ? 'Transcribing...' : 'Transcribe'}
                    </button>
                  </>
                )}
                {videoDuration > 0 && transcribing && (
                  <div className="flex items-center gap-3">
                    <LoadingSpinner size="small" />
                    <p className="text-sm text-gray-400">Transcribing...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Panel - Timeline */}
      {videoUrl && subtitles.length > 0 && (
        <div className="h-32 bg-gray-800 border-t border-gray-700 flex-shrink-0 px-4 py-3">
          <Timeline
            duration={transcribedTrimEnd - transcribedTrimStart}
            currentTime={currentTime - transcribedTrimStart}
            subtitles={subtitles}
            onSeek={handleSeek}
            onSubtitleClick={handleSubtitleClick}
            onSubtitleUpdate={handleSubtitleUpdate}
          />
        </div>
      )}

      {/* Subtitle Style Modal */}
      <SubtitleStyleModal
        isOpen={styleModalOpen}
        onClose={() => setStyleModalOpen(false)}
        currentStyle={subtitleStyle}
        onApply={setSubtitleStyle}
      />

      {/* Export Progress Modal */}
      <ExportProgressModal
        isOpen={exporting}
        phase={exportProgress.phase}
        progress={exportProgress.progress}
        message={exportProgress.message}
        currentFrame={exportProgress.currentFrame}
        totalFrames={exportProgress.totalFrames}
        onCancel={handleCancelExport}
      />
    </div>
  )
}

export default App
