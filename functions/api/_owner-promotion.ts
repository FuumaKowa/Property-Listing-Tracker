// Runs in the same SQL statement as the owner mutation: failures roll back both.
// Category visibility follows owner status. Restoring keeps contacts, notes,
// publications and creator attribution; a source link still prevents duplicates.
export function ownerPromotionCtes(actor: string, name: string, transitionOnly: boolean) {
 const transition = transitionOnly ? "AND o.status IS DISTINCT FROM 'Listed'" : '';
 return `, category_before AS MATERIALIZED (
 SELECT l.* FROM listings l JOIN changed c ON c.id=l.source_owner_listing_id
 ${transitionOnly ? 'JOIN old o ON o.id=c.id' : ''}
 WHERE c.status<>'Listed' OR (c.status='Listed' ${transition})
 FOR UPDATE OF l
 ), withdrawn AS (
 UPDATE listings l SET archived_at=now(),archived_by_name=${name},version=l.version+1,
 updated_by_user_id=${actor}::text,updated_by_name=${name},last_updated_at=now()
 FROM category_before b JOIN changed c ON c.id=b.source_owner_listing_id
 WHERE l.id=b.id AND c.status<>'Listed' AND l.archived_at IS NULL RETURNING l.*
 ), withdrawal_audit AS (
 INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name)
 SELECT w.id,'archive',jsonb_build_object('before',to_jsonb(b),'after',to_jsonb(w))::text,${actor}::text,${name}
 FROM withdrawn w JOIN category_before b ON b.id=w.id
 ), promoted AS (
 INSERT INTO listings(source_owner_listing_id,property,project_category,location,tenure,pm,negotiator,agent,no_tel,available_units,status,date,renew_status,notes,created_by_user_id,created_by_name,updated_by_user_id,updated_by_name,last_updated_at)
 SELECT c.id,c.property_name,CASE c.transaction_type WHEN 'rent' THEN 'Rental' ELSE 'Subsale Direct Listing (SSDL)' END,
 coalesce(nullif(trim(c.location),''),'Location not provided'),coalesce(nullif(c.tenure,''),'-'),coalesce(c.assigned_agent_name,${name}),
 coalesce(c.assigned_agent_name,${name}),c.owner_name,c.no_tel,'1','Active','','Not Renewed',
 concat_ws(E'\\n','Owner: '||c.owner_name,'Price: RM '||c.property_price::text,'Property type: '||c.property_type,
 'Original post: '||nullif(c.property_link,''),'Size: '||c.size,'Bedrooms: '||c.bedrooms::text,'Bathrooms: '||c.bathrooms::text),
 ${actor}::text,${name},${actor}::text,${name},now()
 FROM changed c ${transitionOnly ? 'JOIN old o ON o.id=c.id' : ''}
 LEFT JOIN category_before b ON b.source_owner_listing_id=c.id
 WHERE c.status='Listed' AND c.transaction_type IN ('rent','sale') ${transition}
 AND (b.id IS NULL OR b.archived_at IS NOT NULL)
 ON CONFLICT (source_owner_listing_id) DO UPDATE SET archived_at=NULL,archived_by_name=NULL,
 version=listings.version+1,updated_by_user_id=${actor}::text,updated_by_name=${name},last_updated_at=now()
 WHERE listings.archived_at IS NOT NULL RETURNING *
 ), promotion_audit AS (
 INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name)
 SELECT p.id,CASE WHEN b.id IS NULL THEN 'create' ELSE 'restore' END,
 jsonb_build_object('before',to_jsonb(b),'after',to_jsonb(p))::text,${actor}::text,${name}
 FROM promoted p LEFT JOIN category_before b ON b.id=p.id
 )`;
}
