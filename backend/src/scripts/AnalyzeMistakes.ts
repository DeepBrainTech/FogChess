import { MistakeAnalyzer } from '../ai/training/MistakeAnalyzer';
import { PolicyPatchManager } from '../ai/training/PolicyPatchManager';
import { FailureCurriculum } from '../ai/training/FailureCurriculum';

export async function analyzeMistakes(): Promise<unknown> {
  const analysis = await new MistakeAnalyzer().analyze();
  const patches = await new PolicyPatchManager().updateFromMistakes(analysis.newMistakes, analysis.patchFeedback);
  const curriculum = await new FailureCurriculum().generate();
  return {
    analyzedGames: analysis.analyzedGames,
    losingGames: analysis.losingGames,
    newMistakes: analysis.newMistakes.length,
    savedMistakes: analysis.savedRecords,
    mistakeMemoryPath: analysis.savedTo,
    policyPatchCount: patches.length,
    curriculum
  };
}

if (require.main === module) {
  analyzeMistakes()
    .then(summary => {
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
