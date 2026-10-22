import type {PropertyListing} from './types';
import type {ListingPublication,PublicationChannel} from './publications';

const line=(value?:string|null)=>value?.replace(/[\r\n]+/g,' ').trim()||'N/A';
const priceLine=(value?:string|null)=>{
 const amount=(value||'').trim();
 if(!/^\d{1,16}(?:\.\d{1,2})?$/.test(amount))return '';
 const [whole,fraction]=amount.split('.');
 const cents=fraction?'.'+fraction.replace(/0+$/,''):'';
 return `ASKING PRICE : RM ${whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')}${cents}`;
};
export function buildPublicationReport(listing:PropertyListing,links:ListingPublication[],channels:PublicationChannel[]):string{
 const title=[listing.property,listing.location].filter(v=>v?.trim()).map(v=>line(v)).join(' – ');
 const groups=channels.filter(c=>!c.archivedAt||links.some(l=>l.channelId===c.id));
 for(const link of links)if(!groups.some(c=>c.id===link.channelId))groups.push({id:link.channelId,name:`Other channel (${link.channelId})`,archivedAt:null});
 const sections=groups.map((channel,index)=>{
  const ads=links.filter(link=>link.channelId===channel.id);
  return `${index+1}. ${line(channel.name)}\n${ads.length?ads.map(ad=>`${ad.label?.trim()?line(ad.label)+': ':''}${ad.url}`).join('\n'):'N/A'}`;
 });
 return [`*${title}*`,priceLine(listing.askingPrice),`LISTER\nNAME : ${line(listing.pm)}\nTEL : ${line(listing.noTel)}`,...sections].filter(Boolean).join('\n\n');
}
