import { Router } from 'express';
import { z } from 'zod';
import { q, one, P } from '../lib/db';
import { wrap } from '../lib/http';
import { loadDataset } from '../services/mining/dataset';
import { runKMeans } from '../services/mining/kmeans';
import { runDecisionTree } from '../services/mining/decisionTree';
import { runApriori } from '../services/mining/apriori';
const r = Router();
r.post('/generate',wrap(async(req,res)=>{
  const b=z.object({title:z.string().min(3).default('MumbaiCare Analytical Report'),hospitalIds:z.array(z.number()).default([]),
    from:z.string().optional(),to:z.string().optional(),
    includeMining:z.boolean().default(false),includeApriori:z.boolean().default(false)}).parse(req.body);
  const ids=req.user!.role==='STAFF'?[req.user!.hospitalId!]:b.hospitalIds;
  const Qp=new P();const c:string[]=[];
  if(ids.length)c.push(`p.hospital_id in (${Qp.list(ids)})`);
  if(b.from)c.push(`p.admission_date>=${Qp.add(b.from)}`);
  if(b.to)c.push(`p.admission_date<=${Qp.add(b.to)}`);
  const w=c.length?'where '+c.join(' and '):''; const v=Qp.vals;
  const [[summary],diseases,severity,hospitals]=await Promise.all([
    q(`select count(*) total,count(*) filter(where status='ADMITTED') admitted,count(*) filter(where status='DISCHARGED') discharged,
      round(avg(stay_days),2) "avgStay",round(avg(cost)) "avgCost",coalesce(sum(cost),0) "totalCost",
      min(admission_date) "firstAdmission",max(admission_date) "lastAdmission" from patients p ${w}`,v),
    q(`select condition name,count(*) total,count(*) filter(where severity='SEVERE') severe,round(avg(cost)) "avgCost" from patients p ${w} group by 1 order by 2 desc`,v),
    q(`select severity name,count(*) total from patients p ${w} group by 1`,v),
    q(`select h.name,count(*) total,round(avg(p.stay_days),2) "avgStay",round(avg(p.cost)) "avgCost",sum(p.cost) "totalCost" from patients p join hospitals h on h.id=p.hospital_id ${w} group by h.id,h.name order by h.name`,v),
  ]);
  const Qp2=new P();
  const olapQ=ids.length?`join dw.dim_hospital hd on hd.hospital_key=f.hospital_key where hd.hospital_id in (${Qp2.list(ids)})`:'';
  const olapQuarterly=await q(`select d.year,d.quarter,count(*) admissions,round(avg(f.treatment_cost)) "avgCost" from dw.fact_patient_admission f join dw.dim_date d on d.date_key=f.admission_date_key ${olapQ} group by d.year,d.quarter order by d.year,d.quarter`,Qp2.vals);
  let mining:any=null,aprioriResult:any=null;
  if(b.includeMining&&req.user!.role!=='STAFF'){
    try{const ds=await loadDataset(ids.length?ids:undefined);const{labels,rowsUsed,...km}=runKMeans(ds,['age','stay_days','treatment_cost'],3);
      const dt=runDecisionTree(ds,'severity',['age','heart_rate','treatment_cost','disease'],4,0.3);
      mining={kmeans:{k:km.k,silhouette:km.silhouette,clusters:km.clusters},decisionTree:{accuracy:dt.accuracy,target:dt.target}};}
    catch(e:any){mining={error:e.message};}
  }
  if(b.includeApriori&&req.user!.role!=='STAFF'){
    try{const ds=await loadDataset(ids.length?ids:undefined);aprioriResult=runApriori(ds,'tests_treatment',0.05,0.5,1.1);}
    catch(e:any){aprioriResult={error:e.message};}
  }
  const lastEtl=await one(`select ended_at from etl_runs where status='SUCCESS' order by started_at desc limit 1`);
  const selected=ids.length?(await q(`select name from hospitals where id=any($1::int[]) order by name`,[ids])).map(h=>h.name):['All hospitals'];
  res.json({title:b.title,generatedAt:new Date().toISOString(),generatedBy:req.user!.name,hospitals:selected,
    range:{from:b.from??null,to:b.to??null},summary,diseases,severity,
    hospitalComparison:hospitals,olapQuarterly,mining,aprioriResult,freshness:lastEtl?.ended_at??null});
}));
export default r;
