import {createWorkflow,applyWorkflowAction,type WorkflowUser,type Brief} from './model';
export const previewUsers:WorkflowUser[]=[
  {id:1,name:'Daniel',role:'super_admin'},{id:2,name:'Eypa',role:'coordinator'},
  {id:3,name:'Luqman',role:'producer'},{id:4,name:'Dr Shahril',role:'reviewer'},{id:5,name:'Muz',role:'publisher'},
];
export function seedWorkflow(){
  const context={actual:previewUsers[0],effective:previewUsers[0]};
  const brief:Brief={reference:'WTS-202610-90001',property:'Sample Palm Estate',location:'Sungai Besar, Selangor',category:'Subsale',ownerName:'Sample owner',phone:'Sample contact',whatsapp:'',sourceUrl:'https://example.com/sample-property',price:'RM500,000',details:'Fictional property for trying the workflow.\nLand area: 1.6 acres\nPrice and details are sample data.',raw:'',permission:true,tasks:[]};
  const first=createWorkflow(brief,context);first.id='sample-estate';
  let second=createWorkflow({...brief,reference:'WTL-202610-90002',property:'Sample Jelutong Suites',location:'Bukit Jelutong, Shah Alam',category:'Rental',price:'RM2,850'},context);second.id='sample-suites';
  second=applyWorkflowAction(second,{type:'handoff'},context);
  second=applyWorkflowAction(second,{type:'addMaterial',kind:'photo',title:'Sample property visual',fileKey:'sample-photo.png',mime:'image/png'},context);
  second=applyWorkflowAction(second,{type:'addMaterial',kind:'copy',title:'Rental caption',text:'FOR RENT | Sample Jelutong Suites\nBukit Jelutong, Shah Alam • RM2,850\nFictional listing for testing the approval workflow.'},context);
  const ids=second.materials.map(m=>m.id);
  second=applyWorkflowAction(second,{type:'submit',ids},context);
  second=applyWorkflowAction(second,{type:'approveForPublishing',channelIds:['facebook-page','telegram-subsale','tiktok'],materialIds:ids},context);
  return [first,second];
}
