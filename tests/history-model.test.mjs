import assert from 'node:assert/strict';
import {HistoryJournal} from '../site/src/history-model.js';
let h=new HistoryJournal(3);
assert(h.commit({a:1}));assert(!h.commit({a:1}));assert(h.commit({a:2}));assert(h.commit({a:3}));
assert.deepEqual(h.undo(),{a:2});assert(h.canRedo);
assert(h.commit({a:4}));assert.equal(h.canRedo,false);assert.deepEqual(h.undo(),{a:2});assert.deepEqual(h.undo(),{a:1});assert.equal(h.undo(),null);
assert(h.commit({a:5}));assert.equal(h.canRedo,false);assert(h.commit({a:6}));
assert.equal(h.stack.length,3);assert.deepEqual(h.undo(),{a:5});
console.log('PASS — snapshots, undo/redo, deduplication and bounded journal');
