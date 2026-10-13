import 'dotenv/config';
import fs from 'fs'; import path from 'path'; import { pool } from '../lib/db';
(async()=>{
  const dir=path.resolve(__dirname,'../../../supabase/migrations');
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()){
    console.log('Applying',f); await pool.query(fs.readFileSync(path.join(dir,f),'utf8'));
  }
  console.log('Migrations done.'); await pool.end();
})().catch(e=>{console.error(e.message);process.exit(1);});
