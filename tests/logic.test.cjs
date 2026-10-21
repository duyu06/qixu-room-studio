/* No network/dependencies: inspect and test pure geometry + lighting rules in src/main.js. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','site','src','main.js'),'utf8');
function extractFunction(name){
 const at=source.indexOf(`function ${name}(`);assert(at>=0,`Missing ${name}`);
 const b=source.indexOf('{',at);let depth=0;
 for(let i=b;i<source.length;i++){
  if(source[i]==='{')depth++;
  if(source[i]==='}'&&--depth===0)return source.slice(at,i+1);
 }
 throw Error(`Unbalanced source for ${name}`);
}
class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}}
const state={width:4.8,depth:4.2,height:2.8,north:180,sunHour:12,daylight:85};
const sandbox={state,fengDirections:['北','东北','东','东南','南','西南','西','西北'].map(key=>({key})),windowBounds:{left:-1.23,right:.37,bottom:.93,top:2.18},
 solarVector:new Vector3(),THREE:{Vector3},clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),rad:d=>d*Math.PI/180,deg:r=>r*180/Math.PI};
const fns=['calculateSunVector','isSunlitAt','footprint','furnitureCorners','furnitureCollision','directionOf'];
const impl=vm.runInNewContext(`${fns.map(extractFunction).join('\n')}\n({${fns.join(',')}})`,sandbox);
function recalc(){const {vec}=impl.calculateSunVector();sandbox.solarVector=vec;}
recalc();
assert(sandbox.solarVector.z<-.45,'Noon, south-facing rear window should receive sun');
assert.equal(impl.isSunlitAt(-.43,-1.1),true,'Near-window floor patch is sunlit at noon');
assert.equal(impl.isSunlitAt(-.43,1.4),false,'Far floor cannot see sun through high window');
state.north=0;recalc();assert.equal(impl.isSunlitAt(-.43,-1.1),false,'North-facing rear wall should not show noon direct sun');
state.north=180;state.sunHour=20;recalc();assert.equal(impl.isSunlitAt(-.43,-1.1),false,'No sun exposure at night');
state.sunHour=12;recalc();
sandbox.windowBounds={left:1.2,right:1.6,bottom:.93,top:2.18};
assert.equal(impl.isSunlitAt(-.43,-1.1),false,'Moving window changes the sun patch');
const mk=(x,z,w=1,d=1,rot=0)=>({w,d,scale:1,widthScale:1,depthScale:1,rotation:rot,type:'sofa',group:{position:{x,z}}});
assert.equal(impl.furnitureCollision(mk(0,0),mk(.3,.3)),true,'Furniture overlap detected');
assert.equal(impl.furnitureCollision(mk(-1,0),mk(1,0)),false,'Separated furniture not marked overlapping');
assert.equal(impl.furnitureCollision(mk(0,0,2,.5,45),mk(0,0)),true,'Rotated furniture overlap detected');
const rug=mk(0,0);rug.type='rug';assert.equal(impl.furnitureCollision(rug,mk(0,0)),false,'Rugs allow overlay furniture');
assert.equal(impl.directionOf(0,-1),'南','Compass offset changes semantic direction');
state.north=0;assert.equal(impl.directionOf(0,-1),'北','Compass zero matches rear north');
console.log('PASS — 12 checks for sun direction, window occlusion, time, furniture footprint and compass.');
