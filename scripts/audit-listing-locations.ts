import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {config} from 'dotenv';
import {Pool} from 'pg';
import {planListingLocationRepairs} from '../src/listingLocationAudit';
config({quiet:true});
const pool=new Pool({connectionString:process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL||process.env.NEON_DATABASE_URL});
const apply=process.argv.includes('--apply');
try{
 const before=(await pool.query('SELECT * FROM listings ORDER BY id')).rows;
 const reportRows=(await pool.query("SELECT DISTINCT ON(listing_id) listing_id,changed_fields::jsonb->>'reportText' AS report FROM listing_audit_logs WHERE action='listing_report' ORDER BY listing_id,id DESC")).rows;
 const ownerLocations=(await pool.query("SELECT DISTINCT location FROM owner_listings WHERE location IS NOT NULL AND trim(location)<>''")).rows;
 const ownerHash=(await pool.query("SELECT count(*)::int AS count,md5(coalesce(string_agg(to_jsonb(o)::text,'' ORDER BY id),'')) AS hash FROM owner_listings o")).rows[0];
 const ads=(await pool.query('SELECT * FROM listing_publications ORDER BY id')).rows;
 const plan=planListingLocationRepairs(before.map(row=>({...row,reportText:reportRows.find(r=>r.listing_id===row.id)?.report})),[...before.map(r=>r.location||''),...ownerLocations.map(r=>r.location)]);
 console.log(JSON.stringify({mode:apply?'apply':'dry run',ownersChecked:ownerHash.count,...plan}));
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');mkdirSync('.server/location-audits',{recursive:true});
 writeFileSync(`.server/location-audits/${stamp}-plan.json`,JSON.stringify(plan,null,2));
 if(apply&&plan.repairs.length){
  const client=await pool.connect();try{
   await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='8s'");
   for(const repair of plan.repairs){
    const updated=await client.query(`WITH old AS MATERIALIZED(SELECT * FROM listings WHERE id=$1 FOR UPDATE),changed AS(
     UPDATE listings l SET property=$3,location=$4,version=l.version+1,updated_by_user_id=NULL,updated_by_name='System location audit',last_updated_at=now()
     FROM old o WHERE l.id=o.id AND l.version=$2 AND o.version=$2 AND l.property=$5 AND l.location IS NOT DISTINCT FROM $6 RETURNING l.*),audit AS(
     INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_name)
     SELECT c.id,'update',jsonb_build_object('before',to_jsonb(o),'after',to_jsonb(c),'reason','Location and report-heading audit')::text,'System location audit' FROM changed c JOIN old o ON o.id=c.id)
     SELECT id FROM changed`,[repair.id,repair.version,repair.after.property,repair.after.location,repair.before.property,repair.before.location]);
    assert.equal(updated.rowCount,1,'A listing changed during the audit; no repairs will be applied.');
   }
   await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 const after=(await pool.query('SELECT * FROM listings ORDER BY id')).rows;assert.equal(after.length,before.length);
 for(const row of after){const old=before.find(o=>o.id===row.id),repair=apply?plan.repairs.find(r=>r.id===row.id):undefined;
  if(!repair){assert.deepEqual(row,old);continue;}
  assert.equal(row.location,repair.after.location);assert.equal(row.property,repair.after.property);
  for(const key of Object.keys(old))if(!['property','location','version','updated_by_user_id','updated_by_name','last_updated_at'].includes(key))assert.deepEqual(row[key],old[key],`Unexpected ${key} change`);
 }
 assert.deepEqual((await pool.query('SELECT * FROM listing_publications ORDER BY id')).rows,ads,'Advertisements changed');
 assert.deepEqual((await pool.query("SELECT count(*)::int AS count,md5(coalesce(string_agg(to_jsonb(o)::text,'' ORDER BY id),'')) AS hash FROM owner_listings o")).rows[0],ownerHash,'Owner records changed');
 console.log(JSON.stringify({checked:plan.checked,ownersChecked:ownerHash.count,repaired:apply?plan.repairs.length:0,needsManualReview:plan.unresolved,otherListingFields:'preserved',ads:'preserved',owners:'preserved'}));
}catch(error){console.error(error instanceof assert.AssertionError?error.message.split('\n')[0]:'Location audit failed; no credentials logged. Inspect private audit artifacts.');process.exitCode=1;}finally{await pool.end();}
