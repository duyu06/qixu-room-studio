// Traditional-cultural interpretation only. No electromagnetic, geopathic or air-flow measurements.
// Deterministic field geometry is an artistic visualization of routes and furniture obstacles.
export const BAGUA = [
  {direction:'北',trigram:'坎',glyph:'☵',element:'水',color:'#65ADD0',image:'流动、险中求通',meaning:'传统象征流动、智慧与审慎。',placement:'可用安静的蓝灰配色或流线型装饰呼应；实际布置应优先保证防滑和安全。',tip:'如要布置水景，请优先考虑防潮、漏电风险与维护成本。'},
  {direction:'东北',trigram:'艮',glyph:'☶',element:'土',color:'#B9A080',image:'山与止',meaning:'传统象征沉静、收敛与学习。',placement:'适合尝试阅读角或稳固书架，但不应挡住门与通风口。',tip:'高书架必须防倾倒固定。'},
  {direction:'东',trigram:'震',glyph:'☳',element:'木',color:'#78AE83',image:'雷与动',meaning:'传统象征行动、生发与更新。',placement:'可将适宜光照的绿植用作生机意象，具体位置应由植物习性决定。',tip:'注意叶片不遮光、花盆不漏水。'},
  {direction:'东南',trigram:'巽',glyph:'☴',element:'木',color:'#77B6A3',image:'风与入',meaning:'传统象征柔和、渗透与协作。',placement:'可用轻盈家具、适度留白营造通透感。',tip:'预留窗帘开启和通风空间。'},
  {direction:'南',trigram:'离',glyph:'☲',element:'火',color:'#E6A46F',image:'火与明',meaning:'传统象征光明、表达与可见。',placement:'可用层次照明营造明亮感，但方向本身不代表实际采光优劣。',tip:'根据眩光、色温与真实窗向调整灯具。'},
  {direction:'西南',trigram:'坤',glyph:'☷',element:'土',color:'#C9AE8D',image:'地与承',meaning:'传统象征包容、承载与稳定。',placement:'可用舒适的座椅和暖色织物塑造放松区域。',tip:'软装须兼顾易清洁性和消防安全。'},
  {direction:'西',trigram:'兑',glyph:'☱',element:'金',color:'#B6B8C6',image:'泽与悦',meaning:'传统象征交流、愉悦与表达。',placement:'可尝试会客或交流角，家具应保留适当通行宽度。',tip:'避免尖角突出到主通道。'},
  {direction:'西北',trigram:'乾',glyph:'☰',element:'金',color:'#D6C5A3',image:'天与健',meaning:'传统象征秩序、决断与自强。',placement:'可以尝试整洁的收纳区、清晰的工作动线。',tip:'不要因“方位”牺牲采光或日常使用效率。'}
];
export const FIVE_ELEMENTS = [
  {name:'木',symbol:'木',color:'#76AE89',feature:'舒展、成长',examples:'植物、木饰面',care:'绿植更需要匹配阳光和浇水需求'},
  {name:'火',symbol:'火',color:'#E89B77',feature:'温暖、明亮',examples:'暖色灯光、红色点缀',care:'灯具选用合格电气产品并避免过热'},
  {name:'土',symbol:'土',color:'#C6AF88',feature:'稳定、承载',examples:'陶瓷、米色织物',care:'固定高家具，检查耐磨、防滑'},
  {name:'金',symbol:'金',color:'#B6BDC6',feature:'清晰、收敛',examples:'金属线条、圆形摆件',care:'避免尖角和玻璃破裂风险'},
  {name:'水',symbol:'水',color:'#72ADD0',feature:'柔和、流动',examples:'蓝色、镜面、波纹',care:'真实水景要重视电气及潮湿风险'}
];
export const SHENG = [['木','火'],['火','土'],['土','金'],['金','水'],['水','木']];
export const KE = [['木','土'],['土','水'],['水','火'],['火','金'],['金','木']];
export const roomTips = {
  living:[['沙发与门','传统上讲究座位有“靠”；实际可核对靠背稳定性、门的开合与对坐距离。'],['客厅中区','宜保留行走与活动的灵活区域，而非强制放置招运物件。'],['镜子布置','以真实视觉舒适度、反光与牢固固定为先。']],
  bedroom:[['床头位置','优先稳定实墙、床头安全、电源线和睡眠噪声，避免遮挡窗边应急出口。'],['床侧动线','尽量预留可自由上下床的宽度，避免床角碰撞。'],['夜间照明','床侧柔光和可触及的开关更重要。']],
  study:[['书桌朝向','优先选择侧向日光，避免显示器直面强窗光。'],['背后支撑','传统“背有靠”可解释为空间使用中的安定感，不代表可测量气运。'],['植物点缀','花草应按光照与通风条件摆放，避免水滴进入插座。']]
};
export function directionIndex(x,z,north=0){
  const a=(Math.atan2(x,-z)*180/Math.PI-north+720)%360;
  return Math.round(a/45)%8;
}
export function directionRecord(x,z,north=0){return Math.hypot(x,z)<.38?null:BAGUA[directionIndex(x,z,north)];}
export function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n));}
export function fieldVector(x,z,room,obstacles=[]){
  // A stylized path from front-door edge to the window wall, NOT actual air motion.
  const W=room.width,D=room.depth;
  const doorX=-W/2+Math.min(1,W*.22);
  const windowX=clamp(room.windowX??0,-W/2+.2,W/2-.2);
  let vx=(windowX-x)*.22+(doorX-x)*.035;
  let vz=-.9;
  const centerX=(doorX+windowX)/2;
  // An intentionally soft rotational component makes the artistic paths legible.
  const dx=x-centerX,dz=z;
  vx+=-.17*dz/(1+dx*dx+dz*dz);
  vz+= .14*dx/(1+dx*dx+dz*dz);
  for(const obj of obstacles){
    const ox=x-obj.x,oz=z-obj.z;
    const rx=Math.max(.20,(obj.w??.8)*.55+.18),rz=Math.max(.20,(obj.d??.8)*.55+.18);
    const q=(ox/rx)**2+(oz/rz)**2;
    if(q<3.5){
      const weight=.62*Math.exp(-q*.85);
      const len=Math.max(.16,Math.hypot(ox,oz));
      vx+=weight*ox/len;
      vz+=weight*oz/len;
    }
  }
  const margin=.22;
  if(x< -W/2+margin)vx+=.9;
  if(x> W/2-margin)vx-=.9;
  if(z< -D/2+margin)vz+=.32;
  if(z> D/2-margin)vz-=.9;
  const len=Math.max(1e-5,Math.hypot(vx,vz));
  return {x:vx/len,z:vz/len};
}
export function makeFlowPoint(seed,room){
  const W=room.width,D=room.depth;
  const doorX=-W/2+Math.min(1,W*.22);
  return {x:clamp(doorX+(seed-.5)*W*.85,-W/2+.15,W/2-.15),z:D/2-.15-(seed*2.2)%Math.max(.3,D*.5)};
}