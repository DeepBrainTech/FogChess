import type { ExperienceLog } from './ExperienceBuffer';

export interface WeightTuningSuggestion {
  gameId: string;
  applied: false;
  suggestions: string[];
}

export class WeightTuningHook {
  updateWeightsFromGameResult(gameLog: ExperienceLog): WeightTuningSuggestion {
    const suggestions: string[] = [];
    if (gameLog.decisions.length === 0) {
      suggestions.push('No AI decisions recorded; do not tune weights from this game.');
    } else if (gameLog.result === 'draw') {
      suggestions.push('Retain current weights until more decisive games are available.');
    } else {
      suggestions.push('Queue this labelled result for offline weight analysis.');
    }
    return { gameId: gameLog.gameId, applied: false, suggestions };
  }
}
