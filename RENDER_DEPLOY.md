# Zamine Plataforma - Deploy no Render

## Opção 1: Deploy via Render Blueprint (Recomendado)

1. Acesse [render.com](https://render.com) e faça login
2. Clique em **"New"** → **"Blueprint"**
3. Conecte seu repositório GitHub: `Maxh8054/Plataforma-de-servi-os`
4. O Render detectará automaticamente o arquivo `render.yaml`
5. Clique em **"Apply"** para iniciar o deploy

## Opção 2: Deploy Manual

1. Acesse [render.com](https://render.com) e faça login
2. Clique em **"New"** → **"Web Service"**
3. Conecte seu repositório GitHub
4. Configure:
   - **Name:** `zamine-plataforma`
   - **Runtime:** `Node`
   - **Build Command:** `bun install && bun run build`
   - **Start Command:** `bun run start`
   - **Plan:** Free

## Opção 3: Deploy via Docker

1. Acesse [render.com](https://render.com) e faça login
2. Clique em **"New"** → **"Web Service"**
3. Conecte seu repositório GitHub
4. Configure:
   - **Name:** `zamine-plataforma`
   - **Runtime:** `Docker`
   - **Plan:** Free

## Variáveis de Ambiente (se necessário)

Adicione no dashboard do Render:
- `NODE_ENV=production`

## Arquivos de Configuração

- `render.yaml` - Configuração do Blueprint
- `Dockerfile` - Configuração do Docker
- `next.config.ts` - Configuração do Next.js com standalone output

## Notas

- O plano gratuito do Render "hiberna" após 15 minutos de inatividade
- O primeiro acesso após hibernação pode demorar ~30 segundos
- Para produção, considere atualizar para um plano pago
