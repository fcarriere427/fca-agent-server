// FCA-Agent - Serveur principal (version simplifiée)

// Chargement de la configuration centralisée
const config = require('./config');
const serverConfig = require('./config/server');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { setupDatabase } = require('./db/setup');
const { createModuleLogger } = require('./utils/logger');
const MODULE_NAME = 'SERVER:INDEX';
const log = createModuleLogger(MODULE_NAME);
const { authMiddleware } = require('./utils/auth');
const apiResponse = require('./utils/api-response');

// Initialisation
const app = express();
const PORT = config.get('port');

// Création du répertoire logs s'il n'existe pas
const logsDir = config.get('logDir');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  log.info(`Répertoire de logs créé: ${logsDir}`);
}

// Configuration des middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'unsafe-none' }
}));

// Configuration CORS pour l'extension Chrome
app.use(cors({
  origin: config.get('allowedOrigins'),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'API-Key', 'Cookie', 'X-Requested-With']
}));
app.options('*', cors());

// Autres middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev', { stream: { write: message => log.info(`${message.trim()}`) } }));

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
    return next(); // Pas d'authentification pour les routes d'auth
  }
  authMiddleware(req, res, next);
});

// Routes API protégées
app.use('/api/status', statusRoutes);
app.use('/api/tasks', tasksRoutes.router);

// Partage du cache de réponses
jsonpRoutes.initializeCache(tasksRoutes.responseCache);
app.use('/api/jsonp', jsonpRoutes.router);

// Capturer toutes les autres routes API inexistantes
app.use('/api/*', (req, res) => {
  log.warn(`Route API inexistante: ${req.originalUrl}`);
  return apiResponse.error(res, 'Route API non trouvée', 404, {
    path: req.originalUrl
  });
});

// Capturer toutes les autres requêtes
app.use('*', (req, res) => {
  log.warn(`Route inexistante: ${req.originalUrl}`);
  return apiResponse.error(res, 'Ressource non trouvée', 404, {
    path: req.originalUrl
  });
});

// Middleware de gestion centralisée des erreurs
app.use((err, req, res, next) => {
  // Journalisation détaillée de l'erreur
  log.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  
  // Gestion spécifique des erreurs de routing (path-to-regexp)
  if (err.message && (err.message.includes('pathToRegexpError') || err.message.includes('Missing parameter'))) {
    log.error('Erreur de routing détectée:', err);
    return apiResponse.error(res, 'Erreur de routage: URL invalide', 400, {
      detail: 'L\'URL demandée contient des caractères ou un format incompatible avec le routeur.'
    });
  }
  
  // Utiliser notre gestionnaire standardisé pour toutes les autres erreurs
  return apiResponse.serverError(res, err, err.status || 500);
});

// Initialisation de la base de données et démarrage du serveur
setupDatabase()
  .then(() => {
    log.info('Base de données initialisée avec succès');
    app.listen(PORT, () => {
      log.info(`Serveur FCA-Agent (version simplifiée) démarré sur le port ${PORT}`);
      log.info(`Environnement: ${config.get('nodeEnv')}`);
    });
  })
  .catch(err => {
    log.error('Erreur lors de l\'initialisation de la base de données:', err);
    process.exit(1);
  });

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
  log.info('Arrêt du serveur FCA-Agent...');
  process.exit(0);
});

module.exports = app;