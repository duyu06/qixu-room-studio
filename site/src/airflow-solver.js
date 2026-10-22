// Qixu V8: 2D incompressible, irrotational *potential-flow* baseline.
// Pressure potential solves Laplace's equation with solid Neumann edges,
// and fixed positive/negative pressure at explicitly placed door/window ports.
// It is NOT a validated 3D CFD / turbulent ventilation or actual wind sensor.
export class PressureFlow2D {
  constructor(config, grid=92) { this.reset(config,grid); }
  reset({w,d,crop,walls=[],furniture=[],door,window},grid=this.nx||92) {
    this.w=w; this.d=d; this.crop=crop; this.walls=walls; this.furniture=furniture;
    this.door=door||{x:w*.46,z:-d*.06};this.window=window||{x:0,z:-d*.46};
    this.nx=grid;this.nz=Math.max(24,Math.round(grid*d/w));
    this.dx=w/(this.nx-1);this.dz=d/(this.nz-1);
    const count=this.nx*this.nz;
    this.solid=new Uint8Array(count);
    this.port=new Int8Array(count);
    this.pressure=new Float32Array(count);
    this.u=new Float32Array(count);
    this.v=new Float32Array(count);
    this.recompute();
  }
  id(i,j){return j*this.nx+i;}
  pos(i,j){return {x:(i/(this.nx-1)-.5)*this.w,z:(j/(this.nz-1)-.5)*this.d};}
  pixel(x,y){const c=this.crop;return {x:(x-c.left)/(c.right-c.left)*this.w-this.w/2,z:(y-c.top)/(c.bottom-c.top)*this.d-this.d/2};}
  indexAt(x,z){return {i:Math.max(0,Math.min(this.nx-1,Math.round((x/this.w+.5)*(this.nx-1)))),j:Math.max(0,Math.min(this.nz-1,Math.round((z/this.d+.5)*(this.nz-1))))};}
  blocked(x,z){const {i,j}=this.indexAt(x,z);return this.solid[this.id(i,j)]===1;}
  recompute(){
    this.solid.fill(0);this.port.fill(0);this.pressure.fill(0);this.u.fill(0);this.v.fill(0);
    // Rasterize real uploaded wall segments (not procedural decorative arrows).
    const segments=this.walls.map(([a,b,c,d])=>[this.pixel(a,b),this.pixel(c,d)]);
    for (const [a,b] of segments) {
      const minI=this.indexAt(Math.min(a.x,b.x)-.12,0).i,maxI=this.indexAt(Math.max(a.x,b.x)+.12,0).i;
      const minJ=this.indexAt(0,Math.min(a.z,b.z)-.12).j,maxJ=this.indexAt(0,Math.max(a.z,b.z)+.12).j;
      const wx=b.x-a.x,wz=b.z-a.z,len2=wx*wx+wz*wz||1;
      for(let j=minJ;j<=maxJ;j++)for(let i=minI;i<=maxI;i++){
        const p=this.pos(i,j),q=Math.max(0,Math.min(1,((p.x-a.x)*wx+(p.z-a.z)*wz)/len2));
        if(Math.hypot(p.x-a.x-q*wx,p.z-a.z-q*wz)<.11)this.solid[this.id(i,j)]=1;
      }
    }
    for(const f of this.furniture){
      const a=(f.angle||0),cs=Math.cos(a),sn=Math.sin(a),hw=(f.dims?.[0]||.9)/2+.08,hd=(f.dims?.[1]||.7)/2+.08;
      const r=Math.hypot(hw,hd);
      const x0=this.indexAt(f.x-r,0).i,x1=this.indexAt(f.x+r,0).i;
      const z0=this.indexAt(0,f.z-r).j,z1=this.indexAt(0,f.z+r).j;
      for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++){
        const p=this.pos(i,j),x=p.x-f.x,z=p.z-f.z;
        if(Math.abs(x*cs+z*sn)<hw&&Math.abs(-x*sn+z*cs)<hd)this.solid[this.id(i,j)]=1;
      }
    }
    // Door/window penetrate any line geometry within their editable opening radii.
    for(let j=0;j<this.nz;j++)for(let i=0;i<this.nx;i++){
      const id=this.id(i,j),p=this.pos(i,j);
      const di=Math.hypot(p.x-this.door.x,p.z-this.door.z);
      const wi=Math.hypot(p.x-this.window.x,p.z-this.window.z);
      if(di<.32||wi<.32)this.solid[id]=0;
      if(di<.21){this.port[id]=1;this.pressure[id]=1;}
      if(wi<.21){this.port[id]=-1;this.pressure[id]=-1;}
    }
    this.solvePressure();
  }
  solvePressure(iterations=360){
    const {nx,nz,dx,dz,pressure:p,solid,port}=this;
    const wx=1/(dx*dx),wz=1/(dz*dz);
    // Weighted Gauss-Seidel Laplace solve. Solid-neighbor flux = 0.
    for(let it=0;it<iterations;it++){
      for(let j=1;j<nz-1;j++)for(let i=1;i<nx-1;i++){
        const k=this.id(i,j);if(solid[k]||port[k])continue;
        let sum=0,weight=0;
        for(const [kk,w] of [[k-1,wx],[k+1,wx],[k-nx,wz],[k+nx,wz]]){
          if(solid[kk])continue;
          sum+=p[kk]*w;weight+=w;
        }
        if(weight>0)p[k]=sum/weight;
      }
    }
    let max=1e-9;
    for(let j=1;j<nz-1;j++)for(let i=1;i<nx-1;i++){
      const k=this.id(i,j);if(solid[k])continue;
      const left=solid[k-1]?p[k]:p[k-1],right=solid[k+1]?p[k]:p[k+1];
      const top=solid[k-nx]?p[k]:p[k-nx],bottom=solid[k+nx]?p[k]:p[k+nx];
      this.u[k]=-(right-left)/(2*dx);
      this.v[k]=-(bottom-top)/(2*dz);
      const mag=Math.hypot(this.u[k],this.v[k]);if(mag>max)max=mag;
    }
    // Normalized tracer field. Not an absolute measured airspeed.
    const scale=Math.min(1.7,1.35/max);
    for(let k=0;k<this.u.length;k++){this.u[k]*=scale;this.v[k]*=scale;}
    this.maxRelative=scale*max;
  }
  velocity(x,z){
    if(Math.abs(x)>=this.w/2||Math.abs(z)>=this.d/2)return {x:0,z:0,speed:0};
    const gx=(x/this.w+.5)*(this.nx-1),gz=(z/this.d+.5)*(this.nz-1);
    const i=Math.floor(gx),j=Math.floor(gz),a=gx-i,b=gz-j;
    const s=(arr)=>{const k=this.id(i,j),n=this.nx;
      return (arr[k]*(1-a)+arr[k+1]*a)*(1-b)+(arr[k+n]*(1-a)+arr[k+n+1]*a)*b;
    };
    if(this.blocked(x,z))return {x:0,z:0,speed:0};
    const vx=s(this.u),vz=s(this.v);
    return {x:vx,z:vz,speed:Math.hypot(vx,vz)};
  }
  trace(x,z,dt){
    const v=this.velocity(x,z);
    const next={x:x+v.x*dt,z:z+v.z*dt};
    if(this.blocked(next.x,next.z)||Math.abs(next.x)>this.w/2||Math.abs(next.z)>this.d/2)return {x,z,blocked:true};
    return {...next,blocked:false};
  }
}
