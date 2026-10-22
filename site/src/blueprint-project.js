export const PROJECT_SCHEMA='qixu-blueprint';
export const MAX_PROJECT_FILE_BYTES=18*1024*1024;
const finite=n=>Number.isFinite(n);
export function validateBlueprintPacket(input){
  if(!input||input.schema!==PROJECT_SCHEMA||input.version!==1)return '不是受支持的栖序完整户型项目文件。';
  const {plan,image}=input;
  if(typeof image!=='string'||image.length>MAX_PROJECT_FILE_BYTES*1.4||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))
    return '项目缺少有效的户型图片或图片体积过大。';
  if(!plan||!finite(plan.w)||!finite(plan.d)||plan.w<1||plan.d<1||plan.w>100||plan.d>100)return '户型尺寸不合法。';
  const c=plan.crop;
  if(!c||!['left','right','top','bottom'].every(k=>finite(c[k]))||c.left<0||c.top<0||c.right<=c.left||c.bottom<=c.top||c.right>10000||c.bottom>10000)
    return '户型裁剪范围不合法。';
  if(!Array.isArray(plan.walls)||plan.walls.length>1500||
    !plan.walls.every(line=>Array.isArray(line)&&line.length===4&&line.every(finite)))return '墙线数据不合法。';
  if(!Array.isArray(plan.furniture||[])||(plan.furniture||[]).length>300||
    !(plan.furniture||[]).every(item=>finite(item.x)&&finite(item.z)&&Math.abs(item.x)<=plan.w/2+1&&Math.abs(item.z)<=plan.d/2+1&&
      Array.isArray(item.dims)&&item.dims.length===3&&item.dims.every(n=>finite(n)&&n>.01&&n<20)))return '家具数据不合法。';
  const k=plan.calibration;
  if(k!==undefined && (k.kind!=='two-points'||k.measuredByUser!==true
    ||!finite(k.distanceMeters)||k.distanceMeters<.1||k.distanceMeters>40
    ||!Array.isArray(k.imagePoints)||k.imagePoints.length!==2
    ||!k.imagePoints.every(a=>Array.isArray(a)&&a.length===2&&a.every(finite))))
    return '标尺校准数据不合法。';
  return null;
}
export function makeBlueprintPacket(plan,image){
  const packet={schema:PROJECT_SCHEMA,version:1,exportedAt:new Date().toISOString(),plan,image};
  const error=validateBlueprintPacket(packet);if(error)throw Error(error);
  return packet;
}
