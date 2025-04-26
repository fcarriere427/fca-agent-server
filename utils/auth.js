// Middleware d'authentification simplifié (version renforcée)
const { logger } = require('./logger');
const authConfig = require('./auth-config');

/**
 * Middleware qui vérifie si l'utilisateur est authentifié via un token Bearer
 */
const simpleAuthMiddleware = (req, res, next) => {
  const reqPath = req.originalUrl;
  logger.info(`[SERVER:UTILS:AUTH] Vérification de l\'authentification pour ${reqPath}`);
  
  try {
    // Vérifier uniquement l'en-tête d'autorisation Bearer
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') 
                      ? authHeader.substring(7) 
                      : null;
    
    // Log des informations d'authentification plus détaillées
    if (bearerToken) {
      logger.info(`[SERVER:UTILS:AUTH] Bearer token présent: ${bearerToken.substring(0, 5)}...${bearerToken.substring(bearerToken.length-5)}`);
    } else {
      logger.info('[SERVER:UTILS:AUTH] Bearer token: absent');
    }
    
    // Si aucun token n'est trouvé, retourner un statut 401 Unauthorized
    if (!bearerToken) {
      logger.info('[SERVER:UTILS:AUTH] Accès refusé: aucune information d\'authentification');
      return res.status(401).json({ 
        authenticated: false, 
        message: 'Authentification requise',
        detail: 'Aucun token Bearer fourni'
      });
    }
    
    // Si le token existe, l'utilisateur est authentifié
    logger.info('[SERVER:UTILS:AUTH] Authentification validée');
    next();
  } catch (error) {
    logger.error(`[SERVER:UTILS:AUTH] Erreur dans le middleware: ${error.message}`);
    logger.error(`[SERVER:UTILS:AUTH] Stack: ${error.stack}`);
    return res.status(401).json({ 
      authenticated: false, 
      message: 'Erreur d\'authentification',
      detail: error.message
    });
  }
};

module.exports = simpleAuthMiddleware;