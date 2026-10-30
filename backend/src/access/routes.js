import { Router } from 'express';
import { requireRoles } from '../auth.js';
export function accessRoutes(access){
  const router=Router();router.use(requireRoles('employee','it-support','admin'));router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.get('/catalog',async(_req,res)=>res.json({applications:await access.catalog()}));
  router.get('/mine',async(req,res)=>res.json(await access.mine(req.identity.sub)));
  router.post('/requests',async(req,res)=>res.status(201).json(await access.create(req.identity.sub,req.body)));
  router.post('/requests/:id/cancel',async(req,res)=>res.json(await access.cancel(req.params.id,req.identity.sub)));
  router.get('/review',requireRoles('admin'),async(req,res)=>res.json({requests:await access.queue(req.query.status)}));
  router.post('/requests/:id/decision',requireRoles('admin'),async(req,res)=>res.json(await access.decide(req.params.id,req.identity.sub,req.body)));
  return router;
}
