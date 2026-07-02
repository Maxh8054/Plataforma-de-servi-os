FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json bun.lock* package-lock.json* yarn.lock* ./
RUN npm install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client before build
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=builder /app/public ./public

# Copy Prisma schema for runtime db push
COPY --from=builder /app/prisma ./prisma

# Set the correct permission for prerender cache
RUN mkdir .next

# Create db directory
RUN mkdir db

# Copy node_modules needed at runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/xlsx ./node_modules/xlsx
COPY --from=builder /app/node_modules/xlsx.js ./node_modules/xlsx.js 2>/dev/null || true

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create entrypoint script
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'echo "=== Entrypoint: initializing database ===" >&2' >> /app/entrypoint.sh && \
    echo 'mkdir -p /app/db' >> /app/entrypoint.sh && \
    echo 'npx prisma db push --skip-generate 2>&1 | tee /tmp/prisma-push.log' >> /app/entrypoint.sh && \
    echo 'echo "=== Prisma db push done ===" >&2' >> /app/entrypoint.sh && \
    echo 'exec node server.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/db/custom.db"

CMD ["/app/entrypoint.sh"]