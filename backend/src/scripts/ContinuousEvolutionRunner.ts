import { promises as fs } from 'fs';
import path from 'path';
import { WeightTrainer } from '../ai/training/WeightTrainer';
import { FailureCurriculum } from '../ai/training/FailureCurriculum';
import { runSelfPlayGames } from './SelfPlayRunner';
import { analyzeMistakes } from './AnalyzeMistakes';

interface EvolutionOptions {
  cycles: number;
  candidates: number;
  gamesPerOpponent: number;
  maxPlies: number;
  pauseMs: number;
  useStockfish: boolean;
  gateGamesPerOpponent: number;
}

function nonNegativeOption(name: string, fallback: number): number {
  const arg = process.argv.find(value => value.startsWith(`--${name}=`));
  const value = arg ? Number(arg.split('=')[1]) : fallback;
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function positiveOption(name: string, fallback: number): number {
  const value = nonNegativeOption(name, fallback);
  return value > 0 ? value : fallback;
}

function optionsFromArgs(): EvolutionOptions {
  return {
    cycles: nonNegativeOption('cycles', 0),
    candidates: positiveOption('candidates', 4),
    gamesPerOpponent: positiveOption('games-per-opponent', 2),
    maxPlies: positiveOption('max-plies', 80),
    pauseMs: nonNegativeOption('pause-ms', 1000),
    useStockfish: process.argv.includes('--stockfish'),
    gateGamesPerOpponent: positiveOption('gate-games-per-opponent', 4)
  };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function localTimestamp(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}

async function main(): Promise<void> {
  const options = optionsFromArgs();
  const outputDirectory = path.resolve(__dirname, '../../data/ai_configs');
  const historyPath = path.join(outputDirectory, 'evolution_history.jsonl');
  const statusPath = path.join(outputDirectory, 'evolution_status.json');
  const trainer = new WeightTrainer();
  let stopRequested = false;
  let totalGames = 0;
  let promotions = 0;

  process.once('SIGINT', () => { stopRequested = true; });
  process.once('SIGTERM', () => { stopRequested = true; });

  await fs.mkdir(outputDirectory, { recursive: true });
  console.log(JSON.stringify({
    event: 'evolution-started',
    pid: process.pid,
    screeningOpponent: 'legacy-hard',
    championGateOpponent: 'previous-best',
    cycles: options.cycles === 0 ? 'continuous' : options.cycles,
    options,
    historyPath,
    statusPath
  }));
  console.log(`[训练启动] 本地时间 ${localTimestamp()} | 专项对手: 最高级普通 AI | 守门对手: 上一代冠军`);

  let cycle = 0;
  while (!stopRequested && (options.cycles === 0 || cycle < options.cycles)) {
    cycle++;
    await runSelfPlayGames({
      games: 1,
      maxPlies: options.maxPlies,
      useStockfish: options.useStockfish
    });
    const analysisBeforeSearch = await analyzeMistakes();
    const curriculum = await new FailureCurriculum().generate();
    const summary = await trainer.train({
      populationSize: options.candidates,
      generations: 2,
      eliteCount: 2,
      gamesPerOpponent: options.gamesPerOpponent,
      maxPlies: options.maxPlies,
      useStockfish: options.useStockfish,
      logExperiences: true,
      opponents: curriculum.trainingOpponents,
      seeds: [17, 31],
      minimumFitnessGain: 0.001,
      holdoutOpponents: curriculum.holdoutOpponents,
      holdoutSeeds: [1009, 2027],
      holdoutGamesPerOpponent: options.gateGamesPerOpponent,
      headToHeadMinimumWinRate: 0.55
    });
    const analysisAfterSearch = await analyzeMistakes();
    totalGames += summary.numberOfGames;
    if (summary.promoted) promotions++;
    const record = {
      cycle,
      timestamp: summary.timestamp,
      localTime: localTimestamp(),
      trainingRunId: summary.trainingRunId,
      method: summary.method,
      screeningOpponent: 'legacy-hard',
      championGateOpponent: 'previous-best',
      gamesThisCycle: summary.numberOfGames,
      totalGames,
      promotions,
      promoted: summary.promoted,
      promotionReason: summary.promotionReason,
      fitness: summary.best.fitness,
      metrics: summary.best.metrics,
      challenger: summary.challenger,
      gateMetrics: summary.gateMetrics,
      curriculum,
      analysisBeforeSearch,
      analysisAfterSearch,
      savedTo: summary.savedTo
    };
    await fs.appendFile(historyPath, `${JSON.stringify(record)}\n`, 'utf8');
    await fs.writeFile(statusPath, `${JSON.stringify({ running: true, pid: process.pid, ...record }, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ event: summary.promoted ? 'champion-promoted' : 'champion-retained', ...record }));
    const target = summary.best.metrics.byOpponent['legacy-hard'];
    console.log(
      `[第 ${cycle} 轮完成] 本地时间 ${record.localTime} | 本轮 ${record.gamesThisCycle} 局 | ` +
      `累计 ${totalGames} 局 | ${summary.promoted ? '新冠军晋级' : '冠军保留'} | ` +
      `对最高级 AI: ${target?.wins || 0}胜 ${target?.draws || 0}和 ${target?.losses || 0}负`
    );
    if (!stopRequested && (options.cycles === 0 || cycle < options.cycles) && options.pauseMs > 0) {
      await wait(options.pauseMs);
    }
  }

  await fs.writeFile(statusPath, `${JSON.stringify({
    running: false,
    pid: process.pid,
    stoppedAt: new Date().toISOString(),
    completedCycles: cycle,
    totalGames,
    promotions
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ event: 'evolution-stopped', completedCycles: cycle, totalGames, promotions }));
  console.log(`[训练停止] 本地时间 ${localTimestamp()} | 累计 ${totalGames} 局 | 新冠军晋级 ${promotions} 次`);
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
