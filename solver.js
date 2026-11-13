/* Visible-board Minesweeper solver. Flags are not trusted as facts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MinesweeperSolver=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
 function solveBoard({rows,cols,mineCount,cells},options={}){
  const neighbors=i=>{const r=Math.floor(i/cols),c=i%cols,a=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const y=r+dr,x=c+dc;if(y>=0&&y<rows&&x>=0&&x<cols)a.push(y*cols+x);}return a;};
  const unknown=[];const constraints=[];
  for(let i=0;i<cells.length;i++)if(!cells[i].open)unknown.push(i);
  for(let i=0;i<cells.length;i++)if(cells[i].open){
   const vars=neighbors(i).filter(j=>!cells[j].open);
   if(vars.length)constraints.push({vars,sum:cells[i].n,clue:i});
  }
  return solveModel({unknown,constraints,mineCount,flagged:new Set(unknown.filter(i=>cells[i].flag))},options);
 }
 function solveModel({unknown,constraints,mineCount,flagged=new Set()},options={}){
  const playable=unknown.filter(v=>!flagged.has(v));
  if(!playable.length)return {kind:'none'};
  const find=(vars,kind,source,clues)=>{
   const v=vars.find(x=>!flagged.has(x))??(kind==='safe'?vars[0]:undefined);
   if(v===undefined)return null;
   return {kind,index:v,probability:kind==='safe'?0:1,source,clues};
  };
  if(mineCount<0||mineCount>unknown.length)return {kind:'inconsistent'};
  if(mineCount===0||mineCount===unknown.length){const h=find(unknown,mineCount===0?'safe':'mine','global',[]);if(h)return h;}
  for(const c of constraints){
   if(c.sum<0||c.sum>c.vars.length)return {kind:'inconsistent'};
   if(c.sum===0||c.sum===c.vars.length){const h=find(c.vars,c.sum===0?'safe':'mine','single',[c.clue]);if(h)return h;}
  }
  for(let a=0;a<constraints.length;a++)for(let b=a+1;b<constraints.length;b++){
   for(const [small,big] of [[constraints[a],constraints[b]],[constraints[b],constraints[a]]]){
    if(small.vars.length>=big.vars.length)continue;
    const s=new Set(small.vars);if(!small.vars.every(v=>big.vars.includes(v)))continue;
    const difference=big.vars.filter(v=>!s.has(v)),remaining=big.sum-small.sum;
    if(remaining===0||remaining===difference.length){const h=find(difference,remaining===0?'safe':'mine','subset',[small.clue,big.clue]);if(h)return h;}
   }
  }
  const boundary=[...new Set(constraints.flatMap(c=>c.vars))],boundarySet=new Set(boundary),free=unknown.filter(v=>!boundarySet.has(v));
  if(!boundary.length)return guessFromBaseline(playable,mineCount/unknown.length,true);
  const parent=new Map(boundary.map(v=>[v,v]));
  function root(v){let p=parent.get(v);while(p!==parent.get(p))p=parent.get(p);return p;}
  function union(a,b){parent.set(root(a),root(b));}
  for(const c of constraints)for(let j=1;j<c.vars.length;j++)union(c.vars[0],c.vars[j]);
  const groups=new Map();for(const v of boundary){const p=root(v);if(!groups.has(p))groups.set(p,{vars:[],constraints:[],clues:[]});groups.get(p).vars.push(v);}
  for(const c of constraints){const g=groups.get(root(c.vars[0]));g.constraints.push(c);g.clues.push(c.clue);}
  const deadline=now()+(options.maxMs??85),maxNodes=options.maxNodes??120000;
  let nodes=0,complete=true;
  const components=[];
  for(const group of groups.values()){
   const result=enumerate(group,()=>{nodes++;return nodes<=maxNodes&&(nodes&1023||now()<deadline);});
   if(!result){complete=false;break;}
   if(result.total===0n)return {kind:'inconsistent'};
   components.push(result);
   for(const v of result.vars){
    const mines=result.mineByVar.get(v).reduce((a,b)=>a+b,0n);
    if(mines===0n||mines===result.total){const h=find([v],mines===0n?'safe':'mine','csp',result.clues);if(h)return h;}
   }
  }
  if(!complete)return estimatedGuess(playable,constraints,mineCount,unknown.length);
  const cap=mineCount;
  const convolution=(a,b)=>{const out=Array(Math.min(cap,a.length+b.length-2)+1).fill(0n);for(let i=0;i<a.length;i++)if(a[i])for(let j=0;j<b.length&&i+j<out.length;j++)if(b[j])out[i+j]+=a[i]*b[j];return out;};
  const prefix=[[1n]],suffix=Array(components.length+1);suffix[components.length]=[1n];
  for(const c of components)prefix.push(convolution(prefix.at(-1),c.byMines));
  for(let i=components.length-1;i>=0;i--)suffix[i]=convolution(components[i].byMines,suffix[i+1]);
  const chooseMemo=new Map();
  function choose(n,k){if(k<0||k>n)return 0n;k=Math.min(k,n-k);const key=n+','+k;if(chooseMemo.has(key))return chooseMemo.get(key);let v=1n;for(let i=1;i<=k;i++)v=v*BigInt(n-k+i)/BigInt(i);chooseMemo.set(key,v);return v;}
  function weighted(poly,freeCount){let sum=0n;for(let used=0;used<poly.length;used++)if(poly[used])sum+=poly[used]*choose(freeCount,mineCount-used);return sum;}
  const total=weighted(prefix.at(-1),free.length);
  if(total===0n)return {kind:'inconsistent'};
  const probabilities=new Map();
  for(let i=0;i<components.length;i++){
   const c=components[i],others=convolution(prefix[i],suffix[i+1]);
   for(const v of c.vars){
    const mineWays=weighted(convolution(others,c.mineByVar.get(v)),free.length);
    probabilities.set(v,mineWays);
   }
  }
  if(free.length){ // One specified free cell is a mine.
   let count=0n;for(let used=0;used<prefix.at(-1).length;used++)if(prefix.at(-1)[used])count+=prefix.at(-1)[used]*choose(free.length-1,mineCount-used-1);
   for(const v of free)probabilities.set(v,count);
  }
  for(const v of unknown){const ways=probabilities.get(v);if(ways===0n||ways===total){const kind=ways===0n?'safe':'mine',c=components.find(x=>x.vars.includes(v));const h=find([v],kind,'global-csp',c?c.clues:[]);if(h)return h;}}
  let best=null;for(const v of playable){const ways=probabilities.get(v);if(!best||ways<best.ways)best={v,ways};}
  return {kind:'guess',index:best.v,probability:Number(best.ways*1000000n/total)/1000000,source:'exact',clues:components.find(x=>x.vars.includes(best.v))?.clues||[]};
 }
 function enumerate(group,keepGoing){
  const vars=group.vars.slice().sort((a,b)=>group.constraints.filter(c=>c.vars.includes(b)).length-group.constraints.filter(c=>c.vars.includes(a)).length);
  const byMines=Array(vars.length+1).fill(0n),mineByVar=new Map(vars.map(v=>[v,Array(vars.length+1).fill(0n)]));
  const incident=new Map(vars.map(v=>[v,group.constraints.filter(c=>c.vars.includes(v))]));
  const state=new Map(group.constraints.map(c=>[c,{assigned:0,mines:0}]));
  const picked=[];let total=0n,aborted=false;
  function visit(depth,mines){
   if(!keepGoing()){aborted=true;return;}
   if(depth===vars.length){byMines[mines]++;total++;for(const v of picked)mineByVar.get(v)[mines]++;return;}
   const v=vars[depth];
   for(const value of [0,1]){
    let valid=true;for(const c of incident.get(v)){const s=state.get(c);s.assigned++;s.mines+=value;if(s.mines>c.sum||s.mines+c.vars.length-s.assigned<c.sum)valid=false;}
    if(valid){if(value)picked.push(v);visit(depth+1,mines+value);if(value)picked.pop();}
    for(const c of incident.get(v)){const s=state.get(c);s.assigned--;s.mines-=value;}
    if(aborted)return;
   }
  }
  visit(0,0);
  return aborted?null:{...group,vars,byMines,mineByVar,total};
 }
 function guessFromBaseline(playable,p,exact){return {kind:'guess',index:playable[0],probability:p,source:exact?'exact':'estimate',clues:[]};}
 function estimatedGuess(playable,constraints,mineCount,unknownCount){
  let best=null;const baseline=mineCount/unknownCount;
  for(const v of playable){const touching=constraints.filter(c=>c.vars.includes(v));const estimate=touching.length?Math.min(baseline,...touching.map(c=>c.sum/c.vars.length)):baseline;if(!best||estimate<best.estimate)best={v,estimate,clues:touching.map(c=>c.clue)};}
  return {kind:'guess',index:best.v,probability:Math.max(0.001,Math.min(0.999,best.estimate)),source:'estimate',clues:best.clues};
 }
 return {solveBoard,solveModel};
});
