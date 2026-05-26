import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  BEST_AI_CONFIG_PATH,
  DEFAULT_AI_CONFIG,
  loadSavedBestConfig,
  type AiConfig,
  type SavedAiConfig
} from '../AiConfig';
import {
  EvaluationArena,
  type BenchmarkOpponent,
  type EvaluationMetrics,
  type EvaluationOptions
} from './EvaluationArena';
import { PromotionGate, type PromotionDecision } from './PromotionGate';
import {
  TRAINABLE_WEIGHT_RANGES,
  applyTrainableWeights,
  clampConfig,
  configWeights,
  type TrainableWeightKey
} from './TrainingConfig';
import { CANDIDATE_RESULTS_PATH, TRAINING_RUNS_DIRECTORY } from './TrainingPaths';

export interface TrainingOptions {
  candidates?: number;
  populationSize?: number;
  generations?: number;
  eliteCount?: number;
  gamesPerOpponent?: number;
  maxPlies?: number;
  useStockfish?: boolean;
  seed?: number;
  seeds?: number[];
  outputPath?: string;
  opponents?: BenchmarkOpponent[];
  holdoutOpponents?: BenchmarkOpponent[];
  holdoutSeeds?: number[];
  holdoutGamesPerOpponent?: number;
  minimumFitnessGain?: number;
  headToHeadMinimumWinRate?: number;
  minimumPromotionGames?: number;
  logExperiences?: boolean;
}

export interface EvaluatedConfig {
  name: string;
  generation: number;
  fitness: number;
  metrics: EvaluationMetrics;
  weights: Record<string, number>;
  config: AiConfig;
}

export interface TrainingSummary {
  method: 'evolutionary-search';
  trainingRunId: string;
  timestamp: string;
  numberOfGames: number;
  best: EvaluatedConfig;
  challenger: Omit<EvaluatedConfig, 'config'> | null;
  promoted: boolean;
  promotionReason: string;
  gateMetrics: EvaluationMetrics | null;
  promotionDecision: PromotionDecision | null;
  evaluated: Array<Omit<EvaluatedConfig, 'config'>>;
  previousBestComparison: {
    available: boolean;
    fitness: number | null;
    metrics: EvaluationMetrics | null;
  };
  savedTo: string;
  candidateResultsPath: string;
  trainingRunPath: string;
}

export class WeightTrainer {
  constructor(
    private readonly arena = new EvaluationArena(),
    private readonly promotionGate = new PromotionGate(arena)
  ) {}

  async train(options: TrainingOptions = {}): Promise<TrainingSummary> {
    const runId = `weight-train-${Date.now()}-${uuidv4()}`;
    const timestamp = new Date().toISOString();
    const previousBest = loadSavedBestConfig();
    const incumbentConfig = this.deployableBase(previousBest?.configWeights || DEFAULT_AI_CONFIG);
    const populationSize = Math.max(2, options.populationSize ?? options.candidates ?? 6);
    const generations = Math.max(1, options.generations ?? 2);
    const eliteCount = Math.min(populationSize, Math.max(1, options.eliteCount ?? 2));
    const seed = options.seed ?? Date.now();
    const trainingEvaluation: EvaluationOptions = {
      opponents: options.opponents || ['random', 'greedy', 'current-default', 'aggressive', 'trap-seeking', 'information-seeking', 'legacy-hard'],
      seeds: options.seeds || [seed, seed + 101],
      gamesPerOpponent: options.gamesPerOpponent ?? 1,
      maxPlies: options.maxPlies ?? 50,
      useStockfish: options.useStockfish ?? false,
      logExperiences: options.logExperiences ?? false
    };
    let population = this.initialPopulation(incumbentConfig, populationSize, seed, trainingEvaluation.useStockfish || false);
    const allEvaluated: EvaluatedConfig[] = [];
    let numberOfGames = 0;
    let incumbentEvaluation: EvaluatedConfig | null = null;

    for (let generation = 0; generation < generations; generation++) {
      const generationResults: EvaluatedConfig[] = [];
      for (const candidate of population) {
        const metrics = await this.arena.evaluate(candidate.config, trainingEvaluation);
        const evaluated = {
          name: candidate.name,
          generation,
          fitness: this.arena.fitness(metrics),
          metrics,
          weights: configWeights(candidate.config),
          config: candidate.config
        };
        generationResults.push(evaluated);
        allEvaluated.push(evaluated);
        numberOfGames += metrics.totalGames;
        if (candidate.name === 'current-champion' && !incumbentEvaluation) incumbentEvaluation = evaluated;
      }
      generationResults.sort((left, right) => right.fitness - left.fitness);
      const elites = generationResults.slice(0, eliteCount);
      population = this.nextPopulation(elites, populationSize, seed + generation * 1000, trainingEvaluation.useStockfish || false);
    }

    if (!incumbentEvaluation) {
      const metrics = await this.arena.evaluate(this.forTraining(incumbentConfig, trainingEvaluation.useStockfish || false), trainingEvaluation);
      incumbentEvaluation = {
        name: 'current-champion',
        generation: -1,
        fitness: this.arena.fitness(metrics),
        metrics,
        weights: configWeights(incumbentConfig),
        config: incumbentConfig
      };
      numberOfGames += metrics.totalGames;
    }
    const challengers = allEvaluated
      .filter(candidate => candidate.name !== 'current-champion')
      .sort((left, right) => right.fitness - left.fitness);
    const challenger = challengers[0] || null;
    const candidateDeployable = challenger
      ? applyTrainableWeights(incumbentConfig, challenger.config)
      : incumbentConfig;
    let promotionDecision: PromotionDecision | null = null;
    let promoted = false;
    let promotionReason = 'No promotion this run: no challenger evaluated.';
    const trainingMargin = challenger ? challenger.fitness - incumbentEvaluation.fitness : -Infinity;
    if (challenger && trainingMargin >= (options.minimumFitnessGain ?? 0.02)) {
      const holdoutOpponents = options.holdoutOpponents || ['previous-best', 'defensive', 'aggressive', 'trap-seeking', 'legacy-hard'];
      const holdoutSeeds = options.holdoutSeeds || [seed + 10001, seed + 20003];
      const holdoutGames = options.holdoutGamesPerOpponent ?? 1;
      promotionDecision = await this.promotionGate.evaluate(candidateDeployable, incumbentConfig, {
        holdoutOpponents,
        holdoutSeeds,
        gamesPerOpponent: holdoutGames,
        maxPlies: options.maxPlies ?? 50,
        useStockfish: options.useStockfish ?? false,
        minimumGames: options.minimumPromotionGames ?? holdoutOpponents.length * holdoutSeeds.length * Math.max(2, holdoutGames),
        minimumFitnessMargin: options.minimumFitnessGain ?? 0.02,
        headToHeadMinimumWinRate: options.headToHeadMinimumWinRate ?? 0.55,
        maximumHighRiskRegression: 0.05
      });
      numberOfGames += promotionDecision.candidateHoldout.totalGames + promotionDecision.incumbentHoldout.totalGames;
      promoted = promotionDecision.promoted;
      promotionReason = promoted
        ? 'Promoted new best config: challenger passed training and holdout PromotionGate.'
        : `No promotion this run: ${promotionDecision.reasons.join('; ')}.`;
    } else if (challenger) {
      promotionReason = 'No promotion this run: challenger did not clear training fitness margin.';
    }

    const selected = promoted && challenger ? challenger : incumbentEvaluation;
    const outputPath = options.outputPath || BEST_AI_CONFIG_PATH;
    if (promoted || !previousBest) {
      const persisted: SavedAiConfig = {
        trainingRunId: runId,
        timestamp,
        numberOfGames,
        evaluationResult: promoted && promotionDecision ? promotionDecision.candidateHoldout : selected.metrics,
        configWeights: promoted ? candidateDeployable : incumbentConfig,
        previousBestComparison: promotionDecision || {
          promoted: false,
          reason: promotionReason,
          incumbentFitness: incumbentEvaluation.fitness
        }
      };
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
    }
    const candidateReport = {
      trainingRunId: runId,
      timestamp,
      method: 'evolutionary-search',
      promoted,
      promotionReason,
      incumbent: this.withoutConfig(incumbentEvaluation),
      challenger: challenger ? this.withoutConfig(challenger) : null,
      promotionDecision,
      evaluated: allEvaluated.map(candidate => this.withoutConfig(candidate))
    };
    await fs.mkdir(path.dirname(CANDIDATE_RESULTS_PATH), { recursive: true });
    await fs.writeFile(CANDIDATE_RESULTS_PATH, `${JSON.stringify(candidateReport, null, 2)}\n`, 'utf8');
    await fs.mkdir(TRAINING_RUNS_DIRECTORY, { recursive: true });
    const trainingRunPath = path.join(TRAINING_RUNS_DIRECTORY, `${runId}.json`);
    await fs.writeFile(trainingRunPath, `${JSON.stringify({ ...candidateReport, numberOfGames }, null, 2)}\n`, 'utf8');
    return {
      method: 'evolutionary-search',
      trainingRunId: runId,
      timestamp,
      numberOfGames,
      best: selected,
      challenger: challenger ? this.withoutConfig(challenger) : null,
      promoted,
      promotionReason,
      gateMetrics: promotionDecision?.candidateHoldout || null,
      promotionDecision,
      evaluated: allEvaluated.map(candidate => this.withoutConfig(candidate)),
      previousBestComparison: {
        available: !!previousBest,
        fitness: incumbentEvaluation.fitness,
        metrics: incumbentEvaluation.metrics
      },
      savedTo: outputPath,
      candidateResultsPath: CANDIDATE_RESULTS_PATH,
      trainingRunPath
    };
  }

  private initialPopulation(base: AiConfig, count: number, seed: number, useStockfish: boolean): Array<{ name: string; config: AiConfig }> {
    const population = [{ name: 'current-champion', config: this.forTraining(base, useStockfish) }];
    if (count > 1) population.push({ name: 'default-anchor', config: this.forTraining(DEFAULT_AI_CONFIG, useStockfish) });
    while (population.length < count) {
      const index = population.length;
      population.push({
        name: `candidate-${index}`,
        config: this.mutate(base, seed + index, useStockfish, this.mutationScale(index))
      });
    }
    return population;
  }

  private nextPopulation(elites: EvaluatedConfig[], count: number, seed: number, useStockfish: boolean): Array<{ name: string; config: AiConfig }> {
    const population = elites.map((elite, index) => ({
      name: index === 0 ? 'elite-challenger' : `elite-${index}`,
      config: elite.config
    }));
    while (population.length < count) {
      const index = population.length;
      const parent = elites[index % elites.length].config;
      population.push({
        name: `offspring-${index}`,
        config: this.mutate(parent, seed + index, useStockfish, this.mutationScale(index))
      });
    }
    return population;
  }

  private mutate(base: AiConfig, seed: number, useStockfish: boolean, multiplier: number): AiConfig {
    let state = seed >>> 0;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    const mutated = { ...base };
    for (const key of Object.keys(TRAINABLE_WEIGHT_RANGES) as TrainableWeightKey[]) {
      mutated[key] += (random() * 2 - 1) * TRAINABLE_WEIGHT_RANGES[key].mutationScale * multiplier;
    }
    return this.forTraining(clampConfig(mutated), useStockfish);
  }

  private deployableBase(config: AiConfig): AiConfig {
    return {
      ...DEFAULT_AI_CONFIG,
      ...config,
      beliefPoolSize: DEFAULT_AI_CONFIG.beliefPoolSize,
      beliefSampleCount: DEFAULT_AI_CONFIG.beliefSampleCount,
      useStockfish: DEFAULT_AI_CONFIG.useStockfish
    };
  }

  private forTraining(config: AiConfig, useStockfish: boolean): AiConfig {
    return clampConfig({
      ...config,
      useStockfish,
      beliefPoolSize: Math.min(config.beliefPoolSize, 20),
      beliefSampleCount: Math.min(config.beliefSampleCount, 12)
    });
  }

  private mutationScale(index: number): number {
    return [0.35, 0.7, 1, 1.5, 2.25][index % 5];
  }

  private withoutConfig(candidate: EvaluatedConfig): Omit<EvaluatedConfig, 'config'> {
    const { config: _config, ...summary } = candidate;
    return summary;
  }
}
