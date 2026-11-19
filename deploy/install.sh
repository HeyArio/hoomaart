#!/usr/bin/env bash
# Hooma Art installer. Safe to run again for updates. Touches only its own files:
#   /opt/hoomaart, /var/lib/hoomaart, /etc/hoomaart.env, hoomaart.service, nginx site "hoomaart".
set -euo pipefail
APP=/opt/hoomaart; DATA=/var/lib/hoomaart; ENVF=/etc/hoomaart.env; PORT=3100
DOMAIN=hoomaart.ir

[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }
[ -f "$APP/server.js" ] || { echo "$APP/server.js not found. Unpack the archive into $APP first."; exit 1; }

NODE_SRC=$(ls /root/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -1 || true)
[ -n "$NODE_SRC" ] || NODE_SRC=$(command -v node || true)
[ -n "$NODE_SRC" ] || { echo "Node.js not found."; exit 1; }
install -m 755 "$NODE_SRC" /usr/local/bin/hooma-node

id hooma >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin hooma
mkdir -p "$DATA"; chown -R hooma:hooma "$DATA"; chmod 750 "$DATA"
chown -R root:root "$APP"; chmod -R a+rX "$APP"

NEWPASS=""
if [ ! -f "$ENVF" ]; then
  NEWPASS=$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 14)
  printf 'PORT=%s\nHOST=127.0.0.1\nDATA_DIR=%s\nADMIN_PASSWORD=%s\n' "$PORT" "$DATA" "$NEWPASS" > "$ENVF"
  chmod 600 "$ENVF"
fi

cat > /etc/systemd/system/hoomaart.service <<UNIT
[Unit]
Description=Hooma Art website
After=network.target

[Service]
User=hooma
Group=hooma
WorkingDirectory=$APP
EnvironmentFile=$ENVF
ExecStart=/usr/local/bin/hooma-node $APP/server.js
Restart=always
RestartSec=3
MemoryMax=220M
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable hoomaart >/dev/null 2>&1
systemctl restart hoomaart
sleep 2
curl -fsS "http://127.0.0.1:$PORT/api/works" >/dev/null || { echo "The site did not start. Showing its log:"; journalctl -u hoomaart -n 20 --no-pager; exit 1; }

SITE=/etc/nginx/sites-available/hoomaart
if [ ! -f "$SITE" ]; then
  cat > "$SITE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 12m;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
  ln -sf "$SITE" /etc/nginx/sites-enabled/hoomaart
  if nginx -t 2>/dev/null; then systemctl reload nginx
  else rm -f /etc/nginx/sites-enabled/hoomaart; echo "nginx rejected the new site file, so it was NOT enabled. Other sites are unchanged."; nginx -t; exit 1; fi
fi

echo
echo "=== Hooma Art is installed ==="
echo "Site:  http://$DOMAIN   (once the domain points at this server)"
echo "Admin: http://$DOMAIN/admin"
if [ -n "$NEWPASS" ]; then echo "Admin password (write it down now): $NEWPASS"; else echo "Admin password: unchanged (stored in $ENVF)"; fi
