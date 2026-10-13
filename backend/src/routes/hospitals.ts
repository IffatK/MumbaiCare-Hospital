import { Router } from 'express';
import { z } from 'zod';
import { q, one, P } from '../lib/db';
import { wrap, HttpError } from '../lib/http';
import { requireRole } from '../middleware/auth';
const r = Router();
const body = z.object({ code: z.string().trim().min(2).max(20), name: z.string().trim().min(3).max(120), area: z.string().trim().min(2),
  type: z.string().min(2), phone: z.string().optional().nullable(), email: z.string().email().optional().nullable().or(z.literal('')), active: z.boolean().optional() });
r.get('/', wrap(async (_req, res) => {
  res.json(await q(`select h.*,(select count(*)::int from patients p where p.hospital_id=h.id) "patientCount" from hospitals h order by h.name`));
}));
r.get('/:id', wrap(async (req, res) => {
  const h = await one(`select h.*,(select count(*)::int from patients p where p.hospital_id=h.id) "patientCount" from hospitals h where h.id=$1`, [req.params.id]);
  if (!h) throw new HttpError(404, 'Hospital not found');
  const a = await one('select count(*)::int n from patients where hospital_id=$1 and status=$2', [h.id, 'ADMITTED']);
  res.json({ ...h, admitted: a?.n ?? 0 });
}));
r.post('/', requireRole('ADMIN'), wrap(async (req, res) => {
  const d = body.parse(req.body);
  res.status(201).json(await one('insert into hospitals(code,name,area,type,phone,email) values($1,$2,$3,$4,$5,$6) returning *', [d.code, d.name, d.area, d.type, d.phone ?? null, d.email || null]));
}));
r.put('/:id', requireRole('ADMIN'), wrap(async (req, res) => {
  const d = body.partial().parse(req.body); const Qp = new P(); const sets: string[] = [];
  if (d.name !== undefined) sets.push(`name=${Qp.add(d.name)}`);
  if (d.code !== undefined) sets.push(`code=${Qp.add(d.code)}`);
  if (d.area !== undefined) sets.push(`area=${Qp.add(d.area)}`);
  if (d.type !== undefined) sets.push(`type=${Qp.add(d.type)}`);
  if (d.phone !== undefined) sets.push(`phone=${Qp.add(d.phone ?? null)}`);
  if (d.email !== undefined) sets.push(`email=${Qp.add(d.email || null)}`);
  if (d.active !== undefined) sets.push(`active=${Qp.add(d.active)}`);
  if (!sets.length) throw new HttpError(400, 'Nothing to update');
  const h = await one(`update hospitals set ${sets.join(',')} where id=${Qp.add(Number(req.params.id))} returning *`, Qp.vals);
  if (!h) throw new HttpError(404, 'Hospital not found');
  res.json(h);
}));
export default r;
