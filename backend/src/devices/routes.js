import { Router } from 'express';
import { requireRoles } from '../auth.js';
export function deviceRoutes(inventory){
  const router=Router();
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  // Identity is taken from the verified token, never from a client-supplied employee ID.
  router.get('/mine',requireRoles('employee','it-support','admin'),async(req,res)=>res.json({devices:await inventory.mine(req.identity.sub)}));
  router.use(requireRoles('it-support','admin'));
  router.get('/',async(req,res)=>res.json({devices:await inventory.list(req.query)}));
  router.get('/assignees',async(_req,res)=>res.json({employees:await inventory.assignees()}));
  router.post('/',async(req,res)=>res.status(201).json({device:await inventory.create(req.body,req.identity.sub)}));
  router.post('/:id/assign',async(req,res)=>res.json(await inventory.assign(req.params.id,req.body?.employeeId,req.identity.sub)));
  router.post('/:id/return',async(req,res)=>res.json(await inventory.returnDevice(req.params.id,req.body?.status,req.identity.sub)));
  router.patch('/:id/status',async(req,res)=>res.json(await inventory.changeStatus(req.params.id,req.body?.status,req.identity.sub)));
  router.get('/:id/history',async(req,res)=>res.json({events:await inventory.history(req.params.id)}));
  return router;
}
