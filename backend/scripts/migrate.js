import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createDatabase} from '../src/database.js';
const pool=createDatabase();const db=await pool.getConnection();let locked=false;
try{
  const [lock]=await db.query("SELECT GET_LOCK('employee-it-migrations',0) AS acquired");if(lock[0].acquired!==1)throw new Error('Another migration is running.');locked=true;
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(100) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const folder=new URL('../migrations/',import.meta.url);
  for(const file of (await readdir(folder)).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){
    const sql=await readFile(new URL(file,folder),'utf8');const hash=createHash('sha256').update(sql).digest('hex');
    const [done]=await db.execute('SELECT checksum FROM schema_migrations WHERE filename=?',[file]);
    if(done.length){if(done[0].checksum!==hash)throw new Error(`Applied migration ${file} changed. Add a new migration instead.`);console.log(`Already applied ${file}`);continue;}
    // All current statements are replay-safe if a connection fails before the ledger write.
    // Existing installations replay the initial CREATE/seed scripts once when adopting the ledger.
    for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.query(statement);
    await db.execute('INSERT INTO schema_migrations (filename,checksum) VALUES (?,?)',[file,hash]);console.log(`Applied ${file}`);
  }
}finally{try{if(locked)await db.query("SELECT RELEASE_LOCK('employee-it-migrations')");}finally{db.release();await pool.end();}}
