import type { AiMove } from './types';
import type { AiMemoryState, AiObservation } from './memoryTypes';
import type { BeliefScenario } from './beliefTypes';

/** Future model hooks. No trained model is bundled or invoked in this phase. */
export interface BeliefModel {
  generateScenarios(observation: AiObservation, memory: AiMemoryState): Promise<BeliefScenario[]>;
}

export interface PolicyValueModel {
  evaluateMoves(observation: AiObservation, candidateMoves: AiMove[]): Promise<Array<{
    move: AiMove;
    policy: number;
    value: number;
  }>>;
}

export interface RiskModel {
  scoreRisk(observation: AiObservation, move: AiMove, scenarios: BeliefScenario[]): Promise<number>;
}

export interface InformationGainModel {
  scoreInformationGain(observation: AiObservation, move: AiMove, scenarios: BeliefScenario[]): Promise<number>;
}
