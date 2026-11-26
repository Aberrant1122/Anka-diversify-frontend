"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArchitectureDocument, DraftHandoffPreview, WorkspaceView, workspaceRequest } from "@/lib/workspace-api";

type NativeFile = {repositoryId:string;path:string;action:string};
type NativeRecord = {
  id:string; createdBy:string; authorityCurrent:boolean; accepted:false;
  context:{packet:DraftHandoffPreview;files:NativeFile[];sessionReference:string;authorizationNote:string;authorizedBy:string;providerDispatchAuthorized:false};
  criteria:{criterionId:string;description:string;status:string}[];
  evidence:{id:string;evidenceClass:string;receipt:{criterionId:string;commit:string|null;testedCommit:string|null;status:string}}[];
  nextDecision:string; independentVerification:string;
  recoveryObservations:{id:string;sessionReference:string;repeatedContextCount:number;measurementClass:string}[];
};
function NativeAssignmentCard({record,projectId,version,disabled,refresh}:{record:NativeRecord;projectId:string;version:number;disabled:boolean;refresh:()=>Promise<void>}) {
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[projectId,record.id]);
  const first=record.criteria[0], repo=record.context.packet.repositoryBinding.repositories[0];
  const [receipt,setReceipt]=useState(JSON.stringify({criterionId:first?.criterionId,repositoryId:repo?.id,baseline:repo?.baseline,commit:null,testedCommit:null,status:"NOT_RUN",check:{command:[],exitCode:null,stdout:"",stderr:""},evidenceLabel:"OWNER_REPORTED"},null,2));
  const [session,setSession]=useState(""),[repeated,setRepeated]=useState(""),[ack,setAck]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const evidenceRequest=useRef<{key:string;body:string}|null>(null),observationRequest=useRef<{key:string;body:string}|null>(null);
  const mutate=async(kind:"evidence"|"recovery-observations")=>{
    setBusy(true);setMessage("");
    try{
      const payload=kind==="evidence"?{expectedStateVersion:version,receipt:JSON.parse(receipt)}:{expectedStateVersion:version,sessionReference:session,repeatedContextCount:Number(repeated),acknowledgeOwnerReported:ack};
      const ref=kind==="evidence"?evidenceRequest:observationRequest,body=JSON.stringify(payload);
      if(ref.current?.body!==body)ref.current={key:crypto.randomUUID(),body};
      await workspaceRequest(projectId,"/native-assignments/"+record.id+"/"+kind,{...payload,idempotencyKey:ref.current.key});
      if(!mounted.current)return;
      await refresh();setMessage(kind==="evidence"?"Receipt saved as owner-reported evidence. Acceptance remains pending.":"Owner-reported recovery observation saved.");ref.current=null;
    }catch(e){setMessage(e instanceof Error?e.message:"Native record failed");}finally{setBusy(false);}
  };
  const copy=async()=>{
    setBusy(true);setMessage("");
    try{const recovered=await workspaceRequest<NativeRecord>(projectId,"/native-assignments/"+record.id+"/recovery");if(!mounted.current)return;await navigator.clipboard.writeText(JSON.stringify(recovered,null,2));if(mounted.current)setMessage("Recovery packet copied from persisted records.");}catch(e){if(mounted.current)setMessage(e instanceof Error?e.message:"Recovery failed");}finally{if(mounted.current)setBusy(false);}
  };
  return <article aria-label={"Native assignment "+record.id} className="space-y-3 rounded border p-3">
    <h4 className="font-medium">Manual assignment {record.id}</h4>
    <p>Authorized owner: {record.context.authorizedBy} · Original session: {record.context.sessionReference}</p>
    <p>{record.authorityCurrent?"Current document authority":"STALE — documents changed; stop native work"}</p>
    <p>Main {record.context.packet.documents.main.id} · Architecture {record.context.packet.documents.architecture.id}</p>
    <ul>{record.context.files.map(f=><li key={f.repositoryId+f.path}>{f.action} {f.path} · {f.repositoryId}</li>)}</ul>
    <ul>{record.context.packet.repositoryBinding.repositories.map(r=><li key={r.id}>Baseline {r.id}: {r.baseline}</li>)}</ul>
    <p>Owner-reported evidence. Independent verification: {record.independentVerification}. Acceptance pending.</p>
    <ul>{record.criteria.map(c=><li key={c.criterionId}>{c.criterionId}: {c.status} — {c.description}</li>)}</ul>
    <p>{record.nextDecision}</p>
    {record.evidence.map(e=><p key={e.id}>{e.receipt.criterionId} · {e.evidenceClass} · commit {e.receipt.commit||"not supplied"} · tested {e.receipt.testedCommit||"not run"}</p>)}
    <Button disabled={busy} onClick={copy}>Copy recovery packet</Button>
    <details><summary>Return criterion evidence</summary>
      <p>Paste the receipt returned by the native session. A passed check must identify the same implementation and tested commit. Commands and output are recorded; nothing is executed here.</p>
      <label>Criterion receipt JSON<Textarea aria-label={"Criterion receipt for "+record.id} rows={12} value={receipt} onChange={e=>setReceipt(e.target.value)}/></label>
      <Button disabled={disabled||busy||!record.authorityCurrent} onClick={()=>mutate("evidence")}>Save owner-reported receipt</Button>
    </details>
    <details><summary>Record a recovery observation</summary>
      <p>Report an actual session recovery. Counts are owner-reported, not automatically measured.</p>
      <Input aria-label={"Recovery session for "+record.id} placeholder="New native session reference" value={session} onChange={e=>setSession(e.target.value)}/>
      <Input aria-label={"Repeated context count for "+record.id} type="number" min={0} max={10000} placeholder="Details supplied again" value={repeated} onChange={e=>setRepeated(e.target.value)}/>
      <label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I confirm this is my observation of an actual recovery.</label>
      <Button disabled={disabled||busy||!ack||!session.trim()||repeated===""||!Number.isInteger(Number(repeated))||Number(repeated)<0||Number(repeated)>10000} onClick={()=>mutate("recovery-observations")}>Save recovery observation</Button>
      {record.recoveryObservations.map(o=><p key={o.id}>{o.sessionReference}: {o.repeatedContextCount} repeated details · {o.measurementClass}</p>)}
    </details>
    {message&&<p role="status">{message}</p>}
  </article>;
}
export function NativeAssignmentPanel({projectId,view,architecture,packet,disabled,onRefresh}:{projectId:string;view:WorkspaceView;architecture:ArchitectureDocument|null;packet:DraftHandoffPreview|null;disabled:boolean;onRefresh:()=>Promise<void>}) {
  const [records,setRecords]=useState<NativeRecord[]>([]),[session,setSession]=useState(""),[note,setNote]=useState(""),[ack,setAck]=useState(false),[selectedFiles,setSelectedFiles]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const scopeKey=JSON.stringify([packet?.packetHash,packet?.documents,packet?.verificationExpectations.map(c=>c.criterionId)]);
  const [confirmedScope,setConfirmedScope]=useState(scopeKey);
  if(confirmedScope!==scopeKey){setConfirmedScope(scopeKey);setAck(false);setSelectedFiles([]);}
  const attempt=useRef<{key:string;body:string}|null>(null);
  const identity=useRef(projectId);
  useEffect(()=>{identity.current=projectId;let cancelled=false;workspaceRequest<NativeRecord[]>(projectId,"/native-assignments").then(data=>{if(!cancelled)setRecords(data);}).catch(e=>{if(!cancelled)setMessage(e instanceof Error?e.message:"Native history unavailable");});return()=>{cancelled=true;identity.current="";};},[projectId,view.head.stateVersion]);
  const files:NativeFile[]=architecture?.schemaVersion===1&&packet?architecture.units.filter(u=>u.requirementIds.some(id=>packet.requirements.some(r=>r.id===id))&&u.checks.some(c=>packet.verificationExpectations.some(a=>a.criterionId===c.criterionId))).flatMap(u=>u.files.map(f=>({repositoryId:u.repositoryId,...f}))).filter((f,i,all)=>all.findIndex(a=>a.repositoryId===f.repositoryId&&a.path===f.path)===i):[];
  const fileKey=(f:NativeFile)=>f.repositoryId+":"+f.path+":"+f.action;
  const refresh=async()=>{const project=projectId;const data=await workspaceRequest<NativeRecord[]>(project,"/native-assignments");if(identity.current!==project)return;setRecords(data);await onRefresh();};
  const register=async()=>{
    if(!packet||packet.repositoryBinding.status!=="BOUND"||!ack)return;
    const project=projectId;setBusy(true);setMessage("");
    try{
      const payload={expectedStateVersion:view.head.stateVersion,mainId:packet.documents.main.id,mainHash:packet.documents.main.hash,architectureId:packet.documents.architecture.id,architectureHash:packet.documents.architecture.hash,requirementIds:packet.requirements.map(r=>r.id),criterionIds:packet.verificationExpectations.map(c=>c.criterionId),packetHash:packet.packetHash,sessionReference:session,authorizationNote:note,acknowledgeAuthorization:true,files:files.filter(f=>selectedFiles.includes(fileKey(f)))};
      const body=JSON.stringify(payload);if(attempt.current?.body!==body)attempt.current={key:crypto.randomUUID(),body};
      await workspaceRequest(project,"/native-assignments",{...payload,idempotencyKey:attempt.current.key});
      if(identity.current!==project)return;attempt.current=null;setAck(false);await refresh();setMessage("Bounded manual assignment registered. No native session or provider was launched.");
    }catch(e){if(identity.current===project)setMessage(e instanceof Error?e.message:"Assignment failed");}finally{setBusy(false);}
  };
  return <section aria-label="Bounded native work" className="space-y-3 rounded-lg border p-4">
    <h3 className="font-semibold">Bounded native work</h3>
    <p>Preview saved criteria above, confirm the allowed files and register a session you started yourself. Registration records your authorization; it does not launch native software or approve a full Architecture.</p>
    {!packet&&<p>Generate a current draft preview to choose new work.</p>}
    {packet&&<div className="space-y-2">
      <p>Selected criteria: {packet.verificationExpectations.map(c=>c.criterionId).join(", ")} · {packet.repositoryBinding.status}</p>
      {files.map(f=><label className="block" key={fileKey(f)}><input type="checkbox" aria-label={"Authorize file "+f.path+" in "+f.repositoryId} checked={selectedFiles.includes(fileKey(f))} onChange={e=>{setSelectedFiles(e.target.checked?[...selectedFiles,fileKey(f)]:selectedFiles.filter(k=>k!==fileKey(f)));setAck(false);}}/>{f.action} {f.path} · {f.repositoryId}</label>)}
      <Input aria-label="Native session reference" placeholder="Reference for the session you started" value={session} maxLength={200} onChange={e=>{setSession(e.target.value);setAck(false);}}/>
      <Textarea aria-label="Bounded authorization note" placeholder="Describe the exact permitted work and exclusions" value={note} maxLength={2000} onChange={e=>{setNote(e.target.value);setAck(false);}}/>
      <label className="block"><input type="checkbox" aria-label="Confirm bounded manual authorization" checked={ack} onChange={e=>setAck(e.target.checked)}/>I authorize only the selected criteria, displayed baselines and checked files for this manual session.</label>
      <Button disabled={disabled||busy||!ack||!session.trim()||!note.trim()||!files.some(f=>selectedFiles.includes(fileKey(f)))||packet.repositoryBinding.status!=="BOUND"} onClick={register}>Register bounded manual assignment</Button>
    </div>}
    {message&&<p role="status">{message}</p>}
    {records.map(record=><NativeAssignmentCard key={projectId+record.id} record={record} projectId={projectId} version={view.head.stateVersion} disabled={disabled||busy} refresh={refresh}/>)}
  </section>;
}
