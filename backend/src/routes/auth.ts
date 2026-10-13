import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { q, one } from '../lib/db';
import { wrap, HttpError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { config } from '../config';
const r = Router();
const failures = new Map<string, { n: number; until: number }>();
r.post('/login', wrap(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const key = email.toLowerCase();
  const f = failures.get(key);
  if (f && f.n >= 10 && f.until > Date.now()) throw new HttpError(429, 'Too many failed attempts. Try again in 15 minutes.');
  const u = await one('select u.*, h.name hospital_name from users u left join hospitals h on h.id=u.hospital_id where u.email=$1', [key]);
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    failures.set(key, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 15 * 60_000 });
    throw new HttpError(401, 'Email or password is incorrect');
  }
  failures.delete(key);
  const payload = { id: u.id, role: u.role, hospitalId: u.hospital_id, name: u.name, email: u.email };
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '8h' });
  q('insert into activity_log(user_id,action) values($1,$2)', [u.id, 'LOGIN']).catch(() => {});
  res.json({ token, user: { ...payload, hospitalName: u.hospital_name ?? null } });
}));
r.get('/me', requireAuth, wrap(async (req, res) => {
  const u = await one('select u.*,h.name hospital_name from users u left join hospitals h on h.id=u.hospital_id where u.id=$1', [req.user!.id]);
  if (!u) throw new HttpError(401, 'Account not found');
  res.json({ id: u.id, role: u.role, hospitalId: u.hospital_id, name: u.name, email: u.email, hospitalName: u.hospital_name ?? null });
}));
export default r;
