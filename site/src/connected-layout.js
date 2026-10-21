// Three-room floorplan: one contiguous floor and two shared partitions.
// Coordinates: the living room is centered; the study is on the left and bedroom on the right.
const bound = (n, low, high) => Math.max(low, Math.min(high, n));

export function connectedLayout(width, depth) {
  const studyWidth = bound(width * .58, 2.60, 3.35);
  const bedroomWidth = bound(width * .72, 3.00, 4.10);
  const left = -width / 2 - studyWidth;
  const right = width / 2 + bedroomWidth;
  const areas = {
    living: {id:'living', name:'客厅', minX:-width/2, maxX:width/2, centerX:0, width, depth},
    study: {id:'study', name:'书房', minX:left, maxX:-width/2, centerX:(left-width/2)/2, width:studyWidth, depth},
    bedroom: {id:'bedroom', name:'卧室', minX:width/2, maxX:right, centerX:(right+width/2)/2, width:bedroomWidth, depth}
  };
  return {areas, minX:left, maxX:right, centerX:(left+right)/2, totalWidth:right-left, depth,
    partitions:[-width/2, width/2], doorway:{centerZ:depth*.16, width:Math.min(1.2,depth*.33), height:2.12}};
}

export function partitionSections(depth, doorway) {
  const low=-depth/2, high=depth/2;
  const a=bound(doorway.centerZ-doorway.width/2,low,high);
  const b=bound(doorway.centerZ+doorway.width/2,low,high);
  return [{from:low,to:a},{from:b,to:high}].filter(s=>s.to-s.from>.005);
}

export function clampToArea(area, x, z, halfX, halfZ, padding=.06) {
  const minX=area.minX+halfX+padding, maxX=area.maxX-halfX-padding;
  const minZ=-area.depth/2+halfZ+padding,maxZ=area.depth/2-halfZ-padding;
  return {
    x: minX>maxX?area.centerX:bound(x,minX,maxX),
    z: minZ>maxZ?0:bound(z,minZ,maxZ)
  };
}

export function inferArea(layout,x) {
  if(x<layout.areas.living.minX)return 'study';
  if(x>layout.areas.living.maxX)return 'bedroom';
  return 'living';
}
