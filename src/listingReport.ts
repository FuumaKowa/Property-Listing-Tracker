import {parsePublicationReport,matchReportChannel,type ReportEntry} from './reportImport';
import type {PublicationChannel} from './publications';
import type {PropertyListing,ProjectCategory} from './types';
export interface ListingReportData {property:string;location:string;reference:string;ownerName:string;phone:string;price:string;category:ProjectCategory|null;links:(ReportEntry&{channelId:number|null})[]}
export interface ListingReportPreview extends ListingReportData {candidates:PropertyListing[];selectedListingId:number|null;issue?:string}
export const reportIdentity=(text:string)=>text.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const isPendingReportLocation=(value:string|null|undefined)=>['','-','pending','pending details','location not provided','not provided','not captured','unknown'].includes((value||'').trim().toLowerCase());
export const reportPropertyName=(heading:string)=>heading.replace(/^[*_\s]+|[*_\s]+$/g,'').replace(/^(?:FOR\s+(?:SALE|RENT)|WT[SL]|AUCTION|NEW\s+PROJECT)\s*[|:–—-]\s*/i,'').split(/[•]|\s\|\s*RM\s*/i)[0].replace(/\s+RM\s*[\d,].*$/i,'').trim();
const reportLocalities=['Bukit Jelutong','Shah Alam','Setia Alam','Alam Impian','Port Klang','Klang','Kapar','Petaling Jaya','Kota Damansara','Damansara','Sunway','Ampang','Puchong','Bandar Saujana Putra','Bandar Saujana Putera','Cyberjaya','Subang Jaya','Seri Kembangan','Bangi','Kajang','Semenyih','Sepang','Rawang','Puncak Alam','Sungai Buloh','Selayang','Bukit Beruntung','Putrajaya','Dengkil','Sentul','Sunsuria City','Kota Kemuning','Bandar Sungai Long','Beranang','Kuala Lumpur'];
export function inferReportLocation(property:string,knownLocations:string[]=[]):string {
 const text=' '+reportIdentity(property)+' ';
 const locations=[...reportLocalities,...knownLocations.map(l=>l.split(/[,/]/)[0].replace(/^[\s-]+/,'').trim())].filter(l=>!isPendingReportLocation(l)&&l.length>=4&&l.length<=300);
 const found=locations.filter(l=>text.includes(' '+reportIdentity(l)+' ')).filter((l,i,a)=>a.findIndex(other=>reportIdentity(l)===reportIdentity(other))===i);
 const specific=found.filter(l=>!found.some(other=>other!==l&&(' '+reportIdentity(other)+' ').includes(' '+reportIdentity(l)+' ')));
 if(specific.length===1)return specific[0];
 // Multiple localities explicitly joined by commas form an address; "or", slash
 // and other separators remain ambiguous and must be reviewed.
 const positions=specific.map(location=>{const escaped=location.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'[\\s-]+');const match=new RegExp('\\b'+escaped+'\\b','i').exec(property);return {location,start:match?.index??-1,end:match?match.index+match[0].length:-1};}).sort((a,b)=>a.start-b.start);
 if(positions.length>1&&positions.every(p=>p.start>=0)&&positions.slice(1).every((p,i)=>/^\s*,\s*$/.test(property.slice(positions[i].end,p.start))))return positions.map(p=>p.location).join(', ');
 return '';
}
export function parseListingReport(raw:string,channels:PublicationChannel[],knownLocations:string[]=[]):ListingReportData {
 if(typeof raw!=='string'||raw.length>50000)throw new Error('Keep the report under 50,000 characters.');
 const text=raw.replace(/[\u200B-\u200D\u2060\uFEFF]/g,''),lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
 const heading=(lines[0]||'').replace(/^[*_\s]+|[*_\s]+$/g,''),ref=[...text.matchAll(/\bREF(?:ERENCE)?\s*:\s*([^\s*]+)/gi)];
 if(ref.length>1)throw new Error('Paste one property report at a time.');
 const reference=(ref[0]?.[1]||'').toUpperCase();if(reference&&!/^[A-Z0-9][A-Z0-9/-]{0,79}$/.test(reference))throw new Error('Enter a valid property reference.');
 const property=reportPropertyName(heading);
 if(!property||property.length>300||/^REF\s*:/i.test(property))throw new Error('Start the report with the property name.');
 const field=(key:string)=>lines.map(l=>new RegExp('^[*•-]?\\s*'+key+'\\s*:?\\s*(.+)$','i').exec(l)?.[1]?.replace(/\*$/,'').trim()).find(Boolean)||'';
 const ownerName=field('Name'),phone=field('Contact');if(ownerName.length>200||phone.length>50)throw new Error('Owner name or contact is too long.');
 const explicitLocation=field('(?:Location|Locality|Area)');if(explicitLocation.length>300)throw new Error('Location must be at most 300 characters.');
 const location=explicitLocation&&!isPendingReportLocation(explicitLocation)?explicitLocation:inferReportLocation(property,knownLocations);
 const sale=/^FOR\s+SALE\b/i.test(heading)||reference.startsWith('WTS-'),rent=/^FOR\s+RENT\b/i.test(heading)||reference.startsWith('WTL-');
 if(sale&&rent)throw new Error('The sale/rental heading conflicts with the reference.');
 const category:ProjectCategory|null=rent?'Rental':/^AUCTION\b/i.test(heading)?'Auction':/^NEW\s+PROJECT\b/i.test(heading)?'Project Marketing (PM)':sale?'Subsale Direct Listing (SSDL)':null;
 const price=/\bRM\s*([\d,]+(?:\.\d{1,2})?)/i.exec(heading)?.[1]||'';
 const links=parsePublicationReport(text.replace(/^(\s*\d+)\s+(?=[A-Za-z])/gm,'$1. ')).map(e=>({...e,channelId:matchReportChannel(e,channels)}));
 return {property,location,reference,ownerName,phone,price,category,links};
}
