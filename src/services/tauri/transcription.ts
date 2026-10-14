import { invoke } from '@tauri-apps/api/core';

export interface Word {
  text: string;
  start: number;  // milliseconds
  end: number;    // milliseconds
  confidence?: number;
}

export interface TranscriptionResult {
  words: Word[];
  full_text: string;
}

export async function trimVideoFile(
  videoPath: string,
  trimStartMs: number,
  trimEndMs: number
): Promise<string> {
  return await invoke<string>('trim_video_file', {
    videoPath,
    trimStartMs,
    trimEndMs,
  });
}

export async function transcribeVideo(
  videoPath: string,
  modelSize: string = 'tiny.en'
): Promise<TranscriptionResult> {
  return await invoke<TranscriptionResult>('transcribe_video', {
    videoPath,
    modelSize,
  });
}

export async function getAvailableModels(): Promise<string[]> {
  return await invoke<string[]>('get_available_models');
}
