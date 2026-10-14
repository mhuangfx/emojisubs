import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { dirname } from '@tauri-apps/api/path';

export interface FileInfo {
  path: string;
  name: string;
  size: number;
}

const LAST_VIDEO_DIR_KEY = 'emojisubs_last_video_dir';
const LAST_IMAGE_DIR_KEY = 'emojisubs_last_image_dir';

export async function selectVideoFile(): Promise<string | null> {
  // Get last used directory from localStorage
  const lastDir = localStorage.getItem(LAST_VIDEO_DIR_KEY) || undefined;

  const selected = await open({
    multiple: false,
    defaultPath: lastDir,
    filters: [{
      name: 'Video',
      extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm']
    }]
  });

  if (selected && typeof selected === 'string') {
    // Remember the directory for next time
    try {
      const dir = await dirname(selected);
      localStorage.setItem(LAST_VIDEO_DIR_KEY, dir);
    } catch (e) {
      console.error('Failed to save video directory:', e);
    }
    return selected;
  }

  return null;
}

export async function selectImageFile(): Promise<string | null> {
  // Get last used directory from localStorage
  const lastDir = localStorage.getItem(LAST_IMAGE_DIR_KEY) || undefined;

  const selected = await open({
    multiple: false,
    defaultPath: lastDir,
    filters: [{
      name: 'Image',
      extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
    }]
  });

  if (selected && typeof selected === 'string') {
    // Remember the directory for next time
    try {
      const dir = await dirname(selected);
      localStorage.setItem(LAST_IMAGE_DIR_KEY, dir);
    } catch (e) {
      console.error('Failed to save image directory:', e);
    }
    return selected;
  }

  return null;
}

export async function copyVideoToCache(videoPath: string): Promise<string> {
  return await invoke<string>('copy_video_to_cache', { videoPath });
}

export async function getFileInfo(filePath: string): Promise<FileInfo> {
  return await invoke<FileInfo>('get_file_info', { filePath });
}

export async function getVideoUrl(filename: string, port: number): Promise<string> {
  return await invoke<string>('get_video_url', { filename, port });
}

export async function getVideoServerPort(): Promise<number> {
  return await invoke<number>('get_video_server_port');
}

export async function copyImageToCache(imagePath: string): Promise<string> {
  return await invoke<string>('copy_image_to_cache', { imagePath });
}

export async function getImageUrl(filename: string, port: number): Promise<string> {
  return await invoke<string>('get_image_url', { filename, port });
}
