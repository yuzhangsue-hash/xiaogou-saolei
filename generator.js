(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./solver.js'):root.MinesweeperSolver);if(typeof module==='object'&&module.exports)module.exports=api;else root.MinesweeperGenerator=api;})(typeof globalThis!=='undefined'?globalThis:this,function(solver){
 function adjacent(i,rows,cols){const r=Math.floor(i/cols),c=i%cols,a=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const y=r+dr,x=c+dc;if(y>=0&&y<rows&&x>=0&&x<cols)a.push(y*cols+x);}return a;}
 function randomBoard(rows,cols,mineCount,first){
  const banned=new Set([first,...adjacent(first,rows,cols)]),pool=[];
  for(let i=0;i<rows*cols;i++)if(!banned.has(i))pool.push(i);
  for(let k=0;k<mineCount;k++){const j=k+Math.floor(Math.random()*(pool.length-k));[pool[k],pool[j]]=[pool[j],pool[k]];}
  const mines=new Set(pool.slice(0,mineCount));
  return Array.from({length:rows*cols},(_,i)=>({mine:mines.has(i),n:adjacent(i,rows,cols).filter(j=>mines.has(j)).length,open:false,flag:false}));
 }
 function verify(board,rows,cols,mineCount,first,options={}){
  const cells=board.map(c=>({...c,open:false,flag:false})),safeCount=cells.length-mineCount;
  if(cells.filter(c=>c.mine).length!==mineCount)return false;
  for(let i=0;i<cells.length;i++)if(cells[i].n!==adjacent(i,rows,cols).filter(j=>cells[j].mine).length)return false;
  if(cells[first].mine||adjacent(first,rows,cols).some(i=>cells[i].mine))return false;
  let opened=0;
  function reveal(i){const stack=[i];while(stack.length){const j=stack.pop(),c=cells[j];if(c.open||c.flag||c.mine)continue;c.open=true;opened++;if(c.n===0)for(const n of adjacent(j,rows,cols))if(!cells[n].open)stack.push(n);}}
  reveal(first);
  for(let step=0;step<cells.length*2&&opened<safeCount;step++){
   if(options.deadline&&Date.now()>options.deadline)return false;
   const h=solver.solveBoard({rows,cols,mineCount,cells},options);
   if(h.kind==='safe'){if(cells[h.index].flag||cells[h.index].open||cells[h.index].mine)return false;reveal(h.index);}
   else if(h.kind==='mine'){if(cells[h.index].flag||cells[h.index].open||!cells[h.index].mine)return false;cells[h.index].flag=true;}
   else return false;
  }
  return opened===safeCount;
 }
 function generate(rows,cols,mineCount,first,{maxMs=12000,maxAttempts=500}={}){
  const end=Date.now()+maxMs;let attempts=0;
  while(attempts<maxAttempts&&Date.now()<end){
   attempts++;const board=randomBoard(rows,cols,mineCount,first);
   if(verify(board,rows,cols,mineCount,first,{maxMs:35,maxNodes:40000,deadline:end}))return {ok:true,board,attempts};
  }
  return {ok:false,attempts};
 }
 return {randomBoard,verify,generate};
});
