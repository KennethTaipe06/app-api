# ==========================================
# Stage 1: Dependencies
# ==========================================
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci

# Generar Prisma Client
ENV DATABASE_URL="postgres://u:p@h:5432/d"
RUN npx prisma generate
ENV DATABASE_URL=""

# ==========================================
# Stage 2: Build
# ==========================================
FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL="postgres://u:p@h:5432/d"
RUN npm run build

# ==========================================
# Stage 3: Production
# ==========================================
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copiar dependencias de produccion
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

ENV DATABASE_URL="postgres://u:p@h:5432/d"
RUN npm ci --omit=dev && npx prisma generate
ENV DATABASE_URL=""

# Copiar build
COPY --from=build /app/dist ./dist

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/src/main"]
