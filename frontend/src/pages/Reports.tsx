import{useState}from'react';
import{useMutation}from'@tanstack/react-query';
import{FileText,Printer,CheckCircle2}from'lucide-react';
import{api}from'../lib/api';
import{useAuth}from'../lib/auth';
import{useToast}from'../components/Toast';
import{useHospitals}from'../components/HospitalFilter';
import{PageHeader,Panel,Spinner,DataTable,ExportBtn,Disclaimer,Empty,ErrorState}from'../components/ui';
import{dateTime,date,inr,inrShort,num,sevLabel}from'../lib/format';
import{downloadCsv}from'../lib/csv';
export default function Reports(){
  const{user}=useAuth();const toast=useToast();const{data:hs=[]}=useHospitals();
  const[p,setP]=useState({title:'MumbaiCare Analytical Report',hospitalIds:[] as number[],from:'',to:'',includeMining:false,includeApriori:false});
  const gen=useMutation({mutationFn:()=>api('/reports/generate',{method:'POST',body:{...p,from:p.from||undefined,to:p.to||undefined}}),
    onSuccess:()=>toast('ok','Report generated'),onError:(e:any)=>toast('err',e.message)});
  const r:any=gen.data;
  const H=({children}:any)=><h2 className="mb-2 mt-6 border-b border-ink-200 pb-1 font-display text-lg font-semibold text-navy-900 print:text-base">{children}</h2>;
  const short=(s:string)=>String(s).replace(' (Demo)','');
  return<>
    <div className="print:hidden">
      <PageHeader title="Reports" description="Generate a live report from the database, then print or save as PDF."/>
      <Panel className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2"><label className="label">Report title</label><input className="input" value={p.title} onChange={e=>setP({...p,title:e.target.value})}/></div>
          {user?.role!=='STAFF'&&<div><label className="label">Hospitals</label>
            <select multiple className="input h-[38px] focus:h-32" value={p.hospitalIds.map(String)} onChange={e=>setP({...p,hospitalIds:[...e.target.selectedOptions].map(o=>+o.value)})}>
              {hs.map(h=><option key={h.id} value={h.id}>{short(h.name)}</option>)}</select></div>}
          <div><label className="label">From</label><input type="date" className="input" value={p.from} onChange={e=>setP({...p,from:e.target.value})}/></div>
          <div><label className="label">To</label><input type="date" className="input" value={p.to} onChange={e=>setP({...p,to:e.target.value})}/></div>
        </div>
        {user?.role!=='STAFF'&&<div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.includeMining} onChange={e=>setP({...p,includeMining:e.target.checked})}/>Include K-Means + Decision Tree summary</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.includeApriori} onChange={e=>setP({...p,includeApriori:e.target.checked})}/>Include top Apriori rules</label>
        </div>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn-primary ml-auto" disabled={gen.isPending} onClick={()=>gen.mutate()}>{gen.isPending?<Spinner/>:<FileText size={16}/>}Generate report</button>
          {r&&<button className="btn-ghost" onClick={()=>window.print()}><Printer size={16}/>Print / save PDF</button>}
        </div>
      </Panel>
    </div>
    {gen.isError?<ErrorState error={gen.error}/>:!r?<div className="panel print:hidden"><Empty title="No report yet" hint="Configure filters and generate."/></div>:
    <article className="panel mx-auto max-w-4xl p-6 print:border-0 print:p-0 sm:p-10">
      <header className="border-b-2 border-navy-900 pb-4">
        <p className="text-sm font-semibold text-tide-700">MumbaiCare · Academic project</p>
        <h1 className="font-display text-3xl font-semibold text-navy-900">{r.title}</h1>
        <p className="mt-2 text-sm text-ink-500">Generated {dateTime(r.generatedAt)} by {r.generatedBy}</p>
        <p className="text-sm text-ink-500">Hospitals: {r.hospitals.join(', ')} · Admissions {r.range.from?date(r.range.from):'from start'} to {r.range.to?date(r.range.to):'latest'}</p>
        <p className="text-sm text-ink-500">Warehouse last refreshed: {r.freshness?dateTime(r.freshness):<span className="text-amber-600">Not yet loaded — run ETL</span>}</p>
      </header>

      <H>1. Dataset summary</H>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Total records',num(r.summary.total)],['Currently admitted',num(r.summary.admitted)],['Discharged',num(r.summary.discharged)],
          ['Avg stay',`${num(r.summary.avgStay,1)} days`],['Avg cost',inr(r.summary.avgCost)],['Total revenue',inrShort(r.summary.totalCost)],
          ['First admission',date(r.summary.firstAdmission)],['Last admission',date(r.summary.lastAdmission)]].map(([l,v])=>
          <div key={String(l)} className="rounded-md border border-ink-200 p-3"><p className="text-xs text-ink-500">{l}</p><p className="font-semibold">{v}</p></div>)}
      </div>

      <H>2. Disease and severity</H>
      <div className="mb-2 flex justify-end print:hidden"><ExportBtn onClick={()=>downloadCsv('report-diseases.csv',r.diseases)}/></div>
      <DataTable max="" rows={r.diseases} columns={[{key:'name',label:'Condition'},{key:'total',label:'Patients',align:'right'},{key:'severe',label:'Severe',align:'right'},{key:'avgCost',label:'Avg cost',align:'right',render:(x:any)=>inr(x.avgCost)}]}/>
      <p className="mt-2 text-sm">Severity mix: {r.severity.map((s:any)=>`${sevLabel(s.name)} ${num(s.total)}`).join(' · ')}</p>

      <H>3. Hospital comparison</H>
      <div className="mb-2 flex justify-end print:hidden"><ExportBtn onClick={()=>downloadCsv('report-hospitals.csv',r.hospitalComparison)}/></div>
      <DataTable max="" rows={r.hospitalComparison} columns={[{key:'name',label:'Hospital',render:(x:any)=>short(x.name)},{key:'total',label:'Patients',align:'right'},{key:'avgStay',label:'Avg stay',align:'right'},{key:'avgCost',label:'Avg cost',align:'right',render:(x:any)=>inr(x.avgCost)},{key:'totalCost',label:'Total cost',align:'right',render:(x:any)=>inrShort(x.totalCost)}]}/>

      <H>4. OLAP roll-up: admissions by quarter (warehouse)</H>
      <DataTable max="" rows={r.olapQuarterly.map((x:any)=>({period:`${x.year} Q${x.quarter}`,admissions:x.admissions,avgCost:inr(x.avgCost)}))} columns={[{key:'period',label:'Quarter'},{key:'admissions',label:'Admissions',align:'right'},{key:'avgCost',label:'Avg cost',align:'right'}]}/>

      {r.mining&&<><H>5. ML summary (K-Means + Decision Tree)</H>
        {r.mining.error?<p className="text-sm text-alert-600">{r.mining.error}</p>:<>
          <p className="text-sm"><strong>K-Means (K=3, features: age · stay · cost):</strong> Silhouette score {r.mining.kmeans.silhouette}. Cluster sizes: {r.mining.kmeans.clusters.map((c:any)=>`Cluster ${c.cluster} = ${num(c.size)}`).join(', ')}.</p>
          <p className="mt-1 text-sm"><strong>Decision Tree (target: severity):</strong> Test accuracy {(r.mining.decisionTree.accuracy*100).toFixed(1)}%.</p>
        </>}</>}

      {r.aprioriResult&&<><H>6. Apriori association rules (top 10)</H>
        {r.aprioriResult.error?<p className="text-sm text-alert-600">{r.aprioriResult.error}</p>:<>
          <p className="mb-2 text-sm text-ink-500">{r.aprioriResult.transactions} transactions · {r.aprioriResult.rules.length} rules found (support ≥ 0.05, confidence ≥ 0.5, lift ≥ 1.1)</p>
          <DataTable max="" rows={r.aprioriResult.rules.slice(0,10)} columns={[{key:'a',label:'If (antecedent)',render:(x:any)=>x.antecedents.join(' + ')},{key:'c',label:'Then (consequent)',render:(x:any)=>x.consequents.join(' + ')},{key:'support',label:'Support',align:'right'},{key:'confidence',label:'Confidence',align:'right'},{key:'lift',label:'Lift',align:'right'}]}/>
        </>}</>}

      <div className="mt-8"><Disclaimer>Academic-use report built from synthetic, anonymised data. Figures are descriptive statistics — not medical findings, diagnoses or recommendations.</Disclaimer></div>
    </article>}
  </>;
}
