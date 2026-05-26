import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { IntentSummary } from '../beliefTypes';
import type { AiMemoryState, AiObservation } from '../memoryTypes';
import type { AiMove } from '../types';
import { createPositionSignature, movePattern } from './FeatureSignature';
import type { MistakeRecord, PolicyPatch } from './experienceTypes';
import { POLICY_PATCHES_PATH } from './TrainingPaths';

export class PolicyPatchManager {
  private readonly patches: PolicyPatch[];

  constructor(private readonly filePath: string = POLICY_PATCHES_PATH, private readonly maxPatches = 300) {
    this.patches = this.load();
  }

  score(move: AiMove, observation: AiObservation, memory: AiMemoryState, intent: IntentSummary): {
    adjustment: number;
    matchedPatchIds: string[];
  } {
    const signature = createPositionSignature(observation, memory, intent);
    const pattern = movePattern(move);
    let adjustment = 0;
    const matchedPatchIds: string[] = [];
    for (const patch of this.patches) {
      const conditionMatches = Object.entries(patch.condition).every(([key, value]) =>
        signature[key as keyof typeof signature] === value
      );
      if (!conditionMatches || patch.movePattern !== pattern) continue;
      adjustment += patch.adjustment * patch.confidence;
      matchedPatchIds.push(patch.patchId);
    }
    return { adjustment, matchedPatchIds };
  }

  async updateFromMistakes(
    records: MistakeRecord[],
    feedback: Array<{ patchId: string; success: boolean }> = []
  ): Promise<PolicyPatch[]> {
    const all = [...this.patches];
    for (const outcome of feedback) {
      const patch = all.find(candidate => candidate.patchId === outcome.patchId);
      if (!patch) continue;
      const successes = patch.successRate * patch.timesUsed + (outcome.success ? 1 : 0);
      patch.timesUsed++;
      patch.successRate = successes / patch.timesUsed;
      patch.confidence = Math.max(0.05, Math.min(1, patch.confidence + (outcome.success ? 0.02 : -0.04)));
    }
    for (const record of records) {
      const failedPattern = movePattern(record.chosenMove);
      const existing = all.find(patch =>
        patch.movePattern === failedPattern &&
        patch.sourceMistakeType === record.mistakeType[0] &&
        patch.condition.intentBucket === record.signature.intentBucket &&
        patch.condition.kingRiskBucket === record.signature.kingRiskBucket
      );
      if (existing) {
        existing.confidence = Math.min(1, existing.confidence + 0.04 * record.severity);
        continue;
      }
      all.push({
        patchId: uuidv4(),
        condition: {
          gamePhase: record.signature.gamePhase,
          intentBucket: record.signature.intentBucket,
          kingRiskBucket: record.signature.kingRiskBucket
        },
        movePattern: failedPattern,
        adjustment: -Math.min(12, 4 + record.severity * 5),
        sourceMistakeType: record.mistakeType[0],
        confidence: Math.min(0.8, 0.3 + record.severity * 0.2),
        createdAt: new Date().toISOString(),
        timesUsed: 0,
        successRate: 0
      });
      const alternative = record.betterAlternatives[0]?.move;
      if (alternative) {
        all.push({
          patchId: uuidv4(),
          condition: {
            gamePhase: record.signature.gamePhase,
            intentBucket: record.signature.intentBucket,
            kingRiskBucket: record.signature.kingRiskBucket
          },
          movePattern: movePattern(alternative),
          adjustment: Math.min(10, 3 + record.severity * 4),
          sourceMistakeType: record.mistakeType[0],
          confidence: Math.min(0.7, 0.25 + record.severity * 0.2),
          createdAt: new Date().toISOString(),
          timesUsed: 0,
          successRate: 0
        });
      }
    }
    const bounded = all
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.maxPatches);
    await fsPromises.mkdir(path.dirname(this.filePath), { recursive: true });
    await fsPromises.writeFile(this.filePath, `${JSON.stringify(bounded, null, 2)}\n`, 'utf8');
    return bounded;
  }

  private load(): PolicyPatch[] {
    try {
      const value = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as PolicyPatch[];
      return Array.isArray(value) ? value.slice(0, this.maxPatches) : [];
    } catch {
      return [];
    }
  }
}
