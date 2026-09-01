/**
 * Centralized constants for the TalentOS application.
 * Extracts magic numbers and configuration values for better maintainability.
 */

// ============================================================================
// Token Budgeting & Rate Limits
// ============================================================================

/** Tokens-per-minute limits per model (Groq free tier) */
export const MODEL_TPM: Record<string, number> = {
  "openai/gpt-oss-120b": 8000,
  "openai/gpt-oss-20b": 8000,
};

/** Tokens-per-minute limits per provider */
export const PROVIDER_TPM: Record<string, number> = {
  groq: 12000,
  gemini: 100000,
  openrouter: 100000,
  cerebras: 100000,
  nararouter: 300000, // ~5M tokens/day ≈ 3,472 tokens/min average; generous limit for pacing
};

/** Safety margin for token budget usage (85% of limit) */
export const TOKEN_BUDGET_MARGIN = 0.85;

/** Reserved output tokens as fraction of TPM for screening */
export const SCREENING_OUTPUT_RESERVE_FRACTION = 0.28;

/** Minimum available tokens threshold for screening to proceed */
export const MIN_AVAILABLE_TOKENS = 900;

// ============================================================================
// Token Estimation
// ============================================================================

/** Average characters per token for English/mixed text */
export const CHARS_PER_TOKEN = 3.6;

/** Conservative character-to-token ratio for batch planning */
export const CHARS_PER_TOKEN_CONSERVATIVE = 3.2;

// ============================================================================
// Groq API Configuration
// ============================================================================

/** Default max tokens for completions */
export const DEFAULT_MAX_TOKENS = 6000;

/** Minimum reserved tokens for output */
export const MIN_RESERVED_TOKENS = 512;

/** Fraction of TPM to use as effective max tokens */
export const MAX_TOKENS_TPM_FRACTION = 0.4;

/** GPT-OSS specific settings */
export const GPT_OSS_TEMPERATURE = 1;
export const GPT_OSS_TOP_P = 1;
export const GPT_OSS_REASONING_EFFORT = "low" as const;

// ============================================================================
// Retry & Timeout Configuration
// ============================================================================

/** Default number of retries for failed requests */
export const DEFAULT_RETRIES = 2;

/** Backoff delays in milliseconds */
export const RETRY_DELAYS_MS = [9000, 22000];

/** Empty response retry delay */
export const EMPTY_RESPONSE_RETRY_DELAY_MS = 3000;

/** TPM reset wait time */
export const TPM_RESET_WAIT_MS = 62000;

/** Minimum pace wait time */
export const MIN_PACE_WAIT_MS = 1200;

/** Additional buffer for token budget reset */
export const BUDGET_RESET_BUFFER_MS = 400;

// ============================================================================
// CV Processing
// ============================================================================

/** Minimum text length to consider a valid CV block */
export const MIN_CV_BLOCK_LENGTH = 30;

/** Minimum text length for custom separator blocks */
export const MIN_CUSTOM_SEPARATOR_BLOCK_LENGTH = 40;

/** Maximum line length for header detection */
export const MAX_HEADER_LINE_LENGTH = 180;

/** Maximum candidate name length */
export const MAX_CANDIDATE_NAME_LENGTH = 120;

/** Sandwich header middle line max length */
export const SANDWICH_MIDDLE_MAX_LENGTH = 90;

// ============================================================================
// Batch Planning
// ============================================================================

/** Minimum batch characters */
export const MIN_BATCH_CHARS = 1200;

/** Maximum batch characters */
export const MAX_BATCH_CHARS = 42000;

/** Minimum CV cap characters */
export const MIN_CV_CAP_CHARS = 1000;

/** Maximum CV cap characters */
export const MAX_CV_CAP_CHARS = 6000;

/** Per-CV overhead in characters */
export const CV_OVERHEAD_CHARS = 60;

// ============================================================================
// Candidate Scoring
// ============================================================================

/** Minimum score value */
export const MIN_SCORE = 0;

/** Maximum score value */
export const MAX_SCORE = 100;

/** Score threshold for "good" match (green) */
export const SCORE_THRESHOLD_GOOD = 80;

/** Score threshold for "okay" match (yellow) */
export const SCORE_THRESHOLD_OKAY = 60;

// ============================================================================
// Ranking
// ============================================================================

/** Maximum candidates to include in ranking pool */
export const MAX_RANKING_POOL_SIZE = 60;

/** Token budget fraction for ranking pool */
export const RANKING_POOL_TOKEN_FRACTION = 0.8;

// ============================================================================
// UI & Display
// ============================================================================

/** Number of CV previews to show */
export const CV_PREVIEW_COUNT = 6;

/** Shortlist size range */
export const SHORTLIST_MIN_SIZE = 1;
export const SHORTLIST_MAX_SIZE = 50;

// ============================================================================
// Model Filtering
// ============================================================================

/** Patterns to exclude from model lists */
export const EXCLUDED_MODEL_PATTERNS = /embed|tts|whisper|speech|dall|sora|imagen/i;

/** Gemini model filter pattern */
export const GEMINI_MODEL_PATTERN = /gemini/i;

/** OpenRouter free tag pattern */
export const OPENROUTER_FREE_PATTERN = /:free$/;

/** Maximum models to display */
export const MAX_MODELS_DISPLAY = 60;
