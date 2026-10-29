# -*- coding: utf-8 -*-
"""Aplica a Programação Semanal (iframe do layout novo) aos painéis TV de Minas e Goiás:
slide vira iframe do programacao-zamine.html, aba nova no editor e rotação condicionada
a existir pelo menos uma semana criada no banco."""
import io, sys

FILES = [
    "/home/z/my-project/public/html/painel-tv-minas.html",
    "/home/z/my-project/public/html/painel-tv-goias.html",
]

OLD_PROG = '''  programacao(o){
    const t = today0();
    const it = list(o,"programacao").filter(a=>{const d=pDate(a.data);return !d||d>=t;})
      .sort((a,b)=>(a.data||"9").localeCompare(b.data||"9")||(a.hora||"").localeCompare(b.hora||""));
    if(!it.length) return emptyBox("Sem atividades programadas","Adicione a programação da semana no editor.");
    const nx = it.find(a=>{const d=pDate(a.data);return d&&+d>+t;});
    let hero = "";
    if(nx){ const d=pDate(nx.data), n=Math.round((d-t)/864e5);
      hero = `<div class="card nx"><div class="nx-n"><b class="num">${n}</b><span>${n===1?"dia":"dias"}</span></div>
        <div class="nx-t"><div class="lbl" style="color:var(--accent)">Próxima atividade · ${n===1?"amanhã":"faltam "+n+" dias"}</div><h3>${esc(nx.atividade)}</h3>
        <span class="num">${esc([nx.equipamento&&nx.equipamento!=="—"?nx.equipamento:"", fmtDMY(d)+(nx.hora?" às "+nx.hora:""), nx.responsavel].filter(Boolean).join("  ·  "))}</span></div></div>`; }
    const max = hero?5:8, rows = it.slice(0,max).map(a=>{const d=pDate(a.data); const isT=d&&+d===+t;
      return `<tr class="${isT?"today":""}"><td class="d num">${d?fmtDM(d):"—"}<small>${d?(isT?"hoje":wk(d)):""}</small></td>
      <td class="num" style="white-space:nowrap">${esc(a.hora)||"—"}</td><td><b>${esc(a.atividade)}</b></td><td>${esc(a.equipamento)}</td><td>${esc(a.responsavel)}</td>
      <td class="fx ${isT?"hj":""}">${d?faltaTxt(d):""}</td></tr>`;}).join("");
    return `<div class="s-prog">${hero}<table class="t"><thead><tr><th style="width:150px">Data</th><th style="width:110px">Hora</th><th>Atividade</th><th style="width:260px">Equipamento</th><th style="width:300px">Responsável</th><th style="width:220px">Contagem</th></tr></thead><tbody>${rows}</tbody></table>
      ${it.length>max?`<div class="more">+ ${it.length-max} atividades programadas depois destas</div>`:""}</div>`;
  },'''

NEW_PROG = '''  programacao(o){
    /* Tela virou PROGRAMAÇÃO SEMANAL (arquivo /html/programacao-zamine.html):
       parada de cada máquina por semana (dia, duração, motivo), backlogs e as
       aplicações realizadas — o editor é NA PRÓPRIA TELA e TUDO vai pro banco
       (/api/tv/{painel}/programacao-semanal). O sistema SÓ cria a semana que
       alguém pedir: digita o número (ex.: 1) no campo Semana e salva. */
    return `<iframe class="pro-fr" src="/html/programacao-zamine.html?tv=1&panel=${encodeURIComponent(PANEL_SLUG)}" title="Programação Semanal"></iframe>`;
  },'''

OLD_ABA = '''  {key:"programacao", label:"Programação", hint:"As atividades aparecem em ordem de data, com a contagem de dias que faltam. A próxima atividade aparece em destaque no topo. As de hoje ficam destacadas; as de dias anteriores somem sozinhas.",
    parts:[{kind:"list",key:"itens",label:"Atividades",cols:[
      {k:"data",l:"Data",t:"date",w:2},{k:"hora",l:"Hora",t:"time",w:1},
      {k:"atividade",l:"Atividade",w:4},{k:"equipamento",l:"Equipamento",w:2},{k:"responsavel",l:"Responsável",w:2}]}]},'''

NEW_ABA = '''  {key:"programacao", label:"Programação Semanal", hint:"A tela da TV é a PROGRAMAÇÃO SEMANAL: semana por semana, com a parada de cada máquina (dia, duração, motivo) e os backlogs — e as aplicações realizadas (backlogs concluídos) ficam todas guardadas no banco. O sistema SÓ cria a semana que você pedir: abra o editor, digite o número da semana (ex.: 1), lance as paradas e salve. O editor fica na própria tela da TV — use o botão abaixo (abre em nova aba); pela tecla, E abre o editor dentro da tela.",
    parts:[{kind:"prog"}]},'''

def aplica(path):
    s = io.open(path, encoding="utf-8").read()
    erros = []
    def rep(old, new, tag):
        if s.count(old) != 1:
            erros.append("%s → %d ocorrências de %r" % (tag, s.count(old), old[:60]))
            return
        return s.replace(old, new, 1)

    # 1. CSS dos iframes de tela cheia ganha .pro-fr
    s2 = rep(".bn-fr,.ani-fr,.tre-fr{position:absolute;", ".bn-fr,.ani-fr,.tre-fr,.pro-fr{position:absolute;", "css-1")
    if s2: s = s2
    s2 = rep("main .bn-fr,main .ani-fr,main .tre-fr{position:fixed;", "main .bn-fr,main .ani-fr,main .tre-fr,main .pro-fr{position:fixed;", "css-2")
    if s2: s = s2

    # 2. slide programacao → iframe do layout novo
    s2 = rep(OLD_PROG, NEW_PROG, "R.programacao")
    if s2: s = s2

    # 3. rotação: só entra quando existe semana criada
    s2 = rep('  if(sec==="calendario") return calFonte(o).some(x=>x.data&&x.nome) ? null : [];',
             '''  /* programação semanal: entra na rotação só quando existe pelo menos UMA
     semana criada no banco — a semana é criada no editor da própria tela
     (digita o número, ex.: 1, e salva); antes disso a tela fica fora */
  if(sec==="programacao") return progOk ? null : [];
  if(sec==="calendario") return calFonte(o).some(x=>x.data&&x.nome) ? null : [];''', "expandSlides")
    if s2: s = s2

    # 4. flag + verificação das semanas criadas
    s2 = rep("let treDur = 120000;",
             '''/* programação semanal: o slide (iframe) puxa do banco sozinho; entra na
   rotação quando existe pelo menos uma semana criada (ztvProgOk avisa na hora,
   o poll de conteúdo reconfere a cada 30 s) */
let progOk = false;
function progCheca(){
  fetch(`/api/tv/${PANEL_SLUG}/programacao-semanal?listar=1`,{cache:"no-store"})
    .then(r=>r.json())
    .then(j=>{ progOk = !!(j.semanas && j.semanas.length); })
    .catch(()=>{});
}
let treDur = 120000;''', "progOk")
    if s2: s = s2

    # 5. aplicarConteudo reconfere as semanas
    s2 = rep("""  aplicarUnidade();
  gotSec = true; gotCfg = true; onData();""",
             """  aplicarUnidade();
  progCheca();
  gotSec = true; gotCfg = true; onData();""", "aplicarConteudo")
    if s2: s = s2

    # 6. mensagem da tela (ztvProgOk)
    s2 = rep("""  /* a apresentação ACABOU (último slide fechou): troca de tela na hora — antes""",
             """  /* programação semanal: a tela avisou que já existe semana criada no banco —
     na próxima troca de tela ela entra na rotação */
  if(d.ztvProgOk){ progOk = true; }
  /* a apresentação ACABOU (último slide fechou): troca de tela na hora — antes""", "msg-ztvProgOk")
    if s2: s = s2

    # 7. aba do editor
    s2 = rep(OLD_ABA, NEW_ABA, "ABAS")
    if s2: s = s2

    # 8. renderSec: parte da aba programação
    s2 = rep('''    } else if(p.kind==="obj"){''',
             '''    } else if(p.kind==="prog"){
      /* programação semanal: o editor é a própria tela (programacao-zamine.html),
         que cria a semana pedida e salva tudo direto no banco — aqui fica o atalho */
      h += `<p class="hint">A Programação da TV é a TELA "Programação Semanal": parada de cada máquina (dia, duração, motivo), backlogs e as aplicações realizadas — tudo no banco, semana por semana. O sistema SÓ cria a semana que você informar: abra o editor, digite o número da semana (ex.: 1), lance as paradas e salve.</p>
        <div class="bk"><button type="button" class="btn pri" id="progOpen">Abrir o editor da Programação Semanal</button><span class="hint" style="margin:0 0 0 14px" id="progSemanas"></span></div>`;
    } else if(p.kind==="obj"){''', "renderSec-prog")
    if s2: s = s2

    # 9. renderSec: liga o botão e lista as semanas criadas
    s2 = rep('''  m.querySelectorAll("[data-pvt]").forEach(b=>b.onclick=()=>{ pvTheme=b.dataset.pvt; renderSec(); });''',
             '''  m.querySelectorAll("[data-pvt]").forEach(b=>b.onclick=()=>{ pvTheme=b.dataset.pvt; renderSec(); });
  const po=$("progOpen");
  if(po){
    po.onclick=()=>window.open(`/html/programacao-zamine.html?panel=${encodeURIComponent(PANEL_SLUG)}&editar=1`,"_blank");
    api(`/api/tv/${PANEL_SLUG}/programacao-semanal?listar=1`).then(j=>{
      const el=$("progSemanas"); if(!el) return;
      const sems=(j.semanas||[]).map(x=>("0"+x.semana).slice(-2)+"/"+x.ano);
      el.textContent = sems.length ? ("Semanas já criadas: "+sems.join(" · ")) : "Nenhuma semana criada ainda — abra o editor, digite o número (ex.: 1) e salve.";
    }).catch(()=>{});
  }''', "renderSec-wire")
    if s2: s = s2

    if erros:
        print("ERROS em %s:" % path)
        for e in erros: print("  -", e)
        sys.exit(1)
    io.open(path, "w", encoding="utf-8").write(s)
    print("OK %s" % path)

for f in FILES:
    aplica(f)
