import {createDatabaseWorkflowRouter} from '../src/server/workflow/express';
import type {WorkflowBucket} from '../functions/api/_workflow';
import type {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
export async function databaseWorkflowPreview(pg:PGlite){
 await pg.exec("CREATE TABLE auth_sessions(session_token_hash text UNIQUE,user_id int,expires_at timestamp);UPDATE auth_users SET username=CASE id WHEN 1 THEN 'admin' WHEN 2 THEN 'Eypa' WHEN 3 THEN 'Luqman' WHEN 4 THEN 'drshahril74' WHEN 5 THEN 'Muz' ELSE username END,display_name=CASE id WHEN 1 THEN 'Daniel' WHEN 2 THEN 'Eypa' WHEN 3 THEN 'Luqman' WHEN 4 THEN 'Dr Shahril' WHEN 5 THEN 'Muz' ELSE display_name END");
 await pg.exec(readFileSync('drizzle/0012_marketing_workflow.sql','utf8'));
 const token='workflow-database-preview',hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
 await pg.query("INSERT INTO auth_sessions VALUES($1,1,now()+interval '1 day')",[hash]);
 const files=new Map<string,Uint8Array>();
 const bucket:WorkflowBucket={put:async(key,data)=>{files.set(key,data);},get:async key=>{const data=files.get(key);return data?{body:new Blob([data as Uint8Array<ArrayBuffer>]).stream(),size:data.length}:null;},delete:async key=>{files.delete(key);}};
 const router=createDatabaseWorkflowRouter(()=>({DATABASE_URL:'synthetic-only',WORKFLOW_MEDIA:bucket}),{authenticate:async()=>({id:1,username:'admin',displayName:'Daniel',role:'super_admin'}),connect:()=>({query:async(sql,params)=>(await pg.query(sql,params)).rows}),transact:()=>fn=>pg.transaction(tx=>fn({query:async(sql,params)=>(await tx.query(sql,params)).rows}))});
 return {router,token};
}
