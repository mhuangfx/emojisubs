import type { Word } from '../services/tauri/transcription';
import type { SubtitleLine } from '../types/subtitle';
import { v4 as uuidv4 } from 'uuid';

/**
 * Check if a word is ONLY punctuation (no letters/numbers)
 */
function isPunctuationOnly(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && /^[^a-zA-Z0-9]+$/.test(trimmed);
}

/**
 * Check if a word ends with sentence-ending punctuation
 */
function isSentenceEnd(text: string): boolean {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed);
}

/**
 * Pre-process words to merge standalone punctuation with adjacent words
 */
function mergeStandalonePunctuation(words: Word[]): Word[] {
  const merged: Word[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // If this is standalone punctuation, append to previous word
    if (isPunctuationOnly(word.text) && merged.length > 0) {
      const prev = merged[merged.length - 1];
      prev.text = prev.text + word.text; // No space before punctuation
      prev.end = word.end; // Extend timing to include punctuation
      // Note: we don't add the punctuation as a separate word entry
    } else {
      merged.push({ ...word });
    }
  }

  return merged;
}

/**
 * Convert transcription words into subtitle lines
 * Groups words based on sentence boundaries, then duration/word count
 */
export function wordsToSubtitles(
  words: Word[],
  maxWordsPerLine: number = 12,
  maxDurationMs: number = 5000
): SubtitleLine[] {
  // First, merge standalone punctuation with adjacent words
  const processedWords = mergeStandalonePunctuation(words);

  const subtitles: SubtitleLine[] = [];
  let currentWords: Word[] = [];
  let lineStartTime = 0;

  for (let i = 0; i < processedWords.length; i++) {
    const word = processedWords[i];

    if (currentWords.length === 0) {
      lineStartTime = word.start;
    }

    currentWords.push(word);

    const duration = word.end - lineStartTime;
    const isLastWord = i === processedWords.length - 1;
    const endsWithPunctuation = isSentenceEnd(word.text);

    // Prefer to split at sentence boundaries
    const shouldSplit =
      endsWithPunctuation || // Split at sentence end
      currentWords.length >= maxWordsPerLine || // Too many words
      duration >= maxDurationMs || // Too long duration
      isLastWord; // Last word

    if (shouldSplit && currentWords.length > 0) {
      subtitles.push({
        id: uuidv4(),
        text: currentWords.map((w) => w.text).join(' '),
        start: lineStartTime,
        end: currentWords[currentWords.length - 1].end,
        words: [...currentWords],
      });
      currentWords = [];
    }
  }

  return subtitles;
}

/**
 * Update a subtitle line's text while preserving timing
 */
export function updateSubtitleText(
  subtitle: SubtitleLine,
  newText: string
): SubtitleLine {
  return {
    ...subtitle,
    text: newText,
  };
}

/**
 * Split a subtitle into two at a specific word index
 * @param subtitle - The subtitle to split
 * @param wordIndex - Index of the first word for the second subtitle (0-based)
 * @returns Array of two new subtitles
 */
export function splitSubtitle(
  subtitle: SubtitleLine,
  wordIndex: number
): [SubtitleLine, SubtitleLine] {
  if (wordIndex <= 0 || wordIndex >= subtitle.words.length) {
    throw new Error('Invalid split position');
  }

  const firstWords = subtitle.words.slice(0, wordIndex);
  const secondWords = subtitle.words.slice(wordIndex);

  const firstSubtitle: SubtitleLine = {
    id: uuidv4(),
    text: firstWords.map((w) => w.text).join(' '),
    start: subtitle.start,
    end: firstWords[firstWords.length - 1].end,
    words: firstWords,
    imagePath: subtitle.imagePath, // Preserve image from original
  };

  const secondSubtitle: SubtitleLine = {
    id: uuidv4(),
    text: secondWords.map((w) => w.text).join(' '),
    start: secondWords[0].start,
    end: subtitle.end,
    words: secondWords,
    imagePath: subtitle.imagePath, // Preserve image from original
  };

  return [firstSubtitle, secondSubtitle];
}

/**
 * Merge two consecutive subtitles into one
 */
export function mergeSubtitles(
  first: SubtitleLine,
  second: SubtitleLine
): SubtitleLine {
  return {
    id: uuidv4(),
    text: `${first.text} ${second.text}`,
    start: first.start,
    end: second.end,
    words: [...first.words, ...second.words],
  };
}

/**
 * Get video duration from video element
 */
export function getVideoDuration(video: HTMLVideoElement | null): number {
  if (!video || !isFinite(video.duration)) return 0;
  return video.duration * 1000; // convert to milliseconds
}
