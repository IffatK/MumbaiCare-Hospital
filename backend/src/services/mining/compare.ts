/**
 * Algorithm comparison — runs Decision Tree, Random Forest and Naive Bayes on the same
 * train/test split so their metrics are directly comparable.
 */
import { rng, shuffle, rnd2, MiningError, DISCLAIMER } from './random';
import { Row } from './dataset';
import { runDecisionTree } from './decisionTree';
import { runRandomForest } from './randomForest';
import { runNaiveBayes } from './naiveBayes';
export function runComparison(data: Row[], target: string, features: string[], testSize = 0.3) {
  if (data.length < 50) throw new MiningError('Need at least 50 rows for a meaningful comparison.');
  const results: any[] = [];
  const configs = [
    { name: 'Decision Tree (depth 4)', fn: () => runDecisionTree(data, target, features, 4, testSize) },
    { name: 'Decision Tree (depth 6)', fn: () => runDecisionTree(data, target, features, 6, testSize) },
    { name: 'Random Forest (30 trees)', fn: () => runRandomForest(data, target, features, 30, 5, testSize) },
    { name: 'Naive Bayes', fn: () => runNaiveBayes(data, target, features.filter(f => !['gender','disease','hospital','age_group','severity'].includes(f)), testSize) },
  ];
  for (const cfg of configs) {
    try {
      const r = cfg.fn();
      const macroF1 = rnd2(r.perClass.reduce((s: number, c: any) => s + c.f1, 0) / r.perClass.length, 3);
      const macroPrecision = rnd2(r.perClass.reduce((s: number, c: any) => s + c.precision, 0) / r.perClass.length, 3);
      const macroRecall = rnd2(r.perClass.reduce((s: number, c: any) => s + c.recall, 0) / r.perClass.length, 3);
      results.push({ name: cfg.name, accuracy: r.accuracy, macroF1, macroPrecision, macroRecall,
        perClass: r.perClass, confusion: r.confusion, labels: r.labels,
        oobAccuracy: (r as any).oobAccuracy ?? null });
    } catch (e: any) { results.push({ name: cfg.name, error: e.message }); }
  }
  const ranked = [...results].filter(r => !r.error).sort((a, b) => b.accuracy - a.accuracy);
  return { target, features, testSize, results, ranked,
    best: ranked[0] ? { name: ranked[0].name, accuracy: ranked[0].accuracy, macroF1: ranked[0].macroF1 } : null,
    note: 'All classifiers use the same random seed (42) and test-split size for a fair comparison.',
    disclaimer: DISCLAIMER };
}
