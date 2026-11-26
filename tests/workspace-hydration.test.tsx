import {test} from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {renderToString} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import type {Root} from 'react-dom/client';
import {hydratedWorkspaceFixture} from './workspace-hydration-fixture';

async function hydrate(blockers=true, preview?: (body:Record<string,unknown>)=>Promise<Response>, native?: (path:string,body:Record<string,unknown>|null)=>Promise<Response>){
  const server=hydratedWorkspaceFixture(blockers),dom=new JSDOM('<div id="root"></div>',{url:'http://synthetic.invalid',pretendToBeVisual:true});
  const descriptors=new Map<string,PropertyDescriptor|undefined>();
  const originalFetch=server.fetch;
  if(native){
    const arch=server.currentArchitecture(), {validationProfiles: _profiles,...base}=arch.content as typeof arch.content & {validationProfiles?:unknown};
    arch.content={...base,schemaVersion:1,units:[{id:'UNIT-NATIVE',title:'Sample note',requirementIds:['REQ-001'],dependsOn:[],repositoryId:'repo',files:[{path:'README.md',action:'modify'}],checks:[{id:'CHECK-NATIVE',criterionId:'AC-001',type:'contains',path:'README.md',expected:'reviewed'},{id:'CHECK-NATIVE-TWO',criterionId:'AC-002',type:'contains',path:'README.md',expected:'reviewed'}]}]};
  }
  if(preview||native)server.fetch=async(input,init)=>{
    if(native&&String(input).endsWith('/capabilities'))return Response.json({data:{aiGeneration:false,nativeAssignment:true}});
    if(native&&String(input).includes('/native-assignments')){
      const path=String(input).slice(String(input).indexOf('/native-assignments')),body=init?.body?JSON.parse(String(init.body)):null;
      server.calls.push({path,method:init?.method??'GET',body});return native(path,body);
    }
    if(String(input).endsWith('/handoff-preview')){
      const body=JSON.parse(String(init?.body));server.calls.push({path:'/handoff-preview',method:init?.method??'GET',body});
      return preview!(body);
    }
    return originalFetch(input,init);
  };
  const globals:Record<string,unknown>={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,HTMLElement:dom.window.HTMLElement,HTMLInputElement:dom.window.HTMLInputElement,HTMLTextAreaElement:dom.window.HTMLTextAreaElement,Element:dom.window.Element,Node:dom.window.Node,MutationObserver:dom.window.MutationObserver,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true,fetch:server.fetch};
  for(const [key,value] of Object.entries(globals)){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
  const originalUrl=process.env.NEXT_PUBLIC_API_URL;process.env.NEXT_PUBLIC_API_URL='http://synthetic.invalid/api';dom.window.localStorage.setItem('authToken','synthetic-owner-token');
  const {WorkspaceWorkflow}=await import('../components/project/WorkspaceWorkflow');
  const {hydrateRoot}=await import('react-dom/client');
  const element=React.createElement(WorkspaceWorkflow,{projectId:'synthetic'}),container=dom.window.document.getElementById('root')!;
  container.innerHTML=renderToString(element);assert.match(container.textContent??'',/Loading project documents/);
  const hydrationErrors:unknown[]=[];let root:Root;
  await act(async()=>{root=hydrateRoot(container,element,{onRecoverableError:e=>hydrationErrors.push(e)});});
  const button=(text:string,scope:ParentNode=container)=>{const found=[...scope.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===text);assert.ok(found,'button missing: '+text);return found;};
  const click=async(el:HTMLElement)=>{await act(async()=>{el.click();});};
  const input=async(selector:string,value:string)=>{const el=container.querySelector<HTMLInputElement|HTMLTextAreaElement>(selector);assert.ok(el,'input missing: '+selector);const proto=el.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});return el;};
  const textField=(label:string)=>{const found=[...container.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent===label)?.querySelector('textarea');assert.ok(found,'textarea missing: '+label);return found;};
  const changeField=async(label:string,value:string)=>{const el=textField(label);await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
  const profile=()=>{const found=[...container.querySelectorAll('label')].find(l=>l.textContent?.includes('VAL-ONE'))?.querySelector<HTMLInputElement>('input[type=checkbox]');assert.ok(found,'profile checkbox missing');return found;};
  const resolve=async(id:string)=>{const field=container.querySelector('[aria-label="Question '+id+'"]');assert.ok(field,'question missing: '+id);await click(button('Resolve',field.parentElement!));};
  const forbidden=()=>server.calls.filter(c=>/\/(?:claim|dispatch|authorize|implement|publish|generate|materialize)(?:\/|$)/.test(c.path));
  return {server,dom,container,button,click,input,changeField,textField,profile,resolve,hydrationErrors,forbidden,async close(){await act(async()=>{root!.unmount();});dom.window.close();for(const [key,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}if(originalUrl===undefined)delete process.env.NEXT_PUBLIC_API_URL;else process.env.NEXT_PUBLIC_API_URL=originalUrl;}};
}

test('hydrated schema2 keeps shared editing, immutable saves, blocker recovery and fresh baseline previews',async()=>{
  const h=await hydrate(true);
  try{
    assert.deepEqual(h.hydrationErrors,[]);
    assert.ok(h.textField('Purpose'));assert.ok(h.textField('Architecture overview'));
    assert.equal(h.button('Run unavailable').disabled,true);
    assert.equal([...h.container.querySelectorAll('button')].some(b=>/Add implementation unit|Approve exact Architecture|Generate.*AI|Implement selected|Publish/.test(b.textContent??'')),false);
    assert.equal(h.button('Preview exact selection').disabled,true);
    await h.resolve('Q-MAIN');await h.changeField('Purpose','Revised Main purpose');
    await h.input('[aria-label="Reason for document change"]','Clear Main blocker through a new revision');
    await h.click(h.button('Save Main version'));
    assert.equal(h.server.currentMain().version,2);assert.equal(h.server.currentMain().content.questions.length,0);
    assert.equal(h.server.currentMain().previousId,'main-1');assert.deepEqual(h.server.documents[0],h.server.initialMain);
    assert.match(h.container.textContent??'',/linked to another Main revision/);assert.equal(h.profile().matches(':disabled'),true);
    await h.resolve('Q-ARCH');await h.click(h.button('Reconcile Architecture with current Main'));
    await h.changeField('Architecture overview','Reconciled schema2 overview');
    await h.input('[aria-label="Architecture change reason"]','Clear Architecture blocker and link the saved Main');
    await h.click(h.button('Save Architecture version'));
    const saved=h.server.currentArchitecture();assert.equal(saved.content.schemaVersion,2);
    assert.equal(saved.previousId,'arch-1');assert.deepEqual(saved.content.sourceMain,{id:h.server.currentMain().id,hash:h.server.currentMain().contentHash});
    assert.equal(saved.content.questions.length,0);
    assert.deepEqual(saved.content.schemaVersion===2?saved.content.validationProfiles:null,h.server.initialArchitecture.content.schemaVersion===2?h.server.initialArchitecture.content.validationProfiles:null);
    assert.deepEqual(h.server.documents[1],h.server.initialArchitecture);
    await h.click(h.profile());await h.click(h.button('Preview exact selection'));
    assert.ok(h.container.querySelector('[aria-label="Exact baseline preview"]'));
    assert.equal(h.button('Approve selected scope').disabled,false);
    await h.click(h.button('Approve selected scope'));
    assert.equal(h.server.approvals.length,1);const priorApproval=structuredClone(h.server.approvals[0]);
    await h.click(h.button('Preview exact selection'));
    assert.ok(h.container.querySelector('[aria-label="Exact baseline preview"]'));
    await h.changeField('Architecture overview','Architecture evolves after approval');
    assert.equal(h.container.querySelector('[aria-label="Exact baseline preview"]'),null);
    assert.equal(h.button('Approve selected scope').disabled,true);assert.equal(h.profile().matches(':disabled'),true);
    await h.click(h.button('Approve selected scope'));assert.equal(h.server.approvals.length,1);
    await h.input('[aria-label="Architecture change reason"]','Evolve approved Architecture without mutating history');
    await h.click(h.button('Save Architecture version'));
    assert.equal(h.server.currentArchitecture().version,3);assert.equal(h.profile().checked,false);
    assert.match(h.container.textContent??'',/Stored baseline approval \(may be stale\)/);
    assert.deepEqual(h.server.approvals[0],priorApproval);
    await h.click(h.profile());await h.click(h.button('Preview exact selection'));await h.click(h.button('Approve selected scope'));
    assert.equal(h.server.approvals.length,2);
    assert.equal(h.server.approvals[1]!.architectureId,h.server.currentArchitecture().id);
    const saves=h.server.calls.filter(c=>c.path==='/documents');assert.deepEqual(saves.map(c=>c.body?.expectedVersion),[5,6,8]);
    assert.deepEqual(h.forbidden(),[]);assert.deepEqual(h.hydrationErrors,[]);
    if(process.env.ANKA_HYDRATED_FIXTURE_OUTPUT){
      const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>V4 corrected shared-editor hydration fixture</title><style>body{font:16px system-ui;max-width:76rem;margin:auto;padding:24px}section{border:1px solid #ccd6df;border-radius:8px;padding:16px;margin:16px 0}label{display:flex;flex-direction:column;margin:8px 0}button{margin:4px;padding:8px}button:disabled{opacity:.5}input,textarea{max-width:100%;padding:8px}pre,dd{overflow-wrap:anywhere;white-space:pre-wrap}fieldset{margin:16px 0}</style></head><body><p><strong>Synthetic JSDOM hydration capture.</strong> Shared schema2 editors and baseline controls after immutable save/reconciliation. This static file has no hydrated actions and is not real browser/layout acceptance.</p>'+h.container.innerHTML+'</body></html>';
      fs.writeFileSync(process.env.ANKA_HYDRATED_FIXTURE_OUTPUT,html);
      fs.writeFileSync(process.env.ANKA_HYDRATED_FIXTURE_OUTPUT+'.actions.json',JSON.stringify({engine:'JSDOM 31 / React hydrateRoot',recoverableHydrationErrors:h.hydrationErrors.length,apiCalls:h.server.calls,forbiddenCalls:h.forbidden()},null,2)+'\n');
    }
  }finally{await h.close();}
});

test('hydrated CAS conflict preserves the draft and cannot reuse an invalidated preview',async()=>{
  const h=await hydrate(false);
  try{
    await h.click(h.profile());await h.click(h.button('Preview exact selection'));
    assert.ok(h.container.querySelector('[aria-label="Exact baseline preview"]'));
    await h.changeField('Purpose','Retain this unsaved draft after CAS conflict');
    await h.input('[aria-label="Reason for document change"]','Synthetic concurrent save');h.server.advanceVersion();
    await h.click(h.button('Save Main version'));
    assert.equal(h.server.documents.length,2);assert.equal(h.server.currentMain().version,1);
    assert.equal(h.textField('Purpose').value,'Retain this unsaved draft after CAS conflict');
    assert.match(h.container.textContent??'',/STATE_CONFLICT/);
    assert.equal(h.container.querySelector('[aria-label="Exact baseline preview"]'),null);
    assert.equal(h.button('Approve selected scope').disabled,true);assert.equal(h.button('Refresh authority').disabled,true);
    await h.click(h.button('Discard unsaved document edits'));await h.click(h.button('Refresh authority'));
    assert.equal(h.textField('Purpose').value,h.server.initialMain.content.schemaVersion===1?(h.server.initialMain.content as {purpose:string}).purpose:'');
    await h.click(h.profile());await h.click(h.button('Preview exact selection'));
    assert.ok(h.container.querySelector('[aria-label="Exact baseline preview"]'));
    await h.click(h.button('Approve selected scope'));
    assert.equal(h.server.approvals[0]!.expectedVersion,6);
    assert.equal(h.server.calls.filter(c=>c.path==='/documents').length,1);
    assert.deepEqual(h.forbidden(),[]);assert.deepEqual(h.hydrationErrors,[]);
  }finally{await h.close();}
});

test('draft preview copy revalidates without writes, dirty edits discard packets, reopen needs fresh preview',async()=>{
  const bodies:Record<string,unknown>[]=[], copied:string[]=[];
  let stale=false;
  const h=await hydrate(false,async body=>{
    bodies.push(body);
    return stale?Response.json({error:'HANDOFF_STALE'},{status:409}):Response.json({data:{purpose:'DRAFT_PREVIEW',executionAuthorized:false,packetHash:'sample',repositoryBinding:{status:'UNBOUND'}}});
  });
  try{
    Object.defineProperty(h.dom.window.navigator,'clipboard',{value:{writeText:async(text:string)=>{copied.push(text);}},configurable:true});
    const checkbox=h.container.querySelector<HTMLInputElement>('[aria-label^="Draft criterion "]')!;
    assert.ok(checkbox);await h.click(checkbox);
    const initial=structuredClone(h.server.documents), callStart=h.server.calls.length;
    await h.click(h.button('Preview draft handoff'));
    assert.match(h.container.textContent??'',/DRAFT_PREVIEW.*Execution authorized: false.*UNBOUND/);
    await h.click(h.button('Copy draft handoff'));
    assert.equal(bodies.length,2);assert.equal(copied.length,1);assert.equal(JSON.parse(copied[0]).executionAuthorized,false);
    assert.deepEqual(h.server.calls.slice(callStart).map(c=>c.path),['/handoff-preview','/handoff-preview']);
    assert.deepEqual(h.server.documents,initial);assert.equal(h.server.approvals.length,0);
    await h.changeField('Purpose','Unsaved sample edit');
    assert.equal(h.container.querySelector('[aria-label="Draft handoff packet"]'),null);
    assert.equal(h.button('Preview draft handoff').disabled,true);
    await h.click(h.button('Discard unsaved document edits'));
    await h.click(h.button('Preview draft handoff'));
    stale=true;await h.click(h.button('Copy draft handoff'));
    assert.match(h.container.textContent??'',/HANDOFF_STALE/);assert.equal(copied.length,1);
    assert.equal(h.container.querySelector('[aria-label="Draft handoff packet"]'),null);
    assert.deepEqual(h.forbidden(),[]);
  }finally{await h.close();}
  const reopened=await hydrate(false);
  try{assert.equal(reopened.container.querySelector('[aria-label="Draft handoff packet"]'),null);}finally{await reopened.close();}
});

test('late draft response cannot restore a preview invalidated by an edit',async()=>{
  let finish:((response:Response)=>void)|undefined;
  const h=await hydrate(false,()=>new Promise<Response>(resolve=>{finish=resolve;}));
  try{
    await h.click(h.container.querySelector<HTMLInputElement>('[aria-label^="Draft criterion "]')!);
    await h.click(h.button('Preview draft handoff'));assert.ok(finish);
    await h.changeField('Architecture overview','Edit while preview is loading');
    await act(async()=>{finish!(Response.json({data:{purpose:'DRAFT_PREVIEW',executionAuthorized:false,repositoryBinding:{status:'UNBOUND'}}}));});
    assert.equal(h.container.querySelector('[aria-label="Draft handoff packet"]'),null);
    assert.deepEqual(h.forbidden(),[]);
  }finally{await h.close();}
});

test('native owner UI requires bounded confirmation, returns honest evidence, and recovers persisted scope on reopen',async()=>{
  let record:any=null, packet:any=null, active:Awaited<ReturnType<typeof hydrate>>;
  let finishRegistration:(()=>void)|undefined;
  const preview=async(body:Record<string,unknown>)=>{
    const m=active.server.currentMain(),a=active.server.currentArchitecture();
    packet={schemaVersion:1,purpose:'DRAFT_PREVIEW',executionAuthorized:false,projectId:'synthetic',ownerReference:'owner',stateVersion:body.expectedStateVersion,freshness:'VERSION_BOUND_SNAPSHOT',packetHash:'a'.repeat(64),documents:{main:{id:m.id,hash:m.contentHash},architecture:{id:a.id,hash:a.contentHash,sourceMain:{id:m.id,hash:m.contentHash}}},requirements:[{...m.content.requirements[0],acceptanceCriteria:m.content.requirements[0].acceptanceCriteria.filter(c=>(body.criterionIds as string[]).includes(c.id))}],repositoryBinding:{status:'BOUND',repositories:[{id:'repo',baseline:'b'.repeat(40)}],unboundCriterionIds:[]},context:{purpose:'Synthetic',constraints:[],exclusions:[],openQuestions:[]},verificationExpectations:(body.criterionIds as string[]).map(id=>({requirementId:'REQ-001',criterionId:id,description:id,status:'NOT_ASSESSED'})),nextDecision:'Review draft only'};
    return Response.json({data:packet});
  };
  const native=async(path:string,body:Record<string,unknown>|null)=>{
    if(path==='/native-assignments'&&!body)return Response.json({data:record?[record]:[]});
    if(path==='/native-assignments'&&body){
      assert.equal(body.acknowledgeAuthorization,true);assert.deepEqual(body.files,[{repositoryId:'repo',path:'README.md',action:'modify'}]);
      record={id:'native-1',createdBy:'owner',authorityCurrent:true,accepted:false,context:{packet,files:body.files,authorizedBy:'owner',authorizationNote:body.authorizationNote,sessionReference:body.sessionReference,providerDispatchAuthorized:false},criteria:packet.verificationExpectations.map((c:Record<string,unknown>)=>({...c,status:'MISSING'})),evidence:[],independentVerification:'NOT_PERFORMED',nextDecision:'Return missing criterion evidence; no success is inferred.',recoveryObservations:[]};active.server.advanceVersion();return new Promise<Response>(resolve=>{finishRegistration=()=>resolve(Response.json({data:record}));});
    }
    if(path.endsWith('/evidence')&&body){const receipt=body.receipt as Record<string,unknown>;record.evidence.push({id:'evidence-1',evidenceClass:'OWNER_REPORTED_NOT_INDEPENDENTLY_VERIFIED',receipt});record.criteria[0].status=receipt.status;active.server.advanceVersion();return Response.json({data:record});}
    if(path.endsWith('/recovery'))return Response.json({data:record});
    if(path.endsWith('/recovery-observations')&&body){record.recoveryObservations.push({id:'recovery-1',sessionReference:body.sessionReference,repeatedContextCount:body.repeatedContextCount,measurementClass:'OWNER_REPORTED'});active.server.advanceVersion();return Response.json({data:record});}
    throw Error('Unexpected native request '+path);
  };
  active=await hydrate(false,preview,native);
  const copied:string[]=[];
  try{
    await active.click(active.container.querySelector<HTMLInputElement>('[aria-label="Draft criterion AC-001"]')!);
    await active.click(active.container.querySelector<HTMLInputElement>('[aria-label="Draft criterion AC-002"]')!);
    await active.click(active.button('Preview draft handoff'));
    assert.equal(active.button('Register bounded manual assignment').disabled,true);
    await active.input('[aria-label="Native session reference"]','Current synthetic session');
    await active.input('[aria-label="Bounded authorization note"]','README-only disposable scope');
    await active.click(active.container.querySelector<HTMLInputElement>('[aria-label^="Authorize file "]')!);
    assert.equal(active.button('Register bounded manual assignment').disabled,true);
    await active.click(active.container.querySelector<HTMLInputElement>('[aria-label="Confirm bounded manual authorization"]')!);
    await active.input('[aria-label="Bounded authorization note"]','Reconfirmed README-only disposable scope');
    assert.equal(active.container.querySelector<HTMLInputElement>('[aria-label="Confirm bounded manual authorization"]')!.checked,false);
    assert.equal(active.button('Register bounded manual assignment').disabled,true);
    await active.click(active.container.querySelector<HTMLInputElement>('[aria-label="Confirm bounded manual authorization"]')!);
    await active.click(active.button('Register bounded manual assignment'));
    assert.ok(finishRegistration);
    await active.changeField('Purpose','Preserve this draft typed while assignment is pending');
    await act(async()=>{finishRegistration!();});
    assert.equal(active.textField('Purpose').value,'Preserve this draft typed while assignment is pending');
    await active.click(active.button('Discard unsaved document edits'));
    assert.match(active.container.textContent??'',/AC-001: MISSING/);assert.match(active.container.textContent??'',/AC-002: MISSING/);
    const receipt={criterionId:'AC-001',repositoryId:'repo',baseline:'b'.repeat(40),commit:'c'.repeat(40),testedCommit:'c'.repeat(40),status:'PASSED',check:{command:['node','--test','note.cjs'],exitCode:0,stdout:'Sample passed',stderr:''},evidenceLabel:'DISPOSABLE_SAMPLE'};
    await active.input('[aria-label="Criterion receipt for native-1"]',JSON.stringify(receipt));
    await active.click(active.button('Save owner-reported receipt'));
    assert.match(active.container.textContent??'',/AC-001: PASSED/);assert.match(active.container.textContent??'',/AC-002: MISSING/);
    assert.match(active.container.textContent??'',/Independent verification: NOT_PERFORMED/);
    Object.defineProperty(active.dom.window.navigator,'clipboard',{value:{writeText:async(text:string)=>{copied.push(text);}},configurable:true});
    await active.click(active.button('Copy recovery packet'));assert.equal(JSON.parse(copied[0]).accepted,false);assert.equal(JSON.parse(copied[0]).criteria[1].status,'MISSING');
    assert.deepEqual(active.forbidden(),[]);assert.deepEqual(active.hydrationErrors,[]);
  }finally{await active.close();}
  active=await hydrate(false,preview,native);
  try{
    assert.equal(active.container.querySelector('[aria-label="Draft handoff packet"]'),null);
    assert.match(active.container.textContent??'',/Current synthetic session/);assert.match(active.container.textContent??'',/AC-002: MISSING/);assert.equal(record.recoveryObservations.length,0);
    await active.input('[aria-label="Recovery session for native-1"]','Fresh synthetic session');await active.input('[aria-label="Repeated context count for native-1"]','0');
    const label=[...active.container.querySelectorAll('label')].find(l=>l.textContent?.includes('my observation of an actual recovery'));assert.ok(label);await active.click(label.querySelector('input')!);
    await active.click(active.button('Save recovery observation'));assert.equal(record.recoveryObservations[0].repeatedContextCount,0);assert.equal(record.recoveryObservations[0].measurementClass,'OWNER_REPORTED');assert.deepEqual(active.forbidden(),[]);
  }finally{await active.close();}
});
