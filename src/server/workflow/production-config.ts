import {readFile} from 'node:fs/promises';
import {parse} from 'dotenv';
import type {CopyOptions} from './production-renderer';
/** Local preview reads only the AI settings, never the production database configuration. */
export async function localProductionConfig():Promise<CopyOptions>{
  let saved:Record<string,string>={};
  try{saved=parse(await readFile('.env.ai'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  return {apiKey:process.env.OPENAI_API_KEY||saved.OPENAI_API_KEY,model:process.env.OPENAI_COPY_MODEL||saved.OPENAI_COPY_MODEL||'gpt-4.1-mini'};
}
