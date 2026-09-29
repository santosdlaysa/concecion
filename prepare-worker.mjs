import{readFile,mkdir,writeFile,cp,readdir}from'node:fs/promises';
const hosting=JSON.parse(await readFile('.openai/hosting.json','utf8'));
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/.openai/hosting.json',JSON.stringify(hosting,null,2)+'\n');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
await mkdir('dist/client',{recursive:true});
for(const entry of await readdir('dist',{withFileTypes:true}))if(!['server','client','.openai'].includes(entry.name))await cp(`dist/${entry.name}`,`dist/client/${entry.name}`,{recursive:true,force:true});
