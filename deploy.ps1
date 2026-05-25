# deploy.ps1 — Build l'image Docker et la déploie sur la VM Instance 1
param(
    [string]$VM      = "192.168.23.153",
    [string]$User    = "app1",
    [string]$AppDir  = "~/mastermonitor",
    [string]$Tag     = "mastermonitor:latest"
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== [1/5] Build de l'image Docker ===" -ForegroundColor Cyan
docker build -t $Tag .
if ($LASTEXITCODE -ne 0) { Write-Error "Build échoué"; exit 1 }

Write-Host "`n=== [2/5] Création du répertoire sur la VM ===" -ForegroundColor Cyan
ssh "${User}@${VM}" "mkdir -p $AppDir"

Write-Host "`n=== [3/5] Copie docker-compose.yml vers la VM ===" -ForegroundColor Cyan
scp docker-compose.yml "${User}@${VM}:${AppDir}/"

Write-Host "`n=== [4/5] Envoi de l'image vers la VM (streaming SSH) ===" -ForegroundColor Cyan
docker save $Tag | ssh "${User}@${VM}" "docker load"
if ($LASTEXITCODE -ne 0) { Write-Error "Envoi de l'image échoué"; exit 1 }

Write-Host "`n=== [5/5] Démarrage du container ===" -ForegroundColor Cyan
ssh "${User}@${VM}" @"
  set -e
  cd $AppDir
  docker compose down --remove-orphans 2>/dev/null || true
  docker compose up -d
  docker compose ps
"@

Write-Host "`n=== Déploiement terminé ===" -ForegroundColor Green
Write-Host "Application disponible sur http://${VM}:3000" -ForegroundColor Green
