import{useState}from'react';
import{useMutation}from'@tanstack/react-query';
import{ScatterChart,Scatter,BarChart,Bar,LineChart,Line,ZAxis,Cell}from'recharts';
import{Play}from'lucide-react';
import{api}from'../lib/api';
import{useToast}from'../components/Toast';
import{useHospitals}from'../components/HospitalFilter';
import{PageHeader,Panel,Kpi,ErrorState,DataTable,ExportBtn,Disclaimer,Spinner,Empty,Badge}from'../components/ui';
import{ChartBox,axis,grid,tip,legend,XAxis,YAxis}from'../components/Charts';
import{COLORS,SEV_COLORS,num,inr}from'../lib/format';
import{downloadCsv}from'../lib/csv';
const NUM=[['age','Age'],['systolic_bp','Systolic BP'],['diastolic_bp','Diastolic BP'],['cholesterol','Cholesterol'],['heart_rate','Heart rate'],['stay_days','Stay (days)'],['treatment_cost','Treatment cost']];
const ALL_FEAT=[...NUM,['gender','Gender'],['disease','Condition'],['hospital','Hospital'],['age_group','Age group']];
const lbl=(k:string)=>[...NUM,...ALL_FEAT].find(x=>x[0]===k)?.[1]??k;
function useRun(path:string){const toast=useToast();return useMutation({mutationFn:(b:any)=>api(path,{method:'POST',body:b}),onError:(e:any)=>toast('err',e.message)});}
function Checks({opts,value,onChange,multi=true}:{opts:string[][];value:string[];onChange:(v:string[])=>void;multi?:boolean}){
  return<div className="flex flex-wrap gap-2">{opts.map(([k,l])=>{const on=value.includes(k);return<label key={k} className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${on?'border-tide-600 bg-tide-100 text-tide-700':'border-ink-200 text-ink-700 hover:border-tide-600'}`}>
    <input type="checkbox" className="sr-only" checked={on} onChange={()=>onChange(on?value.filter(x=>x!==k):multi?[...value,k]:[k])} />{l}</label>;})}
  </div>;
}
function HospSel({value,onChange}:{value:number[];onChange:(v:number[])=>void}){
  const{data:hs=[]}=useHospitals();
  return<select aria-label="Hospital scope" className="input" value={value[0]??''} onChange={e=>onChange(e.target.value?[Number(e.target.value)]:[])}><option value="">All hospitals</option>{hs.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select>;
}
function ConfusionMatrix({labels,confusion}:{labels:string[];confusion:number[][]}){
  const max=Math.max(...confusion.flat())||1;
  return<div className="overflow-x-auto"><table className="text-xs"><thead><tr><th className="th"></th>{labels.map(l=><th key={l} className="th text-center px-2">{l}</th>)}</tr></thead>
    <tbody>{confusion.map((row,i)=><tr key={i}><th className="th">{labels[i]}</th>{row.map((v,j)=><td key={j} className="border border-white px-3 py-2 text-center font-semibold" style={{background:`rgba(${i===j?'14,140,131':'192,57,43'},${0.08+0.7*v/max})`,color:v/max>0.5?'#fff':'#15202B'}}>{v}</td>)}</tr>)}</tbody>
  </table></div>;
}
function MetricsTable({perClass}:{perClass:any[]}){
  return<DataTable rows={perClass} columns={[{key:'label',label:'Class'},{key:'precision',label:'Precision',align:'right'},{key:'recall',label:'Recall',align:'right'},{key:'f1',label:'F1',align:'right'},{key:'support',label:'Support',align:'right'}]}/>;
}

// ── K-Means ─────────────────────────────────────────────
function KMeansTab(){
  const[features,setF]=useState(['age','treatment_cost']);const[k,setK]=useState(3);const[std,setStd]=useState(true);const[h,setH]=useState<number[]>([]);
  const run=useRun('/mining/kmeans');const r:any=run.data;
  return<div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
    <Panel title="K-Means parameters"><div className="space-y-3">
      <div><p className="label">Numeric features (≥ 2)</p><Checks opts={NUM} value={features} onChange={setF}/></div>
      <div><label className="label">K = {k}</label><input type="range" min={2} max={10} value={k} onChange={e=>setK(+e.target.value)} className="w-full accent-tide-600"/></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={std} onChange={e=>setStd(e.target.checked)}/>Z-score standardise</label>
      <div><p className="label">Hospital scope</p><HospSel value={h} onChange={setH}/></div>
      <button className="btn-primary w-full" disabled={features.length<2||run.isPending} onClick={()=>run.mutate({features,k,standardize:std,hospitalIds:h.length?h:undefined})}>{run.isPending?<Spinner/>:<Play size={15}/>}Run K-Means</button>
    </div></Panel>
    <div className="min-w-0 space-y-4">{run.isError?<ErrorState error={run.error}/>:!r?<div className="panel"><Empty title="Choose features and run K-Means"/></div>:<>
      <div className="grid grid-cols-3 gap-3"><Kpi label="Records clustered" value={num(r.rows)}/><Kpi label="Silhouette score" value={r.silhouette} tone="teal" hint="Higher = better separated"/><Kpi label="Inertia" value={num(r.inertia)} tone="blue"/></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`${lbl(r.features[0])} vs ${lbl(r.features[1])}`} subtitle="Sample ≤ 800 pts"><ChartBox h={300} label="KMeans scatter"><ScatterChart>{grid}<XAxis type="number" dataKey={r.features[0]} name={lbl(r.features[0])} {...axis}/><YAxis type="number" dataKey={r.features[1]} name={lbl(r.features[1])} {...axis} width={70}/><ZAxis range={[16,16]}/>{tip}{legend}
          {r.clusters.map((c:any)=><Scatter key={c.cluster} name={`Cluster ${c.cluster}`} data={r.points.filter((p:any)=>p.cluster===c.cluster)} fill={COLORS[c.cluster%COLORS.length]} fillOpacity={0.7}/>)}</ScatterChart></ChartBox></Panel>
        <Panel title="Cluster sizes"><ChartBox h={300} label="Sizes"><BarChart data={r.clusters.map((c:any)=>({name:`Cluster ${c.cluster}`,size:c.size}))}>{grid}<XAxis dataKey="name" {...axis}/><YAxis {...axis}/>{tip}<Bar dataKey="size" fill="#0E8C83"/></BarChart></ChartBox></Panel>
      </div>
      <Panel title="Centroids (original units)" actions={<ExportBtn onClick={()=>downloadCsv('kmeans-assignments.csv',r.assignments)}/>}><DataTable rows={r.centroids} columns={[{key:'cluster',label:'Cluster'},...r.features.map((f:string)=>({key:f,label:lbl(f),align:'right' as const}))]}/></Panel>
      <Panel title="Cluster characteristics"><ul className="space-y-2 text-sm">{r.summary.map((s:any)=><li key={s.cluster} className="flex gap-2"><span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{background:COLORS[s.cluster%COLORS.length]}}/><span><strong>Cluster {s.cluster}</strong> ({num(s.size)} records): {s.description}.</span></li>)}</ul></Panel>
      <Disclaimer>{r.disclaimer}</Disclaimer>
    </>}</div></div>;
}

// ── DBSCAN ───────────────────────────────────────────────
function DBSCANTab(){
  const[features,setF]=useState(['age','treatment_cost']);const[eps,setEps]=useState(0.5);const[minPts,setMinPts]=useState(5);const[h,setH]=useState<number[]>([]);
  const run=useRun('/mining/dbscan');const r:any=run.data;
  const clrs=['#1D5FA8','#0E8C83','#B7791F','#C0392B','#6B8FB8'];
  return<div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
    <Panel title="DBSCAN parameters"><div className="space-y-3">
      <div><p className="label">Features</p><Checks opts={NUM} value={features} onChange={setF}/></div>
      <div><label className="label">ε (epsilon) = {eps}</label><input type="range" min={0.1} max={3} step={0.1} value={eps} onChange={e=>setEps(+e.target.value)} className="w-full accent-tide-600"/></div>
      <div><label className="label">minPts = {minPts}</label><input type="range" min={2} max={20} value={minPts} onChange={e=>setMinPts(+e.target.value)} className="w-full accent-tide-600"/></div>
      <div><p className="label">Hospital scope</p><HospSel value={h} onChange={setH}/></div>
      <button className="btn-primary w-full" disabled={features.length<2||run.isPending} onClick={()=>run.mutate({features,eps,minPts,hospitalIds:h.length?h:undefined})}>{run.isPending?<Spinner/>:<Play size={15}/>}Run DBSCAN</button>
      <p className="text-xs text-ink-500">DBSCAN finds clusters of any shape and labels outliers as noise. No K needed.</p>
    </div></Panel>
    <div className="min-w-0 space-y-4">{run.isError?<ErrorState error={run.error}/>:!r?<div className="panel"><Empty title="Set parameters and run DBSCAN" hint="Noise points may represent unusual admission patterns."/></div>:<>
      <div className="grid grid-cols-3 gap-3"><Kpi label="Clusters found" value={r.nClusters} tone="teal"/><Kpi label="Noise / anomaly points" value={`${num(r.noiseCount)} (${r.noisePct}%)`} tone="alert"/><Kpi label="Records used" value={num(r.rows)}/></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`${lbl(features[0])} vs ${lbl(features[1])}`} subtitle="Cluster -1 = noise/anomaly"><ChartBox h={300} label="DBSCAN scatter"><ScatterChart>{grid}<XAxis type="number" dataKey={features[0]} {...axis}/><YAxis type="number" dataKey={features[1]} {...axis} width={70}/><ZAxis range={[14,14]}/>{tip}{legend}
          {[-1,...Array.from({length:r.nClusters},(_,i)=>i)].map(c=><Scatter key={c} name={c===-1?'Noise':` Cluster ${c}`} data={r.points.filter((p:any)=>p.cluster===c)} fill={c===-1?'#C0392B':clrs[c%clrs.length]} fillOpacity={c===-1?0.5:0.75}/>)}</ScatterChart></ChartBox></Panel>
        <Panel title="Cluster details"><DataTable rows={r.clusters} columns={[{key:'cluster',label:'Cluster'},{key:'size',label:'Size',align:'right'},{key:'pct',label:'% of data',align:'right',render:(x:any)=>`${x.pct}%`},...features.map(f=>({key:`centroid.${f}`,label:`Avg ${lbl(f)}`,align:'right' as const,render:(x:any)=>num(x.centroid?.[f],1)}))]} max="max-h-40"/></Panel>
      </div>
      {r.anomalies.length>0&&<Panel title="Anomalous records (noise points)" subtitle="These admissions did not fit any cluster">
        <DataTable rows={r.anomalies} columns={[{key:'record_id',label:'Record'},{key:'hospital',label:'Hospital',render:(x:any)=>String(x.hospital).replace(' (Demo)','')},{key:'label',label:'Label'},
          ...features.map(f=>({key:f,label:lbl(f),align:'right' as const,render:(x:any)=>num((x as any)[f],1)}))]}/></Panel>}
      <div className="panel p-4 text-sm text-ink-700"><strong>Interpretation:</strong> {r.interpretation}</div>
      <Disclaimer>{r.disclaimer}</Disclaimer>
    </>}</div></div>;
}

// ── Decision Tree ────────────────────────────────────────
function TreeTab(){
  const[target,setTarget]=useState('severity');const[features,setF]=useState(['age','heart_rate','systolic_bp','treatment_cost','disease']);
  const[depth,setDepth]=useState(4);const[test,setTest]=useState(0.3);const[h,setH]=useState<number[]>([]);
  const run=useRun('/mining/decision-tree');const r:any=run.data;
  return<div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
    <Panel title="Decision tree parameters"><div className="space-y-3">
      <div><label className="label">Target attribute</label><select className="input" value={target} onChange={e=>setTarget(e.target.value)}><option value="severity">Severity</option><option value="is_discharged">Discharged (0/1)</option><option value="age_group">Age group</option></select></div>
      <div><p className="label">Input features</p><Checks opts={ALL_FEAT.filter(([k])=>k!==target)} value={features} onChange={setF}/></div>
      <div><label className="label">Max depth = {depth}</label><input type="range" min={1} max={10} value={depth} onChange={e=>setDepth(+e.target.value)} className="w-full accent-tide-600"/></div>
      <div><label className="label">Test split = {Math.round(test*100)}%</label><input type="range" min={0.1} max={0.5} step={0.05} value={test} onChange={e=>setTest(+e.target.value)} className="w-full accent-tide-600"/></div>
      <div><p className="label">Hospital scope</p><HospSel value={h} onChange={setH}/></div>
      <button className="btn-primary w-full" disabled={!features.length||run.isPending} onClick={()=>run.mutate({target,features,maxDepth:depth,testSize:test,hospitalIds:h.length?h:undefined})}>{run.isPending?<Spinner/>:<Play size={15}/>}Train decision tree</button>
      <p className="text-xs text-ink-500">Seed fixed at 42 — reproducible results.</p>
    </div></Panel>
    <div className="min-w-0 space-y-4">{run.isError?<ErrorState error={run.error}/>:!r?<div className="panel"><Empty title="Choose target and features, then train"/></div>:<>
      <div className="grid grid-cols-3 gap-3"><Kpi label="Test accuracy" value={`${(r.accuracy*100).toFixed(1)}%`} tone="teal"/><Kpi label="Training rows" value={num(r.train)}/><Kpi label="Test rows" value={num(r.test)} tone="blue"/></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Confusion matrix" subtitle="Rows: actual. Columns: predicted."><ConfusionMatrix labels={r.labels} confusion={r.confusion}/></Panel>
        <Panel title="Feature importance"><ChartBox h={Math.max(200,r.importance.length*24)} label="Importance"><BarChart data={r.importance} layout="vertical">{grid}<XAxis type="number" {...axis}/><YAxis type="category" dataKey="feature" width={150} {...axis}/>{tip}<Bar dataKey="importance" fill="#1D5FA8"/></BarChart></ChartBox></Panel>
      </div>
      <Panel title="Per-class metrics"><MetricsTable perClass={r.perClass}/></Panel>
      <Panel title="Tree rules" actions={<ExportBtn label="Export predictions" onClick={()=>downloadCsv('dt-predictions.csv',r.samples)}/>}><pre className="max-h-64 overflow-auto rounded bg-navy-950 p-3 text-xs leading-relaxed text-ink-100">{r.treeText}</pre></Panel>
      <Disclaimer>{r.disclaimer}</Disclaimer>
    </>}</div></div>;
}

// ── Random Forest ────────────────────────────────────────
function RandomForestTab(){
  const[target,setTarget]=useState('severity');const[features,setF]=useState(['age','heart_rate','systolic_bp','treatment_cost','disease','stay_days']);
  const[nTrees,setN]=useState(30);const[depth,setDepth]=useState(5);const[test,setTest]=useState(0.3);const[h,setH]=useState<number[]>([]);
  const run=useRun('/mining/random-forest');const r:any=run.data;
  return<div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
    <Panel title="Random forest parameters"><div className="space-y-3">
      <div><label className="label">Target</label><select className="input" value={target} onChange={e=>setTarget(e.target.value)}><option value="severity">Severity</option><option value="is_discharged">Discharged</option><option value="age_group">Age group</option></select></div>
      <div><p className="label">Features</p><Checks opts={ALL_FEAT.filter(([k])=>k!==target)} value={features} onChange={setF}/></div>
      <div><label className="label">Trees = {nTrees}</label><input type="range" min={5} max={100} value={nTrees} onChange={e=>setN(+e.target.value)} className="w-full accent-tide-600"/></div>
      <div><label className="label">Max depth = {depth}</label><input type="range" min={1} max={8} value={depth} onChange={e=>setDepth(+e.target.value)} className="w-full accent-tide-600"/></div>
      <div><p className="label">Hospital scope</p><HospSel value={h} onChange={setH}/></div>
      <button className="btn-primary w-full" disabled={!features.length||run.isPending} onClick={()=>run.mutate({target,features,nTrees,maxDepth:depth,testSize:test,hospitalIds:h.length?h:undefined})}>{run.isPending?<Spinner/>:<Play size={15}/>}Train random forest</button>
    </div></Panel>
    <div className="min-w-0 space-y-4">{run.isError?<ErrorState error={run.error}/>:!r?<div className="panel"><Empty title="Configure and train the forest" hint="More trees → more stable results but slower."/></div>:<>
      <div className="grid grid-cols-4 gap-3"><Kpi label="Test accuracy" value={`${(r.accuracy*100).toFixed(1)}%`} tone="teal"/><Kpi label="OOB accuracy" value={`${(r.oobAccuracy*100).toFixed(1)}%`} tone="blue" hint="Out-of-bag estimate"/><Kpi label="Training rows" value={num(r.train)}/><Kpi label="Trees" value={r.nTrees}/></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Confusion matrix"><ConfusionMatrix labels={r.labels} confusion={r.confusion}/></Panel>
        <Panel title="Feature importance"><ChartBox h={Math.max(200,r.featureImportance.length*24)} label="Importance"><BarChart data={r.featureImportance.slice(0,12)} layout="vertical">{grid}<XAxis type="number" {...axis}/><YAxis type="category" dataKey="feature" width={150} {...axis}/>{tip}<Bar dataKey="importance" fill="#0E8C83"/></BarChart></ChartBox></Panel>
      </div>
      <Panel title="Per-class metrics"><MetricsTable perClass={r.perClass}/></Panel>
      <Disclaimer>{r.disclaimer}</Disclaimer>
    </>}</div></div>;
}

// ── Naive Bayes ──────────────────────────────────────────
function NaiveBayesTab(){
  const[target,setTarget]=useState('severity');const[features,setF]=useState(['age','heart_rate','systolic_bp','cholesterol','treatment_cost']);const[test,setTest]=useState(0.3);const[h,setH]=useState<number[]>([]);
  const run=useRun('/mining/naive-bayes');const r:any=run.data;
  return<div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
    <Panel title="Naive Bayes parameters"><div className="space-y-3">
      <div><label className="label">Target</label><select className="input" value={target} onChange={e=>setTarget(e.target.value)}><option value="severity">Severity</option><option value="is_discharged">Discharged</option><option value="age_group">Age group</option></select></div>
      <div><p className="label">Numerical features (Gaussian NB)</p><Checks opts={NUM} value={features} onChange={setF}/></div>
      <div><p className="label">Hospital scope</p><HospSel value={h} onChange={setH}/></div>
      <button className="btn-primary w-full" disabled={!features.length||run.isPending} onClick={()=>run.mutate({target,features,testSize:test,hospitalIds:h.length?h:undefined})}>{run.isPending?<Spinner/>:<Play size={15}/>}Run Naive Bayes</button>
      <p className="text-xs text-ink-500">Assumes Gaussian distribution within each class. Very fast and interpretable.</p>
    </div></Panel>
    <div className="min-w-0 space-y-4">{run.isError?<ErrorState error={run.error}/>:!r?<div className="panel"><Empty title="Select features and run"/></div>:<>
      <div className="grid grid-cols-3 gap-3"><Kpi label="Test accuracy" value={`${(r.accuracy*100).toFixed(1)}%`} tone="teal"/><Kpi label="Training rows" value={num(r.train)}/><Kpi label="Test rows" value={num(r.test)} tone="blue"/></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Confusion matrix"><ConfusionMatrix labels={r.labels} confusion={r.confusion}/></Panel>
        <Panel title="Class profiles (feature means)"><DataTable rows={r.classProfile} columns={[{key:'label',label:'Class'},{key:'prior',label:'Prior prob',align:'right'},...r.features.map((f:string)=>({key:f+'_mean',label:`Mean ${lbl(f)}`,align:'right' as const,render:(x:any)=>num((x as any)[f+'_mean'],1)}))]}/></Panel>
      </div>
      <Panel title="Per-class metrics"><MetricsTable perClass={r.perClass}/></Panel>
      <Disclaimer>{r.disclaimer}</Disclaimer>
    </>}</div></div>;
}

// ── Linear Regression ────────────────────────────────────
function LinearRegressionTab(){
  const[target,setTarget]=useState('treatment_cost');const[features,setF]=useState(['age','stay_days','systolic_bp','cholesterol','heart_rate']);const[h,setH]=useState<number[]>([]);
  const run=useRun('/mining/linear-regression');const r:any=run.data;
  return<div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
    <Panel title="Linear regression parameters"><div className="space-y-3">
      <div><label className="label">Target (to predict)</label><select className="input" value={target} onChange={e=>{setTarget(e.target.value);setF(features.filter(f=>f!==e.target.value));}}><option value="treatment_cost">Treatment cost (₹)</option><option value="stay_days">Stay duration (days)</option><option value="age">Age</option></select></div>
      <div><p className="label">Predictor features</p><Checks opts={NUM.filter(([k])=>k!==target)} value={features} onChange={setF}/></div>
      <div><p className="label">Hospital scope</p><HospSel value={h} onChange={setH}/></div>
      <button className="btn-primary w-full" disabled={!features.length||run.isPending} onClick={()=>run.mutate({target,features,hospitalIds:h.length?h:undefined})}>{run.isPending?<Spinner/>:<Play size={15}/>}Fit regression</button>
      <p className="text-xs text-ink-500">OLS with z-score standardisation. *** = |t| &gt; 3, ** &gt; 2, * &gt; 1.</p>
    </div></Panel>
    <div className="min-w-0 space-y-4">{run.isError?<ErrorState error={run.error}/>:!r?<div className="panel"><Empty title="Choose target and predictors, then fit"/></div>:<>
      <div className="grid grid-cols-4 gap-3"><Kpi label="R² (train)" value={r.r2} tone="teal" hint="Explained variance"/><Kpi label="Adj. R²" value={r.adjR2} tone="blue"/><Kpi label="Test RMSE" value={inr(r.testRmse)}/><Kpi label="Test MAE" value={inr(r.mae)}/></div>
      <Panel title="Coefficients" subtitle="Standardised — compare magnitudes across features"><DataTable rows={r.coefficients} columns={[{key:'feature',label:'Feature'},{key:'coefficient',label:'Coefficient',align:'right'},{key:'tStat',label:'t-stat',align:'right'},{key:'significance',label:'Sig.',align:'right'}]}/></Panel>
      <Panel title="Predicted vs actual (test set)" subtitle="First 150 test records">
        <ChartBox h={300} label="Residuals"><LineChart data={r.residuals} margin={{left:10}}>{grid}<XAxis dataKey="record_id" {...axis} hide/><YAxis {...axis} tickFormatter={(v:any)=>inr(v)} width={70}/>{tip}
          <Line dataKey="actual" name="Actual" stroke="#1D5FA8" dot={false} strokeWidth={1.5}/>
          <Line dataKey="predicted" name="Predicted" stroke="#0E8C83" dot={false} strokeWidth={1.5} strokeDasharray="4 2"/></LineChart></ChartBox></Panel>
      <Panel title="Residuals (actual − predicted)" actions={<ExportBtn onClick={()=>downloadCsv('regression-residuals.csv',r.residuals)}/>}><DataTable max="max-h-48" rows={r.residuals} columns={[{key:'record_id',label:'Record'},{key:'actual',label:'Actual',align:'right',render:(x:any)=>inr(x.actual)},{key:'predicted',label:'Predicted',align:'right',render:(x:any)=>inr(x.predicted)},{key:'residual',label:'Residual',align:'right',render:(x:any)=><span className={x.residual<0?'text-alert-600':'text-tide-700'}>{inr(x.residual)}</span>}]}/></Panel>
      <div className="panel p-3 text-sm">{r.interpretation}</div>
      <Disclaimer>{r.disclaimer}</Disclaimer>
    </>}</div></div>;
}

// ── Apriori ──────────────────────────────────────────────
function AprioriTab(){
  const[p,setP]=useState({source:'tests_treatment',minSupport:0.05,minConfidence:0.5,minLift:1.1});const[h,setH]=useState<number[]>([]);
  const[sort,setSort]=useState<'lift'|'confidence'|'support'>('lift');const[filter,setFilter]=useState('');
  const run=useRun('/mining/apriori');const r:any=run.data;
  const rules=r?[...r.rules].filter((x:any)=>!filter||[...x.antecedents,...x.consequents].join(' ').toLowerCase().includes(filter.toLowerCase())).sort((a:any,b:any)=>b[sort]-a[sort]):[];
  return<div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
    <Panel title="Apriori parameters"><div className="space-y-3">
      <div><label className="label">Transaction source</label><select className="input" value={p.source} onChange={e=>setP({...p,source:e.target.value})}><option value="tests_treatment">Tests + treatment</option><option value="tests">Tests only</option></select></div>
      {([['minSupport','Min. support',0.01,0.5,0.01],['minConfidence','Min. confidence',0.05,1,0.05],['minLift','Min. lift',0,10,0.1]] as const).map(([k,l,mn,mx,st])=><div key={k}><label className="label">{l} = {(p as any)[k]}</label><input type="range" min={mn} max={mx} step={st} value={(p as any)[k]} onChange={e=>setP({...p,[k]:+e.target.value})} className="w-full accent-tide-600"/></div>)}
      <div><p className="label">Hospital scope</p><HospSel value={h} onChange={setH}/></div>
      <button className="btn-primary w-full" disabled={run.isPending} onClick={()=>run.mutate({...p,hospitalIds:h.length?h:undefined})}>{run.isPending?<Spinner/>:<Play size={15}/>}Run Apriori</button>
    </div></Panel>
    <div className="min-w-0 space-y-4">{run.isError?<ErrorState error={run.error}/>:!r?<div className="panel"><Empty title="Set thresholds and run"/></div>:<>
      <div className="grid grid-cols-3 gap-3"><Kpi label="Transactions" value={num(r.transactions)}/><Kpi label="Frequent itemsets" value={num(r.itemsets.length)} tone="teal"/><Kpi label="Rules" value={num(r.rules.length)} tone="blue"/></div>
      <Panel title="Association rules" actions={<><select className="input !w-auto !py-1 text-xs" value={sort} onChange={e=>setSort(e.target.value as any)}><option value="lift">Sort by lift</option><option value="confidence">Sort by confidence</option><option value="support">Sort by support</option></select><ExportBtn onClick={()=>downloadCsv('apriori-rules.csv',r.rules.map((x:any)=>({...x,antecedents:x.antecedents.join('+'),consequents:x.consequents.join('+')})))}/></>}>
        <input className="input mb-3 max-w-xs" placeholder="Filter by item" value={filter} onChange={e=>setFilter(e.target.value)}/>
        {rules.length?<DataTable rows={rules} columns={[{key:'a',label:'If (antecedent)',render:(x:any)=>x.antecedents.join(' + ')},{key:'c',label:'Then (consequent)',render:(x:any)=>x.consequents.join(' + ')},{key:'support',label:'Support',align:'right'},{key:'confidence',label:'Confidence',align:'right'},{key:'lift',label:'Lift',align:'right'}]}/>:<Empty title="No rules at these thresholds" hint="Lower min. support or confidence."/>}
      </Panel>
      <Disclaimer>{r.disclaimer}</Disclaimer>
    </>}</div></div>;
}

// ── Algorithm Comparison ─────────────────────────────────
function CompareTab(){
  const[target,setTarget]=useState('severity');const[features,setF]=useState(['age','heart_rate','systolic_bp','cholesterol','treatment_cost','disease']);const[h,setH]=useState<number[]>([]);
  const run=useRun('/mining/compare');const r:any=run.data;
  return<div className="space-y-4">
    <Panel title="Algorithm comparison parameters"><div className="flex flex-wrap gap-4">
      <div><label className="label">Target</label><select className="input" value={target} onChange={e=>setTarget(e.target.value)}><option value="severity">Severity</option><option value="is_discharged">Discharged</option><option value="age_group">Age group</option></select></div>
      <div className="flex-1"><p className="label">Features</p><Checks opts={ALL_FEAT.filter(([k])=>k!==target)} value={features} onChange={setF}/></div>
      <div><p className="label">Hospital</p><HospSel value={h} onChange={setH}/></div>
      <button className="btn-primary self-end" disabled={features.length<2||run.isPending} onClick={()=>run.mutate({target,features,hospitalIds:h.length?h:undefined})}>{run.isPending?<Spinner/>:<Play size={15}/>}Compare all</button>
    </div></Panel>
    {run.isError?<ErrorState error={run.error}/>:!r?<Empty title="Select features and compare all classifiers at once"/>:<>
      {r.best&&<div className="panel flex items-center gap-3 p-4"><span className="text-2xl">🏆</span><div><p className="text-sm text-ink-500">Best classifier on this data</p><p className="font-semibold text-navy-900">{r.best.name}</p><p className="text-sm text-tide-700">Accuracy {(r.best.accuracy*100).toFixed(1)}% · Macro F1 {r.best.macroF1}</p></div></div>}
      <Panel title="Side-by-side comparison">
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr><th className="th">Algorithm</th><th className="th text-right">Accuracy</th><th className="th text-right">Macro F1</th><th className="th text-right">Macro Precision</th><th className="th text-right">Macro Recall</th><th className="th text-right">OOB accuracy</th></tr></thead>
          <tbody>{r.results.map((x:any,i:number)=><tr key={i} className={r.best?.name===x.name?'bg-tide-100/40':''}>
            <td className="td font-medium">{x.name}{r.best?.name===x.name&&<Badge tone="teal" className="ml-2">Best</Badge>}</td>
            {x.error?<td className="td text-alert-600" colSpan={5}>{x.error}</td>:<><td className="td text-right font-semibold">{x.accuracy!=null?`${(x.accuracy*100).toFixed(1)}%`:'—'}</td><td className="td text-right">{x.macroF1??'—'}</td><td className="td text-right">{x.macroPrecision??'—'}</td><td className="td text-right">{x.macroRecall??'—'}</td><td className="td text-right">{x.oobAccuracy!=null?`${(x.oobAccuracy*100).toFixed(1)}%`:'—'}</td></>}
          </tr>)}</tbody></table></div></Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Accuracy comparison"><ChartBox h={250} label="Accuracy by algorithm"><BarChart data={r.results.filter((x:any)=>!x.error).map((x:any)=>({name:x.name.replace(' (','<br>('),accuracy:+(x.accuracy*100).toFixed(1)}))}>{grid}<XAxis dataKey="name" {...axis} interval={0} angle={-12} textAnchor="end" height={60}/><YAxis {...axis} domain={[0,100]} unit="%"/>{tip}<Bar dataKey="accuracy" name="Accuracy %" fill="#1D5FA8">{r.results.filter((x:any)=>!x.error).map((_:any,i:number)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Bar></BarChart></ChartBox></Panel>
        <Panel title="Macro F1 comparison"><ChartBox h={250} label="F1 by algorithm"><BarChart data={r.results.filter((x:any)=>!x.error).map((x:any)=>({name:x.name,f1:x.macroF1}))}>{grid}<XAxis dataKey="name" {...axis} interval={0} angle={-12} textAnchor="end" height={60}/><YAxis {...axis} domain={[0,1]}/>{tip}<Bar dataKey="f1" name="Macro F1">{r.results.filter((x:any)=>!x.error).map((_:any,i:number)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Bar></BarChart></ChartBox></Panel>
      </div>
      <p className="text-xs text-ink-500">{r.note}</p>
      <Disclaimer>{r.disclaimer}</Disclaimer>
    </>}
  </div>;
}

// ── Cross-hospital ───────────────────────────────────────
function CrossTab(){
  const[features,setF]=useState(['age','stay_days','treatment_cost']);const[k,setK]=useState(3);
  const run=useRun('/mining/cross-hospital');const r:any=run.data;
  const short=(s:string)=>String(s).replace(' (Demo)','');
  const pivot=(rows:any[],col:string)=>Object.values(rows.reduce((a:any,x:any)=>{(a[x.hospital]??={hospital:short(x.hospital)})[col==='severity'?x.severity:x.disease]=x.count;return a;},{})) as any[];
  const clusterKeys=r?[...new Set(r.clusterSizes.map((x:any)=>`Cluster ${x.cluster}`))] as string[]:[];
  return<div className="space-y-4">
    <Panel title="Cross-hospital parameters"><div className="flex flex-wrap gap-4">
      <div><p className="label">Features</p><Checks opts={NUM} value={features} onChange={setF}/></div>
      <div><label className="label">K = {k}</label><input type="range" min={2} max={8} value={k} onChange={e=>setK(+e.target.value)} className="accent-tide-600"/></div>
      <button className="btn-primary self-end" disabled={features.length<2||run.isPending} onClick={()=>run.mutate({features,k})}>{run.isPending?<Spinner/>:<Play size={15}/>}Analyse</button>
    </div></Panel>
    {run.isError?<ErrorState error={run.error}/>:!r?<Empty title="Run cross-hospital cluster analysis"/>:<>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cluster sizes by hospital"><ChartBox h={320} label="Cluster sizes"><BarChart data={pivot(r.clusterSizes,'cluster')}>{grid}<XAxis dataKey="hospital" {...axis} angle={-12} textAnchor="end" height={60}/><YAxis {...axis}/>{tip}{legend}{clusterKeys.map((c,i)=><Bar key={c} dataKey={c} stackId="c" fill={COLORS[i%COLORS.length]}/>)}</BarChart></ChartBox></Panel>
        <Panel title="Severity by hospital"><ChartBox h={320} label="Severity"><BarChart data={pivot(r.severity,'severity')}>{grid}<XAxis dataKey="hospital" {...axis} angle={-12} textAnchor="end" height={60}/><YAxis {...axis}/>{tip}{legend}<Bar dataKey="MILD" name="Mild" stackId="s" fill="#14A89C"/><Bar dataKey="MODERATE" name="Moderate" stackId="s" fill="#B7791F"/><Bar dataKey="SEVERE" name="Severe" stackId="s" fill="#C0392B"/></BarChart></ChartBox></Panel>
      </div>
      <Panel title="Avg stay and cost per cluster per hospital" actions={<ExportBtn onClick={()=>downloadCsv('cross-hospital.csv',r.clusterAverages)}/>}><DataTable rows={r.clusterAverages} columns={[{key:'hospital',label:'Hospital'},{key:'cluster',label:'Cluster'},...(r.clusterAverages[0]?.avg_stay_days!=null?[{key:'avg_stay_days',label:'Avg stay (days)',align:'right' as const}]:[]),...(r.clusterAverages[0]?.avg_treatment_cost!=null?[{key:'avg_treatment_cost',label:'Avg cost (₹)',align:'right' as const,render:(x:any)=>inr(x.avg_treatment_cost)}]:[])]} /></Panel>
      <div className="flex flex-wrap gap-2">{r.samples.map((s:any)=><Badge key={s.hospital} tone={s.smallSample?'amber':'ink'}>{short(s.hospital)}: n={s.n}</Badge>)}</div>
      <Disclaimer>{r.disclaimer}</Disclaimer>
    </>}
  </div>;
}

// ── Tabs ─────────────────────────────────────────────────
const TABS=[
  ['kmeans','K-Means',KMeansTab],['dbscan','DBSCAN',DBSCANTab],['tree','Decision Tree',TreeTab],
  ['forest','Random Forest',RandomForestTab],['bayes','Naive Bayes',NaiveBayesTab],
  ['regression','Linear Regression',LinearRegressionTab],['apriori','Apriori Rules',AprioriTab],
  ['compare','Algorithm Comparison',CompareTab],['cross','Cross-Hospital',CrossTab],
] as const;
export default function Mining(){
  const[tab,setTab]=useState('kmeans');const Active=TABS.find(t=>t[0]===tab)![2];
  return<>
    <PageHeader title="Data mining" description="9 algorithms running on the warehouse data. Results are statistical patterns in synthetic records."/>
    <div className="mb-4 overflow-x-auto border-b border-ink-200" role="tablist">
      <div className="flex gap-0 min-w-max">{TABS.map(([k,l])=><button key={k} role="tab" aria-selected={tab===k} onClick={()=>setTab(k)}
        className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${tab===k?'border-tide-600 text-navy-900':'border-transparent text-ink-500 hover:text-navy-900'}`}>{l}</button>)}</div></div>
    <Active/></>;
}
