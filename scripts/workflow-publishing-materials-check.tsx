import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReviewApprovalPanel} from '../src/components/workflow/ReviewApprovalPanel';
import type {WorkflowListing} from '../src/workflow/model';

const listing={
  id:'workflow-materials-test',version:1,handedOffAt:'2026-10-22T00:00:00.000Z',createdAt:'2026-10-22T00:00:00.000Z',updatedAt:'2026-10-22T00:00:00.000Z',
  brief:{reference:'WTS-TEST',property:'Test property',location:'Shah Alam',category:'Subsale',ownerName:'Owner',phone:'0123456789',whatsapp:'',sourceUrl:'',price:'RM500,000',details:'',raw:'',permission:true,tasks:[]},
  assignees:{coordinator:1,producer:2,reviewer:3,publisher:4},destinations:[],events:[],
  materials:[
    {id:'owner-photo',kind:'photo',title:'Owner living room photo',revision:1,original:true,fileKey:'owner.jpg',mime:'image/jpeg',review:'draft',note:'',at:'2026-10-22T00:00:00.000Z',by:'Eypa'},
    {id:'prepared-poster',kind:'poster',title:'Prepared poster',revision:1,original:false,fileKey:'poster.jpg',mime:'image/jpeg',review:'approved',note:'',at:'2026-10-22T00:00:00.000Z',by:'Luqman'},
  ],
} as WorkflowListing;
const user={id:4,name:'Muz',role:'publisher' as const};
const html=renderToStaticMarkup(<ReviewApprovalPanel listing={listing} session={{actual:user,effective:user,csrf:'',users:[],localPreview:false}} busy={false} onAction={async()=>true} onDirty={()=>{}}/>);

assert.match(html,/Owner living room photo/,'Muz should see owner-supplied photos in the materials list');
assert.match(html,/Owner original/,'Owner-supplied assets should be visibly distinguished in the combined list');
assert.match(html,/Prepared poster/,'Prepared materials should remain in the same list');
assert.match(html,/Choose materials/,'The combined list should have a neutral heading');
assert.match(html,/aria-label="Use Owner living room photo"[^>]*disabled/,'Owner originals should remain view-only until prepared for publishing');
console.log('PASS publisher materials show owner originals and prepared materials together with clear labels');
