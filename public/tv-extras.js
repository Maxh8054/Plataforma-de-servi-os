/* =====================================================================
   ZTV extras — recursos compartilhados dos painéis de TV ZAMine
   (usado por painel-tv-goias.html e painel-tv-minas.html)

   Recursos:
   1. HEARTBEAT      — a TV se anuncia a cada 2,5 min (saúde das TVs)
   2. MARCOS         — slide comemorativo automático nos dias redondos
   3. QR PLATAFORMA  — QR pequeno e opcional no rodapé (link da plataforma)
   4. PRÉVIA         — modo ?tvprevia=1 para a mini prévia dentro do editor
   5. IA             — botão ✨ para gerar rascunhos (DDS/mensagem/campanha)
   6. CHIP TVs       — status das TVs conectadas no editor (admin)

   O painel chama os pontos de entrada window.ZTV.* em momentos definidos.
   Tudo é defensivo: se algo falhar, a TV continua funcionando normalmente.
   ===================================================================== */
(function () {
  "use strict";

  var ZTV = (window.ZTV = window.ZTV || {});
  var Q = new URLSearchParams(location.search);

  /* ---------- 4. MODO PRÉVIA (mini prévia dentro do editor) ---------- */
  ZTV.prev = Q.get("tvprevia") === "1";
  if (ZTV.prev) {
    document.documentElement.classList.add("ztv-previa");
    window.addEventListener("DOMContentLoaded", function () {
      var b = document.createElement("div");
      b.className = "ztv-previa-badge";
      b.textContent = "PRÉVIA — o que entra no ar ao salvar aparece aqui";
      document.body.appendChild(b);
      var st = document.createElement("style");
      st.textContent =
        ".ztv-previa-badge{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9999;" +
        "background:rgba(0,0,0,.72);color:#fff;font:600 12px/1.2 Barlow,system-ui,sans-serif;padding:6px 14px;" +
        "border-radius:999px;letter-spacing:.4px;pointer-events:none;opacity:.85}" +
        "html.ztv-previa .ctrls{display:none!important}";
      document.head.appendChild(st);
    });
  }
  /* chamado pelo painel DEPOIS que o script principal definiu reportaErro:
     prévia não reporta erros (não suja o Histórico do editor real) */
  ZTV.previaSilencio = function () {
    if (!ZTV.prev) return;
    window.reportaErro = function () {};
    window.addEventListener("unhandledrejection", function (e) { e.preventDefault && e.preventDefault(); }, true);
  };

  /* ---------- 1. HEARTBEAT (saúde das TVs) ---------- */
  var HB_DEVICE = null;
  function deviceId() {
    if (HB_DEVICE) return HB_DEVICE;
    var k = "ztv-dev-" + (ZTV.panel || "tv");
    try {
      HB_DEVICE = localStorage.getItem(k);
      if (!HB_DEVICE || !/^[A-Za-z0-9-]{4,24}$/.test(HB_DEVICE)) {
        HB_DEVICE = "TV-" + Math.random().toString(36).slice(2, 8).toUpperCase();
        localStorage.setItem(k, HB_DEVICE);
      }
    } catch (e) {
      HB_DEVICE = "TV-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    }
    return HB_DEVICE;
  }
  var HB_LAST = "";
  function heartbeatAgora() {
    if (ZTV.prev || !ZTV.panel || typeof ZTV.estado !== "function") return;
    var e = {};
    try {
      e = ZTV.estado() || {};
    } catch (err) {
      e = {};
    }
    var sig = [e.c, e.t].join("|");
    var igual = sig === HB_LAST;
    HB_LAST = sig;
    try {
      fetch("/api/tv/" + ZTV.panel + "/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ d: deviceId(), c: String(e.c || ""), t: e.t || 0 }),
        keepalive: true,
      }).catch(function () {});
      if (igual) return; // nada mudou: segue no ritmo normal
    } catch (err) {}
    // canal/telas mudaram: reanuncia logo para o monitor refletir na hora
    if (!igual) setTimeout(heartbeatAgora, 1500);
  }
  ZTV.heartbeat = function (panel, estadoFn) {
    ZTV.panel = panel;
    ZTV.estado = estadoFn;
    if (ZTV.prev) return;
    heartbeatAgora();
    setInterval(heartbeatAgora, 150000); // 2,5 min
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) heartbeatAgora();
    });
  };

  /* ---------- 2. MARCOS COMEMORATIVOS (dias redondos) ---------- */
  ZTV.marcoDe = function (dias) {
    if (!dias || dias <= 0) return null;
    // 100 em 100 até 1000; depois 500 em 500 (1100, 1200… não; 1500, 2000… sim)
    if (dias < 100) return null;
    if (dias <= 1000) return dias % 100 === 0 ? dias : null;
    return dias % 500 === 0 ? dias : null;
  };
  ZTV.marcoSlide = function (dias, cfgGeral, unidade) {
    var marco = ZTV.marcoDe(dias);
    if (!marco) return null;
    if (cfgGeral && cfgGeral.marcos === false) return null;
    var prox = marco < 1000 ? marco + 100 : marco + 500;
    var hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    var el = document.createElement("style");
    el.id = "ztv-marco-css";
    if (!document.getElementById("ztv-marco-css")) {
      el.textContent =
        ".s-marco{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
        "text-align:center;background:radial-gradient(1200px 700px at 50% 18%,#ffb347,#ff6600 55%,#b34700);color:#fff;overflow:hidden}" +
        ".s-marco .m-conf{position:absolute;inset:0;pointer-events:none}" +
        ".s-marco .m-conf i{position:absolute;top:-6%;width:14px;height:22px;border-radius:3px;opacity:.9;" +
        "animation:ztvConf 3.4s linear infinite}" +
        ".s-marco .m-conf i:nth-child(2n){background:#ffe08a}.s-marco .m-conf i:nth-child(3n){background:#fff}.s-marco .m-conf i{background:#ffd166}" +
        "@keyframes ztvConf{0%{transform:translateY(-10%) rotate(0)}100%{transform:translateY(760px) rotate(540deg)}}" +
        ".s-marco .m-kicker{font:700 30px/1 Barlow,sans-serif;letter-spacing:4px;text-transform:uppercase;opacity:.92}" +
        ".s-marco .m-big{font:800 300px/1 'Barlow Condensed',Barlow,sans-serif;text-shadow:0 10px 60px rgba(0,0,0,.25)}" +
        ".s-marco .m-big small{font-size:56px;font-weight:700;letter-spacing:2px;display:block;margin-top:10px;text-transform:uppercase}" +
        ".s-marco .m-sub{font:600 40px/1.25 Barlow,sans-serif;max-width:1200px;margin-top:18px}" +
        ".s-marco .m-foot{margin-top:34px;display:flex;gap:22px;font:600 26px/1 Barlow,sans-serif;opacity:.95}" +
        ".s-marco .m-foot span{background:rgba(0,0,0,.18);padding:14px 26px;border-radius:999px}";
      document.head.appendChild(el);
    }
    var conf = "";
    for (var i = 0; i < 26; i++) {
      conf += '<i style="left:' + (i * 3.9 + 1) + "%;animation-delay:" + (i % 10) * 0.35 + 's"></i>';
    }
    return {
      key: "marco",
      sub: 0,
      // o painel empacota como {key,sub,fn:()=>html} — mesmo formato das telas expandidas
      html:
        '<div class="s-marco"><div class="m-conf" aria-hidden="true">' + conf + "</div>" +
        '<div class="m-kicker">Marco de segurança</div>' +
        '<div class="m-big num">' + marco + "<small>dias sem acidentes</small></div>" +
        '<div class="m-sub">🎉 Hoje é dia de comemorar' + (unidade ? " em " + String(unidade) : "") + ' — esse número é feito de gente que se importa.</div>' +
        '<div class="m-foot"><span>🎯 Próximo marco: ' + prox + " dias</span><span>📅 " + hoje + "</span></div></div>",
    };
  };

  /* ---------- 3. QR DA PLATAFORMA (rodapé, pequeno e opcional) ---------- */
  ZTV.qrFooter = function (url) {
    var host = document.getElementById("ft") || document.querySelector("footer.ft");
    if (!host) return;
    var chip = document.getElementById("ftQr");
    var u = String(url || "").trim();
    if (!/^https?:\/\/.{4,}/i.test(u) || typeof window.qrcode !== "function") {
      if (chip) chip.remove();
      return;
    }
    if (!chip) {
      chip = document.createElement("div");
      chip.className = "qr-chip";
      chip.id = "ftQr";
      host.appendChild(chip);
      var st = document.createElement("style");
      st.id = "ztv-qr-css";
      st.textContent =
        ".qr-chip{flex:none;display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 7px 4px;" +
        "background:rgba(255,255,255,.92);border-radius:10px;line-height:1}" +
        ".qr-chip img{width:56px;height:56px;display:block;image-rendering:pixelated}" +
        ".qr-chip span{font:700 9px/1 Barlow,sans-serif;color:#7a3b00;letter-spacing:.3px;text-transform:uppercase}";
      document.head.appendChild(st);
    }
    try {
      var qr = window.qrcode(0, "M");
      qr.addData(u);
      qr.make();
      chip.innerHTML = '<img src="' + qr.createDataURL(4, 2) + '" alt="QR da plataforma"><span>Plataforma</span>';
    } catch (e) {
      chip.remove();
    }
  };

  /* ---------- 5. IA — rascunhos de conteúdo (editor) ---------- */
  ZTV.iaModal = function (alvo) {
    // alvo: {aplicar: function(texto)} — insere o texto no campo do editor
    var fundo = document.createElement("div");
    fundo.className = "ztv-ia";
    fundo.innerHTML =
      '<div class="ztv-ia-box" role="dialog" aria-label="Gerar rascunho com IA">' +
      "<h3>✨ Gerar rascunho com IA</h3>" +
      '<label>Tipo de conteúdo</label><select id="iaTipo">' +
      '<option value="dds">Roteiro de DDS (1–2 min falado)</option>' +
      '<option value="mensagem">Mensagem curta de segurança (letreiro)</option>' +
      '<option value="campanha">Frase de campanha</option></select>' +
      '<label>Tema <i>(ex.: uso de EPI em altura)</i></label><input id="iaTema" maxlength="200" placeholder="Sobre o que é?">' +
      '<label>Detalhes opcionais</label><textarea id="iaDet" rows="2" maxlength="500" placeholder="Pontos que devem aparecer, público, contexto…"></textarea>' +
      '<div class="ztv-ia-out" id="iaOut" hidden></div>' +
      '<div class="ztv-ia-btns"><button type="button" class="btn pri" id="iaGerar">Gerar rascunho</button>' +
      '<button type="button" class="btn" id="iaUsar" hidden>Usar no campo</button>' +
      '<button type="button" class="btn ghost" id="iaFechar">Fechar</button></div></div>';
    document.body.appendChild(fundo);
    var st = document.createElement("style");
    st.textContent =
      ".ztv-ia{position:fixed;inset:0;background:rgba(10,6,0,.62);z-index:10040;display:flex;align-items:center;justify-content:center;padding:16px}" +
      ".ztv-ia-box{background:#fff;color:#1c130a;border-radius:14px;padding:20px 22px;width:min(520px,94vw);max-height:90vh;overflow:auto;" +
      "box-shadow:0 24px 80px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:8px}" +
      ".ztv-ia-box h3{margin:0 0 4px;font-size:19px}" +
      ".ztv-ia-box label{font:600 13px/1.3 Barlow,sans-serif;margin-top:6px}" +
      ".ztv-ia-box label i{font-weight:400;color:#8a7460}" +
      ".ztv-ia-box select,.ztv-ia-box input,.ztv-ia-box textarea{border:1px solid #d8c9b8;border-radius:9px;padding:9px 11px;font:15px/1.4 Barlow,sans-serif}" +
      ".ztv-ia-out{background:#f7f1e8;border:1px solid #e5d7c5;border-radius:10px;padding:12px;font:15px/1.5 Barlow,sans-serif;white-space:pre-wrap;max-height:220px;overflow:auto}" +
      ".ztv-ia-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}" +
      ".ztv-ia-btns .btn.pri{background:#ff6600;border-color:#ff6600;color:#fff}" +
      ".ztv-ia-btns .btn{cursor:pointer}";
    document.head.appendChild(st);
    var $ = function (id) { return fundo.querySelector("#" + id); };
    var textoGerado = "";
    var gerar = async function () {
      var tema = $("iaTema").value.trim();
      if (!tema) { $("iaOut").hidden = false; $("iaOut").textContent = "Escreva o tema primeiro."; return; }
      $("iaGerar").disabled = true;
      $("iaOut").hidden = false;
      $("iaOut").textContent = "Gerando…";
      try {
        var r = await fetch("/api/ia/rascunho", {
          method: "POST",
          headers: Object.assign({ "Content-Type": "application/json" }, typeof window.tokenHeaders === "function" ? {} : {}),
          credentials: "include",
          body: JSON.stringify({ tipo: $("iaTipo").value, tema: tema, detalhes: $("iaDet").value.trim(), unidade: ZTV.unidade || "" }),
        });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok || !j.texto) {
          $("iaOut").textContent = j.error || "Não consegui gerar agora. Tente de novo em instantes.";
        } else {
          textoGerado = j.texto;
          $("iaOut").textContent = textoGerado;
          $("iaUsar").hidden = false;
        }
      } catch (e) {
        $("iaOut").textContent = "Sem conexão com a IA. Tente novamente.";
      }
      $("iaGerar").disabled = false;
    };
    fundo.querySelector("#iaGerar").onclick = gerar;
    fundo.querySelector("#iaTema").addEventListener("keydown", function (ev) { if (ev.key === "Enter") gerar(); });
    fundo.querySelector("#iaUsar").onclick = function () {
      if (textoGerado && alvo && typeof alvo.aplicar === "function") alvo.aplicar(textoGerado);
      fechar();
    };
    var fechar = function () { fundo.remove(); st.remove(); };
    fundo.querySelector("#iaFechar").onclick = fechar;
    fundo.addEventListener("click", function (ev) { if (ev.target === fundo) fechar(); });
    document.addEventListener("keydown", function esc(ev) {
      if (ev.key === "Escape") { fechar(); document.removeEventListener("keydown", esc); }
    });
    setTimeout(function () { try { $("iaTema").focus(); } catch (e) {} }, 60);
  };

  /* Botão ✨ junto aos campos de texto do editor.
     Chamado após renderSec() — procura textareas de campos-chave conhecidos. */
  ZTV.iaBotoes = function (raiz, aplicarNoCampo) {
    if (!raiz) return;
    raiz.querySelectorAll("textarea").forEach(function (ta) {
      if (ta.dataset.iaBtn) return;
      ta.dataset.iaBtn = "1";
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn ghost ztv-ia-btn";
      b.textContent = "✨ IA";
      b.title = "Gerar rascunho com IA";
      b.style.marginTop = "4px";
      b.onclick = function () {
        ZTV.iaModal({ aplicar: function (txt) {
          ta.value = txt;
          ta.dispatchEvent(new Event("input", { bubbles: true }));
        }});
      };
      ta.insertAdjacentElement("afterend", b);
    });
    // estilo dos botões (1x)
    if (!document.getElementById("ztv-ia-btn-css")) {
      var st = document.createElement("style");
      st.id = "ztv-ia-btn-css";
      st.textContent = ".ztv-ia-btn{align-self:flex-start;font-size:12px;padding:4px 10px}";
      document.head.appendChild(st);
    }
  };

  /* ---------- 6. CHIP "TVs conectadas" no editor (admin) ---------- */
  ZTV.chipTVs = function (mount, authH) {
    if (!mount) return;
    var chip = mount.querySelector("#edTVs");
    if (!chip) {
      chip = document.createElement("button");
      chip.type = "button";
      chip.className = "btn ghost";
      chip.id = "edTVs";
      chip.title = "TVs conectadas a este painel";
      mount.appendChild(chip);
    }
    var pintar = function (devs) {
      var on = devs.filter(function (d) { return d.online; }).length;
      var off = devs.length - on;
      chip.innerHTML = "🖥 TVs: " + (devs.length ? "🟢 " + on + (off ? " · 🔴 " + off : "") : "nenhuma");
    };
    var buscar = function () {
      return fetch("/api/tv/" + (ZTV.panel || "") + "/dispositivos", { headers: authH ? authH() : {}, credentials: "include" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    };
    var carregar = function () { buscar().then(function (j) { if (j && j.dispositivos) pintar(j.dispositivos); else chip.textContent = "🖥 TVs: —"; }); };
    chip.onclick = function () {
      buscar().then(function (j) {
        var devs = (j && j.dispositivos) || [];
        var linhas = devs.length
          ? devs.map(function (d) {
              return "<li><b>" + (d.online ? "🟢" : "🔴") + " " + String(d.id).replace(/[<>&]/g, "") + "</b> — " +
                (d.canal ? "canal " + String(d.canal).replace(/[<>&]/g, "") + ", " : "") +
                (d.telas != null ? d.telas + " telas, " : "") +
                "última vez " + quando(d.ultimaVez) + "</li>";
            }).join("")
          : "<li>Nenhuma TV se conectou a este painel ainda (as TVs se anunciam sozinhas a cada 2,5 min).</li>";
        var box = document.createElement("div");
        box.className = "ztv-ia";
        box.innerHTML = '<div class="ztv-ia-box" role="dialog" aria-label="TVs conectadas"><h3>🖥 TVs deste painel</h3>' +
          '<ul style="margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font:15px/1.4 Barlow,sans-serif">' + linhas + "</ul>" +
          '<div class="ztv-ia-btns"><button type="button" class="btn ghost" id="zFechar">Fechar</button></div></div>';
        document.body.appendChild(box);
        box.querySelector("#zFechar").onclick = function () { box.remove(); };
        box.addEventListener("click", function (ev) { if (ev.target === box) box.remove(); });
      });
    };
    carregar();
    return carregar; // o painel pode chamar de novo quando abrir o editor
  };

  /* ---------- 7. BOTÃO "Prévia na TV" (editor) — mini palco com o que está no ar ---------- */
  ZTV.previaBotao = function (mount) {
    if (!mount || ZTV.prev) return;
    var b = mount.querySelector("#edTvPrev");
    if (!b) {
      b = document.createElement("button");
      b.type = "button";
      b.className = "btn ghost";
      b.id = "edTvPrev";
      b.title = "Ver a TV em miniatura — com o rascunho atual do editor";
      b.textContent = "Prévia na TV";
      b.onclick = abrir;
      mount.appendChild(b);
      var st = document.createElement("style");
      st.id = "ztv-pv-tv-css";
      st.textContent =
        ".ztv-tvbox{position:fixed;inset:0;background:rgba(10,6,0,.72);z-index:10030;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:18px}" +
        ".ztv-tvframe{width:min(1180px,94vw);aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#000;box-shadow:0 30px 90px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.14)}" +
        ".ztv-tvframe iframe{width:100%;height:100%;border:0;display:block}" +
        ".ztv-tvhint{color:#fff;font:600 13px/1.3 Barlow,sans-serif;opacity:.85;text-align:center}";
      document.head.appendChild(st);
    }
    function abrir() {
      var box = document.createElement("div");
      box.className = "ztv-tvbox";
      box.innerHTML = '<div class="ztv-tvframe"><iframe title="Prévia da TV" src=""></iframe></div>' +
        '<div class="ztv-tvhint">Prévia com o rascunho NÃO salvo deste navegador · clique fora para fechar</div>';
      var src = location.pathname + (location.search ? location.search.replace(/&?$/, "&") : "?") + "tvprevia=1";
      box.querySelector("iframe").src = src;
      document.body.appendChild(box);
      box.addEventListener("click", function (ev) { if (ev.target === box) box.remove(); });
      document.addEventListener("keydown", function esc(ev) {
        if (ev.key === "Escape") { box.remove(); document.removeEventListener("keydown", esc); }
      });
    }
  };

  function quando(iso) {
    var t = +new Date(iso);
    if (!t) return "—";
    var min = Math.round((Date.now() - t) / 60000);
    if (min < 1) return "agora";
    if (min < 60) return "há " + min + " min";
    var h = Math.round(min / 60);
    if (h < 24) return "há " + h + "h";
    return "há " + Math.round(h / 24) + " dia(s)";
  }
})();
