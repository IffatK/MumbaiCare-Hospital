/**
 * DBSCAN — Density-Based Spatial Clustering of Applications with Noise.
 * Finds clusters of arbitrary shape and labels outliers as noise (cluster -1).
 * No K parameter needed; tuned by ε (epsilon) and minPts.
 */
import { rnd2, MiningError, DISCLAIMER } from './random';
import { Row } from './dataset';

function euclidean(a: number[], b: number[]) { return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)); }

export function dbscanCore(X: number[][], eps: number, minPts: number) {
  const n = X.length; const labels = new Array(n).fill(-2); // -2=unvisited, -1=noise
  let cluster = 0;
  const neighbours = (i: number) => X.map((_, j) => j).filter(j => j !== i && euclidean(X[i], X[j]) <= eps);
  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue;
    const nb = neighbours(i);
    if (nb.length < minPts - 1) { labels[i] = -1; continue; } // noise
    labels[i] = cluster;
    const queue = [...nb];
    while (queue.length) {
      const q = queue.shift()!;
      if (labels[q] === -1) labels[q] = cluster; // border point previously labelled noise
      if (labels[q] !== -2) continue;
      labels[q] = cluster;
      const nb2 = neighbours(q);
      if (nb2.length >= minPts - 1) queue.push(...nb2.filter(j => labels[j] === -2 || labels[j] === -1));
    }
    cluster++;
  }
  return { labels, nClusters: cluster };
}

export function runDBSCAN(data: Row[], features: string[], eps = 0.5, minPts = 5, standardize = true) {
  const rows = data.filter(r => features.every(f => typeof (r as any)[f] === 'number' && isFinite((r as any)[f])));
  if (rows.length < 10) throw new MiningError(`Only ${rows.length} complete rows — not enough for DBSCAN.`);
  // cap at 2000 for performance (O(n²) algorithm)
  const used = rows.length > 2000 ? rows.slice(0, 2000) : rows;
  const raw = used.map(r => features.map(f => (r as any)[f] as number));
  const mean = features.map((_, f) => raw.reduce((s, x) => s + x[f], 0) / raw.length);
  const std = features.map((_, f) => Math.sqrt(raw.reduce((s, x) => s + (x[f] - mean[f]) ** 2, 0) / raw.length) || 1);
  const X = standardize ? raw.map(x => x.map((v, f) => (v - mean[f]) / std[f])) : raw;
  const { labels, nClusters } = dbscanCore(X, eps, minPts);
  const noiseCount = labels.filter(l => l === -1).length;
  const clusters = Array.from({ length: nClusters }, (_, c) => {
    const idx = used.map((_, i) => i).filter(i => labels[i] === c);
    const cRows = idx.map(i => used[i]);
    const centroid: Record<string, number> = {};
    for (const f of features) centroid[f] = rnd2(cRows.reduce((s, r) => s + (r as any)[f], 0) / (cRows.length || 1));
    return { cluster: c, size: idx.length, centroid, pct: rnd2(idx.length / used.length * 100, 1) };
  });
  // anomaly scores: data points with no neighbours within eps*1.5 are anomalies
  const anomalies = used.map((r, i) => ({ record_id: r.record_id, hospital: r.hospital, cluster: labels[i],
    label: labels[i] === -1 ? 'Noise / Anomaly' : `Cluster ${labels[i]}`,
    ...Object.fromEntries(features.map(f => [f, (r as any)[f]])) }))
    .filter(x => x.cluster === -1).slice(0, 100);
  const points = used.slice(0, 600).map((r, i) => ({ record_id: r.record_id, cluster: labels[i],
    ...Object.fromEntries(features.slice(0, 2).map(f => [f, (r as any)[f]])) }));
  return { features, eps, minPts, rows: used.length, nClusters, noiseCount, noisePct: rnd2(noiseCount / used.length * 100, 1),
    clusters, anomalies, points,
    interpretation: `Found ${nClusters} cluster${nClusters !== 1 ? 's' : ''} and ${noiseCount} noise/anomaly point${noiseCount !== 1 ? 's' : ''} (${rnd2(noiseCount/used.length*100,1)}%). Noise points may represent unusual admissions.`,
    disclaimer: DISCLAIMER };
}
