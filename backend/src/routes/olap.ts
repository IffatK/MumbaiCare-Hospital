import { Router } from 'express';
import { z } from 'zod';
import { q, P } from '../lib/db';
import { wrap, HttpError } from '../lib/http';
const r = Router();
const DIMS: Record<string,{expr:string;label:string}> = {
  hospital:{expr:'h.hospital_name',label:'Hospital'}, area:{expr:'h.area',label:'Area'},
  disease:{expr:'d.disease',label:'Disease'}, severity:{expr:'d.severity',label:'Severity'},
  year:{expr:'ad.year::text',label:'Admission year'}, quarter:{expr:"ad.year||'-Q'||ad.quarter",label:'Admission quarter'},
  month:{expr:"to_char(ad.full_date,'YYYY-MM')",label:'Admission month'}, day:{expr:"to_char(ad.full_date,'YYYY-MM-DD')",label:'Admission day'},
  gender:{expr:'p.gender',label:'Gender'}, ageGroup:{expr:'p.age_group',label:'Age group'},
};
const MEASURES: Record<string,{expr:string;label:string}> = {
  patientCount:{expr:'sum(f.patient_count)',label:'Patient count'},
  admissionCount:{expr:'count(f.fact_id)',label:'Admission count'},
  dischargeCount:{expr:'sum(f.is_discharged)',label:'Discharge count'},
  avgStay:{expr:'round(avg(f.stay_days),2)',label:'Average stay (days)'},
  avgCost:{expr:'round(avg(f.treatment_cost),2)',label:'Avg treatment cost'},
  totalCost:{expr:'round(sum(f.treatment_cost),2)',label:'Total treatment cost'},
};
const FROM=`from dw.fact_patient_admission f join dw.dim_hospital h on h.hospital_key=f.hospital_key
  join dw.dim_disease d on d.disease_key=f.disease_key join dw.dim_patient p on p.patient_key=f.patient_key
  join dw.dim_date ad on ad.date_key=f.admission_date_key`;
const schema=z.object({rows:z.array(z.string()).min(1).max(3),columns:z.array(z.string()).max(1).default([]),measure:z.string(),
  filters:z.array(z.object({dimension:z.string(),values:z.array(z.union([z.string(),z.number()])).min(1)})).default([])});
r.get('/meta',wrap(async(_req,res)=>{
  const values:Record<string,any[]>={};
  await Promise.all(['hospital','disease','severity','year','gender','ageGroup','area'].map(async k=>{
    values[k]=(await q(`select distinct ${DIMS[k].expr} v ${FROM} order by 1`)).map(x=>x.v);
  }));
  res.json({dimensions:Object.entries(DIMS).map(([key,d])=>({key,label:d.label})),
    measures:Object.entries(MEASURES).map(([key,m])=>({key,label:m.label})),values});
}));
r.post('/query',wrap(async(req,res)=>{
  const b=schema.parse(req.body); const dims=[...b.rows,...b.columns];
  for(const d of [...dims,...b.filters.map(f=>f.dimension)])if(!DIMS[d])throw new HttpError(400,`Unknown dimension: ${d}`);
  const m=MEASURES[b.measure];if(!m)throw new HttpError(400,`Unknown measure: ${b.measure}`);
  const Qp=new P();
  const where=b.filters.map(f=>`(${DIMS[f.dimension].expr})::text in (${Qp.list(f.values.map(String))})`);
  const sel=dims.map((d,i)=>`${DIMS[d].expr} as d${i}`).join(', ');
  const grp=dims.map((_,i)=>i+1).join(',');
  const sql=`select ${sel},${m.expr} as value ${FROM} ${where.length?'where '+where.join(' and '):''}
    group by ${grp} order by ${grp} limit 5000`;
  const t0=Date.now(); const raw=await q(sql,Qp.vals);
  const rows=raw.map(x=>{const o:any={value:x.value==null?null:Number(x.value)};dims.forEach((d,i)=>(o[d]=x[`d${i}`]));return o;});
  let pivot:any=null;
  if(b.columns.length){const col=b.columns[0];const cols=[...new Set(rows.map(x=>String(x[col])))].sort();const map=new Map<string,any>();
    for(const x of rows){const key=b.rows.map(d=>x[d]).join('||');if(!map.has(key))map.set(key,Object.fromEntries(b.rows.map(d=>[d,x[d]])));map.get(key)[String(x[col])]=x.value;}
    pivot={columns:cols,rows:[...map.values()]};}
  const explain=`${m.label} by ${b.rows.map(d=>DIMS[d].label).join(' > ')}${b.columns.length?` across ${DIMS[b.columns[0]].label}`:''}${b.filters.length?`, where ${b.filters.map(f=>`${DIMS[f.dimension].label} ∈ {${f.values.join(', ')}}`).join(' and ')}`:''}`;
  res.json({rows,pivot,explain,ms:Date.now()-t0,operation:b.filters.length>1?'dice':b.filters.length===1?'slice':'aggregate'});
}));
export default r;
