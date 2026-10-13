// Runs in the same SQL statement as the owner mutation: failures roll back both.
// The unique source link also covers repeated saves and concurrent requests.
export function ownerPromotionCtes(actor: string, name: string, transitionOnly: boolean) {
 return `, promoted AS (
 INSERT INTO listings(source_owner_listing_id,property,project_category,location,tenure,pm,negotiator,agent,no_tel,available_units,status,date,renew_status,notes,created_by_user_id,created_by_name,updated_by_user_id,updated_by_name,last_updated_at)
 SELECT c.id,c.property_name,CASE c.transaction_type WHEN 'rent' THEN 'Rental' ELSE 'Subsale Direct Listing (SSDL)' END,
 coalesce(nullif(trim(c.location),''),'Location not provided'),coalesce(nullif(c.tenure,''),'-'),coalesce(c.assigned_agent_name,${name}),
 coalesce(c.assigned_agent_name,${name}),c.owner_name,c.no_tel,'1','Active','','Not Renewed',
 concat_ws(E'\\n','Owner: '||c.owner_name,'Price: RM '||c.property_price::text,'Property type: '||c.property_type,
 'Original post: '||nullif(c.property_link,''),'Size: '||c.size,'Bedrooms: '||c.bedrooms::text,'Bathrooms: '||c.bathrooms::text),
 ${actor}::text,${name},${actor}::text,${name},now()
 FROM changed c ${transitionOnly ? 'JOIN old o ON o.id=c.id' : ''}
 WHERE c.status='Listed' AND c.transaction_type IN ('rent','sale') ${transitionOnly ? "AND o.status IS DISTINCT FROM 'Listed'" : ''}
 ON CONFLICT (source_owner_listing_id) DO NOTHING RETURNING *
 ), promotion_audit AS (
 INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name)
 SELECT id,'create',jsonb_build_object('before',NULL,'after',to_jsonb(promoted))::text,${actor}::text,${name} FROM promoted
 )`;
}
