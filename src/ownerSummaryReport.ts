import type { OwnerListing } from './ownerListing';
export interface SummaryEntry { row:number; reference:string; date:string|null; ownerName:string; phone:string; property:string; transactionType:'rent'|'sale'|null; issues:string[] }
export interface SummaryCandidate { id:number; propertyName:string; ownerName:string; noTel:string; location?:string; transactionType?:'rent'|'sale'|null; version?:number; reason:string; canEdit:boolean }
export interface SummaryRow { entry:SummaryEntry; candidates:SummaryCandidate[]; selectedOwnerId:number|null; selectedVersion:number|null; createNew?:boolean; canCreate?:boolean; state:'ready'|'pending'|'applied'; issue?:string }
export interface SummaryPreview { reportId:string; rows:SummaryRow[]; applied:number; pending:number }
export interface SummaryReportListItem { id:string; createdAt:string; total:number; pending:number }
export interface SummaryChoice { row:number; ownerId:number|null; version?:number; reference?:string;createNew?:boolean;defer?:boolean }
const REFERENCE_ISSUE='Invalid reference; expected WTL/WTS-YYYYMM-NNNNN.';
const DUPLICATE_ISSUE='Duplicate reference in this report.';
export function applySummaryReferenceEdits(entries:SummaryEntry[],edits:{row:number;reference?:string}[]):SummaryEntry[] {
  const changes=new Map(edits.map(edit=>[edit.row,edit.reference]));
  const result=entries.map(entry=>{const reference=(changes.get(entry.row)??entry.reference).trim().toUpperCase();return {...entry,reference,transactionType:(/^WT[LS]-\d{6}-\d{5}$/i.test(reference)?reference.startsWith('WTL')?'rent':'sale':null) as SummaryEntry['transactionType'],issues:entry.issues.filter(issue=>issue!==REFERENCE_ISSUE&&issue!==DUPLICATE_ISSUE)};});
  const counts=new Map<string,number>();for(const entry of result)counts.set(entry.reference,(counts.get(entry.reference)||0)+1);
  for(const entry of result){if(!entry.transactionType)entry.issues.push(REFERENCE_ISSUE);if((counts.get(entry.reference)||0)>1)entry.issues.push(DUPLICATE_ISSUE);}
  return result;
}

function calendarDate(text:string):string|null {
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text); if(!m)return null;
  const [,d,mth,y]=m; const date=new Date(Date.UTC(+y,+mth-1,+d));
  return +y>=1000&&date.getUTCFullYear()===+y&&date.getUTCMonth()===+mth-1&&date.getUTCDate()===+d?`${y}-${mth}-${d}`:null;
}
export function normalizeSummaryPhone(value:string):string {
  if(!/^[+\d\s().-]+$/.test(value.trim()))return '';
  let n=value.replace(/\D/g,''); if(n.startsWith('0060'))n=n.slice(2); if(n.startsWith('60'))n='0'+n.slice(2);
  return /^0\d{8,10}$/.test(n)?n:'';
}
export function parseOwnerSummaryReport(report:string):SummaryEntry[] {
  if(typeof report!=='string'||report.length>50000)throw new Error('Report must be at most 50,000 characters.');
  const lines=report.replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').split(/\r?\n/); const entries:SummaryEntry[]=[]; let current:SummaryEntry|undefined; let date:string|null=null;
  for(const raw of lines){const line=raw.trim(); const dateLine=line.replace(/\*/g,'').trim();
    if(/^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(dateLine)){date=calendarDate(dateLine);continue;}
    const numbered=/^\d+\s*[.)]\s*(.*)$/.exec(line);
    if(numbered){if(entries.length>=100)throw new Error('Report must contain at most 100 entries.'); const reference=numbered[1].trim().toUpperCase(); current={row:entries.length+1,reference,date,ownerName:'',phone:'',property:'',transactionType:/^WTL-\d{6}-\d{5}$/.test(reference)?'rent':/^WTS-\d{6}-\d{5}$/.test(reference)?'sale':null,issues:[]};entries.push(current);continue;}
    if(!current)continue;
    const field=/^(?:[-•]\s*)?(Name|Contact|Property)\b\s*:?\s*(.*)$/i.exec(line); if(!field)continue;
    const key=field[1].toLowerCase()==='name'?'ownerName':field[1].toLowerCase()==='contact'?'phone':'property';
    if(current[key])current.issues.push(`Repeated ${field[1]} field.`); else current[key]=field[2].trim();
  }
  const counts=new Map<string,number>(); for(const e of entries)counts.set(e.reference,(counts.get(e.reference)||0)+1);
  for(const e of entries){if(!e.transactionType)e.issues.push('Invalid reference; expected WTL/WTS-YYYYMM-NNNNN.');if(!e.date)e.issues.push('Missing or invalid report date (DD/MM/YYYY).');if(!e.ownerName)e.issues.push('Missing owner name.');if(!normalizeSummaryPhone(e.phone))e.issues.push('Missing or invalid contact phone.');if(!e.property)e.issues.push('Missing property.');if((counts.get(e.reference)||0)>1)e.issues.push('Duplicate reference in this report.');}
  return entries;
}
const normalized=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// A category and its marketing qualifiers do not identify a particular property.
// Remaining words (for example a district or estate name) provide specificity.
const genericPropertyWords=new Set('agricultural agriculture land tanah pertanian kebun sawit bungalow banglo lot residential kediaman untuk disewa sewa dijual jual for rent rental sale lease freehold leasehold vacant empty kosong palm oil plantation paddy sawah development building plot plots commercial industrial tanah'.split(' '));
const generic=(s:string)=>!!s&&s.split(' ').every(word=>genericPropertyWords.has(word));
function similar(a:string,b:string):boolean {const aa=a.split(' ').filter(Boolean),bb=b.split(' ').filter(Boolean);const shared=aa.filter(t=>bb.includes(t));return !generic(a)&&!generic(b)&&shared.length>=2&&shared.length/Math.max(aa.length,bb.length)>=0.6;}
export function matchOwnerSummaryEntry(entry:SummaryEntry,owners:OwnerListing[],actor:{id:number;role:string}):SummaryRow {
  const property=normalized(entry.property),phone=normalizeSummaryPhone(entry.phone),name=normalized(entry.ownerName);
  const scored=owners.map(owner=>{const p=normalized(owner.propertyName),exact=!!property&&property===p,phoneMatch=!!phone&&phone===normalizeSummaryPhone(owner.noTel),nameMatch=!!name&&name===normalized(owner.ownerName),overlap=similar(property,p),canEdit=(actor.role==='admin'||actor.role==='super_admin')||owner.assignedAgentId===actor.id; return {owner,exact,phoneMatch,overlap,canEdit,score:(exact?100:0)+(phoneMatch?60:0)+(overlap?20:0)+(nameMatch?10:0),reason:[exact?'Exact property':overlap?'Similar property':'',phoneMatch?'Same phone':'',nameMatch?'Same owner name':''].filter(Boolean).join('; ')};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.owner.id-b.owner.id);
  let viable=scored.filter(x=>(!normalizeSummaryPhone(x.owner.noTel)||x.phoneMatch)&&!generic(property)&&((x.exact)||(x.phoneMatch&&x.overlap)));
  if(viable.length>1){const withPhone=viable.filter(x=>x.phoneMatch);if(withPhone.length===1)viable=withPhone;}
  const selected=entry.issues.length===0&&viable.length===1&&viable[0].canEdit&&(!viable[0].owner.transactionType||viable[0].owner.transactionType===entry.transactionType)?viable[0].owner:null;
  return {entry,candidates:scored.slice(0,8).map(x=>({id:x.owner.id,propertyName:x.owner.propertyName,ownerName:x.owner.ownerName,noTel:x.owner.noTel,location:x.owner.location,transactionType:x.owner.transactionType,version:x.owner.version,reason:x.reason,canEdit:x.canEdit})),selectedOwnerId:selected?.id??null,selectedVersion:selected?.version??null,state:selected?'ready':'pending',...(!selected?{issue:entry.issues.join(' ')||'Choose an eligible owner; no unique compatible property match was found.'}:{})};
}
