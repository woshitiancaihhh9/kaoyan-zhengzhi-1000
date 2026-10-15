/* 跨设备进度同步：把进度保存到你 GitHub 账号下的私密 Gist */
(function(){
  var me=document.currentScript;
  var KEYS=((me&&me.getAttribute('data-keys'))||'').split(',').filter(Boolean);
  if(!KEYS.length||!window.fetch)return;
  var API='https://api.github.com',DESC='kaoyan-progress-sync (auto)';
  var T='gsync.token',G='gsync.gist';
  var LS=window.localStorage,orig=Storage.prototype.setItem;
  var loadedAt=Date.now(),touched=false,pushTimer=null,busy=false,again=false,ui=null,SEP='\u0001';
  function get(k){try{return LS.getItem(k);}catch(e){return null;}}
  function rawSet(k,v){try{orig.call(LS,k,v);}catch(e){}}
  function jget(k,d){try{var v=JSON.parse(get(k)||'null');return v==null?d:v;}catch(e){return d;}}
  function token(){return get(T);}
  function fname(k){return k.replace(/[^\w.-]/g,'_')+'.json';}
  function metaKey(k){return 'gsync.meta.'+k;}
  function dirtyKey(k){return 'gsync.dirty.'+k;}
  // 把进度对象拍平成「题目 → 值」，按题目逐条合并
  function flat(o,pre,out){out=out||{};if(o&&typeof o==='object'&&!Array.isArray(o)){for(var k in o){var p=pre?pre+SEP+k:k,v=o[k];if(v&&typeof v==='object'&&!Array.isArray(v))flat(v,p,out);else out[p]=v;}}return out;}
  function unflat(f,tpl){var o={},k;if(tpl&&typeof tpl==='object')for(k in tpl)if(tpl[k]&&typeof tpl[k]==='object'&&!Array.isArray(tpl[k]))o[k]={};
    for(var p in f){var ks=p.split(SEP),c=o;for(var i=0;i<ks.length-1;i++){if(!c[ks[i]]||typeof c[ks[i]]!=='object')c[ks[i]]={};c=c[ks[i]];}c[ks[ks.length-1]]=f[p];}return o;}
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  var base={},tpl={};
  KEYS.forEach(function(k){var v=jget(k,{});tpl[k]=v;base[k]=flat(v);});
  // 记录本页的真实改动（勾选/取消），带时间戳写入本地
  Storage.prototype.setItem=function(k,v){
    if(this!==LS||KEYS.indexOf(k)<0)return orig.call(this,k,v);
    var nv;try{nv=JSON.parse(v);}catch(e){return orig.call(this,k,v);}
    var nf=flat(nv),of=base[k]||{},cur=flat(jget(k,{})),meta=jget(metaKey(k),{}),now=Date.now(),ch=false,p;
    for(p in nf)if(!(p in of)||!same(nf[p],of[p])){cur[p]=nf[p];meta[p]=now;ch=true;}
    for(p in of)if(!(p in nf)){delete cur[p];meta[p]=now;ch=true;}
    base[k]=nf;tpl[k]=nv;
    orig.call(LS,k,JSON.stringify(unflat(cur,nv)));
    if(ch){rawSet(metaKey(k),JSON.stringify(meta));rawSet(dirtyKey(k),'1');schedulePush();}
  };
  ['click','keydown','touchstart'].forEach(function(e){document.addEventListener(e,function(){touched=true;},{capture:true,passive:true});});

  function gh(method,path,body,keep){
    var o={method:method,cache:'no-store',headers:{'Authorization':'Bearer '+token(),'Accept':'application/vnd.github+json'}};
    if(body){o.body=JSON.stringify(body);o.headers['Content-Type']='application/json';}
    if(keep&&o.body&&o.body.length<60000)o.keepalive=true;
    return fetch(API+path,o).then(function(r){
      if(r.status===401)throw new Error('令牌无效或已过期');
      if(r.status===403||r.status===404)throw new Error('令牌没有 Gist 权限（'+r.status+'）');
      if(!r.ok)throw new Error('GitHub 返回 '+r.status);
      return r.status===204?null:r.json();
    });
  }
  function findGist(){
    var id=get(G);if(id)return gh('GET','/gists/'+id).catch(function(e){if(/404/.test(e.message)){LS.removeItem(G);return findGist();}throw e;});
    return gh('GET','/gists?per_page=100').then(function(list){
      for(var i=0;i<list.length;i++)if(list[i].description===DESC){rawSet(G,list[i].id);return gh('GET','/gists/'+list[i].id);}
      return gh('POST','/gists',{description:DESC,public:false,files:{'README.md':{content:'考研刷题网站的进度同步数据，请勿手动修改。'}}}).then(function(g){rawSet(G,g.id);return g;});
    });
  }
  function readRemote(g,k){
    var f=g.files&&g.files[fname(k)];if(!f)return Promise.resolve(null);
    var p=f.truncated?fetch(f.raw_url,{cache:'no-store'}).then(function(r){return r.text();}):Promise.resolve(f.content);
    return p.then(function(t){try{return JSON.parse(t);}catch(e){return null;}});
  }
  // 逐题合并：同一题以较新的改动为准；都没有时间记录（旧数据）就取并集
  function mergeFlat(lf,lm,rf,rm){
    var out={},meta={},seen={},p,all=[lf,lm,rf,rm];
    all.forEach(function(o){for(var q in o)seen[q]=1;});
    for(p in seen){
      var lt=lm[p]||0,rt=rm[p]||0,useR;
      if(lt||rt)useR=rt>lt;else useR=!(p in lf);
      var src=useR?rf:lf;if(p in src)out[p]=src[p];
      if(lt||rt)meta[p]=Math.max(lt,rt);
    }
    return {f:out,m:meta};
  }
  function payload(){var files={};KEYS.forEach(function(k){files[fname(k)]={content:JSON.stringify({v:2,data:jget(k,{}),meta:jget(metaKey(k),{})})};});return files;}
  function quickPush(){ // 页面关闭/切走时尽量把未上传的改动发出去
    if(!token()||!get(G))return;
    if(!KEYS.some(function(k){return get(dirtyKey(k))==='1';}))return;
    clearTimeout(pushTimer);pushTimer=null;
    gh('PATCH','/gists/'+get(G),{files:payload()},true).then(function(){KEYS.forEach(function(k){LS.removeItem(dirtyKey(k));});}).catch(function(){});
  }
  function schedulePush(){if(!token())return;status('busy','待上传…');clearTimeout(pushTimer);pushTimer=setTimeout(function(){pushTimer=null;sync();},1500);}

  // 拉取 → 合并 → 写回本地 → 有差异就上传
  function sync(){
    if(!token())return Promise.resolve();
    if(busy){again=true;return Promise.resolve();}
    busy=true;again=false;status('busy','同步中…');
    var changed=false,needPush=false,g0;
    return findGist().then(function(g){g0=g;
      return Promise.all(KEYS.map(function(k){
        return readRemote(g,k).then(function(r){
          var lf=flat(jget(k,{})),lm=jget(metaKey(k),{});
          var rf=r&&r.data?flat(r.data):{},rm=r&&r.meta?r.meta:{};
          var m=mergeFlat(lf,lm,rf,rm);
          if(!same(m.f,lf)||!same(m.m,lm)){
            if(!same(m.f,lf))changed=true;
            rawSet(k,JSON.stringify(unflat(m.f,tpl[k])));rawSet(metaKey(k),JSON.stringify(m.m));
          }
          if(!r||!same(m.f,rf)||!same(m.m,rm))needPush=true;
        });
      }));
    }).then(function(){
      if(!needPush)return;
      status('busy','上传中…');
      return gh('PATCH','/gists/'+get(G),{files:payload()});
    }).then(function(){
      KEYS.forEach(function(k){LS.removeItem(dirtyKey(k));});
      busy=false;status('ok','已同步 '+hm());
      if(changed){
        if(!touched||Date.now()-loadedAt<4000)return location.reload();
        status('new','有其他设备的新进度，点我刷新');
      }
      if(again)sync();
    }).catch(function(e){busy=false;status('err',e.message);});
  }
  function hm(){var d=new Date();return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
  function wake(){if(!token())return;loadedAt=Date.now();touched=false;sync();}

  // ---- 界面 ----
  var st={s:'off',t:'未开启跨设备同步'};
  function status(s,t){st={s:s,t:t};if(ui)paint();}
  function paint(){
    var c={off:'#888',busy:'#d08a00',ok:'#2a9d4b',err:'#d33',new:'#2b6cd6'}[st.s]||'#888';
    ui.dot.style.background=c;ui.txt.textContent=st.t;ui.txt.style.display=st.s==='ok'?'none':'';ui.btn.title=st.t;ui.btn.style.opacity=st.s==='ok'?'.75':'1';
  }
  function el(t,css,txt){var e=document.createElement(t);if(css)e.style.cssText=css;if(txt!=null)e.textContent=txt;return e;}
  function buildUI(){
    var b=el('button','position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid rgba(0,0,0,.15);border-radius:999px;background:rgba(255,255,255,.92);color:#333;font:12px/1.2 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.12);cursor:pointer;backdrop-filter:blur(4px)');
    var dot=el('span','width:8px;height:8px;border-radius:50%;display:inline-block');
    var txt=el('span');b.appendChild(el('span',null,'☁'));b.appendChild(dot);b.appendChild(txt);
    b.addEventListener('click',function(){if(st.s==='new')location.reload();else openDlg();});
    document.body.appendChild(b);ui={btn:b,dot:dot,txt:txt};paint();
  }
  function openDlg(){
    var mask=el('div','position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px');
    var box=el('div','background:#fff;color:#222;max-width:420px;width:100%;border-radius:12px;padding:18px;font:14px/1.6 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)');
    box.appendChild(el('div','font-size:16px;font-weight:600;margin-bottom:6px','☁ 跨设备进度同步'));
    var on=!!token();
    box.appendChild(el('div','color:#555;font-size:13px;margin-bottom:10px',on?'已开启。进度会自动保存到你 GitHub 的私密 Gist，平板、电脑、手机打开时自动拉取最新进度。当前状态：'+st.t:'粘贴一个只有 gist 权限的 GitHub 令牌即可开启。每台设备只需设置一次，三个刷题网站共用。'));
    var a=el('a','display:inline-block;font-size:13px;margin-bottom:8px;color:#2b6cd6','→ 去 GitHub 生成令牌（已勾好 gist 权限）');
    a.href='https://github.com/settings/tokens/new?scopes=gist&description=kaoyan-progress-sync';a.target='_blank';a.rel='noopener';
    if(!on)box.appendChild(a);
    var inp=el('input','width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #ccc;border-radius:8px;font:13px monospace;margin-bottom:10px');
    inp.type='password';inp.placeholder=on?'（如需更换令牌，在此粘贴新令牌）':'ghp_… 粘贴令牌';inp.autocomplete='off';
    box.appendChild(inp);
    var row=el('div','display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end');
    function btn(t,primary,fn){var x=el('button','padding:7px 12px;border-radius:8px;border:1px solid '+(primary?'#2b6cd6':'#ccc')+';background:'+(primary?'#2b6cd6':'#fff')+';color:'+(primary?'#fff':'#333')+';font:13px system-ui;cursor:pointer',t);x.addEventListener('click',fn);row.appendChild(x);}
    function close(){mask.remove();}
    if(on){
      btn('断开同步',false,function(){if(confirm('断开后本设备不再同步（本地进度保留，云端数据保留）。确定？')){LS.removeItem(T);LS.removeItem(G);status('off','未开启跨设备同步');close();}});
      btn('立即同步',false,function(){close();wake();});
    }
    btn('关闭',false,close);
    btn(on?'保存新令牌':'开启同步',true,function(){
      var v=inp.value.trim();if(!v){if(on){close();}else inp.focus();return;}
      rawSet(T,v);LS.removeItem(G);close();wake();
    });
    box.appendChild(row);mask.appendChild(box);
    mask.addEventListener('click',function(e){if(e.target===mask)close();});
    document.body.appendChild(mask);if(!on)inp.focus();
  }
  function start(){
    buildUI();
    if(token())sync();
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')quickPush();else wake();});
    window.addEventListener('focus',wake);
    window.addEventListener('online',wake);
    window.addEventListener('pagehide',quickPush);
    setInterval(function(){if(document.visibilityState==='visible'&&token()&&!busy)sync();},60000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
