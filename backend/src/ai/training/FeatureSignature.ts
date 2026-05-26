import type { IntentSummary } from '../beliefTypes';
import type { AiMemoryState, AiObservation, MemorySummary } from '../memoryTypes';
import type { PositionSignature } from './experienceTypes';

type MemoryInput = AiMemoryState | MemorySummary;

export function createPositionSignature(
  observation: Pick<AiObservation, 'aiColor' | 'turn'>,
  memory: MemoryInput,
  intent: IntentSummary | null
): PositionSignature {
  const highIntent = intent
    ? Object.entries(intent).sort((a, b) => b[1] - a[1])[0]
    : null;
  const rememberedEnemyPieces = 'lastSeenEnemyPieces' in memory
    ? memory.lastSeenEnemyPieces.length
    : memory.rememberedEnemyPieces;
  const threatCount = memory.suspiciousThreatZones.length;
  const kingZones = memory.likelyKingZones.length;
  const kingAttack = intent?.kingAttack || 0;
  const tacticalTrap = intent?.tacticalTrap || 0;
  return {
    aiColor: observation.aiColor,
    gamePhase: observation.turn < 16 ? 'opening' : observation.turn < 48 ? 'middlegame' : 'endgame',
    intentBucket: highIntent && highIntent[1] >= 0.2 ? highIntent[0] : 'unclear',
    uncertaintyBucket: rememberedEnemyPieces + threatCount > 5 ? 'high' : rememberedEnemyPieces + threatCount > 1 ? 'medium' : 'low',
    kingRiskBucket: kingAttack + tacticalTrap >= 1 ? 'critical' : threatCount > 0 || kingAttack >= 0.3 ? 'pressured' : 'safe',
    rememberedEnemyPieces,
    likelyKingZoneCount: kingZones,
    suspiciousThreatZoneCount: threatCount
  };
}

export function signatureSimilarity(left: PositionSignature, right: PositionSignature): number {
  let score = 0;
  if (left.aiColor === right.aiColor) score += 0.15;
  if (left.gamePhase === right.gamePhase) score += 0.2;
  if (left.intentBucket === right.intentBucket) score += 0.2;
  if (left.uncertaintyBucket === right.uncertaintyBucket) score += 0.15;
  if (left.kingRiskBucket === right.kingRiskBucket) score += 0.2;
  if (Math.abs(left.suspiciousThreatZoneCount - right.suspiciousThreatZoneCount) <= 1) score += 0.1;
  return score;
}

export function movePattern(move: { from: string; to: string } | null): string {
  if (!move) return 'none';
  return `${move.from}-${move.to}`;
}
