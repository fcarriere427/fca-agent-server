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
// Désactivation temporaire de la route de tâches
// const tasksRoutes = require('./api/tasks');
const authRoutes = require('./api/auth');

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
app.use(morgan('dev', { stream: { write: message => logger.info(message.trim()) } }));

// Routes API
app.use('/api/status', statusRoutes);
// Désactivation temporaire de la route de tâches
// app.use('/api/tasks', tasksRoutes);
app.use('/api/auth', authRoutes);

// Route pour la santé du serveur
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Route de test simple
app.get('/api/test', (req, res) => {
  res.status(200).json({ message: 'FCA-Agent API fonctionne correctement!' });
});

// Route de test pour l'authentification
app.post('/api/test-auth', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
  }
  
  logger.info(`Test d'authentification pour: ${username}`);
  
  const db = getDb();
  db.get('SELECT id, username, password_hash FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      logger.error('Erreur lors de la recherche de l\'utilisateur:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }
    
    try {
      // Vérification du mot de passe
      const bcrypt = require('bcrypt');
      const match = await bcrypt.compare(password, user.password_hash);
      
      if (!match) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }
      
      // Création du token JWT
      const jwt = require('jsonwebtoken');
      const jwtSecret = process.env.JWT_SECRET || 'default_secret_key_for_dev';
      logger.info(`Secret JWT utilisé: ${jwtSecret.substring(0, 3)}...${jwtSecret.substring(jwtSecret.length - 3)}`);
      
      const token = jwt.sign(
        { id: user.id, username: user.username },
        jwtSecret,
        { expiresIn: process.env.JWT_EXPIRATION || '1d' }
      );
      
      // Test de vérification
      jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
          logger.error(`ERREUR: Impossible de vérifier le token qui vient d'être généré: ${err.message}`);
          return res.status(500).json({ error: 'Erreur de génération du token' });
        }
        
        logger.info(`Test de vérification du token réussi, décodage: ${JSON.stringify(decoded)}`);
        
        return res.status(200).json({ 
          success: true,
          message: 'Authentification réussie',
          token,
          user: {
            id: user.id,
            username: user.username
          }
        });
      });
    } catch (error) {
      logger.error('Erreur dans test-auth:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
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