const fs=require('node:fs');
const path=require('node:path');
const generator=require('../generator.js');
const library=require('../puzzle-library.js');

const target=path.join(__dirname,'..','puzzle-data.js');
const levels=[[9,9,10],[16,16,40],[16,30,99]];
const previous=process.argv.includes('--extend')?require('../puzzle-data.js'):{};
const data={};
for(const [rows,cols,mines] of levels){
 const indices=new Set();
 for(let first=0;first<rows*cols;first++)indices.add(library.canonical(rows,cols,first).index);
 for(const first of [...indices].sort((a,b)=>a-b)){
  const key=rows+'x'+cols+'/'+first;
  const saved=previous[key],variants=typeof saved==='string'?[saved]:Array.isArray(saved)?saved.slice():[];
  for(let variant=0;variant<variants.length;variant++){
   const board=library.getBoard(rows,cols,mines,first,variant);
   if(!board||!generator.verify(board,rows,cols,mines,first))throw Error('Old puzzle failed verification: '+key);
  }
  while(variants.length<2){
   let result;
   for(let retry=0;retry<6;retry++){
    result=generator.generate(rows,cols,mines,first,{maxMs:12000,maxAttempts:1000});
    if(result.ok)break;
   }
   if(!result?.ok||!generator.verify(result.board,rows,cols,mines,first))throw Error('Could not verify '+key);
   const hex=library.encode(result.board);
   if(!variants.includes(hex))variants.push(hex);
  }
  data[key]=variants;
  process.stdout.write('.');
 }
 console.log(' '+rows+'x'+cols+': '+indices.size+' verified boards');
}
const source='(function(root){const data='+JSON.stringify(data)+';if(typeof module==="object"&&module.exports)module.exports=data;else root.MinesweeperPuzzleData=data;})(typeof globalThis!=="undefined"?globalThis:this);\n';
fs.writeFileSync(target,source);
console.log('Saved '+Object.keys(data).length+' boards to '+target);
