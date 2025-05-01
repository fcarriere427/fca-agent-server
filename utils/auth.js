// FCA-Agent - Système d'authentification simplifié par clé API
const config = require('../config');
const { createModuleLogger } = require('./logger');
const MODULE_NAME = 'SERVER:UTILS:AUTH-SIMPLE';
const log = createModuleLogger(MODULE_NAME);
const apiResponse = require('./api-response');

/**
 * Middleware qui vérifie si la requête contient la clé API valide
 * Cette version simplifiée combine toutes les fonctionnalités d'authentification
 * dans un seul fichier facile à maintenir
 */
const authMiddleware = (req, res, next) => {
  const reqPath = req.originalUrl;
  log.info(`Vérification de l'authentification pour ${reqPath}`);
  
  try {
    // Récupérer la clé API depuis la configuration centralisée
    const apiKey = config.get('apiKey');
    
    if (!apiKey || apiKey.trim() === '') {
      log.error('Erreur de configuration: apiKey non définie');
      return apiResponse.error(res, 'Erreur de configuration serveur', 500, {
        detail: 'Clé API non configurée'
      });
    }
    
    // Vérifier l'en-tête API-Key ou Authorization
    const requestApiKey = req.headers['api-key'] || 
                         (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
                           ? req.headers.authorization.substring(7) 
                           : null);
    
    // Log des informations d'authentification (version tronquée de la clé)
    if (requestApiKey) {
      // Tronquer la clé pour la sécurité dans les logs
      const keyStart = requestApiKey.substring(0, 3);
      const keyEnd = requestApiKey.substring(requestApiKey.length - 3);
      log.info(`API Key présente: ${keyStart}...${keyEnd}`);
    } else {
      log.info('API Key: absente');
    }
    
    // Si aucune clé n'est trouvée ou si elle ne correspond pas
    if (!requestApiKey || requestApiKey !== apiKey) {
      log.info('Accès refusé: clé API invalide ou absente');
      return apiResponse.error(res, 'Authentification requise', 401, {
        authenticated: false
      });
    }
    
    // Si la clé correspond, l'accès est autorisé
    log.info('Authentification validée');
    next();
  } catch (error) {
    log.error(`Erreur dans le middleware: ${error.message}`);
    return apiResponse.error(res, 'Erreur d\'authentification', 401, {
      authenticated: false
    });
  }
};

/**
 * Route Express pour vérifier si une clé API est valide
 * Utilisée principalement par le client pour tester son authentification
 */
const checkApiKey = (req, res) => {
  log.info('Vérification de la clé API');
  
  try {
    // Récupérer la clé API depuis la configuration centralisée
    const apiKey = config.get('apiKey');
    
    // Vérifier l'en-tête API-Key ou Authorization
    const requestApiKey = req.headers['api-key'] || 
                         (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
                           ? req.headers.authorization.substring(7) 
                           : null);
    
    // Log limité pour sécurité
    if (requestApiKey) {
      const keyStart = requestApiKey.substring(0, 3);
      const keyEnd = requestApiKey.substring(requestApiKey.length - 3);
      log.info(`API Key reçue: ${keyStart}...${keyEnd}`);
    } else {
      log.info('API Key: absente');
    }
    
    if (!requestApiKey || requestApiKey !== apiKey) {
      log.info('Clé API invalide ou absente');
      return apiResponse.success(res, { authenticated: false }, 200, 'Clé API invalide');
    }
    
    log.info('Clé API valide');
    return apiResponse.success(res, { authenticated: true }, 200, 'Clé API valide');
  } catch (error) {
    log.error('Erreur lors de la vérification:', error);
    return apiResponse.serverError(res, error);
  }
};

// Configuration des routes d'authentification pour Express
const setupAuthRoutes = (router) => {
  // Route pour vérifier la validité de la clé API
  router.get('/check', checkApiKey);
  
  return router;
};

module.exports = {
  authMiddleware,
  checkApiKey,
  setupAuthRoutes
};