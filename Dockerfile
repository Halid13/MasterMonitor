# ──────────────────────────────────────────────
# Stage 1 : Build
# ──────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

COPY . .
RUN npm run build

# ──────────────────────────────────────────────
# Stage 2 : Runner (image finale minimale)
# ──────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Utilisateur non-root
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Fichiers publics
COPY --from=builder /app/public ./public

# Build standalone (inclut server.js + node_modules tracés)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

# ldapts est serverExternalPackage → s'assurer qu'il est présent
COPY --from=builder /app/node_modules/ldapts                    ./node_modules/ldapts
COPY --from=builder /app/node_modules/asn1                      ./node_modules/asn1
COPY --from=builder /app/node_modules/debug                     ./node_modules/debug
COPY --from=builder /app/node_modules/ms                        ./node_modules/ms
COPY --from=builder /app/node_modules/uuid                      ./node_modules/uuid
COPY --from=builder /app/node_modules/strict-event-emitter-types ./node_modules/strict-event-emitter-types

EXPOSE 3000

CMD ["node", "server.js"]
