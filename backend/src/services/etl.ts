import { q, one, pool } from '../lib/db';
import { dateKey, daysBetween, todayStr } from '../lib/dates';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const ageGroup = (a:number) => a<18?'0-17':a<35?'18-34':a<50?'35-49':a<65?'50-64':'65+';
const title = (s:string) => s.trim().toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
export interface CleanRow { recordId:string; hospitalId:number; age:number; ageGroup:string; gender:string; condition:string; severity:string;
  admissionDate:string; dischargeDate:string|null; stay:number|null; isDischarged:number; cost:number;
  systolicBp:number; diastolicBp:number; cholesterol:number; heartRate:number; treatment:string; tests:string; }
export interface Rejected { recordId:string; rule:string; }
export function transformRows(raw:any[], hospitalIds:Set<number>): { clean:CleanRow[]; rejected:Rejected[] } {
  const clean:CleanRow[]=[]; const rejected:Rejected[]=[];
  const today = todayStr();
  for (const p of raw) {
    const rej = (rule:string) => rejected.push({ recordId: p.record_id??`(id ${p.id})`, rule });
    if (!p.record_id||!p.hospital_id||p.age==null||!p.gender||!p.condition||!p.severity||!p.admission_date||p.cost==null||!p.status||!p.treatment) { rej('R01 missing required field'); continue; }
    if (!(p.age>=0&&p.age<=110)) { rej('R02 age outside 0-110'); continue; }
    const adm = String(p.admission_date).slice(0,10);
    const dis = p.discharge_date ? String(p.discharge_date).slice(0,10) : null;
    if (dis && dis < adm) { rej('R03 discharge before admission'); continue; }
    if (Number(p.cost) < 0) { rej('R04 negative cost'); continue; }
    if ((p.status==='DISCHARGED') !== !!dis) { rej('R05 status/discharge mismatch'); continue; }
    if (adm > today) { rej('R06 admission in future'); continue; }
    if (!hospitalIds.has(Number(p.hospital_id))) { rej('R07 unknown hospital'); continue; }
    clean.push({ recordId:p.record_id, hospitalId:Number(p.hospital_id), age:Number(p.age), ageGroup:ageGroup(Number(p.age)),
      gender:title(p.gender), condition:String(p.condition).trim(), severity:String(p.severity).trim().toUpperCase(),
      admissionDate:adm, dischargeDate:dis, stay:dis?daysBetween(adm,dis):null, isDischarged:dis?1:0, cost:Number(p.cost),
      systolicBp:Number(p.systolic_bp)||0, diastolicBp:Number(p.diastolic_bp)||0, cholesterol:Number(p.cholesterol)||0, heartRate:Number(p.heart_rate)||0,
      treatment:String(p.treatment).trim(),
      tests:[...new Set(String(p.tests??'').split(',').map((t:string)=>t.trim()).filter(Boolean))].sort().join(',') });
  }
  return { clean, rejected };
}
async function upsertDate(client:any, dateStr:string) {
  const d = new Date(dateStr+'T00:00:00Z'); const k = dateKey(dateStr);
  await client.query(`insert into dw.dim_date(date_key,full_date,day,month,month_name,quarter,year,weekday) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(date_key) do nothing`,
    [k, dateStr, d.getUTCDate(), d.getUTCMonth()+1, MONTHS[d.getUTCMonth()], Math.floor(d.getUTCMonth()/3)+1, d.getUTCFullYear(), DAYS[d.getUTCDay()]]);
  return k;
}
export async function runEtl() {
  const running = await one(`select 1 from etl_runs where status='RUNNING' and started_at > now()-interval '10 minutes'`);
  if (running) throw Object.assign(new Error('ETL already running'), { status:409 });
  const run = await one(`insert into etl_runs(status) values('RUNNING') returning id`);
  const runId = run!.id; let stats = { extracted:0, transformed:0, loaded:0, rejected:0 }; let issues:any[]=[];
  try {
    const [patients, hospitals] = await Promise.all([q('select * from patients'), q('select id,name,area,type from hospitals')]);
    stats.extracted = patients.length;
    const { clean, rejected } = transformRows(patients, new Set(hospitals.map((h:any)=>h.id)));
    stats.transformed = clean.length; stats.rejected = rejected.length; issues = rejected.slice(0,500);
    const client = await pool.connect();
    try {
      await client.query('begin');
      // dim_hospital upsert
      for (const h of hospitals) await client.query(`insert into dw.dim_hospital(hospital_id,hospital_name,area,hospital_type) values($1,$2,$3,$4) on conflict(hospital_id) do update set hospital_name=excluded.hospital_name,area=excluded.area,hospital_type=excluded.hospital_type`, [h.id,h.name,h.area,h.type]);
      // dim_patient upsert
      for (const c of clean) await client.query(`insert into dw.dim_patient(patient_record_id,age,age_group,gender) values($1,$2,$3,$4) on conflict(patient_record_id) do update set age=excluded.age,age_group=excluded.age_group,gender=excluded.gender`, [c.recordId,c.age,c.ageGroup,c.gender]);
      // dim_disease upsert
      const diseases = [...new Map(clean.map(c=>[`${c.condition}|${c.severity}`,{disease:c.condition,severity:c.severity}])).values()];
      for (const d of diseases) await client.query(`insert into dw.dim_disease(disease,severity) values($1,$2) on conflict(disease,severity) do nothing`, [d.disease,d.severity]);
      // load dates
      const allDates = new Set<string>(); for (const c of clean) { allDates.add(c.admissionDate); if(c.dischargeDate) allDates.add(c.dischargeDate); }
      for (const d of allDates) await upsertDate(client, d);
      // facts upsert
      const hKeys = new Map((await client.query('select hospital_id,hospital_key from dw.dim_hospital')).rows.map((r:any)=>[r.hospital_id,r.hospital_key]));
      const pKeys = new Map((await client.query('select patient_record_id,patient_key from dw.dim_patient')).rows.map((r:any)=>[r.patient_record_id,r.patient_key]));
      const dKeys = new Map((await client.query('select disease||\'|\'||severity k,disease_key from dw.dim_disease')).rows.map((r:any)=>[r.k,r.disease_key]));
      for (const c of clean) {
        const adkKey = dateKey(c.admissionDate); const ddKey = c.dischargeDate?dateKey(c.dischargeDate):null;
        await client.query(`insert into dw.fact_patient_admission(source_record_id,patient_key,hospital_key,disease_key,admission_date_key,discharge_date_key,patient_count,is_discharged,stay_days,treatment_cost,systolic_bp,diastolic_bp,cholesterol,heart_rate,treatment,tests)
          values($1,$2,$3,$4,$5,$6,1,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          on conflict(source_record_id) do update set patient_key=excluded.patient_key,hospital_key=excluded.hospital_key,disease_key=excluded.disease_key,
          admission_date_key=excluded.admission_date_key,discharge_date_key=excluded.discharge_date_key,is_discharged=excluded.is_discharged,
          stay_days=excluded.stay_days,treatment_cost=excluded.treatment_cost,systolic_bp=excluded.systolic_bp,diastolic_bp=excluded.diastolic_bp,
          cholesterol=excluded.cholesterol,heart_rate=excluded.heart_rate,treatment=excluded.treatment,tests=excluded.tests`,
          [c.recordId,pKeys.get(c.recordId),hKeys.get(c.hospitalId),dKeys.get(`${c.condition}|${c.severity}`),adkKey,ddKey,c.isDischarged,c.stay,c.cost,c.systolicBp,c.diastolicBp,c.cholesterol,c.heartRate,c.treatment,c.tests]);
      }
      // remove deleted records
      if (clean.length) await client.query(`delete from dw.fact_patient_admission where source_record_id <> all($1::text[])`, [clean.map(c=>c.recordId)]);
      await client.query('commit'); stats.loaded = clean.length;
      await q(`update etl_runs set status='SUCCESS',ended_at=now(),extracted=$1,transformed=$2,loaded=$3,rejected=$4,issues=$5::jsonb where id=$6`,
        [stats.extracted,stats.transformed,stats.loaded,stats.rejected,JSON.stringify(issues),runId]);
    } catch(e) { await client.query('rollback'); throw e; } finally { client.release(); }
  } catch(e:any) {
    await q(`update etl_runs set status='FAILED',ended_at=now(),extracted=$1,transformed=$2,loaded=$3,rejected=$4,issues=$5::jsonb where id=$6`,
      [stats.extracted,stats.transformed,stats.loaded,stats.rejected,JSON.stringify([{rule:'PIPELINE',message:String(e?.message??e).slice(0,500)}]),runId]);
  }
  const run2 = await one(`select * from etl_runs where id=$1`,[runId]);
  return { runId, status:run2!.status, ...stats, errors:(run2!.issues??[]).slice(0,50), finishedAt:run2!.ended_at };
}
