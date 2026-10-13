/**
 * Multiple Linear Regression via Ordinary Least Squares (closed-form normal equation).
 * Default target: treatment_cost. Shows R², adjusted R², coefficients, p-value proxies,
 * residuals and a predicted-vs-actual comparison so the fit is visible on screen.
 */
import { rng, shuffle, rnd2, MiningError, DISCLAIMER } from './random';
import { Row } from './dataset';

function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length, k = A[0].length, n = B[0].length;
  const C = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) for (let l = 0; l < k; l++) C[i][j] += A[i][l] * B[l][j];
  return C;
}
function transpose(A: number[][]): number[][] {
  return A[0].map((_, j) => A.map(row => row[j]));
}
function invertSymmetric(A: number[][]): number[][] | null {
  // Gauss-Jordan elimination on [A | I]
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(M[row][col]) > Math.abs(M[pivotRow][col])) pivotRow = row;
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
    const piv = M[col][col];
    if (Math.abs(piv) < 1e-12) return null;
    M[col] = M[col].map(v => v / piv);
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      M[row] = M[row].map((v, j) => v - factor * M[col][j]);
    }
  }
  return M.map(row => row.slice(n));
}

export function runLinearRegression(data: Row[], target: string, features: string[], testSize = 0.3) {
  const NUM_FEATURES = ['age', 'systolic_bp', 'diastolic_bp', 'cholesterol', 'heart_rate', 'stay_days', 'treatment_cost'];
  const numFeatures = features.filter(f => NUM_FEATURES.includes(f) && f !== target);
  if (numFeatures.length < 1) throw new MiningError('Linear regression needs at least one numerical feature (excluding the target).');
  if (!NUM_FEATURES.includes(target)) throw new MiningError('Target must be a numerical field.');
  const rows = data.filter(r => [...numFeatures, target].every(f => typeof (r as any)[f] === 'number' && isFinite((r as any)[f])));
  if (rows.length < numFeatures.length + 5) throw new MiningError(`Not enough rows (${rows.length}) for ${numFeatures.length} features.`);
  const rand = rng();
  const shuffled = shuffle([...rows], rand);
  const nTest = Math.round(shuffled.length * testSize);
  const testRows = shuffled.slice(0, nTest), trainRows = shuffled.slice(nTest);
  const Xtrain = trainRows.map(r => [1, ...numFeatures.map(f => (r as any)[f] as number)]);
  const ytrain = trainRows.map(r => (r as any)[target] as number);
  // Standardise features for numerical stability (intercept excluded from scaling)
  const mean = numFeatures.map((_, fi) => Xtrain.reduce((s, x) => s + x[fi + 1], 0) / Xtrain.length);
  const std = numFeatures.map((_, fi) => Math.sqrt(Xtrain.reduce((s, x) => s + (x[fi + 1] - mean[fi]) ** 2, 0) / Xtrain.length) || 1);
  const scale = (x: number[]) => [x[0], ...numFeatures.map((_, fi) => (x[fi + 1] - mean[fi]) / std[fi])];
  const Xs = Xtrain.map(scale);
  const Xt = transpose(Xs);
  const XtX = matMul(Xt, Xs);
  const XtXinv = invertSymmetric(XtX);
  if (!XtXinv) throw new MiningError('Features are perfectly collinear — remove one.');
  const Xty = matMul(Xt, ytrain.map(y => [y]));
  const beta = matMul(XtXinv, Xty).map(r => r[0]);  // [intercept, b1, b2, ...]
  const predict = (r: Row) => beta[0] + numFeatures.reduce((s, f, fi) => s + beta[fi + 1] * ((r as any)[f] - mean[fi]) / std[fi], 0);
  const yMean = ytrain.reduce((a, b) => a + b, 0) / ytrain.length;
  const ssTot = ytrain.reduce((s, y) => s + (y - yMean) ** 2, 0);
  const trainPred = trainRows.map(predict);
  const ssRes = ytrain.reduce((s, y, i) => s + (y - trainPred[i]) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;
  const n = trainRows.length, p = numFeatures.length;
  const adjR2 = 1 - (1 - r2) * (n - 1) / (n - p - 1);
  const mse = ssRes / (n - p - 1);
  const standardErrors = XtXinv.map((row, i) => Math.sqrt(mse * row[i]));
  const tStats = beta.map((b, i) => standardErrors[i] ? b / standardErrors[i] : 0);
  // test evaluation
  const testPred = testRows.map(predict);
  const testY = testRows.map(r => (r as any)[target] as number);
  const testMse = testPred.reduce((s, yp, i) => s + (yp - testY[i]) ** 2, 0) / testPred.length;
  const mae = testPred.reduce((s, yp, i) => s + Math.abs(yp - testY[i]), 0) / testPred.length;
  const coefficients = numFeatures.map((f, i) => ({
    feature: f, coefficient: rnd2(beta[i + 1] / std[i], 4),
    tStat: rnd2(tStats[i + 1], 3), significance: Math.abs(tStats[i + 1]) > 3 ? '***' : Math.abs(tStats[i + 1]) > 2 ? '**' : Math.abs(tStats[i + 1]) > 1 ? '*' : ''
  })).sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
  const residuals = testRows.slice(0, 150).map((r, i) => ({ record_id: r.record_id, actual: rnd2(testY[i]), predicted: rnd2(testPred[i]), residual: rnd2(testY[i] - testPred[i]) }));
  return {
    target, features: numFeatures, intercept: rnd2(beta[0]), coefficients,
    r2: rnd2(r2, 4), adjR2: rnd2(adjR2, 4), trainMse: rnd2(Math.sqrt(ssRes / n)), testRmse: rnd2(Math.sqrt(testMse)), mae: rnd2(mae),
    train: trainRows.length, test: testRows.length, residuals,
    interpretation: `R² = ${rnd2(r2, 3)} — the model explains ${rnd2(r2 * 100, 1)}% of variance in ${target.replace('_', ' ')} on training data.`,
    disclaimer: DISCLAIMER
  };
}
