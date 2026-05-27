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

Write-Host "`n=== [4/5] Sauvegarde de l'image en fichier tar ===" -ForegroundColor Cyan
docker save -o mastermonitor.tar $Tag
if ($LASTEXITCODE -ne 0) { Write-Error "Sauvegarde de l'image échouée"; exit 1 }

Write-Host "`n=== [4b/5] Transfert du tar vers la VM (SCP) ===" -ForegroundColor Cyan
scp mastermonitor.tar "${User}@${VM}:${AppDir}/"
if ($LASTEXITCODE -ne 0) { Remove-Item mastermonitor.tar -ErrorAction SilentlyContinue; Write-Error "Transfert SCP échoué"; exit 1 }

Write-Host "`n=== [4c/5] Chargement de l'image sur la VM ===" -ForegroundColor Cyan
ssh "${User}@${VM}" "docker load -i ${AppDir}/mastermonitor.tar && rm ${AppDir}/mastermonitor.tar"
if ($LASTEXITCODE -ne 0) { Remove-Item mastermonitor.tar -ErrorAction SilentlyContinue; Write-Error "Chargement de l'image échoué"; exit 1 }

Remove-Item mastermonitor.tar -ErrorAction SilentlyContinue

Write-Host "`n=== [5/5] Démarrage du container ===" -ForegroundColor Cyan
ssh "${User}@${VM}" @"
  set -e
  cd $AppDir
  docker compose down --remove-orphans 2>/dev/null || true
  docker compose up -d --force-recreate
  docker compose ps
"@

Write-Host "`n=== Déploiement terminé ===" -ForegroundColor Green
Write-Host "Application disponible sur http://${VM}:3000" -ForegroundColor Green
