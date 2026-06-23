# 🚗 AutoConnect Backend API

**Plateforme de réservation et transport routier en Guinée**

Version: `1.0.0` | Framework: `NestJS 11` | ORM: `Prisma v7` | DB: `PostgreSQL 16`

---

## 🚀 Démarrage Rapide

### Option 1 : Mode natif (npm)
```bash
# Setup initial
./setup.sh

# Démarrage développement
./dev.sh
```

### Option 2 : Docker Compose
```bash
docker-compose up -d
```

---

## 📦 Installation Complète

### Prérequis
- **Node.js**: v20+
- **PostgreSQL**: v14+ (ou Docker)
- **Docker & Compose**: optionnel (recommandé)

### 1. Configuration `.env`
```bash
cp .env.example .env
# Éditer avec vos paramètres
```

### 2. Installation
```bash
npm install
npm run prisma:migrate:dev
npm run start:dev
```

---

## 🛠️ Scripts Disponibles

```bash
# Démarrage
npm run start:dev         # Mode watch
npm run start:prod        # Production

# Tests
npm run test              # Unitaires
npm run test:cov         # Avec coverage
npm run test:e2e         # End-to-end

# Prisma
npm run prisma:migrate:dev    # Créer migrations
npm run prisma:studio         # GUI Prisma

# Lancement rapide
./setup.sh               # Setup initial
./dev.sh                # Démarrage dev avec migrations
./prod.sh               # Production
```

---

## 🏗️ Architecture & Modules

```
src/
├── auth/          # JWT, login, register
├── bookings/      # Réservations (statut, workflow)
├── payments/      # Paiements Mobile Money
├── wallet/        # Portefeuille chauffeur
├── withdrawals/   # Retraits
├── escrow/        # Compte séquestre
├── gps/           # Validation GPS
├── qr/            # QR Code
├── otp/           # OTP verification
├── drivers/       # Profils chauffeurs
├── vehicles/      # Véhicules
├── notifications/ # Notifications
└── common/        # Guards, filters, interceptors
```

---

## 📊 API Endpoints Clés

### Auth
```
POST   /auth/register       Créer un compte
POST   /auth/login          Se connecter
```

### Bookings
```
POST   /bookings            Créer réservation
GET    /bookings/:id        Détail
PATCH  /bookings/:id/status Mettre à jour statut
POST   /bookings/:id/start  Démarrer trajet (GPS + OTP/QR)
```

### Payments
```
POST   /payments            Initier paiement
POST   /payments/webhook    Callback opérateur
```

### Wallet (Chauffeur)
```
GET    /wallet/balance      Solde + récapitulatif
GET    /wallet/history      Historique
POST   /wallet/release/:id  Libérer fonds
```

### Withdrawals
```
POST   /withdrawals         Demander retrait
GET    /withdrawals         Lister retraits
```

**Voir Swagger**: `GET /api/docs`

---

## 💳 Workflow Transactionnel

### 1. Réservation
Passager crée → Chauffeur confirme → Passager paye → Escrow

### 2. Paiement
POST /payments → transactionId (PROCESSING)
← Webhook opérateur → handleWebhook()
→ Si OK: Escrow + OTP/QR + Wallet pendingBalance

### 3. Démarrage Trajet
POST /bookings/:id/start + GPS + (OTP|QR validation)
→ Statut IN_PROGRESS

### 4. Libération Fonds
Trajet terminé → EscrowService.releaseFunds()
→ Wallet: pendingBalance → withdrawableBalance

### 5. Retrait
POST /withdrawals → Commission 10% calculée
← Webhook opérateur → Virement effectué

---

## 🔐 Sécurité

✅ **Mesures en place**:
- Helmet: Headers HTTP sécurisés
- CORS: Liste blanche configurée
- Validation globale: class-validator
- JWT Auth: Token 15min + Refresh 7j
- Roles: ADMIN, CHAUFFEUR, PASSAGER, AGENT_GARE
- Rate Limiting: 100 req/min par IP
- Exception Filter: Masquage erreurs prod
- GPS Validation: Distance configurable
- OTP: 6 chiffres, 24h expiration
- Logs sécurisés: Pas de données sensibles

---

## 🧪 Tests

✅ **Phase 6 - 22 tests passants**:
- BookingsService: 5 tests
- PaymentsService: 5 tests
- WalletService: 3 tests
- EscrowService: 2 tests
- WithdrawalsService: 7 tests

```bash
npm run test -- --runInBand src/payments/payments.service.spec.ts
npm run test:cov
```

---

## 🐳 Docker

### Dev Stack (Postgres + Redis + Backend)
```bash
docker-compose up -d
docker-compose logs -f backend
```

### Build Production
```bash
docker build -t autoconnect-backend:latest .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  autoconnect-backend:latest
```

---

## 📝 Phase 7: Revue Finale & Préparation Déploiement

✅ **Audit de sécurité**:
- Validation input globale
- Exception filter avec masquage erreurs prod
- Logs sécurisés

✅ **Scripts de lancement**:
- `./setup.sh` — Setup initial
- `./dev.sh` — Dev + migrations
- `./prod.sh` — Production

✅ **Docker & Compose**:
- `Dockerfile` — Production
- `Dockerfile.dev` — Development
- `docker-compose.yml` — Full stack

✅ **Documentation**:
- README complet
- Endpoints API
- Workflow transactionnel
- Configuration & sécurité

---

## 🔄 Déploiement

### Production (Render, Railway, Heroku, etc.)
1. Configurer env vars sur plateforme
2. **Build CMD**: `npm run build && npm run prisma:migrate:deploy`
3. **Start CMD**: `npm run start:prod`
4. Connecter DB Neon PostgreSQL

---

## 📞 Support

- **Issues**: Repo issues
- **Email**: api@autoconnect.gn
- **Docs**: `/api/docs` (Swagger)

---

## 📄 License

MIT — Propriétaire AutoConnect 2026
