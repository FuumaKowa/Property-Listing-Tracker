import {parsePublicationReport,matchReportChannel,type ReportEntry} from './reportImport';
import type {PublicationChannel} from './publications';
import type {PropertyListing,ProjectCategory} from './types';
export interface ListingReportData {property:string;reference:string;ownerName:string;phone:string;price:string;category:ProjectCategory|null;links:(ReportEntry&{channelId:number|null})[]}
export interface ListingReportPreview extends ListingReportData {candidates:PropertyListing[];selectedListingId:number|null;issue?:string}
export const reportIdentity=(text:string)=>text.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function parseListingReport(raw:string,channels:PublicationChannel[]):ListingReportData {
 if(typeof raw!=='string'||raw.length>50000)throw new Error('Keep the report under 50,000 characters.');
 const text=raw.replace(/[\u200B-\u200D\u2060\uFEFF]/g,''),lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
 const heading=lines[0]||'',ref=[...text.matchAll(/\bREF(?:ERENCE)?\s*:\s*([^\s*]+)/gi)];
 if(ref.length>1)throw new Error('Paste one property report at a time.');
 const reference=(ref[0]?.[1]||'').toUpperCase();if(reference&&!/^[A-Z0-9][A-Z0-9/-]{0,79}$/.test(reference))throw new Error('Enter a valid property reference.');
 const property=heading.replace(/^(?:FOR\s+(?:SALE|RENT)|WT[SL]|AUCTION|NEW\s+PROJECT)\s*[|:–—-]\s*/i,'').split(/[•]|\s\|\s*RM\s*/i)[0].replace(/\s+RM\s*[\d,].*$/i,'').trim();
 if(!property||property.length>300||/^REF\s*:/i.test(property))throw new Error('Start the report with the property name.');
 const field=(key:string)=>lines.map(l=>new RegExp('^[*•-]?\\s*'+key+'\\s*:?\\s*(.+)$','i').exec(l)?.[1]?.replace(/\*$/,'').trim()).find(Boolean)||'';
 const ownerName=field('Name'),phone=field('Contact');if(ownerName.length>200||phone.length>50)throw new Error('Owner name or contact is too long.');
 const sale=/^FOR\s+SALE\b/i.test(heading)||reference.startsWith('WTS-'),rent=/^FOR\s+RENT\b/i.test(heading)||reference.startsWith('WTL-');
 if(sale&&rent)throw new Error('The sale/rental heading conflicts with the reference.');
 const category:ProjectCategory|null=rent?'Rental':/^AUCTION\b/i.test(heading)?'Auction':/^NEW\s+PROJECT\b/i.test(heading)?'Project Marketing (PM)':sale?'Subsale Direct Listing (SSDL)':null;
 const price=/\bRM\s*([\d,]+(?:\.\d{1,2})?)/i.exec(heading)?.[1]||'';
 const links=parsePublicationReport(text.replace(/^(\s*\d+)\s+(?=[A-Za-z])/gm,'$1. ')).map(e=>({...e,channelId:matchReportChannel(e,channels)}));
 return {property,reference,ownerName,phone,price,category,links};
}
