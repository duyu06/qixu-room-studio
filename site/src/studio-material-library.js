export const FACE_KEYS=['Color','Pattern','Repeat','Roughness','Metalness','NormalMap','RoughnessMap'];
export function captureFacePreset(wall,side){
 if(!['faceA','faceB'].includes(side))throw Error('墙面方向无效');
 const values={};for(const key of FACE_KEYS){const value=wall[side+key];if(value!==undefined)values[key]=value;}
 return values;
}
export function applyFacePreset(wall,side,values){
 if(!['faceA','faceB'].includes(side)||!values||typeof values!=='object')throw Error('墙面预设无效');
 for(const key of FACE_KEYS){
  if(Object.hasOwn(values,key))wall[side+key]=values[key];
  else delete wall[side+key];
 }
}
