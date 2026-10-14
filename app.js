(function(){
  var KEY='kz1000.v1',NAVKEY='kz1000.navHidden',store={m:{},w:{}};
  try{var s=JSON.parse(localStorage.getItem(KEY)||'{}');store.m=s.m||{};store.w=s.w||{};}catch(e){}
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
  function refresh(){
    document.querySelectorAll('[data-ch]').forEach(function(el){
      var ch=el.getAttribute('data-ch'),t=+el.getAttribute('data-total')||0,d=cnt(store.m,ch),w=cnt(store.w,ch);
      var p=el.querySelector('[data-prog]');if(p)p.textContent=d+'/'+t+(w&&el.hasAttribute('data-showw')?' · 错 '+w:'');
      var b=el.querySelector('[data-bar]');if(b)b.style.width=(t?Math.round(d*100/t):0)+'%';
      el.classList.toggle('ch-done',t>0&&d>=t);
    });
    document.querySelectorAll('[data-all-total]').forEach(function(el){
      var t=+el.getAttribute('data-all-total'),d=all(store.m);
      var p=el.querySelector('[data-all-prog]');if(p)p.textContent='已掌握 '+d+' / '+t+' · 错题 '+all(store.w);
      var b=el.querySelector('[data-all-bar]');if(b)b.style.width=(t?(d*100/t).toFixed(1):0)+'%';
    });
    var st=document.getElementById('stat');
    if(st){var qs=document.querySelectorAll('article.q'),m=0,w=0;qs.forEach(function(a){if(store.m[a.dataset.qid])m++;if(store.w[a.dataset.qid])w++;});st.textContent='本章 已掌握 '+m+'/'+qs.length+' · 错题 '+w;}
  }
  // ---- 题目交互 ----
  document.querySelectorAll('article.q').forEach(function(a){
    var id=a.dataset.qid,ans=a.dataset.ans||'',multi=a.dataset.kind==='multi';
    var mcb=a.querySelector('.master-cb'),wcb=a.querySelector('.wrong-cb');
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
      var ok=sel===ans;
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
  function applyFilter(){
    var f=(document.querySelector('input[name=flt]:checked')||{}).value||'all',shown=0;
    document.querySelectorAll('article.q').forEach(function(a){var id=a.dataset.qid,h=false;
      if(f==='todo')h=!!store.m[id];else if(f==='wrong')h=!store.w[id];
      a.classList.toggle('hide',h);if(!h)shown++;});
    var e=document.getElementById('empty');if(e)e.style.display=shown?'none':'block';
  }
  document.querySelectorAll('input[name=flt]').forEach(function(r){r.addEventListener('change',applyFilter);});
  var ex=document.getElementById('expand');
  if(ex)ex.addEventListener('click',function(){var ds=document.querySelectorAll('details.ans'),open=ex.dataset.open!=='1';ds.forEach(function(d){d.open=open;});ex.dataset.open=open?'1':'0';ex.textContent=open?'收起全部答案':'展开全部答案';});
  var redo=document.getElementById('redo');
  if(redo)redo.addEventListener('click',function(){document.querySelectorAll('article.q').forEach(function(a){if(a._reset)a._reset();});window.scrollTo(0,0);});
  var rs=document.getElementById('reset-progress');
  if(rs)rs.addEventListener('click',function(){if(confirm('确定清空全部“已掌握”和“错题”记录？')){store={m:{},w:{}};save();location.reload();}});
  var exp=document.getElementById('export');
  if(exp)exp.addEventListener('click',function(){var t=JSON.stringify(store);prompt('复制以下内容即可在其他设备导入：',t);});
  var imp=document.getElementById('import');
  if(imp)imp.addEventListener('click',function(){var t=prompt('粘贴之前导出的进度：');if(!t)return;try{var s=JSON.parse(t);store={m:s.m||{},w:s.w||{}};save();location.reload();}catch(e){alert('格式不正确');}});
  refresh();applyFilter();
})();
