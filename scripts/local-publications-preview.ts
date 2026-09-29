// Local-only integrated preview: synthetic records, disposable database, no dotenv or Neon connection.
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createPublicationsRouter } from '../src/server/publications/express';
import { onRequestPost } from '../functions/api/listings';
import { onRequestPatch } from '../functions/api/listings/[id]';
import { listingColumns } from '../functions/api/_db';
const pg = new PGlite();
await pg.exec(`CREATE TABLE listings(id serial PRIMARY KEY,property text NOT NULL,project_category text,location text,tenure text,pm text,negotiator text,agent text,no_tel text,available_units text,status text,date text,renew_status text,notes text,updated_by_user_id text,updated_by_name text,updated_by_email text,last_updated_at timestamp DEFAULT now(),created_at timestamp DEFAULT now());`);
await pg.exec(readFileSync('drizzle/0001_publication_channels.sql','utf8'));
await pg.exec(readFileSync('drizzle/0002_listing_creator_priority.sql','utf8'));
await pg.exec(`INSERT INTO listings(property,project_category,location,tenure,pm,negotiator,agent,no_tel,available_units,status,date,renew_status,notes,updated_by_name) VALUES
('The Maple Residences','Project Marketing (PM)','Taman Desa, KL','Freehold','Daniel (sample)','Aina (sample)','Legacy contact','Not captured','6','Active','2099-10-18','Want to be renew','Corner unit with a balcony. Fictional preview record.','Preview'),
('18, Jalan Setia Indah','Subsale CoA (SSCOA)','Setia Alam','Freehold','Amir (sample)','Farah (sample)',NULL,'Not captured','1','Sold Out','2020-01-01','Not Renewed','Sold property retained for reference.','Preview'),
('Lakeview Suites','Rental','Cyberjaya','Leasehold','Daniel (sample)','Mei (sample)',NULL,'Not captured','2','Expired','2020-09-20','In Progress','Fully furnished. Sample record.','Preview');
UPDATE listings SET property_guru_repost_date='2099-10-11',property_guru_repost_mode='Auto' WHERE id=1;
INSERT INTO listing_publications(listing_id,channel_id,url,label) VALUES (1,1,'https://example.com/propertyguru/maple','Main advertisement'),(1,2,'https://example.com/mudah/maple','Mudah listing'),(1,3,'https://example.com/telegram/1','September feature'),(1,3,'https://example.com/telegram/2','Viewing announcement'),(1,4,'https://example.com/tiktok/maple','Walkthrough video');`);
const user={id:1,username:'preview',displayName:'Local preview · sample data',role:'super_admin' as const};
const app=express();app.use(express.json());
let failNextSave=false;
app.post('/__preview/fail-next-save',(_req,res)=>{failNextSave=true;res.json({success:true});});
app.use('/api',(req,res,next)=>{if(failNextSave&&['POST','PATCH','DELETE'].includes(req.method)){failNextSave=false;res.status(503).json({success:false,error:'Simulated local preview save failure.'});return;}next();});
app.get('/api/auth/me',(_req,res)=>res.json({authenticated:true,user}));
app.use('/api',createPublicationsRouter(()=>({DATABASE_URL:'local-only'}),{authenticate:async()=>user,connect:()=>({query:async(sql,params)=>(await pg.query<Record<string,unknown>>(sql,params)).rows})}));
app.get('/api/listings',async(_req,res)=>res.json({success:true,data:(await pg.query(`SELECT ${listingColumns} FROM listings ORDER BY id`)).rows}));
const listingServices:any={getSessionUser:async()=>user,getDb:()=>({query:async(sql:string,params:unknown[])=>(await pg.query(sql,params)).rows})};
app.patch('/api/listings/:id',async(req,res)=>{const response=await onRequestPatch({env:{DATABASE_URL:'local-only'},params:{id:req.params.id},request:new Request('http://localhost/api/listings',{method:'PATCH',body:JSON.stringify(req.body)})},listingServices);res.status(response.status).type('application/json').send(await response.text());});
app.post('/api/listings',async(req,res)=>{const response=await onRequestPost({env:{DATABASE_URL:'local-only'},request:new Request('http://localhost/api/listings',{method:'POST',body:JSON.stringify(req.body)})},listingServices);res.status(response.status).type('application/json').send(await response.text());});
app.delete('/api/listings/:id',async(req,res)=>{await pg.query('DELETE FROM listings WHERE id=$1',[Number(req.params.id)]);res.json({success:true});});
app.get(['/api/owner-listings','/api/audit-logs','/api/users'],(_req,res)=>res.json({success:true,data:[]}));
// Explicit envDir prevents Vite loading the application's production .env into this preview.
const vite=await createServer({envDir:'.server/preview-empty-env',server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);
const previewPort = Number(process.env.PREVIEW_PORT || 4176);
app.listen(previewPort,'127.0.0.1',()=>console.log(`Integrated preview: http://127.0.0.1:${previewPort} (synthetic local data only)`));
