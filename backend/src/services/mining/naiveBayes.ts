/**
 * Gaussian Naive Bayes classifier.
 * Assumes features are normally distributed within each class.
 * Very fast, needs no tree building, and the per-class probabilities are interpretable.
 */
import { rng, shuffle, rnd2, MiningError, DISCLAIMER } from './random';
import { Row } from './dataset';

type Stats = { mean: number; variance: number; count: number };
const logGaussian = (x: number, mu: number, sigma2: number) => -0.5 * Math.log(2 * Math.PI * sigma2) - (x - mu) ** 2 / (2 * sigma2);

export function runNaiveBayes(data: Row[], target: string, features: string[], testSize = 0.3) {
  if (features.includes(target)) throw new MiningError('Target cannot be a feature.');
  // only numerical features
  const numFeatures = features.filter(f => !['gender', 'disease', 'hospital', 'age_group', 'severity'].includes(f));
  if (numFeatures.length < 1) throw new MiningError('Naive Bayes needs at least one numerical feature.');
  const rows = data.filter(r => [...numFeatures, target].every(f => (r as any)[f] !== null && (r as any)[f] !== undefined && (r as any)[f] !== ''));
  if (rows.length < 20) throw new MiningError('Not enough complete rows.');
  const y = rows.map(r => String((r as any)[target]));
  const labels = [...new Set(y)].sort();
  // stratified split
  const rand = rng(); const train: number[] = [], test: number[] = [];
  for (const l of labels) { const ids = shuffle(y.map((c, i) => c === l ? i : -1).filter(i => i >= 0), rand);
    const nt = Math.round(ids.length * testSize); test.push(...ids.slice(0, nt)); train.push(...ids.slice(nt)); }
  // fit: compute per-class mean and variance for each feature
  const classPrior: Record<string, number> = {};
  const stats: Record<string, Record<string, Stats>> = {}; // stats[class][feature]
  for (const l of labels) {
    const idx = train.filter(i => y[i] === l); classPrior[l] = idx.length / train.length;
    stats[l] = {};
    for (const f of numFeatures) {
      const vs = idx.map(i => (rows[i] as any)[f] as number);
      const mean = vs.reduce((a, b) => a + b, 0) / vs.length;
      const variance = vs.reduce((s, v) => s + (v - mean) ** 2, 0) / vs.length + 1e-9; // Laplace smoothing
      stats[l][f] = { mean, variance, count: idx.length };
    }
  }
  // predict
  const predictOne = (row: Row) => {
    let bestL = labels[0], bestScore = -Infinity;
    const probs: Record<string, number> = {};
    for (const l of labels) {
      let score = Math.log(classPrior[l]);
      for (const f of numFeatures) { const { mean, variance } = stats[l][f]; score += logGaussian((row as any)[f], mean, variance); }
      probs[l] = score; if (score > bestScore) { bestScore = score; bestL = l; }
    }
    return { predicted: bestL, logProbs: probs };
  };
  const testRows = test.map(i => rows[i]); const testY = test.map(i => y[i]);
  const preds = testRows.map(r => predictOne(r).predicted);
  const correct = preds.filter((p, i) => p === testY[i]).length;
  const confusion = labels.map(a => labels.map(p => test.filter((_, j) => testY[j] === a && preds[j] === p).length));
  const perClass = labels.map((l, li) => {
    const tp = confusion[li][li], fp = labels.reduce((s, _, a) => s + (a !== li ? confusion[a][li] : 0), 0), fn = confusion[li].reduce((s, v, p) => s + (p !== li ? v : 0), 0);
    const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0;
    return { label: l, precision: rnd2(precision, 3), recall: rnd2(recall, 3), f1: rnd2(precision + recall ? 2 * precision * recall / (precision + recall) : 0, 3), support: tp + fn };
  });
  // feature means per class for display
  const classProfile = labels.map(l => ({ label: l, prior: rnd2(classPrior[l], 3),
    ...Object.fromEntries(numFeatures.map(f => [f + '_mean', rnd2(stats[l][f].mean)])) }));
  return { target, features: numFeatures, train: train.length, test: test.length,
    accuracy: rnd2(correct / test.length, 4), labels, perClass, confusion, classProfile,
    samples: test.slice(0, 25).map((i, j) => ({ record_id: rows[i].record_id, actual: testY[j], predicted: preds[j] })),
    disclaimer: DISCLAIMER };
}
