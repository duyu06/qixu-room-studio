/** Bounded, deduplicated undo/redo journal. Data must be JSON-serializable. */
export class HistoryJournal {
  constructor(capacity=40){this.capacity=Math.max(2,capacity);this.stack=[];this.cursor=-1;}
  commit(value){
    const snapshot=typeof value==='string'?value:JSON.stringify(value);
    if(this.stack[this.cursor]===snapshot)return false;
    if(this.cursor<this.stack.length-1)this.stack.splice(this.cursor+1);
    this.stack.push(snapshot);
    if(this.stack.length>this.capacity)this.stack.shift();
    this.cursor=this.stack.length-1;
    return true;
  }
  undo(){if(this.cursor<=0)return null;return JSON.parse(this.stack[--this.cursor]);}
  redo(){if(this.cursor>=this.stack.length-1)return null;return JSON.parse(this.stack[++this.cursor]);}
  get canUndo(){return this.cursor>0;}
  get canRedo(){return this.cursor<this.stack.length-1;}
}
