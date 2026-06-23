#!/bin/bash
# script de démarrage du backend AutoConnect en mode développement

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "🚀 Démarrage du backend AutoConnect en mode développement..."

# Vérifier que .env existe
if [ ! -f .env ]; then
  echo "❌ Erreur: Le fichier .env est manquant."
  echo "📋 Créer un .env basé sur .env.example:"
  echo "   cp .env.example .env"
  exit 1
fi

# Vérifier que node_modules existe
if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances..."
  npm install
fi

# Vérifier la connexion à PostgreSQL et exécuter les migrations
echo "🔄 Vérification et application des migrations Prisma..."
npm run prisma:migrate:dev

# Démarrer le serveur en mode watch
echo "✅ Démarrage du serveur..."
npm run start:dev
