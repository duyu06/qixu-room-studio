// Immutable-target group operations over editable furniture records.
export function groupMembers(doc,id){
 const item=doc.furniture.find(f=>f.id===id);
 return item?.groupId?doc.furniture.filter(f=>f.groupId===item.groupId):item?[item]:[];
}
export function rotateFurnitureGroup(doc,ids,angle){
 if(!Number.isFinite(angle))throw Error('旋转角度无效');
 const members=doc.furniture.filter(f=>ids.includes(f.id));
 if(members.length<2)throw Error('请选择至少两件家具');
 const cx=members.reduce((sum,f)=>sum+f.x,0)/members.length;
 const cz=members.reduce((sum,f)=>sum+f.z,0)/members.length;
 const cos=Math.cos(angle),sin=Math.sin(angle);
 const positions=members.map(f=>{
  const dx=f.x-cx,dz=f.z-cz;
  return {f,x:cx+dx*cos-dz*sin,z:cz+dx*sin+dz*cos,rotation:Math.atan2(Math.sin((f.rotation||0)+angle),Math.cos((f.rotation||0)+angle))};
 });
 for(const {f,x,z,rotation} of positions){
  const halfW=(Math.abs(Math.cos(rotation))*f.width+Math.abs(Math.sin(rotation))*f.depth)/2;
  const halfD=(Math.abs(Math.sin(rotation))*f.width+Math.abs(Math.cos(rotation))*f.depth)/2;
  if(Math.abs(x)+halfW>doc.width/2||Math.abs(z)+halfD>doc.depth/2)throw Error('旋转后家具会超出户型边界');
 }
 for(const {f,x,z,rotation} of positions){f.x=x;f.z=z;f.rotation=rotation;}
 return members;
}
export function duplicateFurnitureSelection(doc,ids,makeId,dx=.3,dz=.3){
 const originals=doc.furniture.filter(f=>ids.includes(f.id));
 if(!originals.length)throw Error('请先选择家具');
 const groupMap=new Map();
 const copies=originals.map(item=>{
  const next=structuredClone(item);
  next.id=makeId();
  next.x+=dx;next.z+=dz;
  if(item.groupId){if(!groupMap.has(item.groupId))groupMap.set(item.groupId,makeId());next.groupId=groupMap.get(item.groupId);}
  return next;
 });
 for(const item of copies){
  if(Math.abs(item.x)+item.width/2>doc.width/2||Math.abs(item.z)+item.depth/2>doc.depth/2)throw Error('复制位置超出户型边界');
 }
 doc.furniture.push(...copies);
 return copies;
}
