#!/bin/bash
# script de setup initial du backend

set -e

echo "📦 Setup initial du backend AutoConnect..."

# Créer .env s'il n'existe pas
if [ ! -f .env ]; then
  echo "📋 Création du fichier .env..."
  cp .env.example .env
  echo "⚠️  Important: Éditer .env avec vos paramètres (DATABASE_URL, JWT_SECRET, etc.)"
fi

# Installer les dépendances
echo "📥 Installation des dépendances npm..."
npm install

# Initialiser Prisma
echo "🔄 Initialisation de Prisma..."
npm run prisma:generate

# Exécuter les migrations
echo "🔄 Application des migrations..."
npm run prisma:migrate:dev

echo "✅ Setup terminé!"
echo "🚀 Pour démarrer le serveur en développement: npm run start:dev"
echo "📚 Pour voir l'API Swagger: http://localhost:3000/api/docs"
