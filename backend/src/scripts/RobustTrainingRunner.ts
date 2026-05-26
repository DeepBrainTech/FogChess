import { promises as fs } from 'fs';
import path from 'path';
import { runSelfPlayGames } from './SelfPlayRunner';
import { analyzeMistakes } from './AnalyzeMistakes';
import { FailureCurriculum, type TrainingCurriculum } from '../ai/training/FailureCurriculum';
import { WeightTrainer } from '../ai/training/WeightTrainer';
import { EVALUATION_REPORTS_DIRECTORY } from '../ai/training/TrainingPaths';

interface PipelineOptions {
  quick: boolean;
  useStockfish: boolean;
  selfPlayGames: number;
  maxPlies: number;
  populationSize: number;
  generations: number;
  seeds: number[];
  holdoutSeeds: number[];
}

function numberOption(name: string, fallback: number): number {
  const argument = process.argv.find(value => value.startsWith(`--${name}=`));
  const value = argument ? Number(argument.split('=')[1]) : fallback;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function optionsFromArgs(): PipelineOptions {
  const quick = process.argv.includes('--quick');
  return {
    quick,
    useStockfish: process.argv.includes('--stockfish') && !quick,
    selfPlayGames: numberOption('selfplay-games', quick ? 1 : 6),
    maxPlies: numberOption('max-plies', quick ? 8 : 100),
    populationSize: numberOption('population', quick ? 2 : 8),
    generations: numberOption('generations', quick ? 1 : 3),
    seeds: quick ? [17] : [17, 31, 73],
    holdoutSeeds: quick ? [1009] : [1009, 2027, 4051]
  };
}

async function loadCurriculum(): Promise<TrainingCurriculum> {
  return new FailureCurriculum().generate();
}

export async function runRobustTraining(options: PipelineOptions): Promise<unknown> {
  const experiencePath = await runSelfPlayGames({
    games: options.selfPlayGames,
    maxPlies: options.maxPlies,
    useStockfish: options.useStockfish
  });
  const mistakeAnalysisBeforeSearch = await analyzeMistakes();
  const curriculum = await loadCurriculum();
  const trainer = new WeightTrainer();
  const training = await trainer.train({
    populationSize: options.populationSize,
    generations: options.generations,
    eliteCount: options.quick ? 1 : 2,
    gamesPerOpponent: 1,
    maxPlies: options.maxPlies,
    useStockfish: options.useStockfish,
    seeds: options.seeds,
    holdoutSeeds: options.holdoutSeeds,
    holdoutGamesPerOpponent: 1,
    logExperiences: true,
    minimumFitnessGain: options.quick ? 0.001 : 0.03,
    minimumPromotionGames: options.quick ? 8 : undefined,
    headToHeadMinimumWinRate: options.quick ? 0.5 : 0.55,
    opponents: curriculum.trainingOpponents,
    holdoutOpponents: curriculum.holdoutOpponents
  });
  const mistakeAnalysisAfterSearch = await analyzeMistakes();
  const nextCurriculum = await loadCurriculum();
  await fs.mkdir(EVALUATION_REPORTS_DIRECTORY, { recursive: true });
  const reportPath = path.join(EVALUATION_REPORTS_DIRECTORY, `${training.trainingRunId}.json`);
  const report = {
    mode: options.quick ? 'quick' : 'full',
    generatedAt: new Date().toISOString(),
    experiencePath,
    mistakeAnalysisBeforeSearch,
    mistakeAnalysisAfterSearch,
    curriculum,
    nextCurriculum,
    training
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { ...report, reportPath };
}

async function main(): Promise<void> {
  const options = optionsFromArgs();
  const result = await runRobustTraining(options);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
  });
}
