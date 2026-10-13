/**
 * Random Forest — an ensemble of decision trees, each trained on a bootstrap sample
 * and a random subset of features (feature bagging).  Majority vote for classification.
 * More accurate and less prone to overfitting than a single tree.
 */
import { rng, shuffle, rnd2, MiningError, DISCLAIMER } from './random';
import { Row } from './dataset';
import { kmeansCore } from './kmeans'; // reuse distance helper implicitly through imports

const CATEGORICAL = new Set(['gender','disease','hospital','age_group','severity']);
type Node = { leaf:true; cls:string } | { leaf:false; feature:number; threshold:number; left:Node; right:Node };
function gini(cnt:Record<string,number>,n:number){let s=1;for(const v of Object.values(cnt))s-=(v/n)**2;return s;}
const argmax=(m:Record<string,number>)=>Object.entries(m).sort((a,b)=>b[1]-a[1])[0][0];
function buildTree(X:number[][],y:string[],idx:number[],featIdx:number[],depth:number,maxDepth:number,rand:()=>number):Node{
  const counts:Record<string,number>={};for(const i of idx)counts[y[i]]=(counts[y[i]]??0)+1;
  if(depth>=maxDepth||idx.length<2||Object.keys(counts).length===1)return{leaf:true,cls:argmax(counts)};
  let best:{gain:number;f:number;t:number}={gain:0,f:-1,t:0};
  const parentGini=gini(counts,idx.length);
  for(const f of featIdx){const sorted=[...idx].sort((a,b)=>X[a][f]-X[b][f]);const left:Record<string,number>={};let nl=0;
    for(let s=0;s<sorted.length-1;s++){const i=sorted[s];left[y[i]]=(left[y[i]]??0)+1;nl++;if(X[i][f]===X[sorted[s+1]][f])continue;
      const nr=idx.length-nl;const right:Record<string,number>={};for(const c in counts)right[c]=counts[c]-(left[c]??0);
      const gain=parentGini-(nl/idx.length)*gini(left,nl)-(nr/idx.length)*gini(right,nr);if(gain>best.gain+1e-12)best={gain,f,t:(X[i][f]+X[sorted[s+1]][f])/2};}}
  if(best.f<0)return{leaf:true,cls:argmax(counts)};
  const L=idx.filter(i=>X[i][best.f]<=best.t),R=idx.filter(i=>X[i][best.f]>best.t);
  // random feature subset for next level
  const nextFeat=shuffle([...Array(X[0].length).keys()],rand).slice(0,Math.max(1,Math.floor(Math.sqrt(X[0].length))));
  return{leaf:false,feature:best.f,threshold:best.t,left:buildTree(X,y,L,nextFeat,depth+1,maxDepth,rand),right:buildTree(X,y,R,nextFeat,depth+1,maxDepth,rand)};
}
const predictOne=(n:Node,x:number[]):string=>(n.leaf?n.cls:predictOne(x[n.feature]<=n.threshold?n.left:n.right,x));

export function runRandomForest(data:Row[],target:string,features:string[],nTrees=30,maxDepth=5,testSize=0.3){
  if(features.includes(target))throw new MiningError('Target cannot be a feature.');
  const rows=data.filter(r=>[...features,target].every(f=>(r as any)[f]!==null&&(r as any)[f]!==undefined&&(r as any)[f]!==''));
  if(rows.length<30)throw new MiningError('Not enough rows for Random Forest (need at least 30).');
  const cols:{name:string;get:(r:Row)=>number}[]=[];
  for(const f of features){if(CATEGORICAL.has(f))for(const v of[...new Set(rows.map(r=>String((r as any)[f])))].sort())cols.push({name:`${f}_${v}`,get:r=>String((r as any)[f])===v?1:0});
    else cols.push({name:f,get:r=>Number((r as any)[f])});}
  const X=rows.map(r=>cols.map(c=>c.get(r)));const y=rows.map(r=>String((r as any)[target]));
  const labels=[...new Set(y)].sort();if(labels.length<2)throw new MiningError('Target has only one class.');
  const rand=rng();const train:number[]=[],test:number[]=[];
  for(const l of labels){const ids=shuffle(y.map((c,i)=>c===l?i:-1).filter(i=>i>=0),rand);const nt=Math.round(ids.length*testSize);test.push(...ids.slice(0,nt));train.push(...ids.slice(nt));}
  // train nTrees trees on bootstrap samples
  const trees:Node[]=[];
  const oobPreds:Record<number,string[]>={};
  for(let t=0;t<nTrees;t++){
    const boot=Array.from({length:train.length},()=>train[Math.floor(rand()*train.length)]);
    const oob=train.filter(i=>!boot.includes(i));
    const featSubset=shuffle([...Array(cols.length).keys()],rand).slice(0,Math.max(1,Math.floor(Math.sqrt(cols.length))));
    const tree=buildTree(X,y,boot,featSubset,0,maxDepth,rand);trees.push(tree);
    for(const i of oob){const p=predictOne(tree,X[i]);(oobPreds[i]??=[]).push(p);}
  }
  // OOB error estimate
  const oobAcc=Object.entries(oobPreds).filter(([,ps])=>ps.length>0).reduce((s,[i,ps])=>{const cls=argmax(ps.reduce((m,p)=>({...m,[p]:(m[p]??0)+1}),{} as Record<string,number>));return s+(cls===y[+i]?1:0);},0)/Object.keys(oobPreds).length;
  // test evaluation with majority vote
  const pred=test.map(i=>{const votes:Record<string,number>={};for(const tr of trees){const p=predictOne(tr,X[i]);votes[p]=(votes[p]??0)+1;}return argmax(votes);});
  const confusion=labels.map(a=>labels.map(p=>test.filter((i,j)=>y[i]===a&&pred[j]===p).length));
  const perClass=labels.map((l,li)=>{const tp=confusion[li][li],fp=labels.reduce((s,_,a)=>s+(a!==li?confusion[a][li]:0),0),fn=confusion[li].reduce((s,v,p)=>s+(p!==li?v:0),0);
    const precision=tp+fp?tp/(tp+fp):0,recall=tp+fn?tp/(tp+fn):0;
    return{label:l,precision:rnd2(precision,3),recall:rnd2(recall,3),f1:rnd2(precision+recall?2*precision*recall/(precision+recall):0,3),support:tp+fn};});
  // feature importance by mean decrease in Gini (average over trees, approximated by column index)
  const importance:Record<number,number>={};
  const countImportance=(n:Node,depth:number)=>{if(n.leaf)return;importance[n.feature]=(importance[n.feature]??0)+(1/(depth+1));countImportance(n.left,depth+1);countImportance(n.right,depth+1);};
  for(const tr of trees)countImportance(tr,0);
  const impTotal=Object.values(importance).reduce((a,b)=>a+b,0)||1;
  const featureImportance=cols.map((c,i)=>({feature:c.name,importance:rnd2((importance[i]??0)/impTotal,4)})).sort((a,b)=>b.importance-a.importance).slice(0,15);
  return {
  target,
  features,
  nTrees,
  maxDepth,
  train: train.length,
  test: test.length,
  accuracy: rnd2(pred.filter((p, j) => p === y[test[j]]).length / test.length, 4),
  oobAccuracy: rnd2(oobAcc, 4),
  labels,
  perClass,
  confusion,
  featureImportance,
  samples: test.slice(0, 25).map((i, j) => ({
    record_id: rows[i].record_id,
    actual: y[i],
    predicted: pred[j],
  })),
  disclaimer: DISCLAIMER,

  // Prediction function for a new patient
  predict: (newRow: Row): string => {
    const x = cols.map(c => c.get(newRow));

    const votes: Record<string, number> = {};

    for (const tree of trees) {
      const prediction = predictOne(tree, x);
      votes[prediction] = (votes[prediction] ?? 0) + 1;
    }

    return argmax(votes);
  },
};
}