// FCA-Agent - Serveur principal

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
const simpleAuthMiddleware = require('./utils/auth');

// Initialisation
const app = express();
const PORT = process.env.PORT || 3001;

// Création du répertoire logs s'il n'existe pas
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
  logger.info(`[SERVER:INDEX] Répertoire créé: ${logsDir}`);
}

// Configuration des middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'unsafe-none' }
}));

// Configuration CORS pour l'extension Chrome
app.use(cors({
  origin: ['chrome-extension://geijajfenikceeemehghgabl61pbded1', 'http://localhost:3001', '*'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With']
}));
app.options('*', cors());

// Autres middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev', { stream: { write: message => logger.info(message.trim()) } }));

// Importation des routes
const authRoutes = require('./api/auth');
const statusRoutes = require('./api/status');
const tasksRoutes = require('./api/tasks');
const jsonpRoutes = require('./api/jsonp');

// Routes non protégées
app.use('/api/auth', authRoutes);
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Middleware d'authentification pour routes protégées
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) {
    return next();
  }
  simpleAuthMiddleware(req, res, next);
});

// Routes API protégées
app.use('/api/status', statusRoutes);
app.use('/api/tasks', tasksRoutes.router);

// Partage du cache de réponses
jsonpRoutes.initializeCache(tasksRoutes.responseCache);
app.use('/api/jsonp', jsonpRoutes.router);

// Gestion des erreurs
app.use((err, req, res, next) => {
  logger.error(`[SERVER:INDEX] ${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Une erreur interne est survenue'
    }
  });
});

// Initialisation de la base de données et démarrage du serveur
setupDatabase()
  .then(() => {
    logger.info('[SERVER:INDEX] Base de données initialisée avec succès');
    app.listen(PORT, () => {
      logger.info(`[SERVER:INDEX] Serveur FCA-Agent démarré sur le port ${PORT}`);
      logger.info(`[SERVER:INDEX] Environnement: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch(err => {
    logger.error('[SERVER:INDEX] Erreur lors de l\'initialisation de la base de données:', err);
    process.exit(1);
  });

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
  logger.info('[SERVER:INDEX] Arrêt du serveur FCA-Agent...');
  process.exit(0);
});

module.exports = app;