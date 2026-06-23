#!/bin/bash
# script de démarrage du backend AutoConnect en mode production

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "🚀 Démarrage du backend AutoConnect en mode production..."

# Vérifier que .env existe
if [ ! -f .env ]; then
  echo "❌ Erreur: Le fichier .env est manquant."
  echo "📋 Créer un .env avec vos variables de production"
  exit 1
fi

# Vérifier que node_modules existe
if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances..."
  npm install --only=production
fi

# Build TypeScript
echo "🏗️  Compilation TypeScript..."
npm run build

# Exécuter les migrations
echo "🔄 Application des migrations Prisma..."
npm run prisma:migrate:deploy

# Démarrer le serveur
echo "✅ Démarrage du serveur de production..."
npm run start:prod
