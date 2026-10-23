// Safe bounded ASCII DXF line, polyline and tessellated arc importer.
// Requires an explicit or CAD-recorded unit; no scripts or XREF URLs.
import {createProject} from './studio-model.js';
const FACTORS={mm:.001,cm:.01,m:1,inch:.0254,ft:.3048};
export function parseDxf(text,unit='auto'){
  if(typeof text!=='string'||text.length>5_000_000||text.includes('\0'))throw Error('只支持 5MB 内的文本 DXF 文件');
  const lines=text.replace(/\r/g,'').split('\n'),pairs=[];
  for(let i=0;i+1<lines.length;i+=2)pairs.push([lines[i].trim(),lines[i+1].trim()]);
  const variables={};let section='',current=null,entities=[],type='';
  let inHeader=false;
  for(let i=0;i<pairs.length;i++){
    const [code,value]=pairs[i];
    if(code==='0'&&value==='SECTION'){section='';continue;}
    if(code==='2'&&!section){section=value;continue;}
    if(code==='0'&&value==='ENDSEC'){if(current)entities.push(current);current=null;section='';continue;}
    if(section==='HEADER'){
      if(code==='9'&&value==='$INSUNITS'){
        const item=pairs[i+1];if(item&&['70','280'].includes(item[0]))variables.insunits=Number(item[1]);
      }
    }
    if(section!=='ENTITIES')continue;
    if(code==='0'){
      if(current)entities.push(current);
      current=['LINE','LWPOLYLINE','ARC'].includes(value)?{type:value,data:[]}:null;
    }else if(current)current.data.push([code,value]);
  }
  if(current)entities.push(current);
  const unitFromFile={1:'inch',2:'ft',4:'mm',5:'cm',6:'m'}[variables.insunits];
  const resolved=unit==='auto'?unitFromFile:unit;
  if(!resolved||!FACTORS[resolved])throw Error('DXF 没有可识别的图纸单位，请选择毫米、厘米或米后重试');
  const factor=FACTORS[resolved],segments=[];
  const emit=(a,b,layer)=>{if(a.every(Number.isFinite)&&b.every(Number.isFinite)&&Math.hypot(b[0]-a[0],b[1]-a[1])>1e-8)
    segments.push([a[0],a[1],b[0],b[1],layer]);};
  const tessellate=(a,b,bulge,layer)=>{
   if(!bulge){emit(a,b,layer);return;}
   const theta=4*Math.atan(bulge),chord=Math.hypot(b[0]-a[0],b[1]-a[1]);
   if(chord<1e-8)return;
   const radius=chord/(2*Math.sin(Math.abs(theta)/2));
   const midpoint=[(a[0]+b[0])/2,(a[1]+b[1])/2];
   const sign=Math.sign(bulge),offset=chord/(2*Math.tan(theta/2));
   const center=[midpoint[0]-(b[1]-a[1])/chord*offset,midpoint[1]+(b[0]-a[0])/chord*offset];
   const startAngle=Math.atan2(a[1]-center[1],a[0]-center[0]);
   const count=Math.min(128,Math.max(2,Math.ceil(Math.abs(theta)*Math.max(1,radius*factor)/.22)));
   let prev=a;
   for(let j=1;j<=count;j++){
     const angle=startAngle+theta*j/count;
     const point=j===count?b:[center[0]+radius*Math.cos(angle),center[1]+radius*Math.sin(angle)];
     emit(prev,point,layer);prev=point;
   }
  };
  for(const entity of entities){
    const d=entity.data,layer=d.find(([a])=>a==='8')?.[1]||'0';
    if(entity.type==='LINE'){
      const n=k=>Number(d.find(([a])=>a===k)?.[1]);
      emit([n('10'),n('20')],[n('11'),n('21')],layer);
    }else if(entity.type==='ARC'){
      const n=k=>Number(d.find(([a])=>a===k)?.[1]);
      const cx=n('10'),cy=n('20'),radius=n('40'),start=n('50')*Math.PI/180,end=n('51')*Math.PI/180;
      if(![cx,cy,radius,start,end].every(Number.isFinite)||radius<=0)continue;
      const sweep=((end-start)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
      const steps=Math.min(128,Math.max(2,Math.ceil(sweep*Math.max(1,radius*factor)/.22)));
      let last=[cx+radius*Math.cos(start),cy+radius*Math.sin(start)];
      for(let j=1;j<=steps;j++){
        const t=start+sweep*j/steps,next=[cx+radius*Math.cos(t),cy+radius*Math.sin(t)];
        emit(last,next,layer);last=next;
      }
    }else if(entity.type==='LWPOLYLINE'){
      const vertices=[],flag=Number(d.find(([k])=>k==='70')?.[1]||0);
      for(const [code,value]of d){
        if(code==='10')vertices.push({point:[Number(value),NaN],bulge:0});
        if(code==='20'&&vertices.length)vertices.at(-1).point[1]=Number(value);
        if(code==='42'&&vertices.length)vertices.at(-1).bulge=Number(value);
      }
      for(let i=1;i<vertices.length;i++)tessellate(vertices[i-1].point,vertices[i].point,vertices[i-1].bulge,layer);
      if((flag&1)&&vertices.length>2)tessellate(vertices.at(-1).point,vertices[0].point,vertices.at(-1).bulge,layer);
    }
    if(segments.length>650)throw Error('DXF 墙段超过 650，请先清理图层后导入');
  }
  if(segments.length===0)throw Error('没有找到 LINE / LWPOLYLINE 墙线。请选择包含直线墙体的 ASCII DXF');
  if(segments.length>650)throw Error('DXF 墙段超过 650，请先清理图层后导入');
  const coords=segments.flatMap(s=>[[s[0]*factor,s[1]*factor],[s[2]*factor,s[3]*factor]]);
  const minX=Math.min(...coords.map(p=>p[0])),maxX=Math.max(...coords.map(p=>p[0]));
  const minY=Math.min(...coords.map(p=>p[1])),maxY=Math.max(...coords.map(p=>p[1]));
  const width=maxX-minX,depth=maxY-minY;
  if(width<.25||depth<.25||width>98||depth>98)throw Error('DXF 范围超出当前支持的 0.25–98 米，请检查所选单位');
  const doc=createProject();doc.title='导入的 DXF 户型';
  doc.width=Math.max(3,Math.ceil((width+1.5)*10)/10);
  doc.depth=Math.max(3,Math.ceil((depth+1.5)*10)/10);
  doc.openings=[];doc.furniture=[];doc.reference=null;
  const mx=(minX+maxX)/2,my=(minY+maxY)/2;
  doc.walls=segments.filter(s=>Math.hypot((s[2]-s[0])*factor,(s[3]-s[1])*factor)>.15)
    .map(s=>({id:'dxf-'+Math.random().toString(36).slice(2,9),
      layer:s[4],a:[Number((s[0]*factor-mx).toFixed(4)),Number((my-s[1]*factor).toFixed(4))],
      b:[Number((s[2]*factor-mx).toFixed(4)),Number((my-s[3]*factor).toFixed(4))]}));
  if(!doc.walls.length)throw Error('有效墙线为空');
  return {project:doc,units:resolved,wallCount:doc.walls.length};
}
export function exportDxf(doc){
  const out=['0','SECTION','2','HEADER','9','$INSUNITS','70','6','0','ENDSEC','0','SECTION','2','ENTITIES'];
  for(const w of doc.walls){
    out.push('0','LINE','8',w.layer||'QIXU_WALLS','10',String(w.a[0]),'20',String(-w.a[1]),
      '11',String(w.b[0]),'21',String(-w.b[1]));
  }
  out.push('0','ENDSEC','0','EOF');return out.join('\n')+'\n';
}
