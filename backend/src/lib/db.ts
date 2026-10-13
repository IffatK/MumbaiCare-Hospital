import pg from 'pg';
import { config } from '../config';
pg.types.setTypeParser(20, v => parseInt(v, 10));
pg.types.setTypeParser(1700, v => parseFloat(v));
pg.types.setTypeParser(1082, v => v);
export const pool = new pg.Pool({
  connectionString: config.databaseUrl, max: 10,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
});
export async function q<T = any>(sql: string, p: any[] = []): Promise<T[]> {
  return (await pool.query(sql, p)).rows;
}
export async function one<T = any>(sql: string, p: any[] = []): Promise<T | undefined> {
  return (await pool.query(sql, p)).rows[0];
}
export class P {
  vals: any[] = [];
  add(v: any) { this.vals.push(v); return `$${this.vals.length}`; }
  list(vs: any[]) { return vs.map(v => this.add(v)).join(','); }
}
