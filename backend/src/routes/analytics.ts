import { Router } from 'express';
import { q } from '../lib/db';
import { wrap } from '../lib/http';
import { patientWhere, andWhere } from '../lib/filters';
const r = Router();
const GRAIN: Record<string,string> = { day:'YYYY-MM-DD', month:'YYYY-MM', year:'YYYY' };
const J = 'join hospitals h on h.id=p.hospital_id';
const AGE = `case when p.age<18 then '0-17' when p.age<35 then '18-34' when p.age<50 then '35-49' when p.age<65 then '50-64' else '65+' end`;

r.get('/overview', wrap(async (req, res) => {
  const { sql: w, Q } = patientWhere(req); const v = Q.vals;
  const [kpis] = await q(`select count(*) total, count(*) filter(where status='ADMITTED') admitted,
      count(*) filter(where status='DISCHARGED') discharged, count(distinct hospital_id) hospitals,
      round(avg(stay_days),2) "avgStay", round(avg(cost)) "avgCost", coalesce(sum(cost),0) "totalCost",
      count(*) filter(where severity='SEVERE') severe from patients p ${w}`, v);
  const [admissions, discharges, byHospital, diseases, severity, stayHist, scatter, ageGroups] = await Promise.all([
    q(`select to_char(admission_date,'YYYY-MM') period, count(*) value from patients p ${w} group by 1 order by 1`, v),
    q(`select to_char(discharge_date,'YYYY-MM') period, count(*) value from patients p ${andWhere(w,'discharge_date is not null')} group by 1 order by 1`, v),
    q(`select h.name, count(*) patients, round(avg(p.cost)) "avgCost" from patients p ${J} ${w} group by h.id,h.name order by patients desc`, v),
    q(`select condition name, count(*) value from patients p ${w} group by 1 order by 2 desc`, v),
    q(`select severity name, count(*) value from patients p ${w} group by 1`, v),
    q(`select least(stay_days,20) bucket, count(*) value from patients p ${andWhere(w,'stay_days is not null')} group by 1 order by 1`, v),
    q(`select age, cost, severity from patients p ${w} order by id limit 600`, v),
    q(`select ${AGE} grp, count(*) value from patients p ${w} group by 1 order by 1`, v),
  ]);
  res.json({ kpis, admissions, discharges, byHospital, diseases, severity, stayHist, scatter, ageGroups });
}));

r.get('/admissions', wrap(async (req, res) => {
  const { sql: w, Q } = patientWhere(req); const v = Q.vals;
  const g = GRAIN[String(req.query.grain)] ?? GRAIN.month;
  const [trend, byHospital, [kpis]] = await Promise.all([
    q(`select to_char(admission_date,'${g}') period, count(*) admissions, count(*) filter(where status='DISCHARGED') discharged, round(avg(stay_days),2) "avgStay" from patients p ${w} group by 1 order by 1`, v),
    q(`select h.name, count(*) admissions, count(*) filter(where p.status='ADMITTED') current, count(*) filter(where p.status='DISCHARGED') discharged, round(avg(p.stay_days),2) "avgStay" from patients p ${J} ${w} group by h.id,h.name order by admissions desc`, v),
    q(`select count(*) filter(where status='ADMITTED') current, count(*) filter(where status='DISCHARGED') discharged, round(avg(stay_days),2) "avgStay" from patients p ${w}`, v),
  ]);
  res.json({ kpis, trend, byHospital });
}));

r.get('/diseases', wrap(async (req, res) => {
  const { sql: w, Q } = patientWhere(req); const v = Q.vals;
  const [byDisease, byHospital, trend, ageGroups, gender] = await Promise.all([
    q(`select condition name, count(*) total, count(*) filter(where severity='MILD') mild, count(*) filter(where severity='MODERATE') moderate, count(*) filter(where severity='SEVERE') severe, round(avg(age),1) "avgAge" from patients p ${w} group by 1 order by 2 desc`, v),
    q(`select h.name hospital, p.condition name, count(*) value from patients p ${J} ${w} group by h.name,p.condition`, v),
    q(`select to_char(admission_date,'YYYY-MM') period, condition name, count(*) value from patients p ${w} group by 1,2 order by 1`, v),
    q(`select ${AGE} grp, count(*) value from patients p ${w} group by 1 order by 1`, v),
    q(`select gender name, count(*) value from patients p ${w} group by 1`, v),
  ]);
  res.json({ byDisease, byHospital, trend, ageGroups, gender });
}));

r.get('/hospitals', wrap(async (req, res) => {
  const { sql: w, Q } = patientWhere(req); const v = Q.vals;
  const [metrics, severity, disease, monthly] = await Promise.all([
    q(`select h.id, h.name, count(*) total, count(*) admissions, count(*) filter(where p.status='DISCHARGED') discharges,
        count(*) filter(where p.status='ADMITTED') current, round(avg(p.stay_days),2) "avgStay", round(avg(p.cost)) "avgCost", sum(p.cost) "totalCost"
        from patients p ${J} ${w} group by h.id,h.name order by h.name`, v),
    q(`select h.name hospital, p.severity name, count(*) value from patients p ${J} ${w} group by h.name,p.severity`, v),
    q(`select h.name hospital, p.condition name, count(*) value from patients p ${J} ${w} group by h.name,p.condition`, v),
    q(`select to_char(p.admission_date,'YYYY-MM') period, h.name hospital, count(*) value from patients p ${J} ${w} group by 1,2 order by 1`, v),
  ]);
  res.json({ metrics, severity, disease, monthly });
}));
export default r;
