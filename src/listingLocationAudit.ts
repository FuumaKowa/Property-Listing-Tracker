import {inferReportLocation,isPendingReportLocation,parseListingReport,reportIdentity,reportPropertyName} from './listingReport';
export interface AuditListing {id:number;property:string;location:string|null;version:number;reportText?:string|null}
export function planListingLocationRepairs(rows:AuditListing[],knownLocations:string[]){
 const repairs:{id:number;version:number;before:{property:string;location:string|null};after:{property:string;location:string|null}}[]=[];
 const unresolved:{id:number;property:string;reason:string}[]=[];
 for(const row of rows){
  const property=reportPropertyName(row.property);let location=row.location;
  if(isPendingReportLocation(location)){
   let detected=inferReportLocation(property,knownLocations);
   if(row.reportText){try{const report=parseListingReport(row.reportText,[],knownLocations);if(reportIdentity(report.property)===reportIdentity(property)&&report.location)detected=report.location;}catch{/* Leave malformed or unrelated reports for manual review. */}}
   if(detected)location=detected;else unresolved.push({id:row.id,property,reason:'No clear location in the property name or saved report.'});
  }
  const cleanHeading=property!==row.property&&/^[*_\s]*(?:FOR\s+(?:RENT|SALE)|WT[SL]|AUCTION|NEW\s+PROJECT)\s*[|:–—-]/i.test(row.property);
  const cleanProperty=cleanHeading?property:row.property;
  if(cleanProperty!==row.property||location!==row.location)repairs.push({id:row.id,version:row.version,before:{property:row.property,location:row.location},after:{property:cleanProperty,location}});
 }
 return {checked:rows.length,repairs,unresolved};
}
