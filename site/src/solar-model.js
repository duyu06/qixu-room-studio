export function sunCalcToScene(pos,northDeg=0){
  if(!Number.isFinite(pos?.altitude)||!Number.isFinite(pos?.azimuth))throw new Error('Invalid SunCalc position');
  // SunCalc: radians; zero azimuth is SOUTH, positive toward WEST.
  const trueBearing=((pos.azimuth+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
  const sceneBearing=trueBearing-northDeg*Math.PI/180;
  const alt=pos.altitude;
  return {altitudeDeg:alt*180/Math.PI,bearingDeg:trueBearing*180/Math.PI,aboveHorizon:alt>0,
    direction:{x:Math.sin(sceneBearing)*Math.cos(alt),y:Math.sin(alt),z:-Math.cos(sceneBearing)*Math.cos(alt)}};
}
