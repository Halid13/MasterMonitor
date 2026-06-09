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

# Utilisateur non-root (non utilisé, user: "0" est forcé dans docker-compose)
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Outils réseau et métriques distantes :
#  - openssh-client + sshpass : métriques Linux via SSH
#  - curl + libs              : dépendances pour PowerShell
#  - pwsh (PowerShell 7)      : métriques Windows via WinRM
RUN apk add --no-cache openssh-client sshpass curl libgcc libstdc++ icu-libs krb5-libs \
 && PWSH_VER=7.4.6 \
 && curl -sL "https://github.com/PowerShell/PowerShell/releases/download/v${PWSH_VER}/powershell-${PWSH_VER}-linux-musl-x64.tar.gz" -o /tmp/pwsh.tar.gz \
 && mkdir -p /opt/microsoft/powershell/7 \
 && tar zxf /tmp/pwsh.tar.gz -C /opt/microsoft/powershell/7 \
 && chmod +x /opt/microsoft/powershell/7/pwsh \
 && ln -sf /opt/microsoft/powershell/7/pwsh /usr/local/bin/pwsh \
 && rm /tmp/pwsh.tar.gz \
 # PSWSMan : active WSMan/WinRM pour PowerShell 7 sur Linux (Alpine musl supporté)
 && pwsh -NoProfile -Command "Install-Module -Name PSWSMan -Force -Scope AllUsers" \
 && pwsh -NoProfile -Command "Install-WSMan"

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
