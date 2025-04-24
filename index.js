// FCA-Agent - Serveur principal
// Point d'entrée pour le serveur Node.js sur Raspberry Pi

// Imports
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { setupDatabase } = require('./db/setup');
const { logger } = require('./utils/logger');
const simpleAuthMiddleware = require('./middleware/simple-auth');

// Routes
const statusRoutes = require('./api/status');
const tasksRoutes = require('./api/tasks');
const authRoutes = require('./api/auth');
const claudeTestRoutes = require('./api/claude-test');

// Initialisation
const app = express();
const PORT = process.env.PORT || 3001;

// Création du répertoire logs s'il n'existe pas
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
  logger.info(`Répertoire créé: ${logsDir}`);
}

// Middleware
// Configuration plus permissive pour la sécurité
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'unsafe-none' }
}));

// Configure CORS de manière très permissive
app.use(cors({
  origin: '*', // Autorise toutes les origines
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' })); // Permettre des requêtes JSON plus grandes pour les captures d'écran
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Middleware pour analyser les cookies
app.use(morgan('dev', { stream: { write: message => logger.info(message.trim()) } }));

// Nous ne servons plus les fichiers statiques directement depuis le serveur Node.js
// car Nginx s'en charge déjà. On se concentre uniquement sur l'API.

// Routes API d'authentification (non protégées)
app.use('/api/auth', authRoutes);

// Route de test pour l'API Claude (non protégée pour faciliter les tests)
app.use('/api/claude-test', claudeTestRoutes);

// Middleware d'authentification pour protéger les routes suivantes
// Note: on exclut les routes d'authentification et les fichiers statiques
app.use('/api', (req, res, next) => {
  // Vérifier si c'est une route d'authentification
  if (req.path.startsWith('/auth/')) {
    return next();
  }
  
  // Appliquer le middleware d'authentification pour les autres routes API
  simpleAuthMiddleware(req, res, next);
});

// Importer les routes JSONP
const jsonpRoutes = require('./api/jsonp');

// Routes API protégées
app.use('/api/status', statusRoutes);
app.use('/api/tasks', tasksRoutes.router);

// Partager le cache de réponses entre tasks.js et jsonp.js
const tasksCache = require('./api/tasks').responseCache;
jsonpRoutes.initializeCache(tasksCache);

// Routes JSONP (non protégées pour simplifier les tests)
app.use('/api/jsonp', jsonpRoutes.router);

// Route pour la santé du serveur (non protégée)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Route de test simple (protégée)
app.get('/api/test', simpleAuthMiddleware, (req, res) => {
  res.status(200).json({ message: 'FCA-Agent API fonctionne correctement!' });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Une erreur interne est survenue'
    }
  });
});

// Initialisation de la base de données
setupDatabase().then(() => {
  logger.info('Base de données initialisée avec succès');
}).catch(err => {
  logger.error('Erreur lors de l\'initialisation de la base de données:', err);
  process.exit(1);
});

// Démarrage du serveur
app.listen(PORT, () => {
  logger.info(`Serveur FCA-Agent démarré sur le port ${PORT}`);
  logger.info(`Environnement: ${process.env.NODE_ENV || 'development'}`);
});

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
  logger.info('Arrêt du serveur FCA-Agent...');
  process.exit(0);
});

module.exports = app;