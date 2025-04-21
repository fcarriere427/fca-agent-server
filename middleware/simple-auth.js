// Middleware d'authentification simplifié
const { logger } = require('../config/logger');
const authConfig = require('../config/auth-config');

/**
 * Middleware qui vérifie si l'utilisateur est authentifié via un cookie
 */
const simpleAuthMiddleware = (req, res, next) => {
  try {
    // Vérifier si le cookie d'authentification existe
    const authCookie = req.cookies[authConfig.cookieName];
    
    // Si aucun cookie n'est trouvé, retourner un statut 401 Unauthorized
    if (!authCookie) {
      logger.info('Tentative d\'accès sans authentification');
      return res.status(401).json({ authenticated: false, message: 'Authentification requise' });
    }
    
    // Si le cookie existe, l'utilisateur est authentifié
    next();
  } catch (error) {
    logger.error('Erreur dans le middleware d\'authentification:', error);
    return res.status(401).json({ authenticated: false, message: 'Authentification requise' });
  }
};

module.exports = simpleAuthMiddleware;