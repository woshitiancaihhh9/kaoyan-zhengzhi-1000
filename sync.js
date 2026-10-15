/* 跨设备进度同步：把进度保存到你 GitHub 账号下的私密 Gist */
(function(){
  var me=document.currentScript;
  var KEYS=((me&&me.getAttribute('data-keys'))||'').split(',').filter(Boolean);
  if(!KEYS.length||!window.fetch)return;
  var API='https://api.github.com',DESC='kaoyan-progress-sync (auto)';
  var T='gsync.token',G='gsync.gist';
  var LS=window.localStorage,orig=Storage.prototype.setItem,applying=false;
  var loadedAt=Date.now(),touched=false,pushTimer=null,busy=false,ui=null;
  function get(k){try{return LS.getItem(k);}catch(e){return null;}}
  function rawSet(k,v){try{orig.call(LS,k,v);}catch(e){}}
  function tsKey(k){return 'gsync.ts.'+k;}
  function fname(k){return k.replace(/[^\w.-]/g,'_')+'.json';}
  function token(){return get(T);}
  // 监听本地进度写入 -> 自动上传
  Storage.prototype.setItem=function(k,v){
    orig.call(this,k,v);
    if(this===LS&&!applying&&KEYS.indexOf(k)>=0){rawSet(tsKey(k),String(Date.now()));schedulePush();}
  };
  ['click','keydown','touchstart'].forEach(function(e){document.addEventListener(e,function(){touched=true;},{capture:true,passive:true});});

  function gh(method,path,body,keep){
    var o={method:method,cache:'no-store',headers:{'Authorization':'Bearer '+token(),'Accept':'application/vnd.github+json'}};
    if(body){o.body=JSON.stringify(body);o.headers['Content-Type']='application/json';}
    if(keep)o.keepalive=true;
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
  function merge(a,b){ // 首次连接时合并两台设备的已有进度
    if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)){
      var o={},k;for(k in a)o[k]=a[k];for(k in b)o[k]=(k in o)?merge(o[k],b[k]):b[k];return o;}
    if(typeof a==='number'&&typeof b==='number')return Math.max(a,b);
    if(typeof a==='string'&&typeof b==='string')return a>b?a:b;
    return b==null?a:b;
  }
  function localData(k){try{return JSON.parse(get(k)||'null');}catch(e){return null;}}
  function applyLocal(k,data,ts){applying=true;try{LS.setItem(k,JSON.stringify(data));}catch(e){}applying=false;rawSet(tsKey(k),String(ts));}

  function push(keep){
    if(!token()||!get(G))return Promise.resolve();
    var files={};
    KEYS.forEach(function(k){files[fname(k)]={content:JSON.stringify({ts:+(get(tsKey(k))||Date.now()),data:localData(k)||{}})};});
    status('busy','上传中…');
    return gh('PATCH','/gists/'+get(G),{files:files},keep).then(function(){status('ok','已同步 '+hm());}).catch(function(e){status('err',e.message);});
  }
  function schedulePush(){if(!token())return;status('busy','待上传…');clearTimeout(pushTimer);pushTimer=setTimeout(push,1500);}
  function flush(){if(pushTimer){clearTimeout(pushTimer);pushTimer=null;push(true);}}

  function sync(){
    if(!token()||busy)return Promise.resolve();
    busy=true;status('busy','同步中…');
    var changed=false,needPush=false;
    return findGist().then(function(g){
      return Promise.all(KEYS.map(function(k){
        return readRemote(g,k).then(function(r){
          var lt=+(get(tsKey(k))||0),ld=localData(k),linked=get('gsync.linked.'+k)==='1';
          if(!r||!r.data){needPush=true;}
          else if(!linked){
            var m=ld?merge(ld,r.data):r.data;
            if(JSON.stringify(m)!==JSON.stringify(ld)){applyLocal(k,m,Date.now());changed=true;}
            if(JSON.stringify(m)!==JSON.stringify(r.data))needPush=true;
          }
          else if((r.ts||0)>lt){if(JSON.stringify(r.data)!==JSON.stringify(ld)){applyLocal(k,r.data,r.ts);changed=true;}else rawSet(tsKey(k),String(r.ts));}
          else if(lt>(r.ts||0)&&JSON.stringify(r.data)!==JSON.stringify(ld))needPush=true;
          rawSet('gsync.linked.'+k,'1');
        });
      }));
    }).then(function(){return needPush?push():status('ok','已同步 '+hm());})
    .then(function(){
      busy=false;
      if(changed){
        if(!touched||Date.now()-loadedAt<4000)location.reload();
        else status('new','云端有新进度，点我刷新');
      }
    }).catch(function(e){busy=false;status('err',e.message);});
  }
  function hm(){var d=new Date();return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}

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
      btn('立即同步',false,function(){close();sync();});
    }
    btn('关闭',false,close);
    btn(on?'保存新令牌':'开启同步',true,function(){
      var v=inp.value.trim();if(!v){if(on){close();}else inp.focus();return;}
      rawSet(T,v);LS.removeItem(G);close();loadedAt=Date.now();touched=false;sync();
    });
    box.appendChild(row);mask.appendChild(box);
    mask.addEventListener('click',function(e){if(e.target===mask)close();});
    document.body.appendChild(mask);if(!on)inp.focus();
  }
  function start(){
    buildUI();
    if(token())sync();
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='hidden')flush();
      else if(token()){loadedAt=Date.now();touched=false;sync();}
    });
    window.addEventListener('pagehide',flush);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
