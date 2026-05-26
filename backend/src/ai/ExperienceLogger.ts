import type { Move, Room } from '../types';
import type { AiColor, SableFowResult } from './types';
import {
  DEFAULT_EXPERIENCE_BUFFER,
  type ExperienceBuffer,
  type ExperienceLog
} from './ExperienceBuffer';
import { WeightTuningHook } from './WeightTuningHook';

export interface ExperienceDecision {
  ply: number;
  aiColor: AiColor;
  selectedMove: SableFowResult['move'];
  candidateMoveScores: Array<{
    move: SableFowResult['move'];
    finalScore: number;
    riveScore: number;
    luxScore: number;
    tacticalSource: string;
    tacticalCentipawns: number;
    worstCaseRisk: string;
    robustness: number;
    decisionFeatures: SableFowResult['candidateMoves'][number]['decisionFeatures'];
    learnedExperience: SableFowResult['candidateMoves'][number]['learnedExperience'];
  }>;
  riveScore: number | null;
  luxScore: number | null;
  finalScore: number | null;
  worstCaseRisk: SableFowResult['worstCaseRisk'];
  robustness: number | null;
  intentSummary: SableFowResult['intentSummary'];
  beliefSummary: {
    sampledScenarios: number;
    highRiskScenarios: number;
    riskCounts: Record<string, number>;
    sources: string[];
    memory: SableFowResult['memorySummary'];
  };
}

interface PendingExperience {
  gameId: string;
  timestamp: string;
  players: ExperienceLog['players'];
  source: ExperienceLog['source'];
  decisions: ExperienceDecision[];
}

export class ExperienceLogger {
  private readonly games = new Map<string, PendingExperience>();

  constructor(
    private readonly buffer: ExperienceBuffer = DEFAULT_EXPERIENCE_BUFFER,
    private readonly weightTuningHook = new WeightTuningHook()
  ) {}

  beginRoomGame(room: Room): void {
    if (room.gameMode !== 'super-ai') return;
    this.beginGame(
      room.id,
      room.players.map(player => ({
        name: player.name,
        color: player.color,
        role: player.isAi ? 'ai' : 'human'
      })),
      'human-vs-ai'
    );
  }

  beginGame(gameId: string, players: ExperienceLog['players'], source: ExperienceLog['source']): void {
    this.games.set(gameId, {
      gameId,
      timestamp: new Date().toISOString(),
      players,
      source,
      decisions: []
    });
  }

  recordDecision(gameId: string, aiColor: AiColor, ply: number, result: SableFowResult): void {
    const pending = this.games.get(gameId);
    if (!pending) return;
    const riskCounts: Record<string, number> = { low: 0, medium: 0, high: 0 };
    result.sampledScenarios.forEach(scenario => {
      riskCounts[scenario.riskLevel] = (riskCounts[scenario.riskLevel] || 0) + 1;
    });
    pending.decisions.push({
      ply,
      aiColor,
      selectedMove: result.move,
      candidateMoveScores: result.candidateMoves.slice(0, 12).map(candidate => ({
        move: candidate.move,
        finalScore: candidate.finalScore,
        riveScore: candidate.riveScore,
        luxScore: candidate.luxScore,
        tacticalSource: candidate.tacticalOracle.source,
        tacticalCentipawns: candidate.tacticalOracle.centipawns,
        worstCaseRisk: candidate.worstCaseRisk,
        robustness: candidate.robustness,
        decisionFeatures: candidate.decisionFeatures,
        learnedExperience: candidate.learnedExperience
      })),
      riveScore: result.riveScore,
      luxScore: result.luxScore,
      finalScore: result.finalScore,
      worstCaseRisk: result.worstCaseRisk,
      robustness: result.robustness,
      intentSummary: result.intentSummary,
      beliefSummary: {
        sampledScenarios: result.sampledScenarios.length,
        highRiskScenarios: result.highRiskScenarios.length,
        riskCounts,
        sources: [...new Set(result.sampledScenarios.map(scenario => scenario.source))],
        memory: result.memorySummary
      }
    });
  }

  finishRoomGame(room: Room, gameOverReason: string): void {
    void this.finishGame(room.id, room.gameState.moveHistory, room.gameState.winner || null, gameOverReason)
      .catch(error => console.warn('[ExperienceLogger] Failed to persist game log:', error));
  }

  async finishGame(
    gameId: string,
    moveHistory: Move[],
    result: ExperienceLog['result'],
    gameOverReason: string
  ): Promise<void> {
    const pending = this.games.get(gameId);
    if (!pending) return;
    this.games.delete(gameId);
    const log: ExperienceLog = {
      ...pending,
      moveHistory: moveHistory.map(move => ({
        from: move.from,
        to: move.to,
        piece: move.piece,
        captured: move.captured,
        promotion: move.promotion,
        player: move.player,
        timestamp: move.timestamp
      })),
      result,
      gameOverReason
    };
    await this.buffer.append(log);
    this.weightTuningHook.updateWeightsFromGameResult(log);
  }

  getBuffer(): ExperienceBuffer {
    return this.buffer;
  }
}
