import type {WorkflowBucket} from '../../../functions/api/_workflow';
import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {FetchHttpHandler} from '@smithy/fetch-http-handler';
import {WorkflowSyncError} from './sync';
interface NeonStorageConfig {endpoint:string;region:string;bucket:string;accessKeyId:string;secretAccessKey:string}
export function neonWorkflowBucket(raw?:string):WorkflowBucket|undefined{
 if(!raw)return undefined;
 let config:NeonStorageConfig;
 try{config=JSON.parse(raw);const url=new URL(config.endpoint);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!/^br-[a-z0-9-]+\.storage\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname)||!/^[a-z0-9-]+$/.test(config.region)||!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket)||!config.accessKeyId||!config.secretAccessKey)throw new Error();
 }catch{throw new WorkflowSyncError('Media storage configuration is invalid. Contact the administrator.',503);}
 // Abort the underlying transfer before cleanup; the SDK's requestTimeout only races fetch.
 const transport=new FetchHttpHandler({customFetch:async(input,init)=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);try{return await fetch(input,{...init,signal:controller.signal});}finally{clearTimeout(timer);}}});
 const client=new S3Client({endpoint:config.endpoint,region:config.region,credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey},forcePathStyle:true,requestHandler:transport,maxAttempts:2,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
 const failure=()=>new WorkflowSyncError('Private media storage is unavailable. Please try again.',503);
 return {
  async put(key,value,options){try{await client.send(new PutObjectCommand({Bucket:config.bucket,Key:key,Body:value,ContentType:options?.httpMetadata.contentType}));}catch{throw failure();}},
  async get(key,options){
   try{const object=await client.send(new GetObjectCommand({Bucket:config.bucket,Key:key,Range:options?.range.get('Range')||undefined}));
    if(!object.Body)throw failure();
    const match=object.ContentRange?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    return {body:object.Body.transformToWebStream(),size:match?Number(match[3]):Number(object.ContentLength),httpMetadata:{contentType:object.ContentType},...(match?{range:{offset:Number(match[1]),length:Number(match[2])-Number(match[1])+1}}:{})};
   }catch(error:any){if(error.name==='NoSuchKey')return null;if(error.$metadata?.httpStatusCode===416)throw new WorkflowSyncError('The requested media range is unavailable.',416);throw failure();}
  },
  async delete(key){try{await client.send(new DeleteObjectCommand({Bucket:config.bucket,Key:key}));}catch{throw failure();}}
 };
}
