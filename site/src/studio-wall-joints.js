// Propagate intentional endpoint edits to coincident joints; do not mutate unrelated walls.
export function moveWallJoint(doc,wallId,side,next,{tolerance=.015}={}){
 const wall=doc.walls.find(w=>w.id===wallId);
 if(!wall||!['a','b'].includes(side)||!next.every(Number.isFinite))throw Error('墙体端点无效');
 if(wall.locked)throw Error('墙体已锁定');
 const before=[...wall[side]],linked=[];
 for(const other of doc.walls)for(const end of ['a','b']){
  if(Math.hypot(other[end][0]-before[0],other[end][1]-before[1])<=tolerance)linked.push({wall:other,side:end});
 }
 if(linked.some(item=>item.wall.locked))throw Error('连接的墙体已锁定');
 for(const item of linked)item.wall[item.side]=[...next];
 return linked.length;
}
export function translateWallWithJoints(doc,wallId,dx,dz,{tolerance=.015}={}){
 const wall=doc.walls.find(w=>w.id===wallId);
 if(!wall||![dx,dz].every(Number.isFinite))throw Error('墙体位移无效');
 if(wall.locked)throw Error('墙体已锁定');
 const start=[...wall.a],end=[...wall.b];
 const peers=doc.walls.filter(w=>w.id!==wallId);
 for(const other of peers)if(other.locked&&[start,end].some(point=>['a','b'].some(side=>Math.hypot(other[side][0]-point[0],other[side][1]-point[1])<=tolerance)))throw Error('连接的墙体已锁定');
 for(const {point,next} of [{point:start,next:[start[0]+dx,start[1]+dz]},{point:end,next:[end[0]+dx,end[1]+dz]}]){
  for(const other of peers)for(const side of ['a','b']){
   if(Math.hypot(other[side][0]-point[0],other[side][1]-point[1])<=tolerance)other[side]=[...next];
  }
 }
 wall.a=[start[0]+dx,start[1]+dz];wall.b=[end[0]+dx,end[1]+dz];
}
