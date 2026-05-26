import { runRobustTraining } from './RobustTrainingRunner';

runRobustTraining({
  quick: false,
  useStockfish: process.argv.includes('--stockfish'),
  selfPlayGames: 4,
  maxPlies: 80,
  populationSize: 6,
  generations: 2,
  seeds: [17, 31],
  holdoutSeeds: [1009, 2027]
}).then(summary => {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}).catch(error => {
  console.error(error);
  process.exit(1);
});
