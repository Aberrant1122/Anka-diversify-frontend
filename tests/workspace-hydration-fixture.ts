import { createHash } from 'node:crypto';
import type { MainDocument,ArchitectureDocument,WorkspaceRevision,WorkspaceView } from '../lib/workspace-api';
import { baselineFixture } from './baseline-fixture';
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function hydratedWorkspaceFixture(blockers=true){
  const fixture=baselineFixture();
  if(blockers){fixture.main.questions=[{id:'Q-MAIN',question:'Resolve Main blocker',blocking:true}];fixture.architecture.questions=[{id:'Q-ARCH',question:'Resolve Architecture blocker',blocking:true}];}
  const main:WorkspaceRevision<MainDocument>={id:'main-1',kind:'MAIN',version:1,contentHash:digest(fixture.main),content:structuredClone(fixture.main),previousId:null,sourceMainId:null};
  fixture.architecture.sourceMain={id:main.id,hash:main.contentHash};
  const architecture:WorkspaceRevision<ArchitectureDocument>={id:'arch-1',kind:'ARCHITECTURE',version:1,contentHash:digest(fixture.architecture),content:structuredClone(fixture.architecture),previousId:null,sourceMainId:main.id};
  const documents:WorkspaceRevision[]=[main,architecture],calls:{path:string;method:string;body:Record<string,unknown>|null}[]=[],approvals:Record<string,unknown>[]=[];
  let version=5,mainId=main.id,architectureId=architecture.id,baselineApprovalId:string|null=null;
  const currentMain=()=>documents.find(d=>d.id===mainId) as WorkspaceRevision<MainDocument>;
  const currentArchitecture=()=>documents.find(d=>d.id===architectureId) as WorkspaceRevision<ArchitectureDocument>;
  const workspace=():WorkspaceView=>({head:{stateVersion:version,mainId,architectureId,approvalId:null},documents,approvals:[],runs:[],operations:[],readiness:{invalidatedUnitIds:[],approvedMainId:null,currentMainId:mainId},events:[],repositories:[{id:'repo',name:'Synthetic repository',currentIndexedCommit:'b'.repeat(40),materialized:true}]});
  const response=(data:unknown)=>Response.json({data});
  const failure=(error:string,status=409)=>Response.json({error},{status});
  const fetch:typeof globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(url.origin!=='http://synthetic.invalid')throw Error('Synthetic test rejects external request: '+url.origin);
    const prefix='/api/projects/synthetic/workspace';
    if(!url.pathname.startsWith(prefix))throw Error('Unexpected synthetic project');
    const path=url.pathname.slice(prefix.length),method=init?.method??'GET',body=init?.body?JSON.parse(String(init.body)) as Record<string,unknown>:null;
    calls.push({path,method,body});
    if(method==='GET'&&path==='')return response(workspace());
    if(method==='GET'&&path==='/capabilities')return response({aiGeneration:true,isolatedValidation:false,publication:false,runtimeAcceptanceVerified:false});
    if(method==='GET'&&path==='/baseline-validation')return response({head:{stateVersion:version,baselineApprovalId},operations:[],dispatchAvailable:false,runtimeAcceptanceVerified:false});
    if(method==='POST'&&path==='/documents'){
      if(body?.expectedVersion!==version)return failure('STATE_CONFLICT');
      if(typeof body.reason!=='string'||!body.reason.trim())return failure('DOCUMENT_CHANGE_REASON_REQUIRED',422);
      const kind=body.kind;if(kind!=='MAIN'&&kind!=='ARCHITECTURE')return failure('INVALID_DOCUMENT',422);
      const content=body.content as MainDocument|ArchitectureDocument;
      if(kind==='ARCHITECTURE'){
        const arch=content as ArchitectureDocument,m=currentMain();
        if(arch.schemaVersion!==2||arch.sourceMain.id!==m.id||arch.sourceMain.hash!==m.contentHash)return failure('MAIN_VERSION_MISMATCH');
      }
      const prior=kind==='MAIN'?currentMain():currentArchitecture();
      const revision:WorkspaceRevision={id:(kind==='MAIN'?'main-':'arch-')+(prior.version+1),kind,version:prior.version+1,contentHash:digest(content),content:structuredClone(content),previousId:prior.id,sourceMainId:kind==='ARCHITECTURE'?currentMain().id:null};
      documents.push(revision);if(kind==='MAIN')mainId=revision.id;else architectureId=revision.id;version++;
      return response(revision);
    }
    if(method==='POST'&&path==='/baseline-validation/preview'){
      const m=currentMain(),a=currentArchitecture(),arch=a.content;
      if(body?.mainId!==m.id||body.mainHash!==m.contentHash||body.architectureId!==a.id||body.architectureHash!==a.contentHash)return failure('BASELINE_AUTHORITY_CHANGED');
      if(arch.sourceMain.id!==m.id||arch.sourceMain.hash!==m.contentHash)return failure('MAIN_VERSION_MISMATCH');
      if([...m.content.questions,...arch.questions].some(q=>q.blocking))return failure('BLOCKING_QUESTIONS');
      if(arch.schemaVersion!==2)throw Error('Wrong synthetic purpose');
      const ids=body.selectedProfileIds as string[],profiles=arch.validationProfiles.filter(p=>ids.includes(p.id));
      return response({bindingHash:digest(body),planHash:digest(profiles),binding:{purpose:'BASELINE_VALIDATION',main:{id:m.id,hash:m.contentHash},architecture:{id:a.id,hash:a.contentHash},selectedProfileIds:ids,profiles},dispatchAvailable:false,runtimeAcceptanceVerified:false});
    }
    if(method==='POST'&&path==='/baseline-validation/approve'){
      if(body?.expectedVersion!==version)return failure('STATE_CONFLICT');
      if(body.mainId!==mainId||body.architectureId!==architectureId)return failure('BASELINE_AUTHORITY_CHANGED');
      baselineApprovalId='approval-'+(approvals.length+1);approvals.push(structuredClone({...body,id:baselineApprovalId}));version++;
      return response({id:baselineApprovalId});
    }
    throw Error('Forbidden or unexpected synthetic API action: '+method+' '+path);
  };
  return {fetch,calls,documents,approvals,initialMain:structuredClone(main),initialArchitecture:structuredClone(architecture),workspace,currentMain,currentArchitecture,advanceVersion:()=>{version++;},version:()=>version};
}
