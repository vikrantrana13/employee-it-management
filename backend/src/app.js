import {guides,wikiPages} from './knowledge.js';
import express from 'express';
import {ticketRoutes} from './tickets/routes.js';
import { accessRoutes } from './access/routes.js';
import { deviceRoutes } from './devices/routes.js';
import { authentication, requireRoles } from './auth.js';

export function createApp({ checkDatabase, onboarding, inventory, access, tickets, offboarding, audit, verifyToken = async () => { throw new Error("Authentication is not configured"); } }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'employee-it-api' });
  });
  app.get('/api/ready', async (_req, res) => {
    try {
      await checkDatabase();
      res.json({ status: 'ready', api: 'connected', database: 'connected', checkedAt: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'not_ready', api: 'connected', database: 'unavailable', message: 'MySQL is unavailable. Check Docker and database configuration.' });
    }
  });
  const verifyIdentity = authentication(verifyToken);
  const authenticate = [verifyIdentity, async (req,res,next)=>{
    try { if(onboarding)await onboarding.assertActive(req.identity);next(); }
    catch(e) { res.status(e.status||503).json({error:e.status?e.message:'Employee status is temporarily unavailable.',...(e.code==='employee_inactive'?{code:e.code}:{})}); }
  }];
  app.get('/api/knowledge-base',authenticate,requireRoles('employee','it-support','admin'),(req,res)=>res.set('Cache-Control','no-store').json({name:req.identity.name||req.identity.preferred_username||'employee',guides}));
  app.get('/api/team-wiki',authenticate,requireRoles('employee','it-support','admin'),(req,res)=>res.set('Cache-Control','no-store').json({name:req.identity.name||req.identity.preferred_username||'employee',guides:wikiPages}));
  if(audit)app.get('/api/audit',authenticate,requireRoles('admin'),async(req,res)=>{res.set('Cache-Control','no-store');res.json(await audit.list(req.query));});
  app.get('/api/workspaces/audit',authenticate,requireRoles('admin'),(_req,res)=>res.json({title:'Audit workspace',message:'Review recorded changes across IT operations.'}));
  if(tickets)app.use('/api/tickets',authenticate,ticketRoutes(tickets));
  if(access)app.use('/api/access',authenticate,accessRoutes(access));
  if(inventory)app.use('/api/devices',authenticate,deviceRoutes(inventory));
  if(onboarding) {
    app.use('/api/employees',authenticate,requireRoles('admin'),(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
    if(offboarding){
      app.get('/api/employees/:id/offboarding',async(req,res)=>res.json(await offboarding.summary(req.params.id)));
      app.post('/api/employees/:id/offboarding',async(req,res)=>{
        const result=await offboarding.run(req.params.id,{sub:req.identity.sub,name:req.identity.name||req.identity.preferred_username},req.body);
        res.status(result.employee.status==='offboarded'?200:202).json(result);
      });
    }
    app.get('/api/employees',async(_req,res)=>res.json({employees:await onboarding.list()}));
    app.post('/api/employees',async(req,res)=>{
      const result=await onboarding.create(req.body,req.identity.sub);
      res.status(result.employee.status==='active'?201:202).json(result);
    });
    app.post('/api/employees/:id/retry',async(req,res)=>{
      if(!/^[0-9a-f-]{36}$/.test(req.params.id))return res.status(400).json({error:'Invalid employee ID.'});
      const result=await onboarding.retry(req.params.id,req.body?.temporaryPassword,req.identity.sub);
      res.status(result.employee.status==='active'?200:202).json(result);
    });
    app.get('/api/employees/:id/events',async(req,res)=>res.json({events:await onboarding.events(req.params.id)}));
  }
  app.get('/api/me', authenticate, (req, res) => {
    res.set('Cache-Control', 'no-store').json({ id: req.identity.sub, username: req.identity.preferred_username, name: req.identity.name, roles: req.roles });
  });
  app.get('/api/workspaces/employee', authenticate, requireRoles('employee', 'it-support', 'admin'), (_req, res) => {
    res.json({ title: 'Employee workspace', message: 'Your employee access is verified. Request application access and view your assigned devices below.' });
  });
  app.get('/api/workspaces/support', authenticate, requireRoles('it-support', 'admin'), (_req, res) => {
    res.json({ title: 'IT Support workspace', message: 'Your support access is verified. Manage support tickets, device inventory, and assignments below.' });
  });
  app.get('/api/workspaces/admin', authenticate, requireRoles('admin'), (_req, res) => {
    res.json({ title: 'Admin workspace', message: 'Your administrator access is verified. Review application requests and manage employee onboarding below.' });
  });
  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((err,_req,res,_next)=>{
    if(err.type==='entity.parse.failed')return res.status(400).json({error:'Invalid JSON request.'});
    res.status(err.status||503).json({error:err.status?err.message:'The operation could not finish. Refresh the relevant list before retrying.'});
  });
  return app;
}
