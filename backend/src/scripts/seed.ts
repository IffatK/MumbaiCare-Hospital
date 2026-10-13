import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, q, one } from '../lib/db';
function rng(seed=42){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const rand=rng(42);
const pick=<T,>(a:T[])=>a[Math.floor(rand()*a.length)];
const between=(lo:number,hi:number)=>Math.round(lo+rand()*(hi-lo));
const gauss=(m:number,s:number)=>{const u=1-rand(),v=rand();return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const HOSPS=[['H-AND-01','Andheri Community Care (Demo)','Andheri','Multi-specialty'],['H-BAN-02','Bandra Seaside General (Demo)','Bandra','General'],
  ['H-DAD-03','Dadar Central Clinic (Demo)','Dadar','Municipal'],['H-GHA-04','Ghatkopar Wellness Hospital (Demo)','Ghatkopar','Multi-specialty'],
  ['H-BOR-05','Borivali Parkview Hospital (Demo)','Borivali','General'],['H-CHE-06','Chembur Riverside Medical (Demo)','Chembur','Municipal'],
  ['H-COL-07','Colaba Harbour Hospital (Demo)','Colaba','Multi-specialty'],['H-THA-08','Thane Lakeside Care (Demo)','Thane','General']];
const CONDITIONS:Record<string,[number,number,string[],string[]]>={
  'Dengue':[5,35000,['IV Fluids','Supportive Care'],['CBC','Platelet Count','NS1 Antigen']],
  'Malaria':[5,30000,['Antimalarial Therapy'],['CBC','Blood Smear','LFT']],
  'Typhoid':[6,28000,['Antibiotic Therapy'],['CBC','Widal Test','Blood Culture']],
  'Pneumonia':[7,60000,['Antibiotic Therapy','Oxygen Therapy'],['Chest X-Ray','CBC','Sputum Culture']],
  'Diabetes Complications':[6,55000,['Insulin Management'],['HbA1c','Blood Glucose','KFT']],
  'Hypertension':[4,32000,['Antihypertensive Therapy'],['ECG','Lipid Profile','KFT']],
  'Cardiac Event':[9,220000,['Angioplasty','Cardiac Monitoring'],['ECG','Troponin','Echocardiogram','Lipid Profile']],
  'Fracture':[6,90000,['Orthopaedic Surgery','Casting'],['X-Ray','CBC']],
  'Gastroenteritis':[3,18000,['IV Fluids'],['CBC','Stool Test','Electrolytes']],
  'Asthma Exacerbation':[4,25000,['Nebulization','Oxygen Therapy'],['Spirometry','Chest X-Ray']]};
const SEV_MULT={MILD:0.7,MODERATE:1.0,SEVERE:1.8} as const;
const EXTRA=['CBC','ECG','Chest X-Ray','Electrolytes','KFT','LFT'];
(async()=>{
  // hospitals
  for(const [code,name,area,type] of HOSPS)
    await pool.query(`insert into hospitals(code,name,area,type,phone,email) values($1,$2,$3,$4,$5,$6) on conflict(code) do nothing`,
      [code,name,area,type,`+91-22-5550-${between(1000,9999)}`,`${code.toLowerCase()}@demo.mumbaicare.local`]);
  // users
  const hash=await bcrypt.hash('Password@123',10);
  const hospRows=await q('select id,code from hospitals order by id');
  const hid=(code:string)=>hospRows.find((h:any)=>h.code===code)?.id;
  for(const u of [
    {email:'admin@mumbaicare.local',name:'Asha Admin',role:'ADMIN',hid:null},
    {email:'analyst@mumbaicare.local',name:'Rohan Analyst',role:'ANALYST',hid:null},
    {email:'staff.andheri@mumbaicare.local',name:'Meera Staff',role:'STAFF',hid:hid('H-AND-01')},
    {email:'staff.dadar@mumbaicare.local',name:'Kiran Staff',role:'STAFF',hid:hid('H-DAD-03')},
  ]) await pool.query(`insert into users(email,password_hash,name,role,hospital_id) values($1,$2,$3,$4,$5) on conflict(email) do nothing`,[u.email,hash,u.name,u.role,u.hid]);
  // patients
  const existing=await one('select count(*)::int n from patients');
  if(existing!.n>0){console.log(`Seed: ${existing!.n} patients exist; hospitals+users ensured.`);await pool.end();return;}
  const today=new Date();today.setUTCHours(0,0,0,0);
  const start=today.getTime()-730*86400000;
  const weight=[1.3,1.1,1.4,1.0,0.8,0.9,0.6,0.9];const tot=weight.reduce((a,b)=>a+b);
  const rows:any[][]=[];
  for(let i=1;i<=3000;i++){
    let rv=rand()*tot,h=0;for(let k=0;k<weight.length;k++){rv-=weight[k];if(rv<=0){h=k;break;}}
    const cond=pick(Object.keys(CONDITIONS));const[bStay,bCost,trs,tests]=CONDITIONS[cond];
    const age=Math.min(90,Math.max(1,Math.round(gauss(cond==='Cardiac Event'?62:42,17))));
    const sr=rand()+(age>60?0.2:0);const sev=sr<0.5?'MILD':sr<0.85?'MODERATE':'SEVERE';const m=SEV_MULT[sev];
    const adm=new Date(start+Math.floor(rand()*730)*86400000);
    const stay=Math.max(1,Math.round(gauss(bStay*m,1.5)));
    let dis:Date|null=new Date(adm.getTime()+stay*86400000);let status='DISCHARGED';
    if(dis>today){dis=null;status='ADMITTED';}
    const t=[...tests];if(rand()<0.35)t.push(pick(EXTRA));
    rows.push([`MC-${String(i).padStart(6,'0')}`,hospRows[h].id,age,rand()<0.52?'Male':rand()<0.97?'Female':'Other',cond,sev,
      Math.round(gauss(118+age*0.3+(cond==='Hypertension'?25:0)+(sev==='SEVERE'?10:0),10)),
      Math.round(gauss(76+(cond==='Hypertension'?12:0),7)),
      Math.round(gauss(180+age*0.6+(cond==='Cardiac Event'?40:0),25)),
      Math.round(gauss(76+(sev==='SEVERE'?14:sev==='MODERATE'?6:0),8)),
      adm.toISOString().slice(0,10),dis?dis.toISOString().slice(0,10):null,dis?stay:null,
      pick(trs),[...new Set(t)].join(','),
      Math.max(2000,Math.round(gauss(bCost*m*(0.85+weight[h]*0.15)+stay*2500,bCost*0.12))),status]);
  }
  const COLS='record_id,hospital_id,age,gender,condition,severity,systolic_bp,diastolic_bp,cholesterol,heart_rate,admission_date,discharge_date,stay_days,treatment,tests,cost,status';
  for(let i=0;i<rows.length;i+=400){
    const chunk=rows.slice(i,i+400);
    const ph=chunk.map((r,j)=>`(${r.map((_:any,k:number)=>`$${j*17+k+1}`).join(',')})`).join(',');
    await pool.query(`insert into patients(${COLS}) values ${ph}`,chunk.flat());
  }
  console.log(`Seeded ${HOSPS.length} hospitals, 4 users, ${rows.length} synthetic patients.`);
  await pool.end();
})().catch(e=>{console.error(e.message);process.exit(1);});
