// FCA-Agent - Système d'authentification simplifié par clé API
const { createModuleLogger } = require('./logger');
const MODULE_NAME = 'SERVER:UTILS:AUTH-SIMPLE';
const log = createModuleLogger(MODULE_NAME);

/**
 * Middleware qui vérifie si la requête contient la clé API valide
 * Cette version simplifiée combine toutes les fonctionnalités d'authentification
 * dans un seul fichier facile à maintenir
 */
const authMiddleware = (req, res, next) => {
  const reqPath = req.originalUrl;
  log.info(`Vérification de l'authentification pour ${reqPath}`);
  
  try {
    // Récupérer la clé API du fichier .env
    const apiKey = process.env.API_KEY;
    
    if (!apiKey || apiKey.trim() === '') {
      log.error('Erreur de configuration: API_KEY non définie dans .env');
      return res.status(500).json({ 
        error: 'Erreur de configuration serveur',
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
      return res.status(401).json({ 
        authenticated: false, 
        message: 'Authentification requise'
      });
    }
    
    // Si la clé correspond, l'accès est autorisé
    log.info('Authentification validée');
    next();
  } catch (error) {
    log.error(`Erreur dans le middleware: ${error.message}`);
    return res.status(401).json({ 
      authenticated: false, 
      message: 'Erreur d\'authentification'
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
    // Récupérer la clé API du fichier .env
    const apiKey = process.env.API_KEY;
    
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
      return res.status(200).json({ authenticated: false });
    }
    
    log.info('Clé API valide');
    res.status(200).json({ authenticated: true });
  } catch (error) {
    log.error('Erreur lors de la vérification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
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