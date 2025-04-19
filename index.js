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
const { setupDatabase } = require('./db/setup');
const { logger } = require('./config/logger');

// Routes
const statusRoutes = require('./api/status');
// Désactivation temporaire des routes d'authentification et de tâches
// const tasksRoutes = require('./api/tasks');
// const authRoutes = require('./api/auth');

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
app.use(helmet()); // Sécurité
app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Permettre des requêtes JSON plus grandes pour les captures d'écran
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev', { stream: { write: message => logger.info(message.trim()) } }));

// Routes API
app.use('/api/status', statusRoutes);
// Désactivation temporaire des routes d'authentification et de tâches
// app.use('/api/tasks', tasksRoutes);
// app.use('/api/auth', authRoutes);

// Route pour la santé du serveur
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Route de test simple
app.get('/api/test', (req, res) => {
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