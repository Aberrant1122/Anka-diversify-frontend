import { useEffect, useMemo, useState } from 'react';
import type { MainDocument, ValidationArchitectureDocument, WorkspaceRevision } from '@/lib/workspace-api';
import { BaselineSession, baselineCoverage, baselineError, baselineEvidenceLabel, type BaselineView, type BoundBaselinePreview } from '@/lib/baseline-validation';

export function BaselineEvidence({view,onRequestCleanup}:{view:BaselineView;onRequestCleanup?:(id:string)=>void}){
  return <section aria-label="Baseline validation history" className="space-y-4">
    <h3 className="text-lg font-semibold">Validation history</h3>
    {!view.operations.length&&<p>No baseline validation operation has been created.</p>}
    {view.operations.filter(op=>op.purpose==='BASELINE_VALIDATION').map(op=><article key={op.id} className="rounded-lg border p-4 space-y-3">
      <h4 className="font-semibold">{baselineEvidenceLabel(op,view.runtimeAcceptanceVerified)}</h4>
      <p>Status: {op.status}. Authority: {op.authorityCurrent?'current':'changed or revoked'}. Cleanup: {op.cleanup.confirmed?'confirmed for this job':'unconfirmed'}.</p>
      <dl className="text-sm break-all"><dt>Main revision</dt><dd>{op.authority.main.id} · {op.authority.main.hash}</dd><dt>Architecture revision</dt><dd>{op.authority.architecture.id} · {op.authority.architecture.hash}</dd><dt>Binding / plan</dt><dd>{op.authority.bindingHash} / {op.authority.planHash}</dd></dl>
      {op.authority.scopeVerified?<><p>Covered scope: {op.authority.coveredCriterionIds.join(', ')||'none'}. These criteria are not automatically accepted.</p><p>Unassessed criteria: {op.authority.unassessedCriterionIds.join(', ')||'none outside the listed scope'}.</p></>:<p role="alert">Historical scope cannot be verified. Current documents are not substituted.</p>}
      {op.authority.profiles.map(p=><details key={p.id} className="text-sm break-all"><summary>{p.id} · {p.repositoryId} · baseline {p.baseline}</summary><p>Runtime profile: {p.runtimeProfileHash}</p><p>Budget: {p.budgetProfileHash} · measurement: {p.measurementHash}</p><p>Commands: {p.commands.map(c=>c.id+' / '+c.criterionId).join(', ')}</p></details>)}
      <p>Evidence: {op.result?.evidenceClass||'NO_EXECUTION'}. {op.result?.evidenceClass==='CONTRACT_TEST'?'Contract evidence does not establish hardened runtime acceptance.':''}</p>
      {op.result?.results.map((r,i)=><p className="text-sm" key={r.profileId+':'+r.id+':'+i}>{r.profileId} / {r.id} / {r.criterionId}: exit {r.exitCode??'unknown'}{r.signal?' · signal '+r.signal:''}{r.timedOut?' · timed out':''}{r.outputLimitExceeded?' · output overflow':''}{r.resourceLimitExceeded?' · resource limit exceeded':''}{r.sourceWriteAttempted?' · source write attempted':''}</p>)}
      {op.cleanup.canRequest&&onRequestCleanup&&<button type="button" className="rounded border px-3 py-2" onClick={()=>onRequestCleanup(op.id)}>Request cleanup</button>}
      {op.cleanup.canRequest&&<p className="text-sm">A cleanup request is not cleanup confirmation. A trusted worker must confirm the exact job.</p>}
      {op.cleanup.retryEligible&&<><button type="button" disabled className="rounded border px-3 py-2 opacity-60">Retry unavailable</button><p className="text-sm">A successor must link this operation and use fresh authority after runtime acceptance. A new browser key cannot bypass pending cleanup.</p></>}
    </article>)}
  </section>;
}
export function BaselineProfileSelection({main,architecture,selected,disabled,onChange}:{main:MainDocument;architecture:ValidationArchitectureDocument;selected:string[];disabled:boolean;onChange:(ids:string[])=>void}){
  const profiles=architecture.validationProfiles.filter(p=>selected.includes(p.id)),coverage=baselineCoverage(main,profiles);
  return <section className="space-y-4" aria-label="Baseline profile selection">
    <fieldset disabled={disabled} className="space-y-3"><legend className="font-semibold">Select validation profiles</legend>
      {architecture.validationProfiles.map(p=><label key={p.id} className="block rounded-lg border p-3"><span className="flex gap-2"><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>onChange(e.target.checked?[...selected,p.id]:selected.filter(id=>id!==p.id))}/><span>{p.id} · {p.title}</span></span><span className="block text-sm break-all">Repository {p.repositoryId} · baseline {p.baseline}</span><span className="block text-sm">Criteria: {p.criterionIds.join(', ')}. Reserved time: {p.budgetProfile.limits.totalTimeoutMs} ms.</span></label>)}
    </fieldset>
    <div><h3 className="font-semibold">Selected scope — not execution evidence</h3><ul className="list-disc pl-5">{coverage.map(c=><li key={c.requirementId+':'+c.criterionId}>{c.requirementId} / {c.criterionId}: {c.description} · {c.assessedScope?'included in selected scope':'unassessed'}</li>)}</ul></div>
  </section>;
}
export function BaselineValidationPanel({projectId,mainRevision,architectureRevision,onRefresh}:{projectId:string;mainRevision:WorkspaceRevision;architectureRevision:WorkspaceRevision<ValidationArchitectureDocument>;onRefresh:()=>Promise<void>}){
  const session=useMemo(()=>new BaselineSession(projectId),[projectId]);
  const [view,setView]=useState<BaselineView|null>(null),[selected,setSelected]=useState<string[]>([]),[preview,setPreview]=useState<BoundBaselinePreview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const main=mainRevision.content as MainDocument,architecture=architectureRevision.content;
  useEffect(()=>{let cancelled=false;session.load().then(v=>{if(!cancelled)setView(v);}).catch(e=>{if(!cancelled)setError(baselineError(e));});return()=>{cancelled=true;session.invalidate();};},[session]);
  const selection={mainId:mainRevision.id,mainHash:mainRevision.contentHash,architectureId:architectureRevision.id,architectureHash:architectureRevision.contentHash,selectedProfileIds:selected};
  const blockers=[...main.questions,...architecture.questions].filter(q=>q.blocking);
  const act=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await work();}catch(e){setError(baselineError(e));if(/STATE_CONFLICT|AUTHORITY_CHANGED|PROJECT_RESOURCE_NOT_FOUND|HASH_MISMATCH/.test(e instanceof Error?e.message:'')){session.invalidate();setPreview(null);await onRefresh().catch(()=>{});await session.load().then(setView).catch(()=>{});}}finally{setBusy(false);}};
  return <div className="p-5 space-y-6 max-w-5xl">
    <header className="space-y-2"><h2 className="text-xl font-semibold">Baseline validation</h2><p>Check a selected scope on an exact repository baseline. This purpose does not authorize code changes or publication.</p><p role="status" className="rounded border p-3">Runtime unavailable — no hardened runtime has been accepted. Running, claiming and retrying validation are disabled.</p></header>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    <dl className="text-sm break-all"><dt>Current Main</dt><dd>{mainRevision.id} · {mainRevision.contentHash}</dd><dt>Current Architecture</dt><dd>{architectureRevision.id} · {architectureRevision.contentHash}</dd></dl>
    {blockers.length>0&&<div role="alert"><p>Resolve blocking questions before approval:</p><ul>{blockers.map(q=><li key={q.id}>{q.id}: {q.question}</li>)}</ul></div>}
    <BaselineProfileSelection main={main} architecture={architecture} selected={selected} disabled={busy} onChange={ids=>{session.invalidate();setPreview(null);setSelected(ids);}}/>
    <div className="flex flex-wrap gap-3"><button type="button" disabled={busy||!view||!selected.length||!!blockers.length} className="rounded border px-3 py-2 disabled:opacity-50" onClick={()=>act(async()=>{setPreview(await session.preview(selection,view!.head.stateVersion));})}>Preview exact selection</button><button type="button" disabled={busy||!preview||!view||!!blockers.length} className="rounded border px-3 py-2 disabled:opacity-50" onClick={()=>act(async()=>{await session.approve(preview!,selection,view!.head.stateVersion);setPreview(null);setView(await session.load());await onRefresh();})}>Approve selected scope</button><button type="button" disabled className="rounded border px-3 py-2 opacity-60">Run unavailable</button><button type="button" disabled={busy} className="rounded border px-3 py-2" onClick={()=>act(async()=>{session.invalidate();setPreview(null);setView(await session.load());await onRefresh();})}>Refresh authority</button></div>
    {preview&&<section aria-label="Exact baseline preview" className="rounded border p-4 break-all"><h3 className="font-semibold">Exact preview</h3><p>Profiles: {preview.selection.selectedProfileIds.join(', ')}</p><p>Binding: {preview.value.bindingHash}</p><p>Plan: {preview.value.planHash}</p><p>State version: {preview.version}. Preview and approval are not execution evidence.</p></section>}
    {view?.head.baselineApprovalId&&<p className="break-all">Current baseline approval: {view.head.baselineApprovalId}. Preview the exact selection before approving any change.</p>}
    {view?<BaselineEvidence view={view} onRequestCleanup={id=>act(async()=>{const op=view.operations.find(o=>o.id===id);if(op)await session.requestCleanup(op);setView(await session.load());})}/>:<p>{error?'History could not be loaded.':'Loading baseline history…'}</p>}
    <p className="text-sm">Only the listed criteria are in scope. Unassessed criteria and broader product requirements remain unaccepted.</p>
  </div>;
}
