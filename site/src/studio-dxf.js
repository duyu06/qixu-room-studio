// Safe small ASCII DXF LINE/LWPOLYLINE importer, no arbitrary scripts or XREF URLs.
// Requires an explicit or CAD-recorded unit; rejects unsupported arc/bulge geometry.
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
      current=['LINE','LWPOLYLINE'].includes(value)?{type:value,data:[]}:null;
    }else if(current)current.data.push([code,value]);
  }
  if(current)entities.push(current);
  const unitFromFile={1:'inch',2:'ft',4:'mm',5:'cm',6:'m'}[variables.insunits];
  const resolved=unit==='auto'?unitFromFile:unit;
  if(!resolved||!FACTORS[resolved])throw Error('DXF 没有可识别的图纸单位，请选择毫米、厘米或米后重试');
  const factor=FACTORS[resolved],segments=[];
  for(const entity of entities){
    const d=entity.data;
    if(entity.type==='LINE'){
      const n=k=>Number(d.find(([a])=>a===k)?.[1]);
      const coords=[n('10'),n('20'),n('11'),n('21')];
      if(coords.every(Number.isFinite))segments.push(coords);
    }else if(entity.type==='LWPOLYLINE'){
      const vertices=[],flag=Number(d.find(([k])=>k==='70')?.[1]||0);
      for(const [code,value]of d){
        if(code==='42'&&Math.abs(Number(value))>1e-8)throw Error('当前 DXF 导入不支持弧形 bulge 墙线，请在 CAD 中转为直线');
        if(code==='10')vertices.push([Number(value),NaN]);
        if(code==='20'&&vertices.length)vertices[vertices.length-1][1]=Number(value);
      }
      for(let i=1;i<vertices.length;i++)if(vertices[i].every(Number.isFinite)&&vertices[i-1].every(Number.isFinite))
        segments.push([...vertices[i-1],...vertices[i]]);
      if((flag&1)&&vertices.length>2)segments.push([...vertices.at(-1),...vertices[0]]);
    }
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
      a:[Number((s[0]*factor-mx).toFixed(4)),Number((my-s[1]*factor).toFixed(4))],
      b:[Number((s[2]*factor-mx).toFixed(4)),Number((my-s[3]*factor).toFixed(4))]}));
  if(!doc.walls.length)throw Error('有效墙线为空');
  return {project:doc,units:resolved,wallCount:doc.walls.length};
}
export function exportDxf(doc){
  const out=['0','SECTION','2','HEADER','9','$INSUNITS','70','6','0','ENDSEC','0','SECTION','2','ENTITIES'];
  for(const w of doc.walls){
    out.push('0','LINE','8','QIXU_WALLS','10',String(w.a[0]),'20',String(-w.a[1]),
      '11',String(w.b[0]),'21',String(-w.b[1]));
  }
  out.push('0','ENDSEC','0','EOF');return out.join('\n')+'\n';
}
