import { promises as fs } from 'fs';
import path from 'path';
import type { BenchmarkOpponent } from './EvaluationArena';
import type { MistakeRecord, MistakeType } from './experienceTypes';
import { CURRICULUM_PATH, MISTAKE_MEMORY_PATH } from './TrainingPaths';

export interface TrainingCurriculum {
  generatedAt: string;
  recordsAnalyzed: number;
  mistakeCounts: Partial<Record<MistakeType, number>>;
  prioritizedMistakes: MistakeType[];
  trainingOpponents: BenchmarkOpponent[];
  holdoutOpponents: BenchmarkOpponent[];
  emphasis: string[];
}

export class FailureCurriculum {
  constructor(private readonly mistakePath: string = MISTAKE_MEMORY_PATH, private readonly outputPath: string = CURRICULUM_PATH) {}

  async generate(): Promise<TrainingCurriculum> {
    const records = await this.readRecords();
    const counts: Partial<Record<MistakeType, number>> = {};
    records.forEach(record => record.mistakeType.forEach(type => {
      counts[type] = (counts[type] || 0) + 1;
    }));
    const prioritizedMistakes = (Object.entries(counts) as Array<[MistakeType, number]>)
      .sort((left, right) => right[1] - left[1])
      .map(([type]) => type)
      .slice(0, 4);
    const opponents = new Set<BenchmarkOpponent>(['random', 'greedy', 'current-default', 'legacy-hard']);
    const emphasis: string[] = [];
    if (prioritizedMistakes.includes('KingSafetyFailure')) {
      opponents.add('aggressive');
      emphasis.push('king-safety and immediate king-attack defense');
    }
    if (prioritizedMistakes.includes('HiddenThreatMissed') || prioritizedMistakes.includes('BadWorstCaseRisk')) {
      opponents.add('trap-seeking');
      emphasis.push('hidden tactical traps and worst-case-risk resistance');
    }
    if (prioritizedMistakes.includes('VisionNeglect') || prioritizedMistakes.includes('PoorBeliefEstimate')) {
      opponents.add('information-seeking');
      emphasis.push('vision expansion and uncertainty reduction');
    }
    if (prioritizedMistakes.includes('OverDefense')) {
      opponents.add('material-gain');
      emphasis.push('conversion of safe material opportunities');
    }
    const curriculum: TrainingCurriculum = {
      generatedAt: new Date().toISOString(),
      recordsAnalyzed: records.length,
      mistakeCounts: counts,
      prioritizedMistakes,
      trainingOpponents: [...opponents],
      holdoutOpponents: ['previous-best', 'aggressive', 'trap-seeking', 'legacy-hard'],
      emphasis
    };
    await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
    await fs.writeFile(this.outputPath, `${JSON.stringify(curriculum, null, 2)}\n`, 'utf8');
    return curriculum;
  }

  private async readRecords(): Promise<MistakeRecord[]> {
    try {
      return (await fs.readFile(this.mistakePath, 'utf8'))
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => JSON.parse(line) as MistakeRecord);
    } catch {
      return [];
    }
  }
}
