import{readFile,mkdir,writeFile,cp}from'node:fs/promises';
const hosting=JSON.parse(await readFile('.openai/hosting.json','utf8'));
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/.openai/hosting.json',JSON.stringify(hosting,null,2)+'\n');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
