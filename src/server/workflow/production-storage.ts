import {randomUUID} from 'node:crypto';
import type {WorkflowBucket} from '../../../functions/api/_workflow';
import type {ProductionStorage} from './production-runner';
export function bucketProductionStorage(bucket:WorkflowBucket):ProductionStorage{
  return {
    read:async(w,key)=>{const object=await bucket.get(`${w.id}/${key}`);if(!object||object.size>30*1024*1024)throw new Error('Source photo missing or too large.');return Buffer.from(await new Response(object.body).arrayBuffer());},
    put:async(w,data,extension,mime)=>{
      const key=randomUUID()+'.'+extension,objectKey=`${w.id}/${key}`;
      try{await bucket.put(objectKey,data,{httpMetadata:{contentType:mime}});return key;}
      catch(error){await bucket.delete(objectKey).catch(()=>{});throw error;}
    },
    remove:async(w,key)=>{await bucket.delete(`${w.id}/${key}`);},
  };
}
