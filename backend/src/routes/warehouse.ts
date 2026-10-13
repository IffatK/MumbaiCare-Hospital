import { Router } from 'express';
import { q, one } from '../lib/db';
import { wrap, HttpError } from '../lib/http';
import { requireRole } from '../middleware/auth';
import { runEtl } from '../services/etl';
const r = Router();
const TABLES = [
  {name:'dw.fact_patient_admission',kind:'fact',cols:['fact_id','source_record_id','patient_key','hospital_key','disease_key','admission_date_key','discharge_date_key','patient_count','is_discharged','stay_days','treatment_cost','systolic_bp','diastolic_bp','cholesterol','heart_rate','treatment','tests']},
  {name:'dw.dim_hospital',kind:'dimension',cols:['hospital_key','hospital_id','hospital_name','area','hospital_type']},
  {name:'dw.dim_patient',kind:'dimension',cols:['patient_key','patient_record_id','age','age_group','gender']},
  {name:'dw.dim_disease',kind:'dimension',cols:['disease_key','disease','severity']},
  {name:'dw.dim_date',kind:'dimension',cols:['date_key','full_date','day','month','month_name','quarter','year','weekday']},
];
r.get('/schema', wrap(async(_req,res)=>{
  const rows = await Promise.all(TABLES.map(async t=>{const c=await one(`select count(*)::int n from ${t.name}`);return{...t,columns:t.cols,rows:c?.n??0};}));
  res.json(rows);
}));
r.get('/status', wrap(async(_req,res)=>{
  const runs=await q(`select id,status,started_at "startedAt",ended_at "endedAt",extracted,transformed,loaded,rejected,issues errors from etl_runs order by started_at desc limit 20`);
  const last=runs.find(x=>x.status==='SUCCESS');
  const [{n:ops}]=await q(`select count(*)::int n from patients`);
  const [{n:pending}]=last?await q(`select count(*)::int n from patients where updated_at>$1`,[last.startedAt]):[{n:ops}];
  res.json({runs,lastSuccess:last??null,operationalRecords:ops,pendingChanges:pending});
}));
r.post('/etl/run',requireRole('ADMIN'),wrap(async(req,res)=>{
  try{const result=await runEtl();q('insert into activity_log(user_id,action,detail) values($1,$2,$3)',[req.user!.id,'ETL_RUN',`run ${result.runId}`]).catch(()=>{});res.json(result);}
  catch(e:any){if(e.status===409)throw new HttpError(409,e.message);throw e;}
}));
export default r;
