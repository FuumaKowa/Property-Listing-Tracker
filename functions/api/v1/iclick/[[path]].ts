import {handleIclick,type IclickEnv} from '../../_iclick';
type Context={request:Request;env:IclickEnv};
export const onRequest=(context:Context)=>handleIclick(context);
