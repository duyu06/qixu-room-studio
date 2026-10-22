// Shared entry points and storage keys. Keep navigation/data routing in one place.
export const PAGES=Object.freeze([
  {key:'showcase',label:'产品展示',href:'./showcase.html'},
  {key:'studio',label:'专业设计',href:'./studio.html'},
  {key:'analysis',label:'空间分析',href:'./index.html'},
  {key:'render',label:'光照预览',href:'./photoreal.html'}
]);
export const PERSONAL_PROJECT_KEY='qixu-studio-v1';
export const LEGACY_PROJECT_KEY='qixu-blueprint-v6';
export const DEMO_IDS=Object.freeze(['sunlit','compact','family']);
export function demoId(value){
 return DEMO_IDS.includes(value)?value:null;
}
export function projectStorageKey(value){
 const demo=demoId(value);
 return demo?'qixu-studio-demo-'+demo+'-v1':PERSONAL_PROJECT_KEY;
}
export function renderLink(value){
 const demo=demoId(value);
 return './photoreal.html'+(demo?'?template='+encodeURIComponent(demo):'');
}
export function studioLink(value){
 const demo=demoId(value);
 return './studio.html'+(demo?'?template='+encodeURIComponent(demo)+'&view=3d':'');
}
