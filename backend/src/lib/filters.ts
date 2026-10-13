import { Request } from 'express';
import { P } from './db';
export function patientWhere(req: Request, alias = 'p') {
  const Q = new P(); const c: string[] = []; const qs = req.query as any;
  const ids = req.user!.role === 'STAFF' ? [req.user!.hospitalId!] : qs.hospitalIds ? qs.hospitalIds.split(',').map(Number).filter(Boolean) : [];
  if (ids.length) c.push(`${alias}.hospital_id in (${Q.list(ids)})`);
  if (qs.from) c.push(`${alias}.admission_date >= ${Q.add(qs.from)}`);
  if (qs.to) c.push(`${alias}.admission_date <= ${Q.add(qs.to)}`);
  if (qs.condition) c.push(`${alias}.condition = ${Q.add(qs.condition)}`);
  if (qs.severity) c.push(`${alias}.severity = ${Q.add(qs.severity)}`);
  if (qs.gender) c.push(`${alias}.gender = ${Q.add(qs.gender)}`);
  return { sql: c.length ? 'where ' + c.join(' and ') : '', Q };
}
export const andWhere = (w: string, extra: string) => w ? `${w} and ${extra}` : `where ${extra}`;
