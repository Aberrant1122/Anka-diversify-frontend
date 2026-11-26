import { workspaceRequest, type MainDocument } from './workspace-api';
export interface BaselineBudget { hash:string;measurementHash:string;limits:{totalTimeoutMs:number;memoryMiB:number;workMiB:number;tmpMiB:number;stdoutBytes:number;stderrBytes:number} }
export interface ValidationProfile { id:string;title:string;requirementIds:string[];criterionIds:string[];repositoryId:string;baseline:string;runtimeProfileHash:string;budgetProfile:BaselineBudget;commands:{id:string;criterionId:string;argv:string[];cwd:string;timeoutMs:number}[] }
export interface BaselineSelection {mainId:string;mainHash:string;architectureId:string;architectureHash:string;selectedProfileIds:string[]}
export interface BaselinePreview {bindingHash:string;planHash:string;binding:{purpose:'BASELINE_VALIDATION';main:{id:string;hash:string};architecture:{id:string;hash:string};selectedProfileIds:string[];profiles:ValidationProfile[]};dispatchAvailable:boolean;runtimeAcceptanceVerified:boolean}
export interface BoundBaselinePreview {selection:BaselineSelection;version:number;value:BaselinePreview}
export interface BaselineOperation {id:string;runId:string;purpose:'BASELINE_VALIDATION';status:string;stateVersion:number;authorityCurrent:boolean;createdAt:string;authority:{main:{id:string;hash:string};architecture:{id:string;hash:string};approvalId:string;bindingHash:string;planHash:string;selectedProfileIds:string[];scopeVerified:boolean;criteria:{requirementId:string;criterionId:string}[];coveredCriterionIds:string[];unassessedCriterionIds:string[];profiles:{id:string;repositoryId:string;baseline:string;runtimeProfileHash:string;budgetProfileHash:string;measurementHash:string;requirementIds:string[];criterionIds:string[];commands:{id:string;criterionId:string}[]}[]};result:null|{evidenceClass:string;outcome:string;passed:boolean;authorityCurrent:boolean;acceptedForCurrentAuthority:boolean;results:{profileId:string;id:string;criterionId:string;exitCode:number|null;signal:string|null;timedOut:boolean;outputLimitExceeded:boolean;resourceLimitExceeded:boolean;sourceWriteAttempted:boolean}[]};cleanup:{confirmed:boolean;canRequest:boolean;retryEligible:boolean}}
export interface BaselineView {head:{stateVersion:number;baselineApprovalId:string|null};operations:BaselineOperation[];dispatchAvailable:boolean;runtimeAcceptanceVerified:boolean}
export type BaselineTransport=<T>(projectId:string,path:string,body?:unknown)=>Promise<T>;
const normalize=(selection:BaselineSelection):BaselineSelection=>{
  if(!selection.mainId||!selection.architectureId||![selection.mainHash,selection.architectureHash].every(h=>/^[a-f0-9]{64}$/.test(h))||!selection.selectedProfileIds.length||selection.selectedProfileIds.length>8||new Set(selection.selectedProfileIds).size!==selection.selectedProfileIds.length||selection.selectedProfileIds.some(id=>!/^VAL-[A-Z0-9-]+$/.test(id)))throw Error('Select valid baseline profiles.');
  return {...selection,selectedProfileIds:[...selection.selectedProfileIds].sort()};
};
const key=(s:BaselineSelection,version:number)=>JSON.stringify([s.mainId,s.mainHash,s.architectureId,s.architectureHash,[...s.selectedProfileIds].sort(),version]);
const authorityError=(e:unknown)=>/STATE_CONFLICT|BASELINE_AUTHORITY_CHANGED|DOCUMENT_HASH_MISMATCH|MAIN_VERSION_MISMATCH|BASELINE_REPOSITORY_CHANGED|PROJECT_RESOURCE_NOT_FOUND|BLOCKING_QUESTIONS/.test(e instanceof Error?e.message:'');
export function baselineError(e:unknown){return authorityError(e)?'Authority changed or access was revoked. Refresh the documents and preview again.':e instanceof Error?e.message:'Unable to load baseline validation.';}
// This client deliberately has no authorize, claim, dispatch, worker-receipt,
// cleanup-confirm, implementation or publication operation.
export class BaselineSession {
  private generation=0;private current:BoundBaselinePreview|null=null;private approvalKeys=new Map<string,string>();private approving=false;
  constructor(private projectId:string,private transport:BaselineTransport=workspaceRequest,private freshKey=()=>crypto.randomUUID()){}
  invalidate(){this.generation++;this.current=null;}
  load(){return this.transport<BaselineView>(this.projectId,'/baseline-validation');}
  async preview(raw:BaselineSelection,version:number){
    if(!Number.isSafeInteger(version)||version<0)throw Error('Refresh authority before previewing.');
    const selection=normalize(raw),generation=++this.generation;this.current=null;
    const value=await this.transport<BaselinePreview>(this.projectId,'/baseline-validation/preview',selection);
    if(generation!==this.generation)throw Error('Selection changed. Preview again.');
    const b=value.binding;
    if(b?.purpose!=='BASELINE_VALIDATION'||b.main?.id!==selection.mainId||b.main?.hash!==selection.mainHash||b.architecture?.id!==selection.architectureId||b.architecture?.hash!==selection.architectureHash||!Array.isArray(b.selectedProfileIds)||JSON.stringify([...b.selectedProfileIds].sort())!==JSON.stringify(selection.selectedProfileIds)||!Array.isArray(b.profiles)||b.profiles.length!==selection.selectedProfileIds.length||new Set(b.profiles.map(p=>p.id)).size!==b.profiles.length||b.profiles.some(p=>!selection.selectedProfileIds.includes(p.id))||![value.bindingHash,value.planHash].every(h=>/^[a-f0-9]{64}$/.test(h)))throw Error('Baseline preview did not match the selected authority.');
    this.current={selection,version,value};return this.current;
  }
  async approve(preview:BoundBaselinePreview,selection:BaselineSelection,version:number){
    if(this.approving)throw Error('Approval already in progress.');
    const signature=key(normalize(selection),version);
    if(this.current!==preview||key(preview.selection,preview.version)!==signature)throw Error('Selection or authority changed. Preview again.');
    const idempotencyKey=this.approvalKeys.get(signature)??this.freshKey();this.approvalKeys.set(signature,idempotencyKey);this.approving=true;
    try{const result=await this.transport(this.projectId,'/baseline-validation/approve',{...preview.selection,expectedVersion:preview.version,idempotencyKey,expectedBindingHash:preview.value.bindingHash,expectedPlanHash:preview.value.planHash});this.invalidate();return result;}
    catch(e){if(authorityError(e))this.invalidate();throw e;}finally{this.approving=false;}
  }
  async requestCleanup(operation:BaselineOperation){
    if(operation.purpose!=='BASELINE_VALIDATION'||!operation.cleanup.canRequest||!['PREPARING','RUNNING','CLEANUP_REQUIRED'].includes(operation.status)||!/^[a-f0-9-]{36}$/.test(operation.id))throw Error('Cleanup cannot be requested for this operation.');
    return this.transport(this.projectId,'/baseline-validation/operations/'+encodeURIComponent(operation.id)+'/request-cleanup',{});
  }
}
export function baselineCoverage(main:MainDocument,profiles:ValidationProfile[]){const covered=new Set(profiles.flatMap(p=>p.criterionIds));return main.requirements.flatMap(r=>r.acceptanceCriteria.map(c=>({requirementId:r.id,criterionId:c.id,description:c.description,assessedScope:covered.has(c.id)})));}
export function baselineEvidenceLabel(op:BaselineOperation,runtimeAccepted=false){
  if(!op.authority.scopeVerified)return 'Historical scope unavailable';
  if(!op.authorityCurrent||op.result?.outcome==='STALE')return 'Historical evidence — authority changed';
  if(op.status==='CLEANUP_REQUIRED')return 'Cleanup required — result unaccepted';
  if(!op.result||op.result.evidenceClass==='NO_EXECUTION')return 'No execution evidence';
  const failure=op.result.results.some(r=>r.exitCode!==0||r.signal!==null||r.timedOut||r.outputLimitExceeded||r.resourceLimitExceeded||r.sourceWriteAttempted);
  if(failure||op.result.outcome==='FAILED')return 'Validation failed';
  if(!op.cleanup.confirmed)return 'Cleanup unconfirmed — result unaccepted';
  if(op.result.evidenceClass==='CONTRACT_TEST')return op.result.passed?'Contract checks passed — no runtime acceptance':'Contract checks failed';
  if(op.status==='COMPLETED'&&op.result.evidenceClass==='DYNAMIC_ISOLATED_COMMAND_CHECKS'&&op.result.passed&&op.result.acceptedForCurrentAuthority&&runtimeAccepted)return 'Isolated checks passed for the listed criteria';
  return 'No accepted runtime evidence';
}
