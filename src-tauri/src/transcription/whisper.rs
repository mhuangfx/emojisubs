// Whisper integration with chunked audio support
use whisper_rs::{WhisperContext, WhisperContextParameters, FullParams, SamplingStrategy};
use std::path::Path;
use super::models::{Word, TranscriptionResult};
use super::audio::AudioChunk;

pub struct WhisperTranscriber {
    context: WhisperContext,
}

impl WhisperTranscriber {
    pub fn new(model_path: &Path) -> Result<Self, String> {
        let context = WhisperContext::new_with_params(
            model_path.to_str().ok_or("Invalid model path")?,
            WhisperContextParameters::default()
        ).map_err(|e| format!("Failed to load Whisper model: {:?}", e))?;

        Ok(Self { context })
    }

    /// Transcribe a single audio chunk
    pub fn transcribe_chunk(
        &self,
        audio_data: &[f32],
        chunk_start_time: f64,
        language: Option<&str>,
    ) -> Result<TranscriptionResult, String> {
        // Create transcription parameters
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

        params.set_print_progress(true);  // Show progress
        params.set_print_special(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(true);
        params.set_translate(false);
        params.set_language(language);
        // Limit to 8 threads to avoid overloading the system
        let n_threads = std::cmp::min(8, num_cpus::get() as i32);
        println!("Using {} threads for transcription", n_threads);
        params.set_n_threads(n_threads);
        params.set_token_timestamps(true); // Enable word-level timestamps

        // Create state and run transcription
        println!("Creating Whisper state...");
        let mut state = self.context.create_state()
            .map_err(|e| format!("Failed to create Whisper state: {:?}", e))?;

        println!("Running Whisper transcription on {} samples...", audio_data.len());
        let start_time = std::time::Instant::now();

        state.full(params, audio_data)
            .map_err(|e| format!("Transcription failed: {:?}", e))?;

        let elapsed = start_time.elapsed();
        println!("Transcription completed in {:.2}s", elapsed.as_secs_f32());

        // Hybrid approach: Use segments for clean text, tokens for word-level splitting
        let num_segments = state.full_n_segments()
            .map_err(|e| format!("Failed to get segment count: {:?}", e))?;
        println!("Found {} segments", num_segments);

        let mut words = Vec::new();
        let mut full_text = String::new();

        for i in 0..num_segments {
            println!("Processing segment {}/{}", i + 1, num_segments);

            // Get clean segment text for display
            let segment_text = state.full_get_segment_text(i)
                .map_err(|e| format!("Failed to get segment text: {:?}", e))?;

            // Get segment timestamps
            let segment_start = (state.full_get_segment_t0(i)
                .map_err(|e| format!("Failed to get start time: {:?}", e))? as f64 * 10.0)
                + (chunk_start_time * 1000.0);

            let segment_end = (state.full_get_segment_t1(i)
                .map_err(|e| format!("Failed to get end time: {:?}", e))? as f64 * 10.0)
                + (chunk_start_time * 1000.0);

            let trimmed_segment = segment_text.trim();
            if trimmed_segment.is_empty() {
                continue;
            }

            // Get word-level tokens for this segment for splitting capability
            let token_count = state.full_n_tokens(i)
                .map_err(|e| format!("Failed to get token count for segment {}: {:?}", i, e))?;
            println!("  Segment has {} tokens", token_count);

            let mut segment_words = Vec::new();
            for token_idx in 0..token_count {
                let token_text = state.full_get_token_text(i, token_idx)
                    .map_err(|e| format!("Failed to get token text: {:?}", e))?;

                let token_data = state.full_get_token_data(i, token_idx)
                    .map_err(|e| format!("Failed to get token data: {:?}", e))?;

                let start_time = (token_data.t0 as f64 * 10.0) + (chunk_start_time * 1000.0);
                let end_time = (token_data.t1 as f64 * 10.0) + (chunk_start_time * 1000.0);

                let trimmed_text = token_text.trim();

                // Filter out special tokens and empty tokens
                if trimmed_text.is_empty()
                    || trimmed_text.starts_with('[')
                    || trimmed_text.starts_with('<') {
                    continue;
                }

                segment_words.push(Word {
                    text: trimmed_text.to_string(),
                    start: start_time,
                    end: end_time,
                    confidence: Some(token_data.p),
                });
            }

            // Create one segment-level word with clean text, but include token-level words for splitting
            // If we have token words, use them; otherwise create a single word from the segment
            if segment_words.is_empty() {
                // Fallback: use segment as a single word
                words.push(Word {
                    text: trimmed_segment.to_string(),
                    start: segment_start,
                    end: segment_end,
                    confidence: Some(0.95),
                });
            } else {
                // Use the token-level words for splitting capability
                words.extend(segment_words);
            }

            full_text.push_str(trimmed_segment);
            full_text.push(' ');
        }

        Ok(TranscriptionResult {
            words,
            full_text: full_text.trim().to_string(),
        })
    }

    /// Transcribe audio with automatic chunking for better performance
    pub fn transcribe_with_chunks(
        &self,
        chunks: &[AudioChunk],
        language: Option<&str>,
        on_progress: Option<Box<dyn Fn(f32) + Send>>,
    ) -> Result<TranscriptionResult, String> {
        let total_chunks = chunks.len();
        let mut all_words = Vec::new();
        let mut full_text = String::new();

        for (idx, chunk) in chunks.iter().enumerate() {
            println!("Transcribing chunk {}/{}", idx + 1, total_chunks);

            // Transcribe this chunk
            let chunk_result = self.transcribe_chunk(
                &chunk.samples,
                chunk.start_time,
                language,
            )?;

            // Merge results
            all_words.extend(chunk_result.words);
            full_text.push_str(&chunk_result.full_text);
            full_text.push(' ');

            // Report progress
            if let Some(ref callback) = on_progress {
                let progress = ((idx + 1) as f32 / total_chunks as f32) * 100.0;
                callback(progress);
            }
        }

        // Post-process: Remove duplicate words at chunk boundaries
        let deduplicated_words = deduplicate_overlapping_words(all_words);

        Ok(TranscriptionResult {
            words: deduplicated_words,
            full_text: full_text.trim().to_string(),
        })
    }
}

/// Remove duplicate words that appear at chunk boundaries due to overlap
fn deduplicate_overlapping_words(words: Vec<Word>) -> Vec<Word> {
    if words.len() <= 1 {
        return words;
    }

    let mut deduplicated = Vec::new();
    let mut skip_until = 0.0;

    for (i, word) in words.iter().enumerate() {
        // Skip words that are in the overlap region we've already processed
        if word.start < skip_until {
            continue;
        }

        // Check if the next word is very close in time (likely a duplicate)
        if i + 1 < words.len() {
            let next_word = &words[i + 1];
            let time_diff = (next_word.start - word.start).abs();

            // If words start within 100ms and have similar text, it's likely a duplicate
            if time_diff < 100.0 && words_are_similar(&word.text, &next_word.text) {
                // Keep the first occurrence, skip the next
                skip_until = next_word.end;
            }
        }

        deduplicated.push(word.clone());
    }

    deduplicated
}

/// Check if two words are similar enough to be considered duplicates
fn words_are_similar(word1: &str, word2: &str) -> bool {
    let w1 = word1.trim().to_lowercase();
    let w2 = word2.trim().to_lowercase();

    // Exact match
    if w1 == w2 {
        return true;
    }

    // One contains the other (handles partial transcriptions)
    if w1.contains(&w2) || w2.contains(&w1) {
        return true;
    }

    false
}
