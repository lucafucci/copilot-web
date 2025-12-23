# Copilot Web Interface

Interfaccia web per GitHub Copilot CLI creata da zero durante la sessione del 23 dicembre 2025.

## Obiettivo

Creare un'interfaccia web grafica per usare GitHub Copilot CLI tramite browser, accessibile su https://copilot.fujipi.com

## Struttura Progetto

```
/home/beelink/docker/copilot-web/
├── Dockerfile                 # Debian Slim + Node.js 22 + Copilot CLI
├── package.json              # Dipendenze: express, ws
├── .dockerignore
├── src/
│   └── server.js            # Backend Node.js con WebSocket
└── public/
    └── index.html           # Frontend con chat interface
```

## Architettura

### Backend (Node.js + Express + WebSocket)
- **Server HTTP**: Express sulla porta 3000
- **WebSocket**: Comunicazione real-time client-server
- **Esecuzione Copilot**: Spawna processi `copilot -p "<prompt>" --allow-all-tools` per ogni messaggio
- **Modalità**: Non-interattiva (ogni messaggio è un comando separato)

### Frontend (HTML + Vanilla JS)
- **Design**: GitHub dark theme
- **Componenti**: Header con status, chat container, input box
- **WebSocket Client**: Connessione automatica al server
- **Messaggi**: User (blu), Assistant (grigio), System (azzurro), Error (rosso)

### Docker Configuration
**Base Image**: `node:22-slim` (Debian, necessario per copilot CLI binario x64 glibc)

**Installazione Copilot CLI**:
```dockerfile
RUN curl -fsSL https://github.com/github/copilot-cli/releases/latest/download/copilot-linux-x64.tar.gz -o /tmp/copilot.tar.gz && \
    tar -xzf /tmp/copilot.tar.gz -C /usr/local/bin
```

**Variabili d'ambiente richieste**:
- `COPILOT_GITHUB_TOKEN` (o `GH_TOKEN` o `GITHUB_TOKEN`)
- `TZ=Europe/Rome`

**Volumi montati**:
- `/home/beelink/.config:/root/.config` (per salvare credenziali Copilot)

## Integrazione con Stack

### docker-compose.yml
```yaml
copilot-web:
  build: /home/beelink/docker/copilot-web
  container_name: copilot-web
  restart: unless-stopped
  networks:
    - traefik
  environment:
    - TZ=Europe/Rome
    - GH_TOKEN=${GH_TOKEN}
    - GITHUB_TOKEN=${GH_TOKEN}
    - COPILOT_GITHUB_TOKEN=${GH_TOKEN}
  volumes:
    - /home/beelink/.config:/root/.config
  labels:
    - traefik.enable=true
    - traefik.http.routers.copilot-web.rule=Host(`copilot.${DOMAIN}`)
    - traefik.http.routers.copilot-web.entrypoints=websecure
    - traefik.http.routers.copilot-web.tls.certresolver=cloudflare
    - traefik.http.services.copilot-web.loadbalancer.server.port=3000
    - wud.watch=true
```

### Traefik
- **URL**: https://copilot.fujipi.com
- **SSL**: Certificato Cloudflare automatico
- **Auth**: Nessuna (Authentik rimosso per semplificare)

### Homepage Dashboard
Aggiunta voce in `/home/beelink/docker/homepage/services.yaml`:
```yaml
- Copilot Web:
    icon: mdi-robot-outline
    href: https://copilot.fujipi.com
    description: GitHub Copilot Web Interface
    container: copilot-web
```

## Problemi Incontrati

### 1. Alpine Linux incompatibile
**Problema**: Copilot CLI è un binario x64 glibc, non funziona su Alpine (musl)
**Errore**: `exec /usr/local/bin/copilot: no such file or directory`
**Soluzione**: Cambiato base image da `node:22-alpine` a `node:22-slim` (Debian)

### 2. Modalità interattiva non funzionante
**Problema**: Spawning di `copilot` senza parametri non produceva output
**Motivo**: Copilot richiede PTY (pseudo-terminal) per modalità interattiva
**Soluzione**: Usato modalità non-interattiva con flag `-p "<prompt>"`

### 3. Autenticazione GitHub
**Problema critico**: Copilot CLI rifiuta token PAT (Personal Access Token)
**Errore**: `No authentication information found`
**Tentativi falliti**:
- Token classic GitHub (`ghp_...`) ❌
- Fine-grained PAT ❌ (non visibile "Copilot" nei permessi senza abbonamento attivo)
- Variabili d'ambiente `GH_TOKEN`, `GITHUB_TOKEN`, `COPILOT_GITHUB_TOKEN` ❌

**Root cause**: Copilot CLI richiede autenticazione OAuth completa (come VS Code), non supporta token PAT

## Stato Attuale

### ✅ Completato
- [x] Backend Node.js funzionante
- [x] Frontend con design GitHub theme
- [x] WebSocket real-time communication
- [x] Docker build e deploy
- [x] Integrazione Traefik con SSL
- [x] Aggiunto a Homepage dashboard
- [x] Copilot CLI installato nel container
- [x] Modalità non-interattiva implementata

### ❌ Non Funzionante
- [ ] **Autenticazione Copilot CLI** - blocca tutto il funzionamento

### Container Status
```bash
$ docker compose ps copilot-web
NAME          IMAGE                    STATUS
copilot-web   beelink-copilot-web      Up (healthy)
```

### Log Status
```
WebSocket server ready
Copilot Web UI running on port 3000
Client connected
Executing copilot with prompt: <messaggio>
Copilot stderr: Error: No authentication information found.
```

## Soluzione Necessaria

### Opzione 1: Autenticazione Interattiva (CONSIGLIATA)
Fare login una volta in modo interattivo, salvando le credenziali OAuth:

```bash
# Entrare nel container
docker exec -it copilot-web bash

# Avviare copilot
/usr/local/bin/copilot

# Nella CLI, eseguire
/login

# Seguire le istruzioni (codice device flow GitHub)
# Le credenziali vengono salvate in /root/.config/copilot/
```

**Vantaggi**:
- Autenticazione OAuth completa
- Credenziali persistenti (volume montato)
- Funziona come in VS Code

**Prerequisiti**:
- Abbonamento GitHub Copilot attivo
- Accesso al browser per device code flow

### Opzione 2: Rifare con API dirette
Sostituire Copilot CLI con chiamate dirette alle API:
- **OpenAI API** (GPT-4o, GPT-4-turbo)
- **Anthropic API** (Claude Sonnet, Claude Opus)

**Vantaggi**:
- Nessun problema di autenticazione
- Più controllo sull'implementazione
- Più veloce e affidabile

**Svantaggi**:
- Richiede riscrittura backend
- Necessita API key separata (OpenAI/Anthropic)
- Perde integrazione con GitHub MCP server

## Comandi Utili

### Build e Deploy
```bash
cd /home/beelink
docker compose build copilot-web
docker compose up -d copilot-web
```

### Debugging
```bash
# Log real-time
docker compose logs -f copilot-web

# Log ultimi 50
docker compose logs copilot-web --tail 50

# Entrare nel container
docker exec -it copilot-web bash

# Test manuale copilot
docker exec copilot-web /usr/local/bin/copilot -p "hello" --allow-all-tools
```

### Rebuild dopo modifiche
```bash
docker compose build copilot-web && docker compose up -d copilot-web
```

## File Modificati

1. **Creati**:
   - `/home/beelink/docker/copilot-web/` (intera directory)
   - `/home/beelink/.env` (aggiunto `GH_TOKEN`)

2. **Modificati**:
   - `/home/beelink/docker-compose.yml` (aggiunto servizio copilot-web)
   - `/home/beelink/docker/homepage/services.yaml` (aggiunta voce Copilot Web)

## Prossimi Passi

1. **Autenticare Copilot CLI** (opzione 1)
   ```bash
   docker exec -it copilot-web bash
   /usr/local/bin/copilot
   # Poi /login
   ```

2. **Testare funzionamento**
   - Aprire https://copilot.fujipi.com
   - Inviare messaggio "come funziona docker?"
   - Verificare risposta

3. **Miglioramenti futuri** (opzionali):
   - Aggiungere Authentik SSO
   - Streaming delle risposte token-by-token
   - History delle conversazioni
   - Multi-session support
   - Code syntax highlighting nelle risposte
   - File upload per analisi codice

## Note Tecniche

- **Porta interna**: 3000
- **Protocollo WebSocket**: ws:// (http) o wss:// (https) automatico
- **Timeout spawn**: Nessuno (attende fine risposta Copilot)
- **Memoria limite**: Non impostato (default Docker)
- **CPU limite**: Non impostato (default Docker)

## Credenziali e Token

- **GitHub Token** (attualmente non funzionante): Salvato in `/home/beelink/.env` come `GH_TOKEN`
- **Copilot Auth** (da configurare): Verrà salvata in `/root/.config/copilot/` nel container

---

**Creato il**: 23 dicembre 2025  
**Stato**: Funzionante ma bloccato su autenticazione  
**Prossima azione**: Login interattivo Copilot CLI
