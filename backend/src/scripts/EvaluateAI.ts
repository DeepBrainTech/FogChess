import { DEFAULT_AI_CONFIG, loadSavedBestConfig } from '../ai/AiConfig';
import { EvaluationArena } from '../ai/training/EvaluationArena';
import type { BenchmarkOpponent } from '../ai/training/EvaluationArena';

function numberOption(name: string, fallback: number): number {
  const arg = process.argv.find(value => value.startsWith(`--${name}=`));
  const value = arg ? Number(arg.split('=')[1]) : fallback;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

async function main(): Promise<void> {
  const saved = loadSavedBestConfig();
  const config = process.argv.includes('--best') && saved ? saved.configWeights : DEFAULT_AI_CONFIG;
  const arena = new EvaluationArena();
  const opponents: BenchmarkOpponent[] | undefined = process.argv.includes('--legacy-hard')
    ? ['legacy-hard', 'previous-best']
    : undefined;
  const metrics = await arena.evaluate(config, {
    gamesPerOpponent: numberOption('games-per-opponent', 1),
    maxPlies: numberOption('max-plies', 30),
    useStockfish: process.argv.includes('--stockfish'),
    opponents
  });
  console.log(JSON.stringify({
    evaluatedConfig: process.argv.includes('--best') && saved ? 'best-config' : 'default-config',
    metrics,
    fitness: arena.fitness(metrics)
  }, null, 2));
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
