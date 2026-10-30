import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTicket,textField,assertTicketRead,assertTransition} from '../src/tickets/service.js';
const owner={sub:'owner',roles:['employee']},staff={sub:'staff',roles:['it-support']},otherStaff={sub:'other',roles:['it-support']},admin={sub:'admin',roles:['admin']};
const open={requester_sub:'owner',status:'open',assigned_to:null};
test('ticket input rejects incomplete descriptions, invalid priorities and device IDs',()=>{
  const input={title:'Laptop Wi-Fi issue',description:'The laptop disconnects from office Wi-Fi every five minutes.',priority:'normal',category:'network'};
  assert.equal(validateTicket(input).deviceId,null);
  for(const change of [{description:'too short'},{title:'bad'},{priority:'critical'},{category:'bad'},{deviceId:'not-a-uuid'}])assert.throws(()=>validateTicket({...input,...change}),{status:400});
  assert.throws(()=>textField(' ',1,2000,'Reply'),{status:400});
});
test('ticket ownership blocks unrelated employees while allowing staff reads',()=>{
  assert.doesNotThrow(()=>assertTicketRead(open,owner));assert.doesNotThrow(()=>assertTicketRead(open,staff));
  assert.throws(()=>assertTicketRead(open,{sub:'stranger',roles:['employee']}),{status:404});
});
test('claim and resolution permissions enforce ticket state and assignee',()=>{
  assert.throws(()=>assertTransition(open,owner,'claim'),{status:403});assert.doesNotThrow(()=>assertTransition(open,staff,'claim'));
  assert.throws(()=>assertTransition(open,staff,'resolve'),{status:409});
  const active={...open,status:'in_progress',assigned_to:'staff'};
  assert.doesNotThrow(()=>assertTransition(active,staff,'resolve'));assert.doesNotThrow(()=>assertTransition(active,admin,'resolve'));
  assert.throws(()=>assertTransition(active,otherStaff,'resolve'),{status:403});assert.throws(()=>assertTransition(active,staff,'claim'),{status:409});
});
test('only requester or Admin can close/reopen at valid states',()=>{
  const resolved={...open,status:'resolved'};
  assert.doesNotThrow(()=>assertTransition(resolved,owner,'close'));assert.doesNotThrow(()=>assertTransition(resolved,admin,'reopen'));
  assert.throws(()=>assertTransition(resolved,staff,'close'),{status:403});assert.throws(()=>assertTransition(open,owner,'close'),{status:409});
  assert.throws(()=>assertTransition(open,owner,'reopen'),{status:409});assert.doesNotThrow(()=>assertTransition({...open,status:'closed'},owner,'reopen'));
});
