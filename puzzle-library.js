(function(root,factory){
 const data=typeof module==='object'&&module.exports?require('./puzzle-data.js'):root.MinesweeperPuzzleData;
 const api=factory(data);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MinesweeperPuzzleLibrary=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(data){
 const lastByKey=new Map();
 function transforms(rows,cols){return rows===cols?8:4;}
 function transform(index,rows,cols,kind){
  let r=Math.floor(index/cols),c=index%cols;
  if(kind>=4)[r,c]=[c,r];
  if(kind&1)c=cols-1-c;
  if(kind&2)r=rows-1-r;
  return r*cols+c;
 }
 function canonical(rows,cols,first){
  let index=first,kind=0;
  for(let k=1;k<transforms(rows,cols);k++){
   const candidate=transform(first,rows,cols,k);
   if(candidate<index){index=candidate;kind=k;}
  }
  return {index,kind,key:rows+'x'+cols+'/'+index};
 }
 function encode(board){
  let hex='';
  for(let i=0;i<board.length;i+=4){
   let bits=0;
   for(let j=0;j<4&&i+j<board.length;j++)if(board[i+j].mine)bits|=1<<j;
   hex+=bits.toString(16);
  }
  return hex;
 }
 function getBoard(rows,cols,mineCount,first,variantIndex){
  const {key,kind}=canonical(rows,cols,first),entry=data&&data[key];
  const variants=typeof entry==='string'?[entry]:entry;
  if(!Array.isArray(variants)||!variants.length)return null;
  const previous=lastByKey.get(key),pick=variantIndex??(variants.length===1?0:(previous===undefined?Math.floor(Math.random()*variants.length):(previous+1+Math.floor(Math.random()*(variants.length-1)))%variants.length));
  if(pick<0||pick>=variants.length)return null;
  if(variantIndex===undefined)lastByKey.set(key,pick);
  const hex=variants[pick];
  if(typeof hex!=='string'||hex.length!==Math.ceil(rows*cols/4))return null;
  const cells=Array.from({length:rows*cols},(_,i)=>{
   const source=transform(i,rows,cols,kind);
   return {mine:!!(parseInt(hex[Math.floor(source/4)],16)&(1<<(source%4))),n:0,open:false,flag:false};
  });
  if(cells.reduce((count,c)=>count+c.mine,0)!==mineCount)return null;
  for(let i=0;i<cells.length;i++){
   const r=Math.floor(i/cols),c=i%cols;
   for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    if(!dr&&!dc)continue;
    const y=r+dr,x=c+dc;
    if(y>=0&&y<rows&&x>=0&&x<cols&&cells[y*cols+x].mine)cells[i].n++;
   }
  }
  return cells;
 }
 return {canonical,encode,getBoard};
});
