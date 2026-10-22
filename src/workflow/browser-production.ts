import {DEFAULT_POSTER_CONTACT,POSTER_TEMPLATES,type PosterTemplateId} from './production';

export interface BrowserProductionBrief {
  category:string;property:string;location:string;price:string;reference:string;details:string;
}
export interface BrowserPosterOutput {file:File;title:string}

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const propertyFacts=(details:string)=>details.split(/\r?\n/).map(line=>line.replace(/^[-•*\s]+/,'').trim()).filter(Boolean).slice(0,6);
const categoryLabel=(category:string)=>category==='Rental'?'FOR RENT':category==='Subsale'?'FOR SALE':'PROPERTY';
const safeSlug=(value:string)=>value.normalize('NFKD').replace(/[^\w-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'property';

function fitLines(ctx:CanvasRenderingContext2D,text:string,maxWidth:number,maxLines:number,maxSize:number,minSize=16){
  let size=maxSize,rows:string[]=[];
  while(size>minSize){
    ctx.font=`700 ${size}px Arial, sans-serif`;rows=[];
    for(const paragraph of text.split(/\s*\n\s*/)){
      let line='';for(const word of paragraph.split(/\s+/)){const next=line?`${line} ${word}`:word;if(line&&ctx.measureText(next).width>maxWidth){rows.push(line);line=word;}else line=next;}if(line)rows.push(line);
    }
    if(rows.length<=maxLines)break;size-=2;
  }
  if(rows.length>maxLines){rows=rows.slice(0,maxLines);let last=rows[maxLines-1]||'';ctx.font=`700 ${size}px Arial, sans-serif`;while(last&&ctx.measureText(`${last}…`).width>maxWidth)last=last.slice(0,-1);rows[maxLines-1]=last?`${last.trimEnd()}…`:'';}
  return {size,rows};
}

function roundedRect(ctx:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,radius:number,color:string){
  ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,width,height,radius);ctx.fill();
}
type DecodedImage={width:number;height:number;source:CanvasImageSource;close?:()=>void};
function drawCover(ctx:CanvasRenderingContext2D,image:DecodedImage,x:number,y:number,width:number,height:number){
  const scale=Math.max(width/image.width,height/image.height),sw=width/scale,sh=height/scale,sx=(image.width-sw)/2,sy=(image.height-sh)/2;
  ctx.drawImage(image.source,sx,sy,sw,sh,x,y,width,height);
}
async function decodePhoto(photo:Blob):Promise<DecodedImage>{
  const url=URL.createObjectURL(photo);
  try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight,source:image});image.onerror=()=>reject(new Error('A source photo could not be decoded.'));image.src=url;});}
  finally{URL.revokeObjectURL(url);}
}
function text(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,size:number,color:string,weight=400,maxWidth?:number){
  ctx.font=`${weight} ${size}px Arial, sans-serif`;ctx.fillStyle=color;ctx.textBaseline='alphabetic';ctx.fillText(value,x,y,maxWidth);
}

async function renderOne(brief:BrowserProductionBrief,images:DecodedImage[],template:PosterTemplateId,width:number,height:number){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser cannot create posters. Try the latest version of Edge or Chrome.');
  const margin=Math.round(width*.045),gutter=Math.max(6,Math.round(width*.012)),square=width===height,navy=template==='laman-seri-premium',editorial=template==='tangerine-editorial';
  const colors=navy?{paper:'#0b2d50',ink:'#ffffff',muted:'#e4e8ef',accent:'#d8b766',priceInk:'#0b2d50'}:editorial?{paper:'#f7f2ec',ink:'#29231f',muted:'#635b53',accent:'#927a68',priceInk:'#ffffff'}:{paper:'#f5f5ef',ink:'#ffffff',muted:'#ffffff',accent:'#53634e',priceInk:'#ffffff'};
  ctx.fillStyle=colors.paper;ctx.fillRect(0,0,width,height);
  const footerFraction=square?.28:.20,footerTop=Math.round(height*(1-footerFraction)),thumbCount=Math.min(3,Math.max(0,images.length-1)),heroFraction=editorial?(square?.36:.39):navy?(square?.50:.58):(square?.50:.60),headerFraction=editorial?.29:0;
  const stripFraction=thumbCount?(editorial?.13:navy?(square?.22:.21):(square?.22:.20)):0,heroTop=Math.round(height*headerFraction),stripHeight=Math.round(height*stripFraction),stripTop=footerTop-stripHeight,heroHeight=thumbCount?Math.round(height*heroFraction):footerTop-heroTop;
  if(images[0])drawCover(ctx,images[0],0,heroTop,width,heroHeight);
  if(thumbCount){
    const pad=navy?margin:0,innerWidth=width-pad*2,gap=navy?gutter:Math.max(3,Math.round(width*.006)),cellWidth=(innerWidth-gap*(thumbCount-1))/thumbCount;
    for(let index=0;index<thumbCount;index++)drawCover(ctx,images[index+1],pad+index*(cellWidth+gap),stripTop,index===thumbCount-1?width-pad-(pad+index*(cellWidth+gap)):cellWidth,stripHeight);
  }
  const category=categoryLabel(brief.category),property=fitLines(ctx,brief.property,width-margin*2,2,width*.073),location=fitLines(ctx,brief.location,width-margin*2,2,width*.031),priceText=fitLines(ctx,brief.price,width*.55,1,width*.051);
  if(editorial){
    ctx.fillStyle=colors.paper;ctx.fillRect(0,0,width,heroTop);
    const categoryY=Math.round(height*.073),titleY=Math.round(height*.145),titleLine=Math.round(property.size*1.04),locationY=titleY+property.rows.length*titleLine+Math.round(height*.018),priceY=Math.max(Math.round(height*.255),locationY+location.rows.length*location.size+Math.round(height*.02)),priceH=Math.round(height*.058),priceW=Math.min(width-margin*2,Math.max(Math.round(width*.38),Math.round((priceText.rows[0]||brief.price).length*priceText.size*.62+width*.055)));
    text(ctx,category,margin,categoryY,Math.round(width*.026),colors.accent,800);property.rows.forEach((line,index)=>text(ctx,line,margin,titleY+index*titleLine,property.size,colors.ink,700));location.rows.forEach((line,index)=>text(ctx,line,margin,locationY+index*location.size,location.size,colors.ink,500));
    roundedRect(ctx,margin,priceY,priceW,priceH,Math.round(width*.012),colors.accent);text(ctx,priceText.rows[0]||brief.price,margin+Math.round(width*.02),priceY+Math.round(priceH*.68),priceText.size,colors.priceInk,700);
  }else{
    const shade=navy?'#071d38':'#13231b',gradient=ctx.createLinearGradient(0,heroTop,0,heroTop+heroHeight);gradient.addColorStop(0,`${shade}dd`);gradient.addColorStop(.72,`${shade}55`);gradient.addColorStop(1,`${shade}00`);ctx.fillStyle=gradient;ctx.fillRect(0,heroTop,width,heroHeight);
    const boxX=margin,boxY=Math.round(height*.045),boxW=Math.min(width*.64,Math.round(width*.58)),categoryY=Math.round(height*.09),titleY=Math.round(height*.18),titleLine=Math.round(property.size*1.04),locationY=titleY+property.rows.length*titleLine+Math.round(height*.016),priceY=locationY+location.size+Math.round(height*.032),priceH=Math.round(height*.058),priceW=Math.min(width*.62,Math.max(width*.30,Math.round((priceText.rows[0]||brief.price).length*priceText.size*.62+width*.045))),boxH=Math.min(heroHeight-Math.round(height*.06),Math.max(Math.round(height*.31),priceY+priceH-boxY+Math.round(height*.035)));
    if(!navy)roundedRect(ctx,boxX,boxY,boxW,boxH,Math.round(width*.018),'rgba(41,67,56,.86)');
    const inX=boxX+Math.round(width*.022);text(ctx,category,inX,categoryY,Math.round(width*.026),navy?colors.accent:'#c4d9cc',800);property.rows.forEach((line,index)=>text(ctx,line,inX,titleY+index*titleLine,property.size,colors.ink,700));location.rows.forEach((line,index)=>text(ctx,line,inX,locationY+index*location.size,location.size,colors.muted,500));
    roundedRect(ctx,inX,priceY,priceW,priceH,Math.round(width*.012),navy?colors.accent:colors.paper);text(ctx,priceText.rows[0]||brief.price,inX+Math.round(width*.018),priceY+Math.round(priceH*.68),priceText.size,navy?colors.paper:'#26392e',800);
  }
  const footerHeight=height-footerTop,ctaHeight=Math.round(footerHeight*.25),detailsTop=footerTop+Math.round(footerHeight*.10),facts=propertyFacts(brief.details),columnWidth=(width-margin*2)/2,footerPaper=navy?'#f3f0e7':colors.paper,footerInk=navy?'#173653':editorial?'#29231f':'#26392e',ctaFill=navy?'#0b2d50':editorial?'#403b37':'#35473a',ctaAccent=navy?'#d8b766':editorial?'#d7c1ad':'#b5c2aa';
  ctx.fillStyle=footerPaper;ctx.fillRect(0,footerTop,width,footerHeight);
  text(ctx,'PROPERTY DETAILS',margin,detailsTop,Math.round(width*.021),navy?'#92783e':colors.accent,800);
  facts.forEach((fact,index)=>{const column=index%2,row=Math.floor(index/2),x=margin+column*columnWidth,y=detailsTop+Math.round(height*.060)+row*Math.round(height*.042),maxWidth=columnWidth-Math.round(width*.035);ctx.font=`600 ${Math.round(width*.019)}px Arial, sans-serif`;let short=fact;while(short&&ctx.measureText(`${short}…`).width>maxWidth)short=short.slice(0,-1);text(ctx,short===fact?fact:`${short.trimEnd()}…`,x,y,Math.round(width*.019),footerInk,600,maxWidth);});
  const ctaTop=height-ctaHeight;ctx.fillStyle=ctaFill;ctx.fillRect(0,ctaTop,width,ctaHeight);roundedRect(ctx,margin,ctaTop+Math.round(ctaHeight*.20),Math.round(width*.009),Math.round(ctaHeight*.60),3,ctaAccent);
  text(ctx,'FOR VIEWING / DETAILS',margin+Math.round(width*.03),ctaTop+Math.round(ctaHeight*.36),Math.round(width*.014),ctaAccent,700);text(ctx,DEFAULT_POSTER_CONTACT,margin+Math.round(width*.03),ctaTop+Math.round(ctaHeight*.76),Math.round(width*.027),'#ffffff',700,Math.round(width*.64));
  ctx.font=`600 ${Math.round(width*.017)}px Arial, sans-serif`;ctx.textAlign='right';ctx.fillStyle='#ffffff';ctx.fillText(brief.reference,width-margin,ctaTop+Math.round(ctaHeight*.64),width*.28);ctx.textAlign='left';
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('The browser could not export this poster.')),'image/jpeg',.91));
  const name=`${square?'square':'portrait'}-poster-${safeSlug(brief.property)}.jpg`,title=`${square?'Square':'Portrait'} poster · ${POSTER_TEMPLATES.find(item=>item.id===template)!.name}`;
  return {file:new File([blob],name,{type:'image/jpeg'}),title};
}

/** Render locally in Pages' browser, with no image-generation API or server-side worker. */
export async function renderPosterTemplates(brief:BrowserProductionBrief,photos:Blob[],template:PosterTemplateId):Promise<BrowserPosterOutput[]>{
  if(!photos.length)throw new Error('Upload at least one original photo before generating posters.');
  if(photos.length>12)throw new Error('Use up to 12 original photos.');
  if(!photos.every(photo=>photo.type.startsWith('image/')&&photo.size>0&&photo.size<=30*1024*1024))throw new Error('Choose valid image files up to 30 MB each.');
  if(!POSTER_TEMPLATES.some(item=>item.id===template))throw new Error('Choose a supported poster style.');
  const images:DecodedImage[]=[];
  try{
    for(const photo of photos.slice(0,4)){
      const image=await decodePhoto(photo);
      if(image.width*image.height>40_000_000)throw new Error('A source photo is too large to process safely. Use a smaller image.');images.push(image);
    }
    const results:BrowserPosterOutput[]=[];
    for(const [width,height] of [[1080,1440],[1080,1080]] as const)results.push(await renderOne(brief,images,template,width,height));
    return results;
  }finally{for(const image of images)image.close?.();}
}

/** Deterministic copy template: includes only supplied public facts, never owner contact details. */
export function createMarketingCopy(brief:BrowserProductionBrief):string[]{
  const heading=`${categoryLabel(brief.category)} | ${brief.property}`,facts=propertyFacts(brief.details),opening='Arrange a viewing',closing='Contact our team for details.';
  const full=[heading,brief.location,brief.price,'',opening,...facts.map(fact=>`• ${fact}`),'',closing,`REF: ${brief.reference}`].filter((line,index)=>line||index===3).join('\n');
  const short=[heading,brief.price,brief.location,'',...facts.slice(0,4).map(fact=>`• ${fact}`),'',closing,`REF: ${brief.reference}`].join('\n');
  const whatsapp=[`*${heading}*`,brief.price,brief.location,...facts.slice(0,6).map(fact=>`• ${fact}`),closing,`REF: ${brief.reference}`].join('\n');
  return [full,short,whatsapp];
}
