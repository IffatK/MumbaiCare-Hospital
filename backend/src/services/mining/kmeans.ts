import { rng, shuffle, rnd2, MiningError, DISCLAIMER } from './random';
import { Row } from './dataset';
const dist2=(a:number[],b:number[])=>{let s=0;for(let i=0;i<a.length;i++){const d=a[i]-b[i];s+=d*d;}return s;};
export function kmeansCore(X:number[][],k:number,rand:()=>number,nInit=10,maxIter=300){
  let best:{labels:number[];centroids:number[][];inertia:number}|null=null;
  for(let run=0;run<nInit;run++){
    const c:number[][]=[X[Math.floor(rand()*X.length)].slice()];
    const d=X.map(x=>dist2(x,c[0]));
    while(c.length<k){const tot=d.reduce((a,b)=>a+b,0);let r=rand()*tot,idx=0;for(;idx<X.length-1;idx++){r-=d[idx];if(r<=0)break;}c.push(X[idx].slice());X.forEach((x,i)=>{d[i]=Math.min(d[i],dist2(x,c[c.length-1]));});}
    const labels=new Array(X.length).fill(-1);
    for(let it=0;it<maxIter;it++){let chg=false;X.forEach((x,i)=>{let bi=0,bd=Infinity;c.forEach((cv,j)=>{const dd=dist2(x,cv);if(dd<bd){bd=dd;bi=j;}});if(labels[i]!==bi){labels[i]=bi;chg=true;}});
      const sums=c.map(cv=>new Array(cv.length).fill(0));const counts=new Array(k).fill(0);
      X.forEach((x,i)=>{counts[labels[i]]++;x.forEach((v,f)=>(sums[labels[i]][f]+=v));});
      for(let j=0;j<k;j++){if(!counts[j]){let far=0,fd=-1;X.forEach((x,i)=>{const dd=dist2(x,c[labels[i]]);if(dd>fd){fd=dd;far=i;}});c[j]=X[far].slice();chg=true;}else c[j]=sums[j].map(s=>s/counts[j]);}
      if(!chg)break;}
    const inertia=X.reduce((s,x,i)=>s+dist2(x,c[labels[i]]),0);
    if(!best||inertia<best.inertia)best={labels:[...labels],centroids:c.map(cv=>[...cv]),inertia};}
  return best!;
}
export function silhouette(X:number[][],labels:number[],idx:number[]){
  const k=Math.max(...labels)+1;let total=0,n=0;
  for(const i of idx){const sum=new Array(k).fill(0),cnt=new Array(k).fill(0);
    for(const j of idx){if(i===j)continue;sum[labels[j]]+=Math.sqrt(dist2(X[i],X[j]));cnt[labels[j]]++;}
    const a=cnt[labels[i]]?sum[labels[i]]/cnt[labels[i]]:0;let b=Infinity;
    for(let c=0;c<k;c++)if(c!==labels[i]&&cnt[c])b=Math.min(b,sum[c]/cnt[c]);
    if(!isFinite(b)||!cnt[labels[i]])continue;total+=(b-a)/Math.max(a,b);n++;}
  return n?total/n:0;
}
export function runKMeans(data:Row[],features:string[],k:number,standardize=true){
  const rows=data.filter(r=>features.every(f=>typeof(r as any)[f]==='number'&&isFinite((r as any)[f])));
  if(rows.length<k*5) throw new MiningError(`Only ${rows.length} complete rows — not enough for K=${k}.`);
  const raw=rows.map(r=>features.map(f=>(r as any)[f] as number));
  const mean=features.map((_,f)=>raw.reduce((s,x)=>s+x[f],0)/raw.length);
  const std=features.map((_,f)=>Math.sqrt(raw.reduce((s,x)=>s+(x[f]-mean[f])**2,0)/raw.length)||1);
  const X=standardize?raw.map(x=>x.map((v,f)=>(v-mean[f])/std[f])):raw;
  const rand=rng(); const {labels,inertia}=kmeansCore(X,k,rand);
  const sample=shuffle(rows.map((_,i)=>i),rand).slice(0,Math.min(rows.length,1000));
  const sizes=Array.from({length:k},(_,c)=>labels.filter(l=>l===c).length);
  const centroids=sizes.map((_,c)=>({cluster:c,...Object.fromEntries(features.map((f,fi)=>[f,rnd2(raw.filter((_,i)=>labels[i]===c).reduce((s,x)=>s+x[fi],0)/(sizes[c]||1))]))}));
  const summary=centroids.map((c:any)=>{
    const parts=features.map((f,fi)=>({f,z:(c[f]-mean[fi])/std[fi]})).filter(x=>Math.abs(x.z)>0.3).sort((a,b)=>Math.abs(b.z)-Math.abs(a.z)).slice(0,2).map(x=>`${x.z>0?'higher':'lower'} ${x.f.replace('_',' ')}`);
    return {cluster:c.cluster,size:sizes[c.cluster],description:parts.length?`Records with ${parts.join(' and ')} than average`:'Close to overall averages'};});
  const pick=(i:number)=>({record_id:rows[i].record_id,...Object.fromEntries(features.map(f=>[f,(rows[i] as any)[f]])),cluster:labels[i]});
  return {k,features,rows:rows.length,silhouette:rnd2(silhouette(X,labels,sample),3),inertia:rnd2(inertia),
    clusters:sizes.map((size,cluster)=>({cluster,size})),centroids,summary,
    points:sample.slice(0,800).map(pick),
    assignments:rows.slice(0,2000).map((row,i)=>({...pick(i),hospital:row.hospital})),
    labels,rowsUsed:rows,disclaimer:DISCLAIMER};
}
