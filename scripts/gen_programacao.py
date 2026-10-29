# -*- coding: utf-8 -*-
"""Gera public/html/programacao-zamine.html a partir do layout colado pelo usuário,
com: persistência no banco (API), criação de semana por número digitado,
'Sem parada programada' e correções do HTML colado."""
import io, sys

SRC = "/home/z/my-project/upload/Pasted Content_1793230576092.txt"
OUT = "/home/z/my-project/public/html/programacao-zamine.html"

s = io.open(SRC, encoding="utf-8").read().replace("\r\n", "\n")
orig_len = len(s)

def rep(old, new, cnt=1):
    global s
    n = s.count(old)
    if n != cnt:
        print("FALHA rep (%d ocorrências, esperado %d): %r" % (n, cnt, old[:80]))
        sys.exit(1)
    s = s.replace(old, new, cnt)

# ---------- 1. estrutura do documento ----------
rep("<title>Programação Semanal</title>",
    """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Programação Semanal</title>
<meta name="viewport" content="width=device-width, initial-scale=1">""")

rep("</style>\n\n<div id=\"viewport\">",
    "</style>\n</head>\n<body>\n<div id=\"viewport\">")

# fecha o documento (o colar já termina com </script>)
assert s.rstrip().endswith("render();\n</script>")
s = s.rstrip() + "\n</body>\n</html>\n"

# ---------- 2. CSS: estilos novos (o colar já tem os [hidden] corretos) ----------

rep("/* ---------- rodapé ---------- */",
    """/* campo da semana: digite o número (ex.: 1) e Enter — o sistema só cria a semana pedida */
.wk-in{width:104px;height:66px;background:var(--panel);border:1px solid var(--line2);border-radius:9px;
  color:var(--fg);font-family:var(--f-display);font-size:52px;font-weight:700;line-height:1;
  text-align:center;padding:0 6px}
.wk-in:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:var(--accent)}
.wk-st{width:max-content;font-size:14px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;
  border-radius:5px;padding:3px 10px;border:1px solid var(--line2);color:var(--muted2)}
.wk-st.on{color:#39d98a;border-color:#39d98a55}
.btn-empty{margin-top:6px;padding:13px 28px;border-radius:8px;border:1px solid var(--accent);
  background:var(--accent);color:var(--on-accent);font:700 18px var(--f-body);letter-spacing:.06em;
  text-transform:uppercase;cursor:pointer}
.btn-empty:hover{background:#e65c00}

/* ---------- rodapé ---------- */""")

# ---------- 3. HTML: input da semana, chip criada/não criada e botão Editar ----------
rep("""            <b>Semana <span id="wk-num" class="num">--</span></b>
            <span id="wk-per">—</span>""",
    """            <b>Semana <input id="wk-num" class="wk-in num" type="text" inputmode="numeric" maxlength="2" value="--" title="Digite o número da semana (ex.: 1) e pressione Enter" aria-label="Número da semana"></b>
            <span id="wk-per">—</span>
            <span class="wk-st" id="wk-st">—</span>""")

rep("""          <button class="wkb txt" id="wk-today">Semana atual</button>""",
    """          <button class="wkb txt" id="wk-today">Semana atual</button>
          <button class="wkb txt" id="wk-edit" title="Abrir o editor (tecla E)">✎ Editar</button>""")

# ---------- 4. JS: painel de destino + API ----------
rep("/* ===================== dados estáticos ===================== */",
    """/* ===================== painel e banco ===================== */
/* painel de destino: a TV manda ?panel=minas (ou goias, minas-araxa…) */
var PANEL=(new URLSearchParams(location.search).get("panel")||"minas").toLowerCase().replace(/[^a-z0-9-]/g,"")||"minas";
var API="/api/tv/"+PANEL+"/programacao-semanal";
function avisaPainel(){try{if(window.parent&&window.parent!==window)window.parent.postMessage({ztvProgOk:true},"*");}catch(e){}}

/* ===================== dados estáticos ===================== */""")

# ---------- 5. armazenamento → banco de dados ----------
rep("""/* ===================== armazenamento ===================== */
function key(y,w){return "zam_prog_"+y+"_W"+pad(w);}
function load(y,w){
  try{var r=localStorage.getItem(key(y,w));return r?JSON.parse(r):null;}catch(e){return null;}
}
function save(y,w,data){
  try{localStorage.setItem(key(y,w),JSON.stringify(data));return true;}catch(e){return false;}
}
function blank(){
  var m={};TAGS.forEach(function(t){m[t]={dia:"",horas:"",motivo:"",backlogs:"",done:[]};});
  return {machines:m};
}
function getWeek(y,w){
  var d=load(y,w);
  if(!d||!d.machines)return blank();
  TAGS.forEach(function(t){
    if(!d.machines[t])d.machines[t]={dia:"",horas:"",motivo:"",backlogs:"",done:[]};
    if(!Array.isArray(d.machines[t].done))d.machines[t].done=[];
  });
  return d;
}""",
    """/* ===================== banco de dados =====================
   TUDO vai pro banco (nada de localStorage): a semana só é criada quando VOCÊ
   pede — digita o número e salva — e cada alteração (parada lançada, backlog
   marcado como aplicado) é gravada na hora em /api/tv/{painel}/programacao-semanal. */
var MEM={};      /* "ano-Wnn" → dados da semana em uso */
var CRIADAS={};  /* "ano-Wnn" → true quando a semana já existe no banco */
var srvOk=true;  /* última conversa com o servidor deu certo */
function kw(y,w){return y+"-W"+pad(w);}
function blank(){
  var m={};TAGS.forEach(function(t){m[t]={dia:"",horas:"",motivo:"",backlogs:"",done:[]};});
  return {machines:m};
}
function getWeek(y,w){
  var d=MEM[kw(y,w)];
  if(!d||!d.machines){ d=blank(); MEM[kw(y,w)]=d; }
  TAGS.forEach(function(t){
    if(!d.machines[t])d.machines[t]={dia:"",horas:"",motivo:"",backlogs:"",done:[]};
    if(!Array.isArray(d.machines[t].done))d.machines[t].done=[];
  });
  return d;
}
function carregarSemana(y,w){
  return fetch(API+"?ano="+y+"&semana="+w,{cache:"no-store"}).then(function(r){return r.json();})
    .then(function(j){
      if(j&&j.criada&&j.data&&j.data.machines){ MEM[kw(y,w)]=j.data; CRIADAS[kw(y,w)]=true; }
      else { MEM[kw(y,w)]=null; delete CRIADAS[kw(y,w)]; }
      srvOk=true;
    }).catch(function(){ srvOk=false; });
}
function listarSemanas(){
  return fetch(API+"?listar=1",{cache:"no-store"}).then(function(r){return r.json();})
    .then(function(j){ (j.semanas||[]).forEach(function(x){CRIADAS[x.ano+"-W"+pad(x.semana)]=true;}); srvOk=true; })
    .catch(function(){ srvOk=false; });
}
function salvarSemana(y,w){
  var d=getWeek(y,w);
  /* com login na plataforma, o banco guarda QUEM salvou; pela TV fica sem nome */
  var hs={"Content-Type":"application/json"};
  try{var tk=localStorage.getItem("zamine_token"); if(tk)hs["x-zamine-token"]=tk;}catch(e){}
  return fetch(API,{method:"POST",headers:hs,
      body:JSON.stringify({ano:y,semana:w,data:d})})
    .then(function(r){return r.json();})
    .then(function(j){
      if(j&&j.ok){ CRIADAS[kw(y,w)]=true; srvOk=true; avisaPainel(); return true; }
      toast((j&&j.error)||"Não foi possível salvar no banco"); return false;
    })
    .catch(function(){ srvOk=false; toast("Sem conexão com o banco — não salvou"); return false; });
}""")

# ---------- 6. render: número da semana vira valor do input + chip criada ----------
rep("""  document.getElementById("wk-num").textContent=pad(ST.w);""",
    """  var wkNum=document.getElementById("wk-num");
  if(document.activeElement!==wkNum)wkNum.value=pad(ST.w);
  var criada=!!CRIADAS[kw(ST.y,ST.w)];
  var wkSt=document.getElementById("wk-st");
  wkSt.textContent=criada?"semana criada":"semana não criada";
  wkSt.className="wk-st"+(criada?" on":"");""")

# ---------- 7. tira de dias: "sem parada programada" ----------
rep("""        :'<span class="free">Sem parada</span>');""",
    """        :'<span class="free">Sem parada programada</span>');""")

# ---------- 8. estado vazio: explica a criação da semana ----------
rep("""  if(par===0&&bkT===0){
    wrap.style.display="block";
    wrap.innerHTML='<div class="empty"><div><b>Sem programação</b>'
      +'Nenhuma parada lançada para a semana '+pad(ST.w)+' ('+fmtDM(mon)+' — '+fmtDM(sun)+').<br>'
      +'Pressione <kbd>E</kbd> para abrir o editor.<div class="rule"></div></div></div>';
    return;
  }""",
    """  if(par===0&&bkT===0){
    wrap.style.display="block";
    wrap.innerHTML='<div class="empty"><div><b>'+(criada?"Sem programação":"Semana "+pad(ST.w)+" não criada")+'</b>'
      +(criada
        ?'A semana existe no banco, mas nenhuma parada foi lançada.<br>Pressione <kbd>E</kbd> ou toque em Editar para lançar as paradas.'
        :'O sistema só cria a semana que você pedir: digite o número dela no campo Semana (ex.: 1), abra o editor e salve.')
      +'<div class="rule"></div><button class="btn-empty" id="btn-empty-ed">Abrir o editor</button></div></div>';
    var be=document.getElementById("btn-empty-ed");if(be)be.onclick=function(){openEditor("geral");};
    return;
  }""")

# ---------- 9. toggleDone e collect salvam no banco ----------
rep("""  if(p>-1)m.done.splice(p,1);else m.done.push(i);
  save(ST.y,ST.w,d);
  paintDetail();render();""",
    """  if(p>-1)m.done.splice(p,1);else m.done.push(i);
  salvarSemana(ST.y,ST.w);   /* aplicação realizada vai pro banco na hora */
  paintDetail();render();""")

rep("""    if(bkList(m).length!==old)m.done=m.done.filter(function(i){return i<bkList(m).length;});
    save(ST.y,ST.w,d);""",
    """    if(bkList(m).length!==old)m.done=m.done.filter(function(i){return i<bkList(m).length;});
    salvarSemana(ST.y,ST.w);""")

# ---------- 10. editor "geral": hint + salvar cria a semana pedida ----------
rep("""     +'<p class="hint">Informe o ano e o número da semana ISO. O período é calculado automaticamente, '
     +'e cada semana guarda a sua própria programação.</p>'""",
    """     +'<p class="hint">O sistema SÓ cria a semana que você informar: digite o ano e o número da semana (ex.: 1) e salve. '
     +'O período é calculado automaticamente e cada semana guarda a sua própria programação no banco de dados.</p>'""")

rep("""    +'<option value="">— Sem parada —</option>'""",
    """    +'<option value="">— Sem parada programada —</option>'""")

rep("""document.getElementById("ed-save").onclick=function(){
  collect();
  if(pendY&&pendW){ST.y=pendY;ST.w=pendW;}
  closeEditor();ST.selDay=null;render();
  toast("Programação da semana "+pad(ST.w)+" salva");
};""",
    """document.getElementById("ed-save").onclick=function(){
  var btn=this;btn.disabled=true;
  collect();
  var ny=pendY||ST.y,nw=pendW||ST.w,trocou=(ny!==ST.y||nw!==ST.w);
  /* a semana informada é criada/atualizada no banco (o sistema só cria a que foi
     pedida) — salva sempre aqui, esperando a confirmação, para o chip ficar certo */
  salvarSemana(ny,nw).then(function(ok){
    btn.disabled=false;
    if(!ok)return;
    var fim=function(){ closeEditor();ST.selDay=null;render(); toast("Programação da semana "+pad(nw)+" salva no banco de dados"); };
    if(trocou){ST.y=ny;ST.w=nw;carregarSemana(ST.y,ST.w).then(fim);}
    else fim();
  });
};""")

# ---------- 11. eventos: navegação busca do banco + input da semana + botão Editar ----------
rep("""/* ===================== eventos ===================== */""",
    """/* ===================== eventos ===================== */
/* troca de semana: puxa a semana do banco antes de desenhar */
function irSemana(){ carregarSemana(ST.y,ST.w).then(render); }""")

rep("""document.getElementById("wk-prev").onclick=function(){
  ST.w--;if(ST.w<1){ST.y--;ST.w=weeksInISOYear(ST.y);}ST.selDay=null;render();
};
document.getElementById("wk-next").onclick=function(){
  var max=weeksInISOYear(ST.y);ST.w++;if(ST.w>max){ST.y++;ST.w=1;}ST.selDay=null;render();
};
document.getElementById("wk-today").onclick=function(){
  var n=new Date();ST.y=isoYearOf(n);ST.w=isoWeekOf(n);ST.selDay=null;render();toast("Semana atual: "+pad(ST.w));
};""",
    """document.getElementById("wk-prev").onclick=function(){
  ST.w--;if(ST.w<1){ST.y--;ST.w=weeksInISOYear(ST.y);}ST.selDay=null;irSemana();
};
document.getElementById("wk-next").onclick=function(){
  var max=weeksInISOYear(ST.y);ST.w++;if(ST.w>max){ST.y++;ST.w=1;}ST.selDay=null;irSemana();
};
document.getElementById("wk-today").onclick=function(){
  var n=new Date();ST.y=isoYearOf(n);ST.w=isoWeekOf(n);ST.selDay=null;irSemana();toast("Semana atual: "+pad(ST.w));
};
document.getElementById("wk-edit").onclick=function(){openEditor("geral");};
/* campo da semana: digite o número e Enter — a semana que você quer */
function wkNumGo(){
  var el=document.getElementById("wk-num");
  var v=parseInt(el.value,10),max=weeksInISOYear(ST.y);
  if(!v||v<1||v>max){ el.value=pad(ST.w); toast("Digite uma semana de 1 a "+max+" de "+ST.y); return; }
  ST.w=v;ST.selDay=null;irSemana();
  toast("Semana "+pad(ST.w)+" · "+ST.y+(CRIADAS[kw(ST.y,ST.w)]?"":" — ainda não criada: salve no editor para criar"));
}
document.getElementById("wk-num").addEventListener("change",wkNumGo);
document.getElementById("wk-num").addEventListener("keydown",function(e){ if(e.key==="Enter")this.blur(); });""")

# ---------- 12. inicialização: banco primeiro, depois desenha ----------
rep("}\n\nrender();\n</script>", """}

/* primeira carga: puxa do banco a semana em curso e a lista das semanas criadas */
Promise.all([carregarSemana(ST.y,ST.w),listarSemanas()]).then(render);
avisaPainel();
/* a semana em curso se atualiza sozinha a cada 5 minutos (fora do editor) */
setInterval(function(){
  var ed=!document.getElementById("editor").hidden;
  if(!ed&&ST.open===null&&isoWeekOf(new Date())===ST.w&&isoYearOf(new Date())===ST.y){
    carregarSemana(ST.y,ST.w).then(render);
  }
},300000);
/* aberta pelo painel com ?editar=1: editor direto (botão na aba do painel) */
if(new URLSearchParams(location.search).get("editar")==="1")setTimeout(function(){openEditor("geral");},300);
</script>""")

io.open(OUT, "w", encoding="utf-8").write(s)
print("OK — %d → %d bytes → %s" % (orig_len, len(s), OUT))
