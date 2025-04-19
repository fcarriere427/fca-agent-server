// FCA-Agent - Middleware d'authentification
const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');
const { getDb } = require('../db/setup');

// Middleware d'authentification
const authMiddleware = (req, res, next) => {
  try {
    // Extraire le token du header ou des query params
    let token = null;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Token dans l'en-tête
      token = authHeader.split(' ')[1];
      logger.info(`Token extrait de l'en-tête: ${token.substring(0, 20)}...`);
    } else if (req.query.token) {
      // Token dans les paramètres de requête
      token = req.query.token;
      logger.info(`Token extrait des params: ${token.substring(0, 20)}...`);
    } else {
      logger.error('Authentification échouée: Pas de token dans l\'en-tête ou les params');
      logger.error(`Tous les en-têtes: ${JSON.stringify(req.headers)}`);
      return res.status(401).json({ error: 'Non autorisé: token manquant' });
    }
    
    // Vérifier le token
    const jwtSecret = process.env.JWT_SECRET || 'default_secret_key_for_dev';
    logger.info(`Utilisation du secret JWT: ${jwtSecret.substring(0, 3)}...${jwtSecret.substring(jwtSecret.length - 3)}`);
    
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        logger.error(`Erreur de vérification du token: ${err.name} - ${err.message}`);
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Non autorisé: token expiré' });
        } else {
          return res.status(401).json({ error: 'Non autorisé: token invalide' });
        }
      }
      
      // Vérifier si l'utilisateur existe toujours dans la base de données
      const db = getDb();
      db.get('SELECT id FROM users WHERE id = ?', [decoded.id], (err, user) => {
        if (err) {
          logger.error('Erreur lors de la vérification de l\'utilisateur:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        if (!user) {
          return res.status(401).json({ error: 'Non autorisé: utilisateur invalide' });
        }
        
        // Ajouter les informations utilisateur à la requête
        req.user = decoded;
        
        // Mettre à jour la date de dernière activité (de manière non bloquante)
        db.run('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?', [decoded.id], function(err) {
          if (err) {
            logger.error(`Erreur lors de la mise à jour de last_activity: ${err.message}`);
            // Continuer malgré l'erreur
          }
        });
        
        next();
      });
    });
  } catch (error) {
    logger.error('Erreur d\'authentification:', error);
    res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

module.exports = authMiddleware;