import type {PropertyListing} from '../types';
import {dateInputValue} from './datePresentation';
import {PublicationValidationError} from '../publications';

export const warningLabels = {expiry:'Expiry date missing, invalid or missing year',repost:'Repost date invalid or missing year',phone:'Lister phone missing',pic:'PIC missing',links:'No publication links'};
export type WarningKey=keyof typeof warningLabels;
export function validateIgnoredWarnings(value:unknown):WarningKey[]{
  if(!Array.isArray(value)||value.length>5||value.some(k=>typeof k!=='string'||!Object.hasOwn(warningLabels,k)))throw new PublicationValidationError('Invalid ignored data warnings.');
  return [...new Set(value)] as WarningKey[];
}
export function malaysiaToday(now=new Date()):string{
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function dayNumber(value?:string|null):number|null{
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateInputValue(value));
  if(!m)return null;
  const day=+m[1],month=+m[2],year=+m[3];
  const date=new Date(Date.UTC(year,month-1,day));
  return year>=1000&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date.getTime()/86400000:null;
}
export function remindersFor(row:PropertyListing,today=malaysiaToday()){
  if(row.archivedAt||row.status==='Sold Out')return [];
  const current=dayNumber(today)!;
  return ([['Expiry',row.date],['Repost',row.propertyGuruRepostDate]] as const).flatMap(([kind,value])=>{
    const target=dayNumber(value);if(target===null||target-current>7)return [];
    const days=target-current;
    return [{kind,days,label:`${kind} ${days<0?`${-days} day${days===-1?'':'s'} overdue`:days===0?'today':`in ${days} day${days===1?'':'s'}`}`}];
  });
}
const missing=(value?:string|null)=>!value?.trim()||['-','n/a','not captured','not provided'].includes(value.trim().toLowerCase());
export function dataWarnings(row:PropertyListing,linkCount?:number){
  const keys:WarningKey[]=[];
  if(dayNumber(row.date)===null)keys.push('expiry');
  if(row.propertyGuruRepostDate&&dayNumber(row.propertyGuruRepostDate)===null)keys.push('repost');
  if(missing(row.noTel))keys.push('phone');
  if(missing(row.createdByName)&&missing(row.createdByUserId))keys.push('pic');
  if(linkCount===0)keys.push('links');
  return keys.map(key=>({key,label:warningLabels[key],ignored:(row.ignoredDataWarnings||[]).includes(key)}));
}
export function isMine(row:PropertyListing,user:{id:number;displayName:string|null;username:string}){
  if(row.createdByUserId)return row.createdByUserId===String(user.id);
  return !!row.createdByName&&[user.displayName,user.username].some(name=>name?.trim().toLowerCase()===row.createdByName?.trim().toLowerCase());
}
