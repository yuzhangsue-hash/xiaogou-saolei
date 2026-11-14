const {test}=require('node:test');
const assert=require('node:assert/strict');
const solver=require('../solver.js');
const generator=require('../generator.js');
const puzzles=require('../puzzle-library.js');
const puzzleData=require('../puzzle-data.js');

test('multi-number CSP proves a safe cell without a single or subset rule',()=>{
 const h=solver.solveModel({unknown:[0,1,2,3,4],mineCount:2,constraints:[
  {vars:[2,3,4],sum:1,clue:10},{vars:[1,4],sum:1,clue:11},
  {vars:[0,1,2],sum:1,clue:12},{vars:[0,1,3,4],sum:2,clue:13}]});
 assert.equal(h.kind,'safe');assert.equal(h.source,'csp');assert.equal(h.index,2);
});
test('global mine count proves a cell outside the numbered frontier',()=>{
 const h=solver.solveModel({unknown:[0,1,2],mineCount:1,constraints:[{vars:[0,1],sum:1,clue:5}]});
 assert.deepEqual([h.kind,h.index,h.source],['safe',2,'global-csp']);
});
test('uncertain cells are labeled with exact probability',()=>{
 const h=solver.solveModel({unknown:[0,1],mineCount:1,constraints:[{vars:[0,1],sum:1,clue:5}]});
 assert.equal(h.kind,'guess');assert.equal(h.probability,0.5);assert.equal(h.source,'exact');
});
test('a player flag is not accepted as proof of a mine',()=>{
 const h=solver.solveModel({unknown:[0,1],mineCount:1,flagged:new Set([0]),constraints:[{vars:[0,1],sum:1,clue:5}]});
 assert.equal(h.kind,'guess');assert.equal(h.probability,0.5);
});
test('hidden truth is never used by a hint',()=>{
 const base=Array.from({length:9},()=>({open:false,n:0,flag:false,mine:false}));
 base[4]={open:true,n:1,flag:false,mine:false};
 const a=solver.solveBoard({rows:3,cols:3,mineCount:1,cells:base});
 const changed=base.map(c=>({...c}));changed[0].mine=true;changed[1].mine=true;
 const b=solver.solveBoard({rows:3,cols:3,mineCount:1,cells:changed});
 assert.deepEqual(a,b);assert.equal(a.kind,'guess');
});
test('pure logic verification rejects a board requiring a guess',()=>{
 let found=false;
 for(let attempt=0;attempt<100&&!found;attempt++){
  const board=generator.randomBoard(9,9,10,40);
  found=!generator.verify(board,9,9,10,40);
 }
 assert.equal(found,true);
});
test('generated pure logic boards are fully verified before return',()=>{
 const result=generator.generate(9,9,10,40,{maxMs:3000,maxAttempts:100});
 assert.equal(result.ok,true);
 assert.equal(result.board.filter(c=>c.mine).length,10);
 assert.equal(generator.verify(result.board,9,9,10,40),true);
});
test('all difficulty layouts have exact dimensions, mines, numbers and first-click safety',()=>{
 for(const [rows,cols,mines,first] of [[9,9,10,40],[16,16,40,120],[16,30,99,240]]){
  const board=generator.randomBoard(rows,cols,mines,first);
  assert.equal(board.length,rows*cols);
  assert.equal(board.filter(c=>c.mine).length,mines);
  assert.equal(board[first].mine,false);
  for(let i=0;i<board.length;i++){
   const r=Math.floor(i/cols),c=i%cols;
   const around=board.filter((_,j)=>{const y=Math.floor(j/cols),x=j%cols;return j!==i&&Math.max(Math.abs(r-y),Math.abs(c-x))===1;});
   assert.equal(board[i].n,around.filter(c=>c.mine).length);
   if(Math.max(Math.abs(r-Math.floor(first/cols)),Math.abs(c-first%cols))<=1)assert.equal(board[i].mine,false);
  }
 }
});
test('advanced empty board analysis stays fast',()=>{
 const cells=Array.from({length:480},()=>({open:false,n:0,flag:false,mine:false}));
 const start=Date.now();const h=solver.solveBoard({rows:16,cols:30,mineCount:99,cells});
 assert.equal(h.kind,'guess');assert.ok(Date.now()-start<1000);
});
test('every first click has an instant, safe, fully numbered puzzle',()=>{
 for(const [rows,cols,mines] of [[9,9,10],[16,16,40],[16,30,99]]){
  for(let first=0;first<rows*cols;first++){
   const board=puzzles.getBoard(rows,cols,mines,first);
   assert.ok(board,`missing ${rows}x${cols} first ${first}`);
   assert.equal(board.filter(c=>c.mine).length,mines);
   assert.equal(board[first].mine,false);
   for(let i=0;i<board.length;i++){
    const r=Math.floor(i/cols),c=i%cols;
    const adjacent=board.filter((_,j)=>j!==i&&Math.max(Math.abs(r-Math.floor(j/cols)),Math.abs(c-j%cols))===1);
    assert.equal(board[i].n,adjacent.filter(c=>c.mine).length);
    if(Math.max(Math.abs(r-Math.floor(first/cols)),Math.abs(c-first%cols))<=1)assert.equal(board[i].mine,false);
   }
  }
 }
});
test('preverified puzzle remains logic-solvable after symmetry mapping',()=>{
 for(const [rows,cols,mines,first] of [[9,9,10,80],[16,16,40,255],[16,30,99,479]]){
  const board=puzzles.getBoard(rows,cols,mines,first);
  assert.equal(generator.verify(board,rows,cols,mines,first),true);
 }
});
test('each opening position can rotate between two verified layouts',()=>{
 for(const [rows,cols,mines] of [[9,9,10],[16,16,40],[16,30,99]]){
  for(let first=0;first<rows*cols;first++){
   const key=puzzles.canonical(rows,cols,first).key;
   assert.equal(puzzleData[key].length,2);
   const a=puzzles.getBoard(rows,cols,mines,first);
   const b=puzzles.getBoard(rows,cols,mines,first);
   assert.notDeepEqual(a.map(c=>c.mine),b.map(c=>c.mine));
  }
 }
});
