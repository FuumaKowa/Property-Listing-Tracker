import {config} from 'dotenv';
import pg from 'pg';
import {bucketProductionStorage} from '../src/server/workflow/production-storage';
import {DatabaseWorkflowStore,type WorkflowDb} from '../src/server/workflow/database';
import {neonWorkflowBucket} from '../src/server/workflow/neon-storage';
import {ProductionRunner} from '../src/server/workflow/production-runner';
import {localProductionConfig} from '../src/server/workflow/production-config';
// Deliberate standalone entry point: never imported by Cloudflare Pages or the browser.
config({path:'.env.worker',quiet:true});
if(!process.env.DATABASE_URL||!process.env.NEON_STORAGE_CONFIG)throw new Error('Configure DATABASE_URL and NEON_STORAGE_CONFIG for the worker.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:10000,query_timeout:30000});
const db:WorkflowDb={query:async(sql,params)=>(await pool.query(sql,params)).rows};
const transact=async<T>(fn:(db:WorkflowDb)=>Promise<T>)=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await fn({query:async(sql,params)=>(await c.query(sql,params)).rows});await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}};
const store=new DatabaseWorkflowStore(db,transact,[]),bucket=neonWorkflowBucket(process.env.NEON_STORAGE_CONFIG)!;
const runner=new ProductionRunner(store,bucketProductionStorage(bucket),await localProductionConfig());
const timer=setInterval(()=>{void runner.tick().catch(()=>console.error('Production queue unavailable; will retry.'));},5000);
void runner.tick().catch(()=>console.error('Production queue unavailable; will retry.'));
console.log('Production worker running. No advertising platforms are contacted.');
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{clearInterval(timer);void pool.end().then(()=>process.exit(0));});
