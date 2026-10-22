import {handleIclickWorkspace,type IclickWorkspaceEnv} from '../_iclick-workspace';
type Context={request:Request;env:IclickWorkspaceEnv};
export const onRequest=(context:Context)=>handleIclickWorkspace(context);
