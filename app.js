(function(){
  var KEY='kz1000.v1',NAVKEY='kz1000.navHidden',VKEY='kz1000.view',store={m:{},w:{},a:{}};
  try{var s=JSON.parse(localStorage.getItem(KEY)||'{}');store.m=s.m||{};store.w=s.w||{};store.a=s.a||{};}catch(e){}
  var view={f:'all',hm:0};try{var vv=JSON.parse(localStorage.getItem(VKEY)||'{}');if(vv.f)view.f=vv.f;view.hm=vv.hm?1:0;}catch(e){}
  function saveView(){try{localStorage.setItem(VKEY,JSON.stringify(view));}catch(e){}}
  function done(id){return !!(store.a[id]||store.m[id]||store.w[id]);}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(store));}catch(e){}}
  var root=document.documentElement,body=document.body;
  // ---- 目录开关 ----
  var btn=document.getElementById('navtoggle');
  function mobile(){return window.matchMedia('(max-width:900px)').matches;}
  if(btn)btn.addEventListener('click',function(){
    if(mobile())body.classList.toggle('nav-open');
    else{var h=root.classList.toggle('nav-hidden');try{localStorage.setItem(NAVKEY,h?'1':'0');}catch(e){}}
  });
  var bd=document.querySelector('.backdrop');if(bd)bd.addEventListener('click',function(){body.classList.remove('nav-open');});
  var cur=document.querySelector('.toc-ch.current');if(cur)cur.scrollIntoView({block:'center'});
  // ---- 进度 ----
  function cnt(map,ch){var p=ch+':',n=0;for(var k in map)if(k.indexOf(p)===0&&map[k])n++;return n;}
  function all(map){var n=0;for(var k in map)if(map[k])n++;return n;}
  function cntDone(ch){var p=ch==null?'':ch+':',s={},n=0;[store.a,store.m,store.w].forEach(function(mp){for(var k in mp)if(mp[k]&&k.indexOf(p)===0&&!s[k]){s[k]=1;n++;}});return n;}
  function dbar(b,pct){if(!b)return;var d=b.previousElementSibling;if(!d||!d.classList.contains('bar-done')){d=document.createElement('span');d.className='bar-done';b.parentNode.insertBefore(d,b);}d.style.width=pct+'%';}
  function refresh(){
    document.querySelectorAll('[data-ch]').forEach(function(el){
      var ch=el.getAttribute('data-ch'),t=+el.getAttribute('data-total')||0,d=cnt(store.m,ch),w=cnt(store.w,ch),dn=Math.min(cntDone(ch),t);
      var p=el.querySelector('[data-prog]');if(p){p.textContent='已做 '+dn+'/'+t+(w?' · 错 '+w:'');p.title='已做 '+dn+' · 待做 '+(t-dn)+' · 已掌握 '+d+' · 错题 '+w;}
      var b=el.querySelector('[data-bar]');if(b)b.style.width=(t?Math.round(d*100/t):0)+'%';dbar(b,t?Math.round(dn*100/t):0);
      el.classList.toggle('ch-done',t>0&&dn>=t);
    });
    document.querySelectorAll('[data-all-total]').forEach(function(el){
      var t=+el.getAttribute('data-all-total'),d=all(store.m),dn=Math.min(cntDone(null),t);
      var p=el.querySelector('[data-all-prog]');if(p)p.textContent='已做 '+dn+' / '+t+' · 待做 '+(t-dn)+' · 已掌握 '+d+' · 错题 '+all(store.w);
      var b=el.querySelector('[data-all-bar]');if(b)b.style.width=(t?(d*100/t).toFixed(1):0)+'%';dbar(b,t?(dn*100/t).toFixed(1):0);
    });
    var st=document.getElementById('stat');
    if(st){var qs=document.querySelectorAll('article.q'),m=0,w=0,dn=0;qs.forEach(function(a){var id=a.dataset.qid;if(store.m[id])m++;if(store.w[id])w++;if(done(id))dn++;});
      st.innerHTML='已做 <b>'+dn+'</b>/'+qs.length+' · 待做 <b>'+(qs.length-dn)+'</b> · 已掌握 '+m+' · 错题 '+w;var ps=document.getElementById('pstat');if(ps)ps.innerHTML='本页 '+st.innerHTML;}
    document.querySelectorAll('article.q').forEach(function(a){var c=a.querySelector('.done-cb');if(!c)return;var id=a.dataset.qid,lk=!!(store.m[id]||store.w[id]);c.checked=done(id);c.disabled=lk;c.parentNode.title=lk?'已标记错题/已掌握，自动算作已做':'';a.classList.toggle('is-done',done(id));});
  }
  // ---- 题目交互 ----
  document.querySelectorAll('article.q').forEach(function(a){
    var id=a.dataset.qid,ans=a.dataset.ans||'',multi=a.dataset.kind==='multi';
    var mcb=a.querySelector('.master-cb'),wcb=a.querySelector('.wrong-cb'),acts=a.querySelector('.q-acts');
    if(acts){var dl=document.createElement('label');dl.className='chip donemark';dl.innerHTML='<input type="checkbox" class="done-cb">已做';acts.insertBefore(dl,acts.firstChild);
      var dcb=dl.querySelector('input');dcb.addEventListener('change',function(){if(dcb.checked)store.a[id]=1;else delete store.a[id];save();refresh();});}
    if(mcb){mcb.checked=!!store.m[id];a.classList.toggle('mastered',mcb.checked);
      mcb.addEventListener('change',function(){if(mcb.checked)store.m[id]=1;else delete store.m[id];a.classList.toggle('mastered',mcb.checked);save();refresh();});}
    if(wcb){wcb.checked=!!store.w[id];
      wcb.addEventListener('change',function(){if(wcb.checked)store.w[id]=1;else delete store.w[id];save();refresh();});}
    var opts=a.querySelectorAll('.opt');if(!opts.length||!ans)return;
    var go=a.querySelector('.go'),vd=a.querySelector('.verdict'),det=a.querySelector('details.ans');
    function judge(){
      var sel='';opts.forEach(function(o){if(o.classList.contains('sel'))sel+=o.dataset.l;});
      a.classList.add('done');
      opts.forEach(function(o){var l=o.dataset.l,isA=ans.indexOf(l)>=0,isS=o.classList.contains('sel');
        o.classList.toggle('right',isA&&isS);o.classList.toggle('wrong',!isA&&isS);o.classList.toggle('miss',isA&&!isS);});
      var ok=sel===ans;store.a[id]=1;save();refresh();
      if(vd){vd.className='verdict '+(ok?'ok':'bad');vd.textContent=ok?'回答正确':'回答错误：你选 '+(sel||'—')+'，正确答案 '+ans+'（已自动加入错题）';}
      if(!ok&&wcb&&!wcb.checked){wcb.checked=true;store.w[id]=1;save();refresh();}
      if(det)det.open=true;
      if(go){go.textContent='重做';}
    }
    function reset(){a.classList.remove('done');opts.forEach(function(o){o.classList.remove('sel','right','wrong','miss');});if(vd)vd.textContent='';if(go){go.textContent='提交';go.disabled=true;}if(det)det.open=false;}
    a._reset=reset;
    opts.forEach(function(o){o.addEventListener('click',function(){
      if(a.classList.contains('done'))return;
      if(multi){o.classList.toggle('sel');if(go)go.disabled=!a.querySelector('.opt.sel');}
      else{opts.forEach(function(x){x.classList.remove('sel');});o.classList.add('sel');judge();}
    });});
    if(go)go.addEventListener('click',function(){if(a.classList.contains('done'))reset();else judge();});
  });
  // ---- 筛选 ----
  var seg=document.querySelector('.toolbar .seg');
  if(seg){
    seg.innerHTML='<label><input type="radio" name="flt" value="all"><span>全部</span></label><label><input type="radio" name="flt" value="undone"><span>未做</span></label><label><input type="radio" name="flt" value="wrong"><span>错题</span></label>';
    if(['all','undone','wrong'].indexOf(view.f)<0)view.f='all';
    seg.querySelector('input[value="'+view.f+'"]').checked=true;
    var hl=document.createElement('label');hl.className='hm-toggle';hl.innerHTML='<input type="checkbox" id="hidem"><span>屏蔽已掌握</span>';
    seg.parentNode.insertBefore(hl,seg.nextSibling);
    var hcb=hl.querySelector('input');hcb.checked=!!view.hm;
    hcb.addEventListener('change',function(){view.hm=hcb.checked?1:0;saveView();applyFilter();});
  }
  function applyFilter(){
    var f=(document.querySelector('input[name=flt]:checked')||{}).value||'all',shown=0,hm=view.hm;
    document.querySelectorAll('article.q').forEach(function(a){var id=a.dataset.qid,h=false;
      if(f==='undone')h=done(id);else if(f==='wrong')h=!store.w[id];
      if(hm&&store.m[id])h=true;
      a.classList.toggle('hide',h);if(!h)shown++;});
    var e=document.getElementById('empty');if(e){e.style.display=shown?'none':'block';e.textContent=f==='undone'?'本章题目都做过了 🎉':f==='wrong'?'这个筛选下没有错题 🎉':'这个筛选下没有题目 🎉';}
  }
  document.querySelectorAll('input[name=flt]').forEach(function(r){r.addEventListener('change',function(){view.f=r.value;saveView();applyFilter();});});
  var ex=document.getElementById('expand');
  if(ex)ex.addEventListener('click',function(){var ds=document.querySelectorAll('details.ans'),open=ex.dataset.open!=='1';ds.forEach(function(d){d.open=open;});ex.dataset.open=open?'1':'0';ex.textContent=open?'收起全部答案':'展开全部答案';});
  var redo=document.getElementById('redo');
  if(redo)redo.addEventListener('click',function(){document.querySelectorAll('article.q').forEach(function(a){if(a._reset)a._reset();});window.scrollTo(0,0);});
  var rs=document.getElementById('reset-progress');
  if(rs)rs.addEventListener('click',function(){if(confirm('确定清空全部“已做”“已掌握”和“错题”记录？')){store={m:{},w:{},a:{}};save();location.reload();}});
  var exp=document.getElementById('export');
  if(exp)exp.addEventListener('click',function(){var t=JSON.stringify(store);prompt('复制以下内容即可在其他设备导入：',t);});
  var imp=document.getElementById('import');
  if(imp)imp.addEventListener('click',function(){var t=prompt('粘贴之前导出的进度：');if(!t)return;try{var s=JSON.parse(t);store={m:s.m||{},w:s.w||{},a:s.a||{}};save();location.reload();}catch(e){alert('格式不正确');}});
  (function(){var t=document.querySelector('.toolbar');if(t&&!document.getElementById('pstat')){var d=document.createElement('div');d.className='pstat';d.id='pstat';t.parentNode.insertBefore(d,t.nextSibling);}})();
  refresh();applyFilter();
})();
