// FCA-Agent - Middleware d'authentification
const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');

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
        return res.status(401).json({ error: 'Non autorisé: token invalide' });
      }
      
      // Ajouter les informations utilisateur à la requête
      req.user = decoded;
      next();
    });
  } catch (error) {
    logger.error('Erreur d\'authentification:', error);
    res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

module.exports = authMiddleware;