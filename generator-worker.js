importScripts('./solver.js','./generator.js');
self.onmessage=event=>{
 const {rows,cols,mineCount,first}=event.data;
 const result=MinesweeperGenerator.generate(rows,cols,mineCount,first);
 self.postMessage(result);
};
