#!/usr/bin/env bash
# ==========================================================================
#  deploy-instance2.sh
#  Deploiement de MasterMonitor – Instance 2 + Nginx Load Balancer
#
#  Prerequis avant d'executer ce script :
#    1. VM Debian 12 (Bookworm) fraichement installee
#    2. Acces SSH avec un utilisateur sudoer
#    3. Le fichier .env.instance2 copie sur la VM dans /tmp/
#         scp deploy/instance2/.env.instance2 user@192.168.32.155:/tmp/
#    4. Connectivite vers PostgreSQL et AD
#    5. IP de l'Instance 1 connue (par defaut 192.168.32.154)
#
#  Execution :
#    chmod +x deploy-instance2.sh
#    sudo bash deploy-instance2.sh
#
#  Optionnel :
#    APP1_IP=192.168.32.153 sudo bash deploy-instance2.sh
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
ENV_SOURCE="/tmp/.env.instance2"
APP1_IP="${APP1_IP:-192.168.32.153}"

NGINX_SITE_AVAILABLE="/etc/nginx/sites-available/mastermonitor-lb"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/mastermonitor-lb"

# --------------------------------------------------------------------------
# Couleurs pour la lisibilite
# --------------------------------------------------------------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --------------------------------------------------------------------------
# 0. Verifications initiales
# --------------------------------------------------------------------------
info "=== Deploiement MasterMonitor – Instance 2 + Load Balancer ==="

[ "$(id -u)" -eq 0 ] || error "Ce script doit etre execute avec sudo."
[ -f "$ENV_SOURCE" ] || error "Fichier env introuvable : $ENV_SOURCE — copier .env.instance2 dans /tmp/ avant de relancer."

# --------------------------------------------------------------------------
# 1. Mise a jour systeme + dependances de base
# --------------------------------------------------------------------------
info "Mise a jour des paquets systeme..."
apt-get update -qq
apt-get install -y -qq \
  curl git ca-certificates gnupg lsb-release \
  net-tools iputils-ping build-essential nginx

# --------------------------------------------------------------------------
# 2. Installation de Node.js via NodeSource
# --------------------------------------------------------------------------
if command -v node &>/dev/null && node -e "process.exit(+process.version.split('.')[0].slice(1) >= $NODE_MAJOR ? 0 : 1)" 2>/dev/null; then
  info "Node.js $(node -v) deja installe — OK"
else
  info "Installation de Node.js $NODE_MAJOR LTS..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
  info "Node.js $(node -v) installe"
fi

# --------------------------------------------------------------------------
# 3. Installation de PM2 (gestionnaire de processus)
# --------------------------------------------------------------------------
if command -v pm2 &>/dev/null; then
  info "PM2 $(pm2 -v) deja installe — OK"
else
  info "Installation de PM2..."
  npm install -g pm2 --silent
  info "PM2 $(pm2 -v) installe"
fi

# --------------------------------------------------------------------------
# 4. Utilisateur systeme dedie (sans shell de connexion)
# --------------------------------------------------------------------------
if id "$APP_USER" &>/dev/null; then
  info "Utilisateur '$APP_USER' deja existant — OK"
else
  info "Creation de l'utilisateur '$APP_USER'..."
  useradd --system --shell /usr/sbin/nologin --home-dir "/home/$APP_USER" --create-home "$APP_USER"
fi
mkdir -p "/home/$APP_USER"
chown "$APP_USER":"$APP_USER" "/home/$APP_USER"

# --------------------------------------------------------------------------
# 5. Repertoire de l'application
# --------------------------------------------------------------------------
info "Preparation du repertoire $APP_DIR..."
mkdir -p "$APP_DIR"
mkdir -p "$LOG_DIR"
chown "$APP_USER":"$APP_USER" "$APP_DIR" "$LOG_DIR"

# --------------------------------------------------------------------------
# 6. Clone ou mise a jour du depot
# --------------------------------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
  info "Mise a jour du depot (git pull)..."
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --quiet origin
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$REPO_BRANCH"
else
  info "Clonage du depot depuis $REPO_URL..."
  sudo -u "$APP_USER" git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
fi

# --------------------------------------------------------------------------
# 7. Fichier d'environnement
# --------------------------------------------------------------------------
info "Copie du fichier d'environnement..."
cp "$ENV_SOURCE" "$APP_DIR/.env.local"
chown "$APP_USER":"$APP_USER" "$APP_DIR/.env.local"
chmod 600 "$APP_DIR/.env.local"

# --------------------------------------------------------------------------
# 8. Installation des dependances npm
# --------------------------------------------------------------------------
info "Installation des dependances npm (npm ci)..."
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
  warn "ecosystem.config.js non trouve a cote du script — utilisation de celui deja present dans $APP_DIR (s'il existe)."
fi

# --------------------------------------------------------------------------
# 11. Demarrage / rechargement App2 via PM2
# --------------------------------------------------------------------------
info "Demarrage de MasterMonitor Instance 2 avec PM2..."
if sudo -u "$APP_USER" pm2 list | grep -q "mastermonitor-2"; then
  sudo -u "$APP_USER" pm2 reload "$APP_DIR/ecosystem.config.js" --update-env
else
  sudo -u "$APP_USER" pm2 start "$APP_DIR/ecosystem.config.js"
fi

# --------------------------------------------------------------------------
# 12. Persistance PM2 au demarrage (systemd)
# --------------------------------------------------------------------------
info "Configuration du demarrage automatique PM2 (systemd)..."
PM2_STARTUP_CMD=$(sudo -u "$APP_USER" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>&1 | grep "sudo env" | head -1 || true)
if [ -n "$PM2_STARTUP_CMD" ]; then
  eval "$PM2_STARTUP_CMD"
fi
sudo -u "$APP_USER" pm2 save

# --------------------------------------------------------------------------
# 13. Configuration Nginx (load balancer)
# --------------------------------------------------------------------------
info "Configuration de Nginx load balancer..."
cat > "$NGINX_SITE_AVAILABLE" <<EOF
upstream mastermonitor_backend {
  least_conn;
  server ${APP1_IP}:3000 max_fails=3 fail_timeout=10s;
  server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;
  keepalive 32;
}

server {
  listen 80;
  server_name _;

  access_log /var/log/nginx/mastermonitor-access.log;
  error_log /var/log/nginx/mastermonitor-error.log;

  location / {
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    proxy_buffering off;
    proxy_read_timeout 3600;
    proxy_connect_timeout 5s;
    proxy_send_timeout 60s;

    proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
    proxy_next_upstream_tries 3;

    proxy_pass http://mastermonitor_backend;
  }
}
EOF

ln -sf "$NGINX_SITE_AVAILABLE" "$NGINX_SITE_ENABLED"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl restart nginx

# --------------------------------------------------------------------------
# 14. Verification finale
# --------------------------------------------------------------------------
info "=== Verification de l'instance et du load balancer ==="
sleep 3

APP_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/login || echo "000")
LB_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/login || echo "000")

if [ "$APP_HTTP_CODE" -ge 200 ] && [ "$APP_HTTP_CODE" -lt 400 ]; then
  info "Instance 2 operationnelle — HTTP $APP_HTTP_CODE sur http://127.0.0.1:3000"
else
  warn "Reponse HTTP inattendue App2 : $APP_HTTP_CODE — verifier : pm2 logs mastermonitor-2"
fi

if [ "$LB_HTTP_CODE" -ge 200 ] && [ "$LB_HTTP_CODE" -lt 400 ]; then
  info "Load balancer Nginx operationnel — HTTP $LB_HTTP_CODE sur http://192.168.32.155"
else
  warn "Reponse HTTP inattendue LB : $LB_HTTP_CODE — verifier : journalctl -u nginx -n 100"
fi

echo ""
echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}  MasterMonitor Instance 2 + Nginx LB deployes !${NC}"
echo -e "${GREEN}========================================================${NC}"
echo ""
echo "  Commandes utiles :"
echo "    pm2 status                               -> etat des processus"
echo "    pm2 logs mastermonitor-2                 -> logs App2"
echo "    sudo nginx -t                            -> verifier conf Nginx"
echo "    sudo systemctl status nginx              -> etat Nginx"
echo "    curl -I http://192.168.32.155/login      -> test LB"
echo ""
echo "  Backend pool actuel :"
echo "    - App1: ${APP1_IP}:3000"
echo "    - App2: 127.0.0.1:3000"
