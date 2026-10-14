import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { dirname } from '@tauri-apps/api/path';
import type { SubtitleLine, SubtitleStyle } from '../../types/subtitle';

const LAST_EXPORT_DIR_KEY = 'emojisubs_last_export_dir';

export async function selectExportPath(defaultName: string): Promise<string | null> {
  // Get last used directory from localStorage
  const lastDir = localStorage.getItem(LAST_EXPORT_DIR_KEY) || undefined;

  const selected = await save({
    defaultPath: lastDir ? `${lastDir}/${defaultName}` : defaultName,
    filters: [{
      name: 'Video',
      extensions: ['mp4']
    }]
  });

  if (selected && typeof selected === 'string') {
    // Remember the directory for next time
    try {
      const dir = await dirname(selected);
      localStorage.setItem(LAST_EXPORT_DIR_KEY, dir);
    } catch (e) {
      console.error('Failed to save export directory:', e);
    }
    return selected;
  }

  return null;
}

/**
 * Save a video blob to disk using Tauri
 */
export async function saveVideoBlob(
  blob: Blob,
  outputPath: string
): Promise<void> {
  // Convert blob to array buffer
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const blobData = Array.from(uint8Array);

  // Save via Tauri command
  await invoke<void>('save_video_blob', {
    blobData,
    outputPath,
  });
}
