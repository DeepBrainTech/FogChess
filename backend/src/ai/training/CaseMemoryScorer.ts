import fs from 'fs';
import type { AiMove } from '../types';
import type { AiMemoryState, AiObservation } from '../memoryTypes';
import type { IntentSummary } from '../beliefTypes';
import { MISTAKE_MEMORY_PATH } from './TrainingPaths';
import { createPositionSignature, movePattern, signatureSimilarity } from './FeatureSignature';
import type { CaseMemoryScore, MistakeRecord, MistakeType } from './experienceTypes';

export class CaseMemoryScorer {
  private readonly records: MistakeRecord[];

  constructor(private readonly filePath: string = MISTAKE_MEMORY_PATH, private readonly maxLoadedCases = 500) {
    this.records = this.loadRecords();
  }

  score(
    move: AiMove,
    observation: AiObservation,
    memory: AiMemoryState,
    intent: IntentSummary
  ): CaseMemoryScore {
    const signature = createPositionSignature(observation, memory, intent);
    const candidatePattern = movePattern(move);
    let mistakePenalty = 0;
    let learnedAlternativeBonus = 0;
    const types = new Set<MistakeType>();
    let matchedCasesCount = 0;
    for (const record of this.records) {
      const similarity = signatureSimilarity(signature, record.signature);
      if (similarity < 0.65) continue;
      matchedCasesCount++;
      record.mistakeType.forEach(type => types.add(type));
      const strength = similarity * Math.max(0.2, record.severity);
      if (movePattern(record.chosenMove) === candidatePattern) mistakePenalty += strength * 9;
      if (record.betterAlternatives.some(alternative => movePattern(alternative.move) === candidatePattern)) {
        learnedAlternativeBonus += strength * 6;
      }
    }
    return {
      mistakePenalty,
      learnedAvoidanceScore: mistakePenalty > 0 ? mistakePenalty : 0,
      learnedAlternativeBonus,
      matchedCasesCount,
      matchedMistakeTypes: [...types]
    };
  }

  private loadRecords(): MistakeRecord[] {
    try {
      return fs.readFileSync(this.filePath, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => JSON.parse(line) as MistakeRecord)
        .slice(-this.maxLoadedCases);
    } catch {
      return [];
    }
  }
}
