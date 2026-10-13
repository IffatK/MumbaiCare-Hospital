import { Router } from 'express';
import { q, one } from '../lib/db';
import { wrap, HttpError } from '../lib/http';
import { todayStr } from '../lib/dates';
const r = Router();
const CHECKS = [
  {key:'missing_discharge',label:'Discharged without discharge date',sql:"status='DISCHARGED' and discharge_date is null"},
  {key:'admitted_with_discharge',label:'Admitted but has discharge date',sql:"status='ADMITTED' and discharge_date is not null"},
  {key:'discharge_before_admission',label:'Discharge before admission',sql:'discharge_date < admission_date'},
  {key:'future_admission',label:'Admission date in the future',sql:`admission_date > '${todayStr()}'`},
  {key:'stay_mismatch',label:'Stay duration mismatch',sql:'discharge_date is not null and (stay_days is null or stay_days <> discharge_date - admission_date)'},
  {key:'negative_cost',label:'Negative treatment cost',sql:'cost < 0'},
  {key:'age_out_of_range',label:'Age outside 0–110',sql:'age < 0 or age > 110'},
  {key:'vitals_out_of_range',label:'Vital signs out of range',sql:'systolic_bp not between 60 and 250 or heart_rate not between 30 and 220 or cholesterol not between 80 and 450'},
  {key:'invalid_hospital',label:'Invalid hospital reference',sql:'hospital_id not in (select id from hospitals)'},
];
r.get('/',wrap(async(_req,res)=>{
  const [{n:total}]=await q(`select count(*)::int n from patients`);
  const checks=await Promise.all(CHECKS.map(async c=>({key:c.key,label:c.label,count:(await one(`select count(*)::int n from patients where ${c.sql}`))?.n??0})));
  const [m]=await q(`select count(*) filter(where discharge_date is null)::int "dischargeDate", count(*) filter(where stay_days is null)::int "stayDays", count(*) filter(where tests='')::int tests, count(*) filter(where treatment='')::int treatment from patients`);
  const missing=Object.entries(m).map(([field,count])=>({field,count}));
  const duplicates=await q(`select record_id "recordId",count(*)::int n from patients group by record_id having count(*)>1`);
  res.json({total,checks,missing,duplicates,checkedAt:new Date().toISOString(),note:'Missing discharge date/stay days expected for admitted patients.'});
}));
r.get('/records/:key',wrap(async(req,res)=>{
  const c=CHECKS.find(x=>x.key===req.params.key);if(!c)throw new HttpError(404,'Unknown check');
  res.json(await q(`select id,record_id "recordId",hospital_id "hospitalId",status,admission_date "admissionDate",discharge_date "dischargeDate",stay_days "stayDays",cost,age from patients where ${c.sql} limit 200`));
}));
export default r;
