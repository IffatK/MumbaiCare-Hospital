import { Router, Request } from 'express';
import { z } from 'zod';
import { q, one, P, pool } from '../lib/db';
import { wrap, HttpError } from '../lib/http';
import { requireRole } from '../middleware/auth';
import { todayStr, daysBetween } from '../lib/dates';
const r = Router();
const DAY = 86400000;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD').transform(s => s.slice(0, 10));
export const patientSchema = z.object({
  hospitalId: z.coerce.number().int().positive(), age: z.coerce.number().int().min(0).max(110),
  gender: z.enum(['Male', 'Female', 'Other']), condition: z.string().trim().min(2).max(80),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE']),
  systolicBp: z.coerce.number().int().min(60).max(250), diastolicBp: z.coerce.number().int().min(30).max(150),
  cholesterol: z.coerce.number().int().min(80).max(450), heartRate: z.coerce.number().int().min(30).max(220),
  admissionDate: dateStr, dischargeDate: dateStr.nullable().optional(),
  treatment: z.string().trim().min(2).max(80), tests: z.string().max(255).default(''),
  cost: z.coerce.number().min(0, 'Cost cannot be negative'), status: z.enum(['ADMITTED', 'DISCHARGED']),
}).superRefine((d, ctx) => {
  const t = todayStr();
  if (d.admissionDate > t) ctx.addIssue({ code: 'custom', path: ['admissionDate'], message: 'Admission date cannot be in the future' });
  if (d.status === 'DISCHARGED' && !d.dischargeDate) ctx.addIssue({ code: 'custom', path: ['dischargeDate'], message: 'Discharged patients need a discharge date' });
  if (d.status === 'ADMITTED' && d.dischargeDate) ctx.addIssue({ code: 'custom', path: ['dischargeDate'], message: 'Admitted patients cannot have a discharge date' });
  if (d.dischargeDate && d.dischargeDate < d.admissionDate) ctx.addIssue({ code: 'custom', path: ['dischargeDate'], message: 'Discharge cannot be before admission' });
  if (d.dischargeDate && d.dischargeDate > t) ctx.addIssue({ code: 'custom', path: ['dischargeDate'], message: 'Discharge date cannot be in the future' });
});
const PCOLS = `p.id, p.record_id "recordId", p.hospital_id "hospitalId", p.age, p.gender, p.condition, p.severity,
  p.systolic_bp "systolicBp", p.diastolic_bp "diastolicBp", p.cholesterol, p.heart_rate "heartRate",
  p.admission_date "admissionDate", p.discharge_date "dischargeDate", p.stay_days "stayDays",
  p.treatment, p.tests, p.cost, p.status, p.created_at "createdAt", p.updated_at "updatedAt",
  json_build_object('id',h.id,'name',h.name,'area',h.area,'type',h.type) hospital`;
const COLS = 'hospital_id,age,gender,condition,severity,systolic_bp,diastolic_bp,cholesterol,heart_rate,admission_date,discharge_date,stay_days,treatment,tests,cost,status';
const vals = (d: z.infer<typeof patientSchema>) => [d.hospitalId, d.age, d.gender, d.condition, d.severity, d.systolicBp, d.diastolicBp,
  d.cholesterol, d.heartRate, d.admissionDate, d.dischargeDate ?? null,
  d.dischargeDate ? daysBetween(d.admissionDate, d.dischargeDate) : null, d.treatment,
  d.tests.split(',').map(s => s.trim()).filter(Boolean).join(','), d.cost, d.status];
function scope(req: Request) { return req.user!.role === 'STAFF' ? ` and p.hospital_id=${req.user!.hospitalId}` : ''; }
function assertAllowed(req: Request, hId: number) {
  if (req.user!.role === 'STAFF' && req.user!.hospitalId !== hId) throw new HttpError(403, 'You can only manage records for your hospital');
}
const SORT: Record<string, string> = { recordId: 'p.record_id', age: 'p.age', admissionDate: 'p.admission_date', cost: 'p.cost', stayDays: 'p.stay_days' };

r.get('/', wrap(async (req, res) => {
  const f = z.object({ page: z.coerce.number().min(1).default(1), pageSize: z.coerce.number().min(5).max(100).default(20),
    search: z.string().optional(), hospitalId: z.coerce.number().optional(), condition: z.string().optional(),
    severity: z.enum(['MILD','MODERATE','SEVERE']).optional(), status: z.enum(['ADMITTED','DISCHARGED']).optional(),
    from: z.string().optional(), to: z.string().optional(),
    sort: z.enum(['recordId','age','admissionDate','cost','stayDays']).default('admissionDate'),
    dir: z.enum(['asc','desc']).default('desc'), all: z.string().optional() }).parse(req.query);
  const Qp = new P(); const c: string[] = [];
  if (req.user!.role === 'STAFF') c.push(`p.hospital_id=${Qp.add(req.user!.hospitalId)}`);
  else if (f.hospitalId) c.push(`p.hospital_id=${Qp.add(f.hospitalId)}`);
  if (f.search) { const s = Qp.add(`%${f.search}%`); c.push(`(p.record_id ilike ${s} or p.condition ilike ${s} or p.treatment ilike ${s})`); }
  if (f.condition) c.push(`p.condition=${Qp.add(f.condition)}`);
  if (f.severity) c.push(`p.severity=${Qp.add(f.severity)}`);
  if (f.status) c.push(`p.status=${Qp.add(f.status)}`);
  if (f.from) c.push(`p.admission_date>=${Qp.add(f.from)}`);
  if (f.to) c.push(`p.admission_date<=${Qp.add(f.to)}`);
  const w = c.length ? 'where '+c.join(' and ') : '';
  const total = (await one(`select count(*)::int n from patients p ${w}`, Qp.vals))?.n ?? 0;
  const lim = f.all === 'true' ? 10000 : f.pageSize;
  const off = f.all === 'true' ? 0 : (f.page - 1) * f.pageSize;
  const rows = await q(`select ${PCOLS} from patients p join hospitals h on h.id=p.hospital_id ${w} order by ${SORT[f.sort]} ${f.dir} nulls last, p.id limit ${Qp.add(lim)} offset ${Qp.add(off)}`, Qp.vals);
  res.json({ total, page: f.page, pageSize: f.pageSize, rows });
}));
r.get('/conditions', wrap(async (_req, res) => res.json((await q('select distinct condition from patients order by condition')).map(x => x.condition))));
r.get('/:id', wrap(async (req, res) => {
  const p = await one(`select ${PCOLS} from patients p join hospitals h on h.id=p.hospital_id where p.id=$1${scope(req)}`, [req.params.id]);
  if (!p) throw new HttpError(404, 'Record not found or not in your hospital');
  res.json(p);
}));
r.post('/', requireRole('ADMIN', 'STAFF'), wrap(async (req, res) => {
  const d = patientSchema.parse(req.body); assertAllowed(req, d.hospitalId);
  if (!await one('select 1 from hospitals where id=$1', [d.hospitalId])) throw new HttpError(400, 'Hospital does not exist');
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('lock table patients in share row exclusive mode');
    const last = (await client.query(`select coalesce(max(substring(record_id from 4)::int),0) n from patients where record_id ~ '^MC-[0-9]+$'`)).rows[0].n;
    const recordId = `MC-${String(last + 1).padStart(6, '0')}`;
    const p = (await client.query(`insert into patients(record_id,${COLS}) values($1,${vals(d).map((_,i) => `$${i+2}`).join(',')}) returning id, record_id "recordId"`, [recordId, ...vals(d)])).rows[0];
    await client.query('commit');
    q('insert into activity_log(user_id,action,detail) values($1,$2,$3)', [req.user!.id, 'PATIENT_CREATE', p.recordId]).catch(() => {});
    res.status(201).json(p);
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
}));
r.put('/:id', requireRole('ADMIN', 'STAFF'), wrap(async (req, res) => {
  const existing = await one(`select id,record_id,hospital_id from patients p where p.id=$1${scope(req)}`, [req.params.id]);
  if (!existing) throw new HttpError(404, 'Record not found or not in your hospital');
  const d = patientSchema.parse(req.body); assertAllowed(req, d.hospitalId);
  const sets = COLS.split(',').map((c, i) => `${c}=$${i + 1}`).join(',');
  const p = await one(`update patients set ${sets} where id=$${vals(d).length + 1} returning id, record_id "recordId"`, [...vals(d), existing.id]);
  q('insert into activity_log(user_id,action,detail) values($1,$2,$3)', [req.user!.id, 'PATIENT_UPDATE', p?.recordId]).catch(() => {});
  res.json(p);
}));
r.delete('/:id', requireRole('ADMIN'), wrap(async (req, res) => {
  const p = await one('delete from patients where id=$1 returning record_id', [req.params.id]);
  if (!p) throw new HttpError(404, 'Record not found');
  q('insert into activity_log(user_id,action,detail) values($1,$2,$3)', [req.user!.id, 'PATIENT_DELETE', p.record_id]).catch(() => {});
  res.status(204).end();
}));
export default r;
