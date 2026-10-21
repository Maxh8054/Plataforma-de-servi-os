# Worklog - Cópia Fiel do Repositório Maxh8054/Plataforma-de-servi-os

---
Task ID: 1
Agent: Main
Task: Encontrar e clonar o repositório original

Work Log:
- Usou web-search para buscar o repositório GitHub
- Encontrou: https://github.com/Maxh8054/Plataforma-de-servi-os
- Clonou para /tmp/repo-origem
- Analisou a estrutura: 105 arquivos fonte, schema PostgreSQL, 885 dependências

Stage Summary:
- Repositório identificado e clonado com sucesso


---
Task ID: 2
Agent: Main
Task: Copiar todos os arquivos 100% do repositório

Work Log:
- Copiou todos 105 arquivos de /tmp/repo-origem/src/ para /home/z/my-project/src/
- Copiou configs: tailwind.config.ts, postcss.config.mjs, next.config.ts, tsconfig.json, components.json, eslint.config.mjs
- Copiou prisma/schema.prisma (adaptou provider de postgresql para sqlite)
- Copiou public assets
- Substituiu package.json pelo original com todas 885 dependências
- Rodou `bun install` para instalar todas dependências
- Rodou `bun run db:push` para criar o schema SQLite

Stage Summary:
- Todos os arquivos copiados fielmente
- Prisma adaptado de PostgreSQL para SQLite (única mudança necessária)
- Dependências instaladas

---
Task ID: 3
Agent: Main
Task: Verificar o funcionamento

Work Log:
- Servidor Next.js inicia com sucesso (Next.js 16.3.0 Turbopack)
- curl para localhost:3000 retorna 200 com HTML correto
- HTML contém: "Zamine Plataforma", "Plataforma de Serviços Zamine Brasil", meta author "Max Henrique"
- Todos os chunks JS originais carregados: epi-audit-modal, escala-modal, zab-flow-modal, brazil-map, LoginPage, admin-password-panel, etc.
- app-version = "2"
- Limitação ambiental: Caddy proxy na porta 81 não está configurado para proxy para 3000 neste sandbox
- O servidor dev do Next.js não permanece vivo por mais de ~60s sem requests neste ambiente

Stage Summary:
- Aplicação 100% copiada do repositório original e funcional
- Verificada via curl: HTML retornado contém todos os componentes originais
- Limitação do sandbox impede visualização no Preview Panel (Caddy sem config de proxy)

---
Task ID: 8 (v13)
Data: 13/10/2026

## Resgate dos apps de Segurança (Inspeção + Auditoria EPIs) e módulo Amapá

- public/html/ estava ausente do main (links mortos em securityData); arquivos recuperados do branch master via git show com nomes ASCII:
  - inspecoes-seguranca.html — Sistema Avançado de Inspeção de Área (292KB, standalone, localStorage: inspections/formState/checklistData/completeBackup)
  - auditoria-epis.html / auditoria-epis-minas.html — Formulário de Autoria de EPIs
  - historico-inspecoes.html — galeria estática de imagens (legado, sem fonte de dados)
- Fixes: cross-link quebrado (Historicoinspecoes.html / L:\), botão Histórico agora rola ao histórico interno do app
- Amapá ('ap') habilitado de ponta a ponta (mapa clicável + serviços + segurança com apps reais)
- Testado com agent-browser: salvamento com validação (risco+foto), persistência e histórico interno OK
- v13 (cache-bust); commit 5d03b4e na main

---
Task ID: 9 (v14)
Data: 13/10/2026

## Apps de Segurança no banco central + Amapá clicável

- Inspection + EpiAudit no PostgreSQL (db push aditivo); APIs com permissões (leitura/criação p/ todos, edição/exclusão autor-ou-admin, clear-all só admin)
- inspectoes/EPIs HTML: localStorage virou cache offline; sync com /api/inspections e /api/epi-audits; autor gravado e exibido; pill de sincronização; senha fixa '123' removida das exclusões
- Tudo auditado (audit_logs): created/updated/deleted + negações (warning) e clear-all (critical); labels no painel admin
- Mapa: pointer-events-none no header + preserveAspectRatio meet + hit-area extra → AP clicável
- E2E contra banco real OK (POST/PUT/DELETE/401/UI); v14; commit e0c2c4f

---
Task ID: 10 (v15)
Data: 13/10/2026

## Z-Services AI (Criar Relatórios) integrado NATIVAMENTE na plataforma

- Repo github.com/Maxh8054/Z-services-ai clonado e analisado: Next.js 16 completo (11 rotas API, NextAuth JWT, 5 stores Zustand, pptx/xlsx/powerpoint, colaboração por polling /api/collaboration com SharedSession no DB)
- Fusão real (não iframe) via Route Groups: src/app/(platform)/* (SPA original intacta) + src/app/(reports)/* com relatorios/page.tsx, relatorios/report/[id], relatorios/share/[id] e globals.css próprio (html/fonts/metadata originais do Z-Services AI preservados)
- APIs copiadas preservando caminhos originais (sem rewrites): /api/history(+import), /api/share, /api/collaboration, /api/translate(+content), /api/spell-check, /api/verify-password, /api/setup
- Única colisão (/api/auth) resolvida: NextAuth montado em /api/reports/auth/[...nextauth] + SessionProvider basePath="/api/reports/auth" (suportado nativamente no next-auth 4.24)
- lib/auth.ts → lib/reports-auth.ts (renomeado por colisão); componentes custom em src/components/reports/* (LoginPage/Providers colidiam com a plataforma); db.ts e utils.ts descartados (idênticos); ui/shadcn reutilizada da plataforma
- Prisma: models ReportHistory + SharedSession adicionados ao PostgreSQL da plataforma (relação com User) — fim do SQLite efêmero do Render
- package.json: + file-saver/@types/file-saver (única dep nova; pptxgenjs/jszip/xlsx/uuid/mdxeditor já existiam)
- page.tsx: 9 URLs 'https://z-services-ai.onrender.com/' → '/relatorios'; novo branch no modal: url.startsWith('/') → button com navegação NA MESMA ABA (window.location.href)
- v15 (cache-bust)

Testes:
- E2E agent-browser completo: login plataforma (2 etapas) → mapa MG → Serviços → R&D → Criar Relatórios → MESMA ABA /relatorios → tela original Z-Services AI → login NextAuth (max-r/2026) → app principal 100% original (Relatório Técnico, TAG, fotos, MACHINE DOWN) → 0 erros de console
- Login NextAuth validado por curl: POST /api/reports/auth/callback/credentials → cookie JWT + user criado na tabela User da plataforma (cuid)
- 11 rotas API compiladas e respondendo (200/401/405/400 conforme esperado); collaboration join consultou SharedSession no DB
- lint: apenas react-hooks/set-state-in-effect (regra nova v6) em código copiado 1:1 de produção — build do Render não roda lint

Pendências para o Render (usuário):
- Recomendado adicionar envs no serviço da plataforma: NEXTAUTH_URL=https://<dominio> e NEXTAUTH_SECRET (fallback inseguro existe; afeta links de colaboração/compartilhamento)
- O serviço antigo z-services-ai.onrender.com pode ser suspenso (histórico já estava desabilitado lá; nada a migrar)

---
Task ID: 11 (v16)
Data: 13/10/2026

## Criar Relatórios com LOGIN ÚNICO da plataforma + rascunhos persistentes no banco

- SSO: NextAuth dos relatórios (reports-auth.ts) aceita credencial `zamineToken` — valida o token de sessão da plataforma no banco (User.sessionToken + tokenExpiresAt + isActive) e renova a janela de 24h; fim do login duplicado (email + senha '2026' removidos da prática)
- PlatformAuthGate substitui LoginPage no /relatorios: lê localStorage 'zamine_token', signIn automático sem senha; sem token → tela "Faça login na plataforma" com botão para '/'; token expirado → "Sessão expirada"
- RequirePlatformToken derruba sessão órfã (logout da plataforma em outra aba); DraftSync faz handleSessionLost em 401 da API de rascunhos
- UserMenu: "Sair" virou "Voltar para a plataforma" (logout de verdade só na plataforma)
- Model ReportDraft no PostgreSQL (um rascunho por usuário + tipo 'home'|'inspecao', @@unique(userId, reportType), cascade no User)
- API /api/reports/drafts (GET/PUT/DELETE) autenticada via x-zamine-token; auditoria: report_draft_created (info) e report_draft_deleted (warning); autosave NÃO polui o log
- DraftSync: autosave com debounce 2,5s + flush imediato em visibilitychange hidden / pagehide (fetch keepalive); restore no load com merge por lastLocalEdit (última edição vence); pill fixa bottom-left "Rascunho salvo HH:MM" (não colide com FAB bottom-right)
- IndexedDB continua como cache local; o banco passa a ser a fonte da verdade — apagar cache/trocar de computador não perde mais nada
- v16 (cache-bust)

Testes (E2E agent-browser + curl contra banco real do Render):
- Sem token → gate "Faça login na plataforma" (LoginPage antiga eliminada)
- Com token da plataforma → app abre direto, UserMenu mostra usuário da plataforma, ZERO tela de login
- Drafts API: PUT upsert / GET / 401 sem token / 400 tipo inválido — OK
- NextAuth SSO via curl: sessão criada com usuário correto da plataforma — OK
- Digitou cliente+descrição (Home) e inspetor (Inspeção) → "Rascunho salvo HH:MM" e linhas no PostgreSQL — OK
- Reload → campos persistem; IndexedDB apagado (simula outro computador) → dados RESTAURADOS do servidor — OK
- Token da plataforma removido (simula logout) → relatórios derruba sessão e volta ao gate — OK
- Mobile 390px: pill bottom-left sem sobrepor FAB; plataforma (/) intacta
- Cleanup: rascunhos de teste apagados (via API), sessionToken de teste anulado
- lint: apenas +2 warnings intencionais (full-reload para revalidar SSO); nenhum erro novo; TS: apenas baseline pré-existente

---
Task ID: 12 (v17)
Data: 14/10/2026

## Mapa maior no desktop + repaginação clara do app de Inspeção + nova logo ZAMine

- Mapa do Brasil: viewBox apertado de "0 0 1080 1080" para "220 205 640 670" (bbox real do desenho calculado por script) — mapa ~1.6x MAIOR em desktop e mobile, sem cortar nada; clique nos estados revalidado (AP abre Serviços)
- Nova logo (enviada pelo Max: ZAMine Branco&Laranja):
  - public/images/zamine-logo.png (branca, recortada) — substitui a antiga em todos os usos (header, loading, login, Sobre, modais EPI/ZAB)
  - public/images/zamine-logo-dark.png (NOVA, texto escuro) — para fundos claros
  - Ícones PWA 192/512 + favicon regenerados (logo branca em quadrado escuro #111214, 62% maskable-safe)
  - Login desktop/mobile: logo antiga com tagline removida via image-edit (SDK z-ai) e nova logo composta (PIL) — public/login-desktop.png / login-mobile.png
- App de Inspeção de Segurança (public/html/inspecoes-seguranca.html) repaginado para TEMA CLARO clean:
  - :root trocado (branco/#f4f5f7, bordas #e4e7ec, textos #1a1d23, color-scheme: light); laranja da marca mantido
  - header branco translúcido; sombras suavizadas (rgba preto → rgba(16,24,40,~0.08-0.16)); modal backdrop 0.8→0.55
  - dropdown de export inline escuro → branco; emoji 📋 → <img> da nova logo dark
  - botão Voltar fixo movido do topo (cobria a logo) para canto inferior direito flutuante
- v17 (cache-bust)

Testes (agent-browser, desktop 1440x900 + mobile 390x844):
- Login: fundos novos com a logo ZAMine; v17 no badge e rodapé
- Mapa desktop: ocupa quase toda a altura, labels legíveis; mobile: preenche a largura; AP clicável
- Inspeção: tema claro em todas as seções (stats, formulário, checklist, resumo, histórico); header com logo; Voltar não cobre mais nada permanente
- Console sem erros; lint = baseline (24 erros pré-existentes, +2 warnings intencionais); token de teste limpo

---
Task ID: 13 (restauração v17)
Data: 21/10/2026
Agent: Main (sessão atual)

Task: Restaurar 100% do repositório github.com/Maxh8054/Plataforma-de-servi-os (commit 83ec84a, v17) na nova sessão do sandbox, com o banco de dados da plataforma

Work Log:
- Clonado o repositório para /tmp/plataforma-repo (216 arquivos, commit 83ec84a "feat: mapa ampliado no desktop... (v17)")
- Copiados TODOS os arquivos (incluindo .git com histórico completo) para /home/z/my-project via rsync; git status limpo (working tree idêntica ao remoto)
- .env reescrito com as credenciais de produção do painel (APP_PASSWORD, BREVO_API_KEY, EMAIL_FROM, REGISTRATION_INVITE_CODE)
- DATABASE_URL da imagem (hostname interno do Render dpg-d6h0d4ma2pns7388dgq0-a) testado: NÃO resolve fora da rede do Render (Internal Database URL); testadas as variantes externas regionais (oregon/frankfurt/ohio/virginia/singapore/sao-paulo/ireland/london) — todas falham autenticação fora da rede
- Solução: PostgreSQL 18.4 local real (embedded-postgres em /home/z/local-postgres, FORA do repo) na porta 5432, com MESMO usuário/senha/nome de banco da produção (z_services_db_f1pd); daemonizado via pg_ctl para sobreviver às sessões
- Quirk do sandbox: variável de sistema DATABASE_URL=file:...custom.db sobrescreve o .env — o dev server DEVE ser lançado com export DATABASE_URL=postgresql://...@localhost:5432/z_services_db_f1pd
- prisma db push aplicado (schema PostgreSQL integral, incluindo campos Json) + seed.js (23 usuários) + senha bcrypt do admin max-r@zaminebrasil.com = APP_PASSWORD (mesmo padrão do endpoint /api/auth/seed de produção)
- Dev server Next.js 16.3.0 (Turbopack) relançado daemonizado com o DATABASE_URL correto (porta 3000)

Stage Summary:
- App 100% funcional e verificado com agent-browser: login (etapa email → senha → sessão), mapa do Brasil com clique em MG abrindo "Minas Gerais" (contador 832 dias sem afastamento), /relatorios (Z-Services AI) com SSO NextAuth automático e formulário completo, mobile 390px com splash + mapa, APIs version/equipment/escala/estoque-goias 200 consultando o PostgreSQL local
- Único arquivo divergente do remoto: .env (DATABASE_URL apontando para o PostgreSQL local — necessário pois o banco do Render só é acessível de dentro da rede Render; no deploy, as env vars do dashboard do Render prevalecem automaticamente)
- Artefatos de teste (local-*.js/ts/png) removidos; senha de teste do admin mantida no banco local (dados ephemeral)

---
Task ID: 14 (Painel TV)
Data: 21/10/2026
Agent: Main (sessão atual)

Task: Integrar o sistema "Painel TV ZAMine" (HTML anexado pelo usuário, ex-artifact claude.ai) à plataforma, com login da plataforma, permissões por aba escolhidas pelo admin e aprovação obrigatória do admin para conteúdo ir à TV

Work Log:
- Prisma: novos modelos TvSection (conteúdo no ar + pendente por aba), TvPanelConfig (configurações), TvPermissao (quem edita o quê por aba) e TvAsset (imagens) — db push aplicado + prisma generate
- APIs em /api/tv/*: content (público, só aprovado), me (sessão+permissões), secoes/[key] GET/PUT (admin vai direto ao ar; editor com permissão cria pendência), secoes/[key]/aprovacao (aprovar/rejeitar), pendencias (com prévia), permissoes (GET/POST/DELETE, admin; bloqueia abas admin), config (PUT admin), upload + assets/[id] (imagens no bytea)
- src/lib/tv.ts: helpers (tvUser via sessão cookie/header x-zamine-token, tvAdmin via isAdminRole, podeEditarSecao)
- public/html/painel-tv-goias.html: app TV adaptado do arquivo do usuário (CRLF→LF) — claude.ai db/assets/user substituídos por fetch nas APIs da plataforma (mesmo padrão dos apps inspecoes/EPIs com zamine_token); editor com abas restritas por permissão; novas abas admin "Aprovações (TV)" (lista pendências com prévia renderizada + Aprovar/Rejeitar) e "Permissões de edição" (usuários da plataforma × 15 abas, salvar/remove); gate de login para sem acesso; polling 30s na TV; imagens via /api/tv/upload; backup download/restauração via API; links de edição locais (#editar-aba)
- Plataforma: entrada "Painel TV" no menu de Goiás (servicesData.go, ícone tv)
- Fix bug: tvUser checava isActive que não vem no select do validateSession (401 para todos) — removido (desativar usuário já derruba sessão)
- Fix: content não expõe seções com data vazio (linhas criadas só para pendência)
- E2E agent-browser (5 testes): admin edita Dias sem acidentes → no ar na hora; permissões concedidas a charles-a (DDS do dia + Comunicados); charles vê SOMENTE 2 abas e salvamento vira pendência (TV não muda); admin aprova em Aprovações → TV atualiza; cicero-c sem permissão vê bloqueio no editor. APIs validadas via curl (content/pendencias/me)

Stage Summary:
- Painel TV Goiás integrado: /html/painel-tv-goias.html (TV pública com só conteúdo aprovado; editor com login da plataforma)
- Permissões por aba centralizadas no admin (aba Permissões de edição); pendência nunca vai à TV sem aprovação
- Senhas de teste locais definidas para charles-a e cicero-c (= APP_PASSWORD); artefatos de teste removidos

---
Task ID: 14
Agent: Main
Task: Corrigir login no previewer — autenticação 100% via banco de dados, sem credenciais no código

Work Log:
- Investigado dev.log: tentativas do usuário (IP 21.0.0.1) em max-r@zaminebrasil.com retornavam 401
- Audit log confirmou 2 login_failed às 14:13 (senha de produção não existe no banco local — Render inacessível do sandbox)
- Verificado src/app/api/auth/login/route.ts: autenticação já é 100% DB-driven (bcrypt/SHA-256 contra User.password no PostgreSQL); nenhum login hardcoded no código (APP_PASSWORD do .env é usado apenas pelo endpoint de seed admin, nunca pelo login)
- Consultado User no banco: admin tinha hash temporário (definido na restauração); outros 22 usuários em first-access com password NULL
- Resetada conta max-r@zaminebrasil.com: password=null, isFirstAccess=true, attempts=0, sessionToken=null, TwoFactorChallenges limpos
- Testado envio de código via Brevo: POST /api/auth/first-access/resend → emailSent:true (e-mail real disparado)
- Verificação end-to-end com agent-browser: tela "Bem-vindo" → e-mail admin → tela de primeiro acesso renderizada (campo código, Nova Senha, Confirmar Senha, "Definir Senha e Entrar"); código enviado automaticamente ao abrir a tela; zero erros de console

Stage Summary:
- Login confirmado 100% puxado do banco de dados PostgreSQL — nenhuma credencial no código-fonte
- Admin definirá a própria senha via fluxo de primeiro acesso: e-mail → código de 6 dígitos no inbox real (Brevo) → nova senha (bcrypt no DB)
- Demais 22 usuários seguem o mesmo fluxo de primeiro acesso, idêntico à produção
- TWO_FACTOR_MODE está 'off' — após definir a senha, login direto sem 2FA
- Código expira em 10 min; botão "Reenviar código" disponível

---
Task ID: 15
Agent: Main
Task: Blindagem anti-perda de dados no painel TV Goiás (tudo no banco, sem bug, à prova de quedas)

Work Log:
- Auditoria completa: painel (public/html/painel-tv-goias.html) já persiste 100% no PostgreSQL (tv_sections, tv_panel_configs, tv_permissoes, tv_assets com bytes no DB) + auditoria em AuditLog + fluxo de aprovação admin pendência→ar
- Identificados 3 riscos: rascunho só na memória (F5/crash perdia tudo digitado), sobrescrita silenciosa entre editores simultâneos, TV sem auto-recuperação de falha prolongada
- Backend (secoes/[key]/route.ts + config/route.ts): controle de concorrência otimista — PUT aceita baseEm/force via query; se outra pessoa publicou depois do carregamento → 409 com autor/data (audit tv_secao_conflito); sucesso retorna atualizadoEm
- Frontend: rascunho persistente em localStorage (zamine-tv-draft-goias-v1) gravado a cada edição (debounce 300ms) com baseEm por aba; recuperação automática ao reabrir o editor + botão "Descartar rascunho"; limpeza por aba no salvamento bem-sucedido
- Frontend: diálogo de conflito 409 ("sobrescrever de propósito?" / cancelar mantém rascunho); baseEm sincronizado em showWho/PUT/aprovação; restauração de cópia de segurança limpa rascunho
- Frontend: TV auto-recarrega após 20 falhas consecutivas (~10 min) de conexão — apenas com editor fechado e sem alterações não salvas
- E2E verificado com sessão temporária no banco: digitar → F5 → rascunho recuperado ✓; salvar → banco atualizado + rascunho limpo + autor gravado ✓; PUT simultâneo → 409 → TV protegida → sobrescrita deliberada via dialog ✓; audit log registrou conflito ✓
- Lint limpo nos arquivos modificados; dados de teste restaurados; sessão temporária removida

Stage Summary:
- Nada digitado no painel pode mais se perder: ou está no banco, ou está no rascunho do navegador (sobrevive a F5, crash e queda de luz)
- Sobrescrita entre editores agora é sempre deliberada (409 + confirmação)
- TV opera 9h+/dia com auto-recuperação (polling 30s + reload após 10 min de falha)
- Usuário já definira a própria senha do admin via primeiro acesso (confirmado no banco)

---
Task ID: 16
Agent: Main
Task: Commit e push para o GitHub (com proteção de segredos)

Work Log:
- Push inicial bloqueado pelo GitHub Push Protection: commit automático continha BREVO_API_KEY no .env
- Investigação revelou risco pior não detectado pelo GitHub: screenshots do dashboard Render com TODAS as credenciais de produção (DATABASE_URL, BREVO_API_KEY, APP_PASSWORD) estavam em upload/ e commitados
- Histórico reescrito: git reset --soft origin/main; .env devolvido à versão do origin no índice; 3 arquivos de upload com conteúdo sensível removidos dos commits e movidos para /tmp/upload-backup
- Commits limpos criados: 982a8b1 (feat: Painel TV Goiás v18 completo) + 6ddfe32 (docs: worklog v18)
- Verificação: git grep nos commits confirmou zero segredos (Brevo, senha do banco, APP_PASSWORD)
- Push realizado com sucesso: 83ec84a..6ddfe32 main -> main
- git update-index --skip-worktree .env aplicado: .env local (com segredos reais para rodar localmente) nunca mais será commitado pelo auto-committer
- origin/main tracking ref sincronizado localmente

Stage Summary:
- GitHub atualizado com o Painel TV Goiás completo (v18) sem nenhum segredo exposto
- Repositório no GitHub mantém .env neutro (DATABASE_URL sandbox); produção usa env vars do dashboard Render (confirmado no screenshot do usuário)
- Token do usuário usado apenas nos comandos de push (nunca salvo em arquivo); usuário orientado a revogar
- .env local protegido contra commits futuros via skip-worktree

---
Task ID: 17
Agent: Main
Task: Escala de turno automática no painel da TV (técnico de hoje e amanhã puxados da plataforma)

Work Log:
- Mapeado o fluxo existente: plataforma tem escala Lundin (ciclo 8 dias, equipes A=Weslley, B=Higor, C=Marcos, D=Marcelo em src/data/escala-lundin.ts) + lançamentos no banco (EscalaData: atestados, spots, adms, eventos incl. backup) editados pelo EscalaModal; painel TV tinha aba "escala" 100% manual (letras diurno/noturno por dia)
- Criado src/lib/escala-auto.ts: cálculo server-side imune a fuso (datas em string YYYY-MM-DD), replicando as regras do EscalaModal — turno base Lundin (com fallback do ciclo 8 dias fora de mai/2026-jan/2027), atestado→"Atestado", evento férias→"Férias", folga agendada, backup→assume o turno de quem cobre (selo "Cobrindo X"), viagem/treinamento/ADM/spot como selos informativos
- GET /api/tv/[panel]/content agora devolve escalaAuto (hoje + amanhã + próximos 5 dias) via computarEscalaAutoSeguro (try/catch → null; falha nunca derruba o /content), respeitando ?tz= do navegador da TV (padrão America/Sao_Paulo)
- painel-tv-goias.html: nova opção na aba escala — checkbox "Puxar automaticamente da escala da plataforma (equipes A/B/C/D)" (def:false; renderer de check generalizado para respeitar def sem quebrar os checks existentes da config) + hint atualizado
- Novo slide automático na TV: cartões HOJE e AMANHÃ (dia da semana, data, diurno e noturno com letra colorida + nome + horário, selos de cobertura, linha "Fora" com folgas/atestados), próximos 5 dias com letras, e turmas/equipes A-B-C-D com nomes (fallback automático quando não há turmas cadastradas)
- Fetch do /content passa ?tz= do navegador (TV_TZ) nas duas chamadas (carregarConteudo e refreshContent); virada de dia acontece sozinha pelo polling de 30s
- Seção "escala" criada no banco com auto:true e horários 07:00–19:00 / 19:00–07:00 (nesting corrigido: conteúdo da seção é {horarios:...}, sem chave externa)
- Teste E2E real (agent-browser): slide mostra Hoje 21/10 A-Weslley (diurno) e C-Marcos (noturno), amanhã idem, próximos 5 dias batendo com o ciclo Lundin; cenário com A atestado + B cobrindo aplicado no banco → TV refletiu na hora (B no diurno com selo "Cobrindo A — Weslley Siqueira", A em "Fora: Atestado"); estado original do EscalaData restaurado após o teste
- Checkbox do editor validado (marcado com auto:true do banco, desmarcado com false); lint sem novos erros (31 problemas são preexistentes em outros arquivos)

Stage Summary:
- TV agora puxa sozinha o técnico do dia e de amanhã da escala da plataforma (nada para digitar na TV)
- Qualquer atestado/férias/folga/cobertura lançado no EscalaModal da plataforma aparece na TV no próximo polling (30s)
- Modo manual da aba escala continua disponível (basta desligar o checkbox)
- Arquivos: src/lib/escala-auto.ts (novo), src/app/api/tv/[panel]/content/route.ts, public/html/painel-tv-goias.html

---
Task ID: 18
Agent: Main
Task: Aniversariantes — cadastro dos colaboradores + upload de fotos em lote (casa foto com pessoa pelo nome do arquivo)

Work Log:
- Cadastrados no banco os 78 colaboradores da lista enviada pelo usuário (aba "aniversarios" do painel goias estava vazia): nome completo + dia + mês (nome) + nascimento (data completa, novo campo t:"date" na aba); distribuição por mês conferida (máx. 12 em Maio — slide mostra até 16, cabe)
- Novo campo "nascimento" na definição da aba (registro histórico; TV continua usando dia+mês)
- Nova part kind:"lote" no editor da aba: botão de seleção múltipla de fotos (input file multiple) + área de progresso/relatório
- Matching por nome do arquivo (casarFotoNome): normalização NFD (imune a acentos/maiúsculas/pontuação) → 1) nome completo igual, 2) nome do arquivo é começo do nome (primeiro nome), 3) nome é começo do arquivo; ambiguidade (ex.: 3 Robsons) NÃO casa — vai para o relatório para escolha manual; separadores _ e - viram espaço
- Loop de envio com progresso "Enviando N/total: arquivo…" reusando shrink() + /api/tv/upload (mesmas primitivas do campo foto individual); fotos entram no draft (rascunho persistente sobrevive a F5); relatório final: casadas, sem casamento, ambíguas (com as opções), falhas de envio; usuário revisa e salva pelo fluxo normal (Salvar e enviar para a TV)
- Handler de upload individual excluído do seletor genérico (.fileIn:not(#bkFile):not(#loteFile)) para não conflitar
- Teste E2E: usuário de teste (com permissão só da aba aniversarios) + 5 fotos de teste → 3 casaram nas pessoas certas (exato + 2 pelo primeiro nome), 1 ambígua reportada com os 3 Robsons, 1 sem casamento reportada; checkbox/relatório validados
- Upload real provado via curl (200 + asset criado); headless do agent-browser falhou com File-via-CDP (limitação do ambiente de teste, não do código — o campo foto individual que a equipe já usa em produção usa as mesmas primitivas)
- Limpeza total: localStorage do browser limpo (nenhum draft com fotos de teste), usuário/permissão de teste deletados, 2 assets de teste deletados; aba ficou com 78 itens e 0 fotos (pronta para as fotos reais)

Stage Summary:
- As 78 pessoas já estão na TV (slide mostra automaticamente os do mês; destaque nos do dia)
- Usuário só precisa: abrir a aba Aniversariantes → Fotos em lote → selecionar as 77 fotos → conferir o relatório → Salvar
- Nomes ambíguos (Robson ×3, Carlos ×2, Victor ×2, Vinicius ×2, Marcelo ×2, Marcos ×2, Jean ×2) precisam de arquivo com nome mais completo (ex.: "robson leao lima.jpg") ou escolha manual na linha
- Arquivos: public/html/painel-tv-goias.html (aba + editor + handler + CSS), prisma (dados)

---
Task ID: 19
Agent: Main
Task: Colar do Excel no cadastro de aniversariantes (lote por colagem NOME + NASCIMENTO)

Work Log:
- Nova part kind:"colar" na aba Aniversariantes (abaixo de Fotos em lote): botão "Colar do Excel" abre textarea para colar as colunas NOME e NASCIMENTO copiadas do Excel (TSV com tab; aceita também ; e 2+ espaços)
- Parser próprio (parseDataBR + lerLinhasExcel): pula linha de cabeçalho (NOME/NASCIMENTO), encontra a célula de data em qualquer posição (troca colunas invertidas), entende DD/MM/YYYY, DD/MM (sem ano), separadores / - . , ano com 2 dígitos (≤30→2000s, senão 1900s) e tira sufixo de hora ("08/12/1974 00:00:00")
- Prévia antes de aplicar: contagem "X linha(s) lida(s): N nova(s) · M já na lista", tabela com as 12 primeiras (nome, dia de Mês, selo nova/atualiza), problemas listados (data inválida, sem data, repetido na cola) e 3 botões: Juntar com a lista atual / Substituir tudo (mantém as fotos) / Colar de novo
- Juntar: casa por nome normalizado (normNome, imune a acentos/caixa) — quem já existe só atualiza dia+mês+nascimento (foto e setor ficam), novo é adicionado; não duplica. Substituir: lista passa a ser a colada, carregando foto/setor/nascimento antigos de quem já existia. Duplicado na cola vale a última (dedupe no parser)
- Aplicar re-renderiza a lista e mostra "Pronto: N adicionada(s) · M atualizada(s). A lista agora tem X pessoas." — salvamento segue pelo fluxo normal (Salvar e enviar para a TV, com rascunho/409 já existentes)
- Fix de robustez no handler genérico de inputs do editor: setDirty agora só nos branches f-/lista (evitava marcar "não salvo" ao digitar em inputs alheios ao draft, ex. busca e textarea da colagem)
- E2E real (agent-browser, usuário admin temporário depois apagado): lista completa de 78 colada no formato exato do Excel do usuário → "78 lidas: 0 nova · 78 já na lista" (bate 100% com o cadastrado na Task 18); cenário com data trocada + pessoa nova → atualizou dia/nascimento e adicionou sem duplicar (79); Substituir tudo → lista ficou com as 2 coladas; reload sem salvar recuperou o rascunho (blindagem Task 15) e Descartar voltou às 78 do banco — banco intacto no fim (78, ADRIANA dia 8)
- TV conferida: /content entrega 78 itens; slide de Outubro mostra Reinaldo (15/10) e Victor (28/10); renderer OK
- Lint sem novos problemas (31 preexistentes em outros arquivos); usuário/permissão de teste removidos; localStorage do navegador de teste limpo

Stage Summary:
- Cadastrar/atualizar os aniversariantes agora é colar a tabela do Excel e clicar em Juntar — sem digitar linha por linha
- A lista completa dos 78 segue no ar (intacta); o recurso serve para inclusões futuras (contratações) e correções em lote
- Fotos continuam sendo enviadas por Fotos em lote (nome do arquivo casa com a pessoa)
- Arquivos: public/html/painel-tv-goias.html (part colar + parser + CSS + fix setDirty)

---
Task ID: 20
Agent: Main
Task: Correção — colagem não lia tabela colada de fora do Excel e fotos em lote não casavam com lixo no nome do arquivo

Work Log:
- Diagnóstico via logs do servidor: sessão do usuário teve 0 PUT (nenhum save) e 0 POST /api/tv/upload (nenhuma foto enviada) — as duas falhas eram 100% no navegador; banco intacto (78 pessoas, nada corrompido, tv_assets=0 porque foto sem casamento nunca é enviada)
- Causa 1 (colagem): o parser só entendia colunas separadas por tab (Excel puro). Colando de PDF/WhatsApp/Word (espaço simples), a data ficava colada ao nome e TODAS as linhas viravam problema → "não entendi nenhuma linha" sem confirmação de sucesso
- Fix parser: se a linha não tem colunas, extrai a data de qualquer posição (regex dia/mês/ano, dia/mês, ISO yyyy-mm-dd, com espaço em branco ao redor dos separadores) e o nome é o resto da linha; cabeçalho com variantes ("NOME NASCIMENTO", "NOME DATA DE NASCIMENTO", "COLABORADOR...") pulado; vírgula aceita como separador; BOM do Excel removido; sufixo de hora ("08/12/1974 00:00:00") limpo do nome; mensagens de erro mostram a linha bruta ("Chegou assim aqui: …") para o usuário ver o que o painel recebeu
- Causa 2 (fotos): casarFotoNome exigia o nome no começo do arquivo. "foto 1 - adriana", "1 - NOME (2)", "WhatsApp Image 2024-01-15 at 10.30.00 higor ataides" não casavam NADA
- Fix casarFotoNome: tira tokens numéricos e palavras-lixo (foto/fotos/img/image/images/whatsapp/zap/at/am/pm/colaborador/col/funcionario/equipe/time/painel/tv) e adiciona regra "nome completo contido em qualquer posição do nome do arquivo"; tenta primeiro com o texto limpo e depois com o bruto; ambiguidade continua reportada com os candidatos
- UX: resultado da leitura agora rola para a visão (scrollIntoView) — antes podia ficar abaixo da dobra e parecer "nada aconteceu"; mensagem de sucesso diz "Lido com sucesso: N linha(s)…"; texto dos hints atualizado (colagem aceita qualquer origem; fotos explicam o que é ignorado)
- parseDataBR ganhou branch ISO (yyyy-mm-dd) antes do dia/mês/ano (evitava "1974-12-08" virar dia 74 inválido)
- Testes node: tab ✓, sem-tab ✓, vírgula+BOM ✓, vazio ✓, data com hora ✓, data inválida reportada ✓; casador: nome completo ✓, primeiro nome ✓, com lixo antes/depois ✓, WhatsApp ✓, ambíguos (robson×3/marcos×2/victor×2) reportados ✓, IMG sem nome rejeitado ✓, sobrenome sozinho rejeitado ✓
- E2E real (agent-browser + usuário admin temporário, apagado depois): colagem SEM TAB via evento paste real → "Lido com sucesso: 7 linha(s)" → Juntar → "Pronto: 0 adicionada(s) · 7 atualizada(s). A lista agora tem 78 pessoas"; casador no painel real casou adriana.jpg, "foto 2 - HIGOR ATAIDES MACEDO (1).jpg", "WhatsApp Image … reinaldo duarte.jpeg" e "robson leao.jpg"; IMG_2041.jpg sem casamento (correto); storage limpo, banco segue 78/sem pendência

Stage Summary:
- Colar agora funciona de QUALQUER origem (Excel, Planilhas, PDF, WhatsApp, Word) — a data é achada em qualquer lugar da linha
- Fotos casam mesmo com números/"WhatsApp Image"/"foto 1"/parênteses no nome do arquivo — só precisa do nome da pessoa em algum lugar dele
- Nada do que o usuário tinha feito se perdeu: banco estava (e está) com as 78 pessoas íntegras
- Arquivos: public/html/painel-tv-goias.html (parseDataBR + lerLinhasExcel + casarFotoNome + lerColagem + hints)
