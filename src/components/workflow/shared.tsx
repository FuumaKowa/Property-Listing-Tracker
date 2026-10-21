import React from 'react';
import {Building2,FileText,Film,Image as ImageIcon,Download} from 'lucide-react';
import type {WorkflowUser,WorkflowListing,WorkflowAction,Material,MaterialKind} from '../../workflow/model';
export interface WorkflowSession {actual:WorkflowUser;effective:WorkflowUser;csrf:string;users:WorkflowUser[];localPreview:boolean;production?:{enabled:boolean;openaiReady:boolean}}
export interface PanelProps {listing:WorkflowListing;session:WorkflowSession;busy:boolean;onAction:(action:WorkflowAction)=>Promise<boolean>;onDirty:(dirty:boolean,key?:string)=>void;onUploadMany?:(files:File[])=>Promise<number>;onUpload?:(file:File,fields:{kind:MaterialKind;title:string;original:boolean;replacesId?:string})=>Promise<boolean>}
export const roleLabels:Record<string,string>={super_admin:'SuperAdmin',coordinator:'Owner coordination',producer:'Creative production',reviewer:'Workflow observer',publisher:'Publishing',viewer:'View workflow'};
export function timeLabel(date:string){return new Date(date).toLocaleString('en-MY',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:true});}
export function Badge({children,tone='slate'}:{children:React.ReactNode;tone?:string}){return <span className={`wf-badge wf-badge-${tone}`}>{children}</span>;}
export function MaterialPreview({material,compact=false}:{material:Material;compact?:boolean}){
  const m=material;
  if(m.kind==='copy')return <div className={`wf-copy-preview ${compact?'wf-preview-compact':''}`}><FileText size={18}/><p>{m.text}</p></div>;
  if(m.fileKey==='sample-photo.png')return <div className={`wf-sample-visual ${compact?'wf-preview-compact':''}`}><Building2 size={48} strokeWidth={1.3}/><span>Sample property visual</span><small>Upload a photo to try your own materials</small></div>;
  if(!m.fileKey)return <div className="wf-sample-visual">{m.kind==='video'?<Film/>:<ImageIcon/>}<span>File pending</span></div>;
  const url='/api/workflow/files/'+encodeURIComponent(m.fileKey);
  return m.kind==='video'?<video className={`wf-media ${compact?'wf-preview-compact':''}`} controls preload="metadata" src={url}/>:<a href={url} target="_blank" rel="noreferrer"><img className={`wf-media ${compact?'wf-preview-compact':''}`} src={url} alt={m.title} loading="lazy"/></a>;
}
export function MaterialDownload({material}:{material:Material}){
  if(!material.fileKey)return null;
  return <a className="wf-text-link" href={`/api/workflow/files/${encodeURIComponent(material.fileKey)}?download=1`} download><Download size={14}/> Download</a>;
}
