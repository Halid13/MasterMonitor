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

Write-Host "`n=== [2/5] Export de l'image ===" -ForegroundColor Cyan
docker save $Tag | gzip > mastermonitor.tar.gz

Write-Host "`n=== [3/5] Création du répertoire sur la VM ===" -ForegroundColor Cyan
ssh "${User}@${VM}" "mkdir -p $AppDir"

Write-Host "`n=== [4/5] Copie vers la VM ===" -ForegroundColor Cyan
scp mastermonitor.tar.gz    "${User}@${VM}:${AppDir}/"
scp docker-compose.yml      "${User}@${VM}:${AppDir}/"

Write-Host "`n=== [5/5] Déploiement sur la VM ===" -ForegroundColor Cyan
ssh "${User}@${VM}" @"
  set -e
  cd $AppDir
  docker load < mastermonitor.tar.gz
  docker compose down --remove-orphans 2>/dev/null || true
  docker compose up -d
  docker compose ps
"@

Remove-Item mastermonitor.tar.gz -ErrorAction SilentlyContinue

Write-Host "`n=== Déploiement terminé ===" -ForegroundColor Green
Write-Host "Application disponible sur http://${VM}:3000" -ForegroundColor Green
