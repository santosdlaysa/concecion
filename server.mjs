import http from 'node:http';
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.txt':'text/plain'};
// Local and Vercel previews use the published marketplace's accounts and data.
const apiOrigin='https://vertice-motors.laysadiniz.chatgpt.site';
const hosted=process.env.VERCEL==='1';
const productionHosts=new Set(['concecion.vercel.app']);
const localOrigins=new Set(['http://localhost:4173','http://127.0.0.1:4173']);
function requestOrigin(req){
  const host=req.headers.host;
  if(typeof host!=='string'||!/^[a-z0-9.-]+(?::\d+)?$/i.test(host))return null;
  if(hosted||productionHosts.has(host.toLowerCase()))return `https://${host.toLowerCase()}`;
  const origin=`http://${host.toLowerCase()}`;
  return localOrigins.has(origin)?origin:null;
}
function proxyMarketplace(req,res){
  if(req.headers.origin&&req.headers.origin!==requestOrigin(req)){res.writeHead(403);return res.end('Origem inválida.');}
  const headers={};
  for(const name of ['content-type','content-length','accept'])if(req.headers[name])headers[name]=req.headers[name];
  const session=req.headers.cookie?.match(/(?:^|;\s*)(vertice_session=[\w-]{30,100})/);
  if(session)headers.cookie=session[1];
  if(req.headers.origin)headers.origin=apiOrigin;
  const incoming=new URL(req.url,'http://localhost:4173');
  const target=new URL(apiOrigin);target.pathname=incoming.pathname;target.search=incoming.search;
  const upstream=https.request(target,{method:req.method,headers},response=>{
    const outgoing={...response.headers};
    // Only local HTTP drops Secure; Vercel keeps HTTPS session protection.
    if(requestOrigin(req)?.startsWith('http://')&&outgoing['set-cookie'])outgoing['set-cookie']=outgoing['set-cookie'].map(value=>value.replace(/;\s*Secure\b/gi,''));
    res.writeHead(response.statusCode,outgoing);
    response.pipe(res);
  });
  upstream.setTimeout(30000,()=>upstream.destroy(new Error('Upstream timeout')));
  upstream.on('error',()=>{if(res.headersSent)return res.destroy();res.writeHead(502,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'Não foi possível conectar ao site. Tente novamente.'}));});
  req.on('aborted',()=>upstream.destroy());
  req.pipe(upstream);
}
http.createServer(async(req,res)=>{
  if(!requestOrigin(req)){res.writeHead(403);return res.end('Host inválido.');}
  const url=new URL(req.url,'http://localhost:4173');
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/media/'))return proxyMarketplace(req,res);
  try{let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path===root)path=resolve(root,'index.html');if(!path.startsWith(root+sep)){res.writeHead(403);return res.end();}const data=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT)||4173,hosted?'0.0.0.0':'127.0.0.1',()=>console.log(`Server: http://localhost:${Number(process.env.PORT)||4173}`));

