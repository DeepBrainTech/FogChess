import path from 'path';

export const AI_CONFIG_DIRECTORY = path.resolve(__dirname, '../../../data/ai_configs');
export const AI_TRAINING_DIRECTORY = path.resolve(__dirname, '../../../data/ai_training');
export const EXPERIENCE_LOG_PATH = path.resolve(__dirname, '../../../data/experience/games.jsonl');
export const CANDIDATE_RESULTS_PATH = path.join(AI_CONFIG_DIRECTORY, 'candidate_results.json');
export const MISTAKE_MEMORY_PATH = path.join(AI_TRAINING_DIRECTORY, 'mistakes', 'mistake_memory.jsonl');
export const MISTAKE_ANALYSIS_STATE_PATH = path.join(AI_TRAINING_DIRECTORY, 'mistakes', 'analysis_state.json');
export const POLICY_PATCHES_PATH = path.join(AI_TRAINING_DIRECTORY, 'policy_patches.json');
export const CURRICULUM_PATH = path.join(AI_TRAINING_DIRECTORY, 'curriculum', 'current_curriculum.json');
export const TRAINING_RUNS_DIRECTORY = path.join(AI_TRAINING_DIRECTORY, 'training_runs');
export const EVALUATION_REPORTS_DIRECTORY = path.join(AI_TRAINING_DIRECTORY, 'evaluation_reports');
