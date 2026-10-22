import {createProject,addWall,addOpening,addFurniture,validateProject} from './studio-model.js';
export const SHOWCASE_TEMPLATES=Object.freeze([
 {slug:'sunlit',number:'01',name:'日光都市公寓',subtitle:'开放客餐厅 · 温暖橡木 · 单卧套间',tag:'城市生活',floor:'#d4bc9c',accent:'#698b77',area:'约 70㎡'},
 {slug:'compact',number:'02',name:'木色小家',subtitle:'小户型高效布置 · 卧室与生活区',tag:'紧凑空间',floor:'#e5d8c1',accent:'#b29270',area:'约 50㎡'},
 {slug:'family',number:'03',name:'理想家庭居所',subtitle:'独立卧室 · 家庭客厅 · 多区域规划',tag:'家庭住宅',floor:'#c6c7bd',accent:'#7d9295',area:'约 75㎡'}
]);
const wall=(d,a,b)=>addWall(d,a,b);
const furnish=(d,type,x,z,rotation=0)=>{
 const item=addFurniture(d,type);item.x=x;item.z=z;item.rotation=rotation;return item;
};
const blank=(title,width,depth,floor)=>{
 const d=createProject();d.title=title;d.width=width;d.depth=depth;
 d.walls=[];d.openings=[];d.furniture=[];d.floor=floor;
 d.wallColor='#f7f4ec';d.wallHeight=2.75;d.thickness=.14;return d;
};
export function makeShowcaseTemplate(slug){
 if(!SHOWCASE_TEMPLATES.some(x=>x.slug===slug))throw Error('未知演示样板间');
 let d;
 if(slug==='sunlit'){
  d=blank('日光都市公寓 · 栖序样板间',12,8.5,'#d4bc9c');
  const south=wall(d,[-5.3,-3.5],[5.3,-3.5]);
  const east=wall(d,[5.3,-3.5],[5.3,3.5]);
  const north=wall(d,[5.3,3.5],[-5.3,3.5]);
  wall(d,[-5.3,3.5],[-5.3,-3.5]);
  wall(d,[-1.7,-3.5],[-1.7,.95]);
  const room=wall(d,[-1.7,.95],[-5.3,.95]);
  addOpening(d,'door',south.id,.81,.95);
  addOpening(d,'window',north.id,.35,2.15);
  addOpening(d,'window',east.id,.62,1.55);
  addOpening(d,'door',room.id,.52,.86);
  furnish(d,'sofa',2.45,.45,Math.PI/2);
  furnish(d,'table',.35,-.8,0);
  furnish(d,'chair',.35,-2.2,0);
  furnish(d,'rug',2.5,.45,Math.PI/2);
  furnish(d,'cabinet',4.4,-2.6,0);
  furnish(d,'bed',-3.45,-1.1,Math.PI/2);
  furnish(d,'plant',4.45,2.42);
  furnish(d,'desk',-3.5,2.45);
 }else if(slug==='compact'){
  d=blank('木色小家 · 栖序样板间',10.5,7.8,'#e5d8c1');
  const south=wall(d,[-4.5,-3],[4.5,-3]);
  const east=wall(d,[4.5,-3],[4.5,3]);
  const north=wall(d,[4.5,3],[-4.5,3]);
  wall(d,[-4.5,3],[-4.5,-3]);
  const partition=wall(d,[.4,-3],[.4,3]);
  addOpening(d,'door',south.id,.13,.86);
  addOpening(d,'door',partition.id,.54,.85);
  addOpening(d,'window',north.id,.21,1.55);
  addOpening(d,'window',east.id,.68,1.25);
  furnish(d,'bed',-2,-.8,0);
  furnish(d,'desk',-2.4,2.2);
  furnish(d,'cabinet',-4,1.4,Math.PI/2);
  furnish(d,'sofa',2.7,.75,Math.PI/2);
  furnish(d,'rug',2.6,.65,Math.PI/2);
  furnish(d,'table',2,-1.75);
  furnish(d,'plant',3.85,2.35);
 }else{
  d=blank('理想家庭居所 · 栖序样板间',12.5,8.7,'#c6c7bd');
  const south=wall(d,[-5.4,-3.6],[5.4,-3.6]);
  const east=wall(d,[5.4,-3.6],[5.4,3.6]);
  const north=wall(d,[5.4,3.6],[-5.4,3.6]);
  wall(d,[-5.4,3.6],[-5.4,-3.6]);
  const partA=wall(d,[-1.4,-3.6],[-1.4,3.6]);
  const partB=wall(d,[-1.4,.4],[5.4,.4]);
  addOpening(d,'door',south.id,.85,.9);
  addOpening(d,'door',partA.id,.72,.86);
  addOpening(d,'door',partB.id,.61,.85);
  addOpening(d,'window',north.id,.17,1.5);
  addOpening(d,'window',north.id,.77,1.65);
  addOpening(d,'window',east.id,.57,1.4);
  furnish(d,'bed',-3.5,1.5,Math.PI/2);
  furnish(d,'cabinet',-4.7,-2.2);
  furnish(d,'desk',-2.2,-1.6,Math.PI/2);
  furnish(d,'sofa',2,-1.5,Math.PI/2);
  furnish(d,'table',3.7,-1.3);
  furnish(d,'rug',2.2,-1.4,Math.PI/2);
  furnish(d,'bed',.6,2.05);
  furnish(d,'plant',4.55,2.85);
  furnish(d,'chair',4,1.7);
 }
 const err=validateProject(d);if(err)throw Error('样板间几何无效: '+err);
 return d;
}
