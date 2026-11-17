import {readFile,readdir,mkdir,writeFile,cp,rm} from 'node:fs/promises';
import {marked} from 'marked';
import {shell,card,heading,group,icon,esc,postPath} from './layout.mjs';
import {configuredFolder,readRecords,snapshotPath} from './records.mjs';
const config=JSON.parse(await readFile('site.json','utf8'));
const base=new URL(config.url).pathname.replace(/\/$/,'');
const href=p=>base+p;
const repo=`https://github.com/${config.github}/${config.repository}`;
const posts=[];
for(const file of await readdir('content/posts')){
 if(!file.endsWith('.md'))continue;
 const source=await readFile(`content/posts/${file}`,'utf8');
 const match=source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
 if(!match)throw Error(`Missing frontmatter: ${file}`);
 const meta=Object.fromEntries(match[1].split(/\r?\n/).filter(Boolean).map(line=>{const i=line.indexOf(':');if(i<1)throw Error(`Invalid metadata: ${file}`);return [line.slice(0,i).trim(),line.slice(i+1).trim().replace(/^"(.*)"$/,'$1')];}));
 if(!meta.title||!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)||!Number.isFinite(Date.parse(meta.date)))throw Error(`Invalid title/date: ${file}`);
 if(meta.draft==='true')continue;
 const slug=file.replace(/\.md$/,'');
 if(!/^[a-z0-9-]+$/.test(slug))throw Error(`Invalid filename: ${file}`);
 posts.push({...meta,category:meta.category||'기록',tags:(meta.tags||'').replace(/^\[|\]$/g,'').split(',').map(t=>t.trim()).filter(Boolean),slug,file,body:match[2]});
}
const records = process.argv.includes('--records-preview')
 ? await readRecords(await configuredFolder())
 : JSON.parse(await readFile(snapshotPath,'utf8').catch(error=>{
   if(error.code==='ENOENT')return '[]';
   throw error;
 }));
for(const record of records){
 if(!/^[a-f0-9]{24}$/.test(record.slug))throw Error('Invalid record slug');
 record.kind='record';
}
const byDate=(a,b)=>b.date.localeCompare(a.date)||a.slug.localeCompare(b.slug);
posts.sort(byDate);
records.sort(byDate);
const all=[...posts,...records].sort(byDate);
const categories=[...new Set(all.map(p=>p.category))];
const tags=[...new Set(all.flatMap(p=>p.tags))];
const context={config,posts,all,categories,href,repo};
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
async function page(path,title,body,toc=''){const dir=path==='/'?'dist':`dist${path}`;await mkdir(dir,{recursive:true});await writeFile(`${dir}/index.html`,shell(context,title,body,path,toc));}
await page('/',config.title,`${heading('모든 글',`${posts.length}개의 기록`)}<div class="post-list">${posts.map(p=>card(p,href)).join('')||'<p class="empty">첫 번째 기록을 기다리고 있어요.</p>'}</div>`);
await page('/records/','기록',heading('기록',`옵시디언에서 발행한 ${records.length}개의 기록`)+`<div class="post-list">${records.map(p=>card(p,href)).join('')||'<p class="empty">아직 발행된 기록이 없어요.</p>'}</div>`);
for(const p of all){
 let number=0;const headings=[];const renderer=new marked.Renderer();
 renderer.heading=function({tokens,depth}){const text=this.parser.parseInline(tokens);const id=`section-${++number}`;if(depth===2||depth===3)headings.push({text,depth,id});return `<h${depth} id="${id}">${text}</h${depth}>`;};
 if(p.kind==='record'){
  const renderLink=renderer.link;
  const renderImage=renderer.image;
  renderer.html=({text})=>esc(text);
  renderer.link=function(token){
   return /^(https?:\/\/|mailto:|#)/i.test(token.href)
    ?renderLink.call(this,token):this.parser.parseInline(token.tokens);
  };
  renderer.image=function(token){
   return /^https?:\/\//i.test(token.href)?renderImage.call(this,token):esc(token.text);
  };
 }
 const html=marked.parse(p.body,{renderer});
 const toc=headings.map(h=>`<a class="depth-${h.depth}" href="#${h.id}">${h.text.replace(/<[^>]*>/g,'')}</a>`).join('');
 const mobileToc=toc?`<details class="mobile-toc"><summary>이 글의 목차</summary><nav aria-label="모바일 본문 목차">${toc}</nav></details>`:'';
 const record=p.kind==='record';
 const back=record?['/records/','기록']:['/','모든 글'];
 const edit=record?'':`<a href="${repo}/edit/${config.branch}/content/posts/${p.file}">${icon('edit')}이 글 수정하기</a>`;
 await page(postPath(p),p.title,`<article class="article"><header class="article-header"><a class="back" href="${href(back[0])}">← ${back[1]}</a><h1>${esc(p.title)}</h1><p>${esc(p.description||'')}</p><div class="meta"><time datetime="${p.date}">${icon('calendar')}${p.date.replaceAll('-','. ')}</time><a href="${href('/categories/')}#${encodeURIComponent(p.category)}">${icon('folder')}${esc(p.category)}</a><span class="view-count"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><span>조회수</span><img src="https://hits.sh/${esc(new URL(config.url).host+base)}${postPath(p).slice(0,-1)}.svg?label=%20&amp;style=flat-square&amp;color=transparent&amp;labelColor=transparent" alt="집계 중" height="20" referrerpolicy="no-referrer"></span></div></header>${mobileToc}<div class="prose">${html}</div>${p.tags.length?`<div class="chips article-tags">${p.tags.map(t=>`<a href="${href('/tags/')}#${encodeURIComponent(t)}"># ${esc(t)}</a>`).join('')}</div>`:''}<div class="article-bottom"><span>Written by <strong>${esc(config.author)}</strong></span>${edit}</div></article>`,toc);
}
await page('/categories/','카테고리',heading('카테고리','주제별로 모아 둔 기록입니다.')+categories.map(c=>group(c,all.filter(p=>p.category===c),href)).join(''));
await page('/tags/','태그',heading('태그','키워드로 기록을 찾아보세요.')+(tags.length?tags.map(t=>group(t,all.filter(p=>p.tags.includes(t)),href)).join(''):'<div class="empty">아직 등록된 태그가 없습니다.<p>글이 쌓이면 이곳에서 키워드별로 모아볼 수 있어요.</p></div>'));
await page('/archives/','아카이브',heading('아카이브',`${all.length}개의 기록을 시간순으로 모았습니다.`)+[...new Set(all.map(p=>p.date.slice(0,4)))].map(y=>group(y,all.filter(p=>p.date.startsWith(y)),href)).join(''));
await page('/about/','소개',heading('소개','공부한 내용을 정리합니다.')+`<div class="prose"><p><a href="https://github.com/${esc(config.github)}">GitHub에서 만나기 ↗</a></p></div>`);
await page('/search/','검색',heading('글 검색','제목, 본문, 카테고리에서 찾아보세요.')+`<form class="search-form" role="search"><label for="search-input" class="sr-only">검색어</label>${icon('search')}<input id="search-input" name="q" type="search" placeholder="어떤 기록을 찾고 있나요?" autocomplete="off"><button type="submit">검색</button></form><p id="search-status" role="status" class="search-status">검색어를 입력하세요.</p><div id="search-results"></div>`);
await writeFile('dist/search.json',JSON.stringify(all.map(p=>({title:p.title,description:p.description||'',body:p.body,category:p.category,tags:p.tags,url:href(postPath(p)),date:p.date}))));
await writeFile('dist/feed.xml',`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(config.title)}</title><link>${config.url}</link><description>${esc(config.description)}</description><language>ko</language>${posts.map(p=>`<item><title>${esc(p.title)}</title><link>${config.url}/posts/${p.slug}/</link><guid>${config.url}/posts/${p.slug}/</guid><description>${esc(p.description||p.title)}</description><pubDate>${new Date(p.date+'T12:00:00+09:00').toUTCString()}</pubDate></item>`).join('')}</channel></rss>`);
await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/','/categories/','/tags/','/archives/','/about/','/records/',...all.map(postPath)].map(p=>`<url><loc>${esc(config.url+p)}</loc></url>`).join('')}</urlset>`);
await writeFile('dist/robots.txt',`User-agent: *\nAllow: /\nSitemap: ${config.url}/sitemap.xml\n`);
await writeFile('dist/404.html',shell(context,'페이지를 찾을 수 없습니다',heading('기록을 찾을 수 없어요','주소를 확인하거나 모든 글에서 찾아보세요.')+`<a class="back" href="${href('/')}">← 모든 글로 돌아가기</a>`,'/404.html'));
await writeFile('dist/.nojekyll','');console.log(`Built ${posts.length} posts, ${records.length} records, categories, tags, archives, search, RSS and sitemap.`);
