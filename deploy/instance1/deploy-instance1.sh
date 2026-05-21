#!/usr/bin/env bash
# ==========================================================================
#  deploy-instance1.sh
#  Déploiement de MasterMonitor – Instance 1 sur VM Debian
#
#  Prérequis avant d'exécuter ce script :
#    1. VM Debian 12 (Bookworm) fraîchement installée
#    2. Accès SSH avec un utilisateur sudoer
#    3. Le fichier .env.instance1 copié sur la VM dans /tmp/
#         scp deploy/instance1/.env.instance1 user@<VM_IP>:/tmp/
#    4. Connectivité vers PostgreSQL (192.168.23.147) et AD (192.168.23.145)
#
#  Exécution :
#    chmod +x deploy-instance1.sh
#    sudo bash deploy-instance1.sh
# ==========================================================================
set -euo pipefail

# --------------------------------------------------------------------------
# VARIABLES — adapter si besoin
# --------------------------------------------------------------------------
APP_DIR="/opt/mastermonitor"
APP_USER="mastermonitor"
LOG_DIR="/var/log/mastermonitor"
REPO_URL="https://github.com/Halid13/MasterMonitor.git"
REPO_BRANCH="main"
NODE_MAJOR="22"          # Node.js LTS 22.x
ENV_SOURCE="/tmp/.env.instance1"

# --------------------------------------------------------------------------
# Couleurs pour la lisibilité
# --------------------------------------------------------------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --------------------------------------------------------------------------
# 0. Vérifications initiales
# --------------------------------------------------------------------------
info "=== Déploiement MasterMonitor – Instance 1 ==="

[ "$(id -u)" -eq 0 ] || error "Ce script doit être exécuté avec sudo."

[ -f "$ENV_SOURCE" ] || error "Fichier env introuvable : $ENV_SOURCE — copier .env.instance1 dans /tmp/ avant de relancer."

# --------------------------------------------------------------------------
# 1. Mise à jour système + dépendances de base
# --------------------------------------------------------------------------
info "Mise à jour des paquets système..."
apt-get update -qq
apt-get install -y -qq \
  curl git ca-certificates gnupg lsb-release \
  net-tools iputils-ping build-essential

# --------------------------------------------------------------------------
# 2. Installation de Node.js via NodeSource
# --------------------------------------------------------------------------
if command -v node &>/dev/null && node -e "process.exit(+process.version.split('.')[0].slice(1) >= $NODE_MAJOR ? 0 : 1)" 2>/dev/null; then
  info "Node.js $(node -v) déjà installé — OK"
else
  info "Installation de Node.js $NODE_MAJOR LTS..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
  info "Node.js $(node -v) installé"
fi

# --------------------------------------------------------------------------
# 3. Installation de PM2 (gestionnaire de processus)
# --------------------------------------------------------------------------
if command -v pm2 &>/dev/null; then
  info "PM2 $(pm2 -v) déjà installé — OK"
else
  info "Installation de PM2..."
  npm install -g pm2 --silent
  info "PM2 $(pm2 -v) installé"
fi

# --------------------------------------------------------------------------
# 4. Utilisateur système dédié (sans shell de connexion)
# --------------------------------------------------------------------------
if id "$APP_USER" &>/dev/null; then
  info "Utilisateur '$APP_USER' déjà existant — OK"
else
  info "Création de l'utilisateur '$APP_USER'..."
  useradd --system --no-create-home --shell /usr/sbin/nologin "$APP_USER"
fi

# --------------------------------------------------------------------------
# 5. Répertoire de l'application
# --------------------------------------------------------------------------
info "Préparation du répertoire $APP_DIR..."
mkdir -p "$APP_DIR"
mkdir -p "$LOG_DIR"
chown "$APP_USER":"$APP_USER" "$APP_DIR" "$LOG_DIR"

# --------------------------------------------------------------------------
# 6. Clone ou mise à jour du dépôt
# --------------------------------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
  info "Mise à jour du dépôt (git pull)..."
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --quiet origin
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$REPO_BRANCH"
else
  info "Clonage du dépôt depuis $REPO_URL..."
  sudo -u "$APP_USER" git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
fi

# --------------------------------------------------------------------------
# 7. Fichier d'environnement
# --------------------------------------------------------------------------
info "Copie du fichier d'environnement..."
cp "$ENV_SOURCE" "$APP_DIR/.env.local"
chown "$APP_USER":"$APP_USER" "$APP_DIR/.env.local"
chmod 600 "$APP_DIR/.env.local"   # lecture réservée au propriétaire

# --------------------------------------------------------------------------
# 8. Installation des dépendances npm
# --------------------------------------------------------------------------
info "Installation des dépendances npm (npm ci)..."
sudo -u "$APP_USER" npm ci --prefix "$APP_DIR" --silent

# --------------------------------------------------------------------------
# 9. Build de l'application Next.js
# --------------------------------------------------------------------------
info "Build de l'application (npm run build)..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm run build"

# --------------------------------------------------------------------------
# 10. Copie de l'ecosystem PM2
# --------------------------------------------------------------------------
ECOSYSTEM_SRC="$(dirname "$0")/ecosystem.config.js"
if [ -f "$ECOSYSTEM_SRC" ]; then
  info "Copie de l'ecosystem PM2..."
  cp "$ECOSYSTEM_SRC" "$APP_DIR/ecosystem.config.js"
  chown "$APP_USER":"$APP_USER" "$APP_DIR/ecosystem.config.js"
else
  warn "ecosystem.config.js non trouvé à côté du script — utilisation de celui déjà présent dans $APP_DIR (s'il existe)."
fi

# --------------------------------------------------------------------------
# 11. Démarrage / rechargement via PM2
# --------------------------------------------------------------------------
info "Démarrage de MasterMonitor avec PM2..."
if sudo -u "$APP_USER" pm2 list | grep -q "mastermonitor-1"; then
  sudo -u "$APP_USER" pm2 reload "$APP_DIR/ecosystem.config.js" --update-env
else
  sudo -u "$APP_USER" pm2 start "$APP_DIR/ecosystem.config.js"
fi

# --------------------------------------------------------------------------
# 12. Persistance PM2 au démarrage (systemd)
# --------------------------------------------------------------------------
info "Configuration du démarrage automatique PM2 (systemd)..."
PM2_STARTUP_CMD=$(sudo -u "$APP_USER" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>&1 | grep "sudo env" | head -1 || true)
if [ -n "$PM2_STARTUP_CMD" ]; then
  eval "$PM2_STARTUP_CMD"
fi
sudo -u "$APP_USER" pm2 save

# --------------------------------------------------------------------------
# 13. Vérification finale
# --------------------------------------------------------------------------
info "=== Vérification de l'instance ==="
sleep 3

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login || echo "000")
if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
  info "Instance 1 opérationnelle — HTTP $HTTP_CODE sur http://localhost:3000"
else
  warn "Réponse HTTP inattendue : $HTTP_CODE — vérifier les logs : pm2 logs mastermonitor-1"
fi

echo ""
echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}  MasterMonitor Instance 1 déployée avec succès !${NC}"
echo -e "${GREEN}========================================================${NC}"
echo ""
echo "  Commandes utiles :"
echo "    pm2 status                     → état du processus"
echo "    pm2 logs mastermonitor-1       → logs en temps réel"
echo "    pm2 reload ecosystem.config.js → redémarrage sans coupure"
echo "    pm2 monit                      → supervision CPU/RAM"
echo ""
echo "  Logs fichiers : $LOG_DIR"
echo ""
echo "  PROCHAINE ÉTAPE :"
echo "    → Déployer Instance 2 + Nginx sur la deuxième VM"
