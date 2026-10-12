import type { OwnerListing } from '../ownerListing';
import { normalizeDateEdit } from './datePresentation';
export interface OwnerFilters {query:string;status:string;type:string;agent:string;alertOnly:boolean;location:string;stage:string;minPrice:string;maxPrice:string;dateFrom:string;dateTo:string;sort:string}
export const defaultOwnerFilters:OwnerFilters={query:'',status:'All',type:'All',agent:'All',alertOnly:false,location:'',stage:'All',minPrice:'',maxPrice:'',dateFrom:'',dateTo:'',sort:'newest'};
export const ownerIsOverdue=(row:OwnerListing,now:number)=>row.status==='Unlisted'&&row.assignedAgentId!=null&&!!row.activityDueAt&&Date.parse(row.activityDueAt)<=now;
const price=(value:string):bigint|null=>/^\d{1,16}(?:\.\d{1,2})?$/.test(value.trim())?BigInt(value.trim().split('.')[0])*100n+BigInt((value.trim().split('.')[1]||'').padEnd(2,'0')):null;
const malaysiaDate = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'});
function calendarDay(value:string|undefined){if(!value)return '';const date=new Date(value);if(Number.isNaN(date.getTime()))return '';return malaysiaDate.format(date);}
const time=(value?:string|null)=>value&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
function compareNullable(a:number|bigint|null,b:number|bigint|null,direction=1){if(a===null)return b===null?0:1;if(b===null)return -1;return a<b?-direction:a>b?direction:0;}
export function browseOwners(rows:readonly OwnerListing[],filters:OwnerFilters,size:number,requestedPage:number,now=Date.now()){
 const errors:string[]=[];
 const min=filters.minPrice.trim()?price(filters.minPrice):null,max=filters.maxPrice.trim()?price(filters.maxPrice):null;
 if(filters.minPrice.trim()&&min===null)errors.push('Enter a valid minimum price, without RM or commas.');
 if(filters.maxPrice.trim()&&max===null)errors.push('Enter a valid maximum price, without RM or commas.');
 if(min!==null&&max!==null&&min>max)errors.push('Minimum price must not exceed maximum price.');
 let from='',to='';
 try{from=normalizeDateEdit(filters.dateFrom);to=normalizeDateEdit(filters.dateTo);}catch{errors.push('Enter valid dates as DD/MM/YYYY.');}
 if(from&&to&&from>to)errors.push('Date added from must not be after date added to.');
 const query=filters.query.trim().toLowerCase(),location=filters.location.trim().toLowerCase();
 const faceted=errors.length?[]:rows.filter(row=>{
  const amount=price(row.propertyPrice),day=from||to?calendarDay(row.createdAt):'';
  return [row.propertyName,row.ownerName,row.noTel,row.location,row.assignedAgentName].some(value=>value?.toLowerCase().includes(query))&&
   (filters.status==='All'||row.status===filters.status)&&(filters.type==='All'||row.propertyType===filters.type)&&
   (!location||row.location?.toLowerCase().includes(location))&&
   (filters.stage==='All'||(filters.stage==='not-started'?!row.seedingStatus:row.seedingStatus===filters.stage))&&
   (min===null||(amount!==null&&amount>=min))&&(max===null||(amount!==null&&amount<=max))&&
   (!from||(!!day&&day>=from))&&(!to||(!!day&&day<=to))&&(!filters.alertOnly||ownerIsOverdue(row,now));
 });
 const agentCounts:Record<string,number>={};for(const row of faceted){const key=row.assignedAgentId==null?'unassigned':String(row.assignedAgentId);agentCounts[key]=(agentCounts[key]||0)+1;}
 const filtered=faceted.filter(row=>filters.agent==='All'||(filters.agent==='unassigned'?row.assignedAgentId==null:String(row.assignedAgentId)===filters.agent));
 filtered.sort((a,b)=>{
  let result=0;
  if(filters.sort==='price-asc'||filters.sort==='price-desc')result=compareNullable(price(a.propertyPrice),price(b.propertyPrice),filters.sort==='price-asc'?1:-1);
  else if(filters.sort==='inactivity')result=compareNullable(time(a.lastAgentActivityAt||a.assignedAt),time(b.lastAgentActivityAt||b.assignedAt));
  else result=compareNullable(time(a.createdAt),time(b.createdAt),filters.sort==='oldest'?1:-1);
  return result||a.id-b.id;
 });
 const pageSize=[25,50,100].includes(size)?size:50,total=filtered.length,pageCount=Math.max(1,Math.ceil(total/pageSize));
 const page=Math.max(1,Math.min(pageCount,Math.trunc(requestedPage)||1)),offset=(page-1)*pageSize;
 return {total,page,pageCount,pageSize,agentCounts,facetTotal:faceted.length,errors,pageRows:filtered.slice(offset,offset+pageSize).map((row,index)=>({row,number:offset+index+1})),start:total?offset+1:0,end:Math.min(offset+pageSize,total)};
}
