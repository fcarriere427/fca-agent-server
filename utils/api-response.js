// FCA-Agent - Utilitaire de formatage des réponses API
const { createModuleLogger } = require('./logger');
const { AppError, ErrorTypes } = require('./error');
const MODULE_NAME = 'UTILS:API-RESPONSE';
const log = createModuleLogger(MODULE_NAME);

/**
 * Formate une réponse de succès avec un format standardisé
 * @param {object} res - Objet response d'Express
 * @param {*} data - Données à renvoyer
 * @param {number} statusCode - Code HTTP de statut (défaut: 200)
 * @param {string} message - Message de succès optionnel
 * @returns {object} Réponse formatée
 */
function success(res, data = {}, statusCode = 200, message = '') {
  const response = {
    success: true,
    data: data
  };
  
  // Ajouter un message uniquement s'il est fourni
  if (message) {
    response.message = message;
  }
  
  log.debug('Envoi d\'une réponse de succès', { 
    statusCode,
    data: typeof data === 'object' ? `Objet avec ${Object.keys(data).length} propriétés` : typeof data
  });
  
  return res.status(statusCode).json(response);
}

/**
 * Formate une réponse d'erreur avec un format standardisé
 * @param {object} res - Objet response d'Express
 * @param {string} message - Message d'erreur
 * @param {number} statusCode - Code HTTP de statut (défaut: 400)
 * @param {*} errorDetails - Détails d'erreur additionnels (optionnel)
 * @returns {object} Réponse d'erreur formatée
 */
function error(res, message = 'Une erreur est survenue', statusCode = 400, errorDetails = null) {
  const response = {
    success: false,
    error: {
      message: message,
      code: statusCode
    }
  };
  
  // Ajouter les détails d'erreur uniquement s'ils sont fournis
  if (errorDetails) {
    response.error.details = errorDetails;
  }
  
  log.warn('Envoi d\'une réponse d\'erreur', { 
    statusCode, 
    message, 
    details: errorDetails ? 'Présents' : 'Aucun'
  });
  
  return res.status(statusCode).json(response);
}

/**
 * Gère les erreurs AppError et envoie une réponse formatée
 * @param {object} res - Objet response d'Express
 * @param {AppError} err - Objet d'erreur AppError
 * @returns {object} Réponse d'erreur formatée
 */
function appError(res, err) {
  const errorResponse = err.toJSON();
  
  log.error('Erreur AppError traitée', { 
    type: err.type,
    message: err.message,
    statusCode: err.statusCode,
    details: err.details ? 'Présents' : 'Aucun'
  });
  
  return res.status(err.statusCode).json({
    success: false,
    error: errorResponse
  });
}

/**
 * Gère les erreurs système et envoie une réponse formatée
 * @param {object} res - Objet response d'Express
 * @param {Error} err - Objet d'erreur
 * @param {number} statusCode - Code HTTP de statut (défaut: 500)
 * @returns {object} Réponse d'erreur formatée
 */
function serverError(res, err, statusCode = 500) {
  // Si c'est déjà une AppError, utiliser la fonction appError
  if (err instanceof AppError) {
    return appError(res, err);
  }
  
  // Journaliser l'erreur complète mais ne pas l'exposer au client
  log.error('Erreur serveur', { 
    message: err.message,
    stack: err.stack
  });
  
  return error(res, 'Erreur serveur interne', statusCode, {
    // En production, on pourrait limiter les détails renvoyés au client
    message: err.message
  });
}

/**
 * Crée un middleware pour la gestion centralisée des erreurs
 * @returns {function} Middleware Express pour la gestion des erreurs
 */
function errorHandler() {
  return (err, req, res, next) => {
    log.error('Middleware de gestion d\'erreur déclenché', {
      url: req.originalUrl,
      method: req.method,
      error: err.message
    });
    
    // Vérifier si c'est une AppError
    if (err instanceof AppError) {
      return appError(res, err);
    }
    
    // Déterminer le code HTTP approprié
    let statusCode = err.statusCode || 500;
    
    // Traitement des erreurs spécifiques
    if (err.name === 'ValidationError') {
      // Erreurs de validation (par exemple, mongoose ou joi)
      return error(res, 'Erreur de validation', 400, {
        validationErrors: err.details || err.errors || err.message
      });
    } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
      // Erreurs d'authentification JWT
      return error(res, 'Erreur d\'authentification', 401);
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      // Erreurs de connexion réseau
      return error(res, 'Erreur de connexion à un service externe', 503);
    }
    
    // Pour toutes les autres erreurs, utiliser serverError
    return serverError(res, err, statusCode);
  };
}

module.exports = {
  success,
  error,
  appError,
  serverError,
  errorHandler
};