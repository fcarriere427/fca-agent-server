// Middleware d'authentification simplifié
const { logger } = require('./logger');
const authConfig = require('./auth-config');

/**
 * Middleware qui vérifie si l'utilisateur est authentifié via un cookie
 */
const simpleAuthMiddleware = (req, res, next) => {
  logger.info('[SERVER:UTILS:AUTH] Vérification de l\'authentification pour ' + req.originalUrl);
  
  try {
    // Vérifier si le cookie d'authentification existe
    const authCookie = req.cookies[authConfig.cookieName];
    
    // Vérifier aussi l'en-tête d'autorisation Bearer (pour compatibilité avec les clients)
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') 
                      ? authHeader.substring(7) 
                      : null;
    
    // Log des informations d'authentification
    logger.info(`[SERVER:UTILS:AUTH] Cookie: ${authCookie ? 'présent' : 'absent'}, Bearer: ${bearerToken ? 'présent' : 'absent'}`);
    
    // Si aucun cookie ni token n'est trouvé, retourner un statut 401 Unauthorized
    if (!authCookie && !bearerToken) {
      logger.info('[SERVER:UTILS:AUTH] Accès refusé: aucune information d\'authentification');
      return res.status(401).json({ 
        authenticated: false, 
        message: 'Authentification requise',
        detail: 'Aucun cookie ni token fourni'
      });
    }
    
    // Si le cookie ou le token existe, l'utilisateur est authentifié
    logger.info('[SERVER:UTILS:AUTH] Authentification validée');
    next();
  } catch (error) {
    logger.error('[SERVER:UTILS:AUTH] Erreur dans le middleware:', error);
    return res.status(401).json({ 
      authenticated: false, 
      message: 'Erreur d\'authentification',
      detail: error.message
    });
  }
};

module.exports = simpleAuthMiddleware;