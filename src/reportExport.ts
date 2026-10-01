import type {PropertyListing} from './types';
import type {ListingPublication,PublicationChannel} from './publications';

const line=(value?:string|null)=>value?.replace(/[\r\n]+/g,' ').trim()||'N/A';
export function buildPublicationReport(listing:PropertyListing,links:ListingPublication[],channels:PublicationChannel[]):string{
 const title=[listing.property,listing.location].filter(v=>v?.trim()).map(v=>line(v)).join(' – ');
 const groups=channels.filter(c=>!c.archivedAt||links.some(l=>l.channelId===c.id));
 for(const link of links)if(!groups.some(c=>c.id===link.channelId))groups.push({id:link.channelId,name:`Other channel (${link.channelId})`,archivedAt:null});
 const sections=groups.map((channel,index)=>{
  const ads=links.filter(link=>link.channelId===channel.id);
  return `${index+1}. ${line(channel.name)}\n${ads.length?ads.map(ad=>`${ad.label?.trim()?line(ad.label)+': ':''}${ad.url}`).join('\n'):'N/A'}`;
 });
 return [`*${title}*`,`LISTER\nNAME : ${line(listing.pm)}\nTEL : ${line(listing.noTel)}`,...sections].join('\n\n');
}
