// Deterministic 2D furniture-clearance routing for an illustrative room.
// Distances are metres; the result is NOT a fire-egress compliance assessment.
export const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
export function pointBlocked(x,z,items,clearance=.16){
  return items.some(item=>{
    if(['rug','mirror','lamp'].includes(item.type))return false;
    const dx=x-item.x,dz=z-item.z;
    const a=(item.rotation||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    const lx=dx*c-dz*s,lz=dx*s+dz*c;
    return Math.abs(lx)<=item.w/2+clearance&&Math.abs(lz)<=item.d/2+clearance;
  });
}
export function findWalkway(room,items,{step=.20,clearance=.16}={}){
  const {width:W,depth:D}=room;
  if(!Number.isFinite(W)||!Number.isFinite(D)||W<=0||D<=0)return {ok:false,points:[],reason:'invalid room'};
  const nx=Math.floor(W/step)+1,nz=Math.floor(D/step)+1;
  const xOf=i=>-W/2+i*W/(nx-1),zOf=j=>-D/2+j*D/(nz-1);
  const xy=(x,z)=>[limit(Math.round((x+W/2)/W*(nx-1)),0,nx-1),limit(Math.round((z+D/2)/D*(nz-1)),0,nz-1)];
  const key=(i,j)=>j*nx+i,blocked=new Uint8Array(nx*nz);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x=xOf(i),z=zOf(j);
    blocked[key(i,j)]=(Math.abs(x)>W/2-.08||Math.abs(z)>D/2-.08||pointBlocked(x,z,items,clearance))?1:0;
  }
  const start=xy(-W/2+Math.min(1,W*.22),D/2-.25),end=xy(room.windowX||0,-D/2+.25);
  function nearest([ii,jj]){
    let best=-1,score=Infinity;
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)if(!blocked[key(i,j)]){
      const scoreNow=(i-ii)**2+(j-jj)**2;
      if(scoreNow<score){best=key(i,j);score=scoreNow;}
    }
    // Do not pretend an exit exists if all points near the goal are blocked.
    return score<=36?best:-1;
  }
  const a=nearest(start),b=nearest(end);
  if(a<0||b<0)return {ok:false,points:[],reason:'entrance or window-side approach blocked'};
  const predecessor=new Int32Array(nx*nz).fill(-1),distance=new Float32Array(nx*nz).fill(Infinity);
  const queue=[a];let head=0;predecessor[a]=a;distance[a]=0;
  const neighbors=[[1,0],[-1,0],[0,1],[0,-1]];
  while(head<queue.length){const at=queue[head++];if(at===b)break;const i=at%nx,j=Math.floor(at/nx);
    for(const [dx,dz] of neighbors){const ni=i+dx,nj=j+dz;
      if(ni<0||nj<0||ni>=nx||nj>=nz)continue;
      const node=key(ni,nj);if(blocked[node]||predecessor[node]!==-1)continue;
      predecessor[node]=at;distance[node]=distance[at]+Math.hypot(xOf(ni)-xOf(i),zOf(nj)-zOf(j));queue.push(node);
    }
  }
  if(predecessor[b]===-1)return {ok:false,points:[],reason:'no clearance path'};
  const route=[];let at=b;
  while(at!==a){route.push({x:xOf(at%nx),z:zOf(Math.floor(at/nx))});at=predecessor[at];}
  route.push({x:xOf(a%nx),z:zOf(Math.floor(a/nx))});route.reverse();
  const streamlined=route.filter((p,i)=>{
    if(i===0||i===route.length-1)return true;
    const before=route[i-1],after=route[i+1];return Math.abs((p.x-before.x)*(after.z-p.z)-(p.z-before.z)*(after.x-p.x))>.0001;
  });
  return {ok:true,points:streamlined,length:Number(distance[b].toFixed(2)),expanded:head};
}
export function calculateClearanceRatio(room,items,{step=.25,clearance=.16}={}){
  let total=0,open=0;
  for(let x=-room.width/2+.20;x<=room.width/2-.20;x+=step)
    for(let z=-room.depth/2+.20;z<=room.depth/2-.20;z+=step){total++;if(!pointBlocked(x,z,items,clearance))open++;}
  return total?Math.round(open/total*100):0;
}
