# =============================================================================
# Chat Service — production image (NestJS + Prisma 7 + Socket.IO)
# =============================================================================

# --- Builder: compile + prisma generate ---
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci --legacy-peer-deps

COPY . .

# Prisma 7: prisma.config.ts reads DATABASE_URL; dummy URL is enough for generate
ARG DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV DATABASE_URL=${DATABASE_URL}

RUN npx prisma generate && npm run build && \
    test -f dist/main.js || (echo "ERROR: dist/main.js missing after nest build" && ls -laR dist 2>/dev/null || true && exit 1)

# --- Pruner: prod deps + client ---
FROM node:20-alpine AS pruner
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

RUN npm ci --omit=dev --legacy-peer-deps && \
    npm cache clean --force

ARG DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate

RUN test -f dist/main.js || (echo "ERROR: pruner stage lost dist/main.js" && ls -laR dist 2>/dev/null || true && exit 1)

# --- Runtime ---
FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache wget openssl libc6-compat && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

COPY --from=pruner --chown=nestjs:nodejs /app/package*.json ./
COPY --from=pruner --chown=nestjs:nodejs /app/dist ./dist
COPY --from=pruner --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=pruner --chown=nestjs:nodejs /app/prisma.config.ts ./
COPY --from=pruner --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/keys ./keys

RUN test -f dist/main.js && test -r dist/main.js

USER nestjs

ENV NODE_ENV=production \
    PORT=3013

EXPOSE 3013

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3013/health || exit 1

CMD ["node", "dist/main.js"]
