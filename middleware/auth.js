// FCA-Agent - Middleware d'authentification
const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');
const { getDb } = require('../db/setup');

// Middleware d'authentification
const authMiddleware = (req, res, next) => {
  try {
    // Extraire le token du header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non autorisé: token manquant' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Vérifier le token
    jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key_for_dev', (err, decoded) => {
      if (err) {
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
        
        // Mettre à jour la date de dernière activité
        db.run('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?', [decoded.id]);
        
        next();
      });
    });
  } catch (error) {
    logger.error('Erreur d\'authentification:', error);
    res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

module.exports = authMiddleware;