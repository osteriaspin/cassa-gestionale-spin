#!/bin/bash
set -euo pipefail

BRIDGE="$HOME/Desktop/kube-bridge"
PROJECT="$HOME/Desktop/cassa"
SOURCE="$PROJECT/tools/mac-bridge/server-fiscal-queue.js"
ENVFILE="$PROJECT/.env.local"

if [ ! -f "$SOURCE" ]; then echo "ERRORE: manca $SOURCE"; exit 1; fi
if [ ! -f "$ENVFILE" ]; then echo "ERRORE: manca $ENVFILE"; exit 1; fi
if [ ! -f "$BRIDGE/kube-fiscal.exe" ]; then echo "ERRORE: manca $BRIDGE/kube-fiscal.exe"; exit 1; fi

URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENVFILE" | head -1 | cut -d= -f2-)
KEY=$(grep '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' "$ENVFILE" | head -1 | cut -d= -f2-)
if [ -z "$URL" ] || [ -z "$KEY" ]; then echo "ERRORE: configurazione Supabase mancante"; exit 1; fi

cp "$SOURCE" "$BRIDGE/server-fiscal-queue.js"
cat > "$BRIDGE/start-fiscal-bridge.sh" <<EOF
#!/bin/bash
export SUPABASE_URL='$URL'
export SUPABASE_PUBLISHABLE_KEY='$KEY'
export FISCAL_PRINT_ENABLED='true'
exec node '$BRIDGE/server-fiscal-queue.js'
EOF
chmod +x "$BRIDGE/start-fiscal-bridge.sh"

echo "Bridge installato."
echo "Avvio: $BRIDGE/start-fiscal-bridge.sh"
echo "ATTENZIONE: avviandolo, le vendite CONTANTI in coda possono produrre scontrini fiscali reali."
