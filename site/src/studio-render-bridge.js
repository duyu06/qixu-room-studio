import {validateProject,wallPieces} from './studio-model.js';
// Translate current Qixu Studio editing documents into preview input while retaining
// metric wall objects and their opening geometry. Does not copy protected model assets.
export function studioToRenderPayload(studio){
 const error=validateProject(studio);if(error)throw Error(error);
 const crop={left:0,top:0,right:1000,bottom:1000};
 const toPixel=p=>[(p[0]/studio.width+.5)*1000,(p[1]/studio.depth+.5)*1000];
 const walls=studio.walls.map(w=>[...toPixel(w.a),...toPixel(w.b)]);
 const furniture=studio.furniture.map(f=>({x:f.x,z:f.z,dims:[f.width,f.depth,f.height],angle:f.rotation,type:f.type}));
 return {source:'qixu-studio',image:studio.reference||null,
   plan:{w:studio.width,d:studio.depth,crop,walls,furniture},
   studio};
}
export function renderWallPieces(studio,mode='high'){
 if(!studio)return[];
 const limit=mode==='low'?1.2:studio.wallHeight;
 return studio.walls.flatMap(w=>wallPieces(studio,w).flatMap(piece=>{
   const top=Math.min(piece.top,limit),bottom=piece.bottom;
   if(top-bottom<.004)return[];
   const L=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);
   const t=(piece.start+piece.end)/2/L;
   return [{
     wallId:w.id,x:w.a[0]+(w.b[0]-w.a[0])*t,z:w.a[1]+(w.b[1]-w.a[1])*t,
     length:piece.end-piece.start,
     height:top-bottom,y:(top+bottom)/2,
     thickness:studio.thickness,rotation:-Math.atan2(w.b[1]-w.a[1],w.b[0]-w.a[0])
   }];
 }));
}
