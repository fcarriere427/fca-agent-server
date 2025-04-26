// Middleware d'authentification simplifiée par clé API fixe
const { createModuleLogger } = require('./logger');
const MODULE_NAME = 'SERVER:UTILS:AUTH';
const log = createModuleLogger(MODULE_NAME);

/**
 * Middleware qui vérifie si la requête contient la clé API valide
 */
const simpleAuthMiddleware = (req, res, next) => {
  const reqPath = req.originalUrl;
  log.info(`Vérification de l\'authentification pour ${reqPath}`);
  
  try {
    // Récupérer la clé API du fichier .env
    const apiKey = process.env.API_KEY;
    
    // Vérifier l'en-tête API-Key ou Authorization (pour compatibilité)
    const requestApiKey = req.headers['api-key'] || 
                        (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
                          ? req.headers.authorization.substring(7) 
                          : null);
    
    // Log des informations d'authentification
    if (requestApiKey) {
      log.info(`API Key présente: ${requestApiKey.substring(0, 5)}...${requestApiKey.substring(requestApiKey.length-5)}`);
    } else {
      log.info('API Key: absente');
    }
    
    // Si aucune clé n'est trouvée ou si elle ne correspond pas
    if (!requestApiKey || requestApiKey !== apiKey) {
      log.info('Accès refusé: clé API invalide ou absente');
      return res.status(401).json({ 
        authenticated: false, 
        message: 'Authentification requise',
        detail: 'Clé API invalide ou absente'
      });
    }
    
    // Si la clé correspond, l'accès est autorisé
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