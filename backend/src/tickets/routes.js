import {Router} from 'express';
import {requireRoles} from '../auth.js';
export function ticketRoutes(tickets){
  const router=Router();router.use(requireRoles('employee','it-support','admin'));
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');req.ticketActor={sub:req.identity.sub,name:req.identity.name||req.identity.preferred_username,roles:req.roles};next();});
  router.get('/',async(req,res)=>res.json({tickets:await tickets.list(req.ticketActor,req.query)}));
  router.post('/',async(req,res)=>res.status(201).json(await tickets.create(req.ticketActor,req.body)));
  router.get('/:id',async(req,res)=>res.json(await tickets.detail(req.params.id,req.ticketActor)));
  router.post('/:id/replies',async(req,res)=>res.json(await tickets.comment(req.params.id,req.ticketActor,req.body)));
  router.post('/:id/actions',async(req,res)=>res.json(await tickets.transition(req.params.id,req.ticketActor,req.body)));
  return router;
}
