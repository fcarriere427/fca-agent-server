// Middleware d'authentification simplifié (version renforcée)
const { createModuleLogger } = require('./logger');
const MODULE_NAME = 'SERVER:UTILS:AUTH';
const log = createModuleLogger(MODULE_NAME);
const authConfig = require('./auth-config');

/**
 * Middleware qui vérifie si l'utilisateur est authentifié via un token Bearer
 */
const simpleAuthMiddleware = (req, res, next) => {
  const reqPath = req.originalUrl;
  log.info(`Vérification de l\'authentification pour ${reqPath}`);
  
  try {
    // Vérifier uniquement l'en-tête d'autorisation Bearer
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') 
                      ? authHeader.substring(7) 
                      : null;
    
    // Log des informations d'authentification plus détaillées
    if (bearerToken) {
      log.info(`Bearer token présent: ${bearerToken.substring(0, 5)}...${bearerToken.substring(bearerToken.length-5)}`);
    } else {
      log.info('Bearer token: absent');
    }
    
    // Si aucun token n'est trouvé, retourner un statut 401 Unauthorized
    if (!bearerToken) {
      log.info('Accès refusé: aucune information d\'authentification');
      return res.status(401).json({ 
        authenticated: false, 
        message: 'Authentification requise',
        detail: 'Aucun token Bearer fourni'
      });
    }
    
    // Si le token existe, l'utilisateur est authentifié
    log.info('Authentification validée');
    next();
  } catch (error) {
    log.error(`Erreur dans le middleware: ${error.message}`);
    log.error(`Stack: ${error.stack}`);
    return res.status(401).json({ 
      authenticated: false, 
      message: 'Erreur d\'authentification',
      detail: error.message
    });
  }
};

module.exports = simpleAuthMiddleware;