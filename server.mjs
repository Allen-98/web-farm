import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url)),dist=path.join(root,'dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8','.ts':'text/plain; charset=utf-8'};
const port=Number(process.env.FARM_PORT||8792);
http.createServer((request,response)=>{
  try{
    const url=new URL(request.url,'http://localhost');
    if(url.pathname==='/health'){response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({app:'farm-and-flow',version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version}));return;}
    const design=url.pathname.startsWith('/design/'),base=design?path.join(root,'docs','reference'):dist;
    const relative=decodeURIComponent(design?url.pathname.slice('/design/'.length):url.pathname==='/'?'index.html':url.pathname.slice(1));
    const file=path.resolve(base,relative);
    if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404);response.end('Not found');return;}
    response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(response);
  }catch{response.writeHead(400);response.end('Bad request');}
}).listen(port,'127.0.0.1',()=>console.log(`田园小掌柜 http://127.0.0.1:${port}`));
