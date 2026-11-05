import {test} from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {renderToString} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import type {Root} from 'react-dom/client';
import {hydratedWorkspaceFixture} from './workspace-hydration-fixture';

async function hydrate(blockers=true){
  const server=hydratedWorkspaceFixture(blockers),dom=new JSDOM('<div id="root"></div>',{url:'http://synthetic.invalid',pretendToBeVisual:true});
  const descriptors=new Map<string,PropertyDescriptor|undefined>();
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
