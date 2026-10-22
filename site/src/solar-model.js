// SunCalc 2.1.1 uses degrees clockwise from true north.
export function sunCalcToScene(pos,northDeg=0){
  if(!Number.isFinite(pos?.altitude)||!Number.isFinite(pos?.azimuth)) throw new Error('Invalid SunCalc position');
  const bearing=((pos.azimuth%360)+360)%360;
  const a=(bearing-northDeg)*Math.PI/180,alt=pos.altitude*Math.PI/180;
  return {altitudeDeg:pos.altitude,bearingDeg:bearing,aboveHorizon:pos.altitude>0,
    direction:{x:Math.sin(a)*Math.cos(alt),y:Math.sin(alt),z:-Math.cos(a)*Math.cos(alt)}};
}
