// Shared entry points and storage keys. Keep navigation/data routing in one place.
// The public workflow has one canvas. The legacy lab and standalone previews
// remain internal implementation pages, not competing customer journeys.
export const PAGES=Object.freeze([
  {key:'studio',label:'空间设计工作台',href:'./studio.html'}
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
