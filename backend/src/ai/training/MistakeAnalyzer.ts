import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ExperienceLog } from '../ExperienceBuffer';
import type { ExperienceDecision } from '../ExperienceLogger';
import type { IntentSummary } from '../beliefTypes';
import { createPositionSignature } from './FeatureSignature';
import type { LoggedCandidateMove, MistakeRecord, MistakeType } from './experienceTypes';
import { EXPERIENCE_LOG_PATH, MISTAKE_ANALYSIS_STATE_PATH, MISTAKE_MEMORY_PATH } from './TrainingPaths';

interface AnalyzeResult {
  analyzedGames: number;
  losingGames: number;
  newMistakes: MistakeRecord[];
  savedRecords: number;
  savedTo: string;
  patchFeedback: Array<{ patchId: string; success: boolean }>;
}

export class MistakeAnalyzer {
  constructor(
    private readonly experiencePath: string = EXPERIENCE_LOG_PATH,
    private readonly outputPath: string = MISTAKE_MEMORY_PATH,
    private readonly statePath: string = MISTAKE_ANALYSIS_STATE_PATH,
    private readonly maxRecords: number = 2000,
    private readonly maxExperienceReadBytes: number = 24 * 1024 * 1024
  ) {}

  async analyze(): Promise<AnalyzeResult> {
    const games = await this.readRecentExperiences();
    const existing = await this.readJsonLines<MistakeRecord>(this.outputPath);
    const processedFeedbackGames = await this.readProcessedGameIds();
    const known = new Set(existing.map(record => `${record.gameId}:${record.moveIndex}`));
    const newMistakes: MistakeRecord[] = [];
    const patchFeedback: Array<{ patchId: string; success: boolean }> = [];
    let losingGames = 0;
    for (const game of games) {
      const decisions = (game.decisions || []) as ExperienceDecision[];
      if (!processedFeedbackGames.has(game.gameId)) {
        for (const decision of decisions) {
          const selected = decision.candidateMoveScores?.find(candidate =>
            candidate.move?.from === decision.selectedMove?.from && candidate.move?.to === decision.selectedMove?.to
          );
          for (const patchId of selected?.learnedExperience?.matchedPatchIds || []) {
            patchFeedback.push({ patchId, success: game.result === decision.aiColor });
          }
        }
        processedFeedbackGames.add(game.gameId);
      }
      const losingColors = new Set(
        game.result === 'draw' || !game.result
          ? []
          : decisions.filter(decision => decision.aiColor !== game.result).map(decision => decision.aiColor)
      );
      if (!losingColors.size) continue;
      losingGames++;
      const losingDecisions = decisions.filter(decision => losingColors.has(decision.aiColor));
      const selected = this.criticalDecisions(losingDecisions);
      for (const decision of selected) {
        const key = `${game.gameId}:${decision.ply}`;
        if (known.has(key)) continue;
        const record = this.toRecord(game, decision);
        known.add(key);
        newMistakes.push(record);
      }
    }
    const bounded = [...existing, ...newMistakes].slice(-this.maxRecords);
    await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
    await fs.writeFile(this.outputPath, bounded.map(record => JSON.stringify(record)).join('\n') + (bounded.length ? '\n' : ''), 'utf8');
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    await fs.writeFile(this.statePath, `${JSON.stringify({ processedFeedbackGames: [...processedFeedbackGames].slice(-5000) }, null, 2)}\n`, 'utf8');
    return {
      analyzedGames: games.length,
      losingGames,
      newMistakes,
      savedRecords: bounded.length,
      savedTo: this.outputPath,
      patchFeedback
    };
  }

  private criticalDecisions(decisions: ExperienceDecision[]): ExperienceDecision[] {
    if (!decisions.length) return [];
    const sorted = [...decisions].sort((left, right) => {
      const leftRisk = this.riskValue(left.worstCaseRisk);
      const rightRisk = this.riskValue(right.worstCaseRisk);
      const leftScore = left.finalScore ?? 0;
      const rightScore = right.finalScore ?? 0;
      return (rightRisk - leftRisk) || (leftScore - rightScore);
    });
    return sorted.slice(0, Math.min(3, sorted.length));
  }

  private toRecord(game: ExperienceLog, decision: ExperienceDecision): MistakeRecord {
    const candidates: LoggedCandidateMove[] = (decision.candidateMoveScores || []).map(candidate => ({
      move: candidate.move,
      finalScore: candidate.finalScore,
      riveScore: candidate.riveScore,
      luxScore: candidate.luxScore,
      worstCaseRisk: candidate.worstCaseRisk,
      robustness: candidate.robustness,
      decisionFeatures: candidate.decisionFeatures
    }));
    const selectedScore = decision.finalScore ?? candidates[0]?.finalScore ?? 0;
    const betterAlternatives = candidates.filter(candidate =>
      candidate.move &&
      (candidate.finalScore > selectedScore + 1 ||
        this.riskValue(candidate.worstCaseRisk) < this.riskValue(decision.worstCaseRisk))
    ).slice(0, 3);
    const intent = decision.intentSummary as IntentSummary;
    const memory = decision.beliefSummary?.memory || {
      rememberedEnemyPieces: 0,
      capturedOrMissingPieces: 0,
      suspiciousThreatZones: [],
      likelyKingZones: []
    };
    const types = this.classify(decision, betterAlternatives);
    const severity = Math.min(
      1,
      0.3 + this.riskValue(decision.worstCaseRisk) * 0.2 +
      (game.gameOverReason === 'king-captured' ? 0.3 : 0) +
      (betterAlternatives.length ? 0.15 : 0)
    );
    return {
      mistakeId: uuidv4(),
      gameId: game.gameId,
      moveIndex: decision.ply,
      aiColor: decision.aiColor,
      signature: createPositionSignature(
        { aiColor: decision.aiColor, turn: decision.ply },
        memory,
        intent
      ),
      observationFeatures: candidates[0]?.decisionFeatures || null,
      memorySummary: memory,
      beliefSummary: decision.beliefSummary,
      intentSummary: intent,
      chosenMove: decision.selectedMove,
      chosenMoveScores: {
        finalScore: decision.finalScore,
        riveScore: decision.riveScore,
        luxScore: decision.luxScore,
        worstCaseRisk: decision.worstCaseRisk || null
      },
      candidateMoves: candidates,
      betterAlternatives,
      mistakeType: types,
      severity,
      outcomeAfterMove: `${game.result || 'unknown'}:${game.gameOverReason}`,
      explanation: this.explanation(types, betterAlternatives.length),
      timestamp: new Date().toISOString()
    };
  }

  private classify(decision: ExperienceDecision, alternatives: LoggedCandidateMove[]): MistakeType[] {
    const types: MistakeType[] = [];
    const intent = decision.intentSummary;
    const selected = decision.candidateMoveScores?.[0];
    const features = selected?.decisionFeatures;
    if (decision.worstCaseRisk === 'high' || (features?.worstCaseRisk || 0) > 2) types.push('BadWorstCaseRisk');
    if ((features?.kingSafety || 0) < 0 || intent.kingAttack >= 0.45) types.push('KingSafetyFailure');
    if (intent.tacticalTrap >= 0.45) types.push('HiddenThreatMissed');
    if ((decision.luxScore || 0) < 0.1 && intent.visionExpansion >= 0.4) types.push('VisionNeglect');
    if ((features?.threatCreation || 0) > 1 && (features?.kingSafety || 0) < 1) types.push('OverAggression');
    if ((features?.informationLeakage || 0) > 0.7) types.push('InformationLeakage');
    if (alternatives.length) types.push('TacticalBlunder');
    return types.length ? [...new Set(types)] : ['PoorBeliefEstimate'];
  }

  private explanation(types: MistakeType[], hasAlternatives: number): string {
    return `Loss-associated position marked as ${types.join(', ')}.` +
      (hasAlternatives ? ' Safer or higher-scoring logged alternatives were available.' : ' No clearly superior logged alternative was available.');
  }

  private riskValue(risk: string | null | undefined): number {
    return risk === 'high' ? 3 : risk === 'medium' ? 2 : risk === 'low' ? 1 : 0;
  }

  private async readJsonLines<T>(filePath: string): Promise<T[]> {
    try {
      return (await fs.readFile(filePath, 'utf8'))
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => JSON.parse(line) as T);
    } catch {
      return [];
    }
  }

  private async readRecentExperiences(): Promise<ExperienceLog[]> {
    try {
      const stats = await fs.stat(this.experiencePath);
      const bytesToRead = Math.min(stats.size, this.maxExperienceReadBytes);
      const handle = await fs.open(this.experiencePath, 'r');
      const buffer = Buffer.alloc(bytesToRead);
      try {
        await handle.read(buffer, 0, bytesToRead, stats.size - bytesToRead);
      } finally {
        await handle.close();
      }
      let content = buffer.toString('utf8');
      if (bytesToRead < stats.size) {
        const firstNewline = content.indexOf('\n');
        content = firstNewline >= 0 ? content.slice(firstNewline + 1) : '';
      }
      return content
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => JSON.parse(line) as ExperienceLog);
    } catch {
      return [];
    }
  }

  private async readProcessedGameIds(): Promise<Set<string>> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.statePath, 'utf8')) as { processedFeedbackGames?: string[] };
      return new Set(parsed.processedFeedbackGames || []);
    } catch {
      return new Set<string>();
    }
  }
}
