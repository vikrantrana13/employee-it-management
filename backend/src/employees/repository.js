export function employeeRepository(pool) {
  async function get(db,id) { const [rows]=await db.execute('SELECT * FROM employees WHERE id=?',[id]); return rows[0]; }
  return {
    async list() { const [rows]=await pool.query('SELECT * FROM employees ORDER BY created_at DESC, id DESC LIMIT 100'); return rows; },
    async get(id) { return get(pool,id); },
    async byUsername(username) { const [rows]=await pool.execute('SELECT * FROM employees WHERE username=?',[username]); return rows[0]; },
    async insert(e,actor) {
      const db=await pool.getConnection();
      try {
        await db.beginTransaction();
        await db.execute('INSERT INTO employees (id,username,first_name,last_name,email,department,start_date,role,created_by) VALUES (?,?,?,?,?,?,?,?,?)',
          [e.id,e.username,e.first_name,e.last_name,e.email,e.department,e.start_date,e.role,actor]);
        await db.execute('INSERT INTO onboarding_events (employee_id,actor_id,action) VALUES (?,?,?)',[e.id,actor,'onboarding_requested']);
        await db.commit();
      } catch(e) { await db.rollback(); throw e; } finally { db.release(); }
    },
    async events(id) { const [rows]=await pool.execute('SELECT action,actor_id,created_at FROM onboarding_events WHERE employee_id=? ORDER BY id DESC',[id]); return rows; },
    async withLock(id,callback) {
      const db=await pool.getConnection();
      let locked=false;
      try {
        const [rows]=await db.execute('SELECT GET_LOCK(?,0) AS acquired',['onboard:'+id]);
        if(rows[0].acquired!==1) { const e=new Error('Onboarding is already running. Refresh before retrying.');e.status=409;throw e; }
        locked=true;
        return await callback({
          get:()=>get(db,id),
          link:async keycloakId=>{await db.execute('UPDATE employees SET keycloak_id=? WHERE id=?',[keycloakId,id]);},
          transition:async(status,actor,action)=>{
            await db.beginTransaction();
            try {
              await db.execute('UPDATE employees SET status=? WHERE id=?',[status,id]);
              await db.execute('INSERT INTO onboarding_events (employee_id,actor_id,action) VALUES (?,?,?)',[id,actor,action]);
              await db.commit();
            }catch(e){await db.rollback();throw e;}
          },
        });
      } finally { if(locked)await db.execute('SELECT RELEASE_LOCK(?)',['onboard:'+id]); db.release(); }
    },
  };
}
