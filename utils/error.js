// FCA-Agent - Système de gestion centralisée des erreurs
const { createModuleLogger } = require('./logger');
const MODULE_NAME = 'UTILS:ERROR';
const log = createModuleLogger(MODULE_NAME);

/**
 * Types d'erreurs standardisés pour l'application
 * Utilisés pour catégoriser les erreurs et faciliter leur traitement
 */
const ErrorTypes = {
  // Erreurs génériques
  GENERIC: 'GENERIC_ERROR',
  
  // Erreurs d'authentification et d'autorisation
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  
  // Erreurs de validation
  VALIDATION: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT_ERROR',
  
  // Erreurs de ressources
  NOT_FOUND: 'NOT_FOUND_ERROR',
  ALREADY_EXISTS: 'ALREADY_EXISTS_ERROR',
  
  // Erreurs externes
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE_ERROR',
  NETWORK: 'NETWORK_ERROR',
  
  // Erreurs de base de données
  DATABASE: 'DATABASE_ERROR',
  
  // Erreurs système
  SYSTEM: 'SYSTEM_ERROR',
  CONFIG: 'CONFIG_ERROR',
  
  // Erreurs de cache
  CACHE: 'CACHE_ERROR',
  
  // Erreurs de limites et de performances
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  
  // Erreurs liées aux tâches
  TASK_EXECUTION: 'TASK_EXECUTION_ERROR',
  TASK_NOT_SUPPORTED: 'TASK_NOT_SUPPORTED_ERROR',
  
  // Erreurs liées à Claude API
  CLAUDE_API: 'CLAUDE_API_ERROR',
};

/**
 * Codes HTTP par défaut associés à chaque type d'erreur
 */
const DefaultStatusCodes = {
  [ErrorTypes.GENERIC]: 500,
  [ErrorTypes.AUTHENTICATION]: 401,
  [ErrorTypes.AUTHORIZATION]: 403,
  [ErrorTypes.VALIDATION]: 400,
  [ErrorTypes.INVALID_INPUT]: 400,
  [ErrorTypes.NOT_FOUND]: 404,
  [ErrorTypes.ALREADY_EXISTS]: 409,
  [ErrorTypes.EXTERNAL_SERVICE]: 502,
  [ErrorTypes.NETWORK]: 503,
  [ErrorTypes.DATABASE]: 500,
  [ErrorTypes.SYSTEM]: 500,
  [ErrorTypes.CONFIG]: 500,
  [ErrorTypes.CACHE]: 500,
  [ErrorTypes.RATE_LIMIT]: 429,
  [ErrorTypes.TIMEOUT]: 504,
  [ErrorTypes.TASK_EXECUTION]: 500,
  [ErrorTypes.TASK_NOT_SUPPORTED]: 400,
  [ErrorTypes.CLAUDE_API]: 502,
};

/**
 * Classe d'erreur personnalisée pour l'application
 * @extends Error
 */
class AppError extends Error {
  /**
   * Crée une nouvelle instance d'AppError
   * @param {string} message - Message d'erreur
   * @param {string} type - Type d'erreur (depuis ErrorTypes)
   * @param {number} [statusCode] - Code HTTP (utilise la valeur par défaut du type si non spécifiée)
   * @param {object} [details] - Détails supplémentaires sur l'erreur
   * @param {Error} [originalError] - Erreur d'origine (pour le chaînage)
   */
  constructor(message, type = ErrorTypes.GENERIC, statusCode = null, details = null, originalError = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode || DefaultStatusCodes[type] || 500;
    this.details = details;
    this.originalError = originalError;
    
    // Capture de la stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Journalisation de l'erreur à sa création
    log.error(`AppError créée: [${type}] ${message}`, {
      type,
      statusCode: this.statusCode,
      details: details ? JSON.stringify(details) : 'Aucun',
      originalError: originalError ? originalError.message : 'Aucune'
    });
  }
  
  /**
   * Convertit l'objet d'erreur en format JSON pour les réponses API
   * @returns {object} Représentation JSON de l'erreur
   */
  toJSON() {
    const errorResponse = {
      message: this.message,
      type: this.type,
      code: this.statusCode
    };
    
    // Ajouter les détails uniquement s'ils existent
    if (this.details) {
      errorResponse.details = this.details;
    }
    
    // En mode développement, inclure des informations supplémentaires pour le débogage
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = this.stack;
      if (this.originalError) {
        errorResponse.originalError = {
          message: this.originalError.message,
          stack: this.originalError.stack
        };
      }
    }
    
    return errorResponse;
  }
}

/**
 * Crée une erreur d'authentification
 * @param {string} message - Message d'erreur
 * @param {object} [details] - Détails supplémentaires
 * @returns {AppError} Erreur d'authentification
 */
function createAuthenticationError(message = 'Authentification requise', details = null) {
  return new AppError(message, ErrorTypes.AUTHENTICATION, null, details);
}

/**
 * Crée une erreur d'autorisation
 * @param {string} message - Message d'erreur
 * @param {object} [details] - Détails supplémentaires
 * @returns {AppError} Erreur d'autorisation
 */
function createAuthorizationError(message = 'Accès non autorisé', details = null) {
  return new AppError(message, ErrorTypes.AUTHORIZATION, null, details);
}

/**
 * Crée une erreur pour ressource non trouvée
 * @param {string} resource - Nom de la ressource
 * @param {string|number} [id] - Identifiant de la ressource
 * @returns {AppError} Erreur de ressource non trouvée
 */
function createNotFoundError(resource, id = null) {
  const message = id 
    ? `${resource} avec l'identifiant ${id} n'a pas été trouvé(e)`
    : `${resource} non trouvé(e)`;
  return new AppError(message, ErrorTypes.NOT_FOUND, null, { resource, id });
}

/**
 * Crée une erreur de validation
 * @param {string} message - Message d'erreur
 * @param {object} [validationErrors] - Erreurs de validation détaillées
 * @returns {AppError} Erreur de validation
 */
function createValidationError(message = 'Données de requête invalides', validationErrors = null) {
  return new AppError(message, ErrorTypes.VALIDATION, null, { validationErrors });
}

/**
 * Crée une erreur pour un service externe
 * @param {string} message - Message d'erreur
 * @param {string} [service] - Nom du service externe
 * @param {Error} [originalError] - Erreur d'origine
 * @returns {AppError} Erreur de service externe
 */
function createExternalServiceError(message, service = null, originalError = null) {
  return new AppError(
    message || `Erreur lors de la communication avec le service externe${service ? ` (${service})` : ''}`,
    ErrorTypes.EXTERNAL_SERVICE,
    null,
    { service },
    originalError
  );
}

/**
 * Crée une erreur pour l'API Claude
 * @param {string} message - Message d'erreur
 * @param {Error} [originalError] - Erreur d'origine
 * @returns {AppError} Erreur de l'API Claude
 */
function createClaudeApiError(message = 'Erreur lors de la communication avec l\'API Claude', originalError = null) {
  return new AppError(
    message,
    ErrorTypes.CLAUDE_API,
    null,
    null,
    originalError
  );
}

/**
 * Crée une erreur pour la base de données
 * @param {string} message - Message d'erreur
 * @param {Error} [originalError] - Erreur d'origine
 * @returns {AppError} Erreur de base de données
 */
function createDatabaseError(message = 'Erreur de base de données', originalError = null) {
  return new AppError(
    message,
    ErrorTypes.DATABASE,
    null,
    null,
    originalError
  );
}

/**
 * Crée une erreur pour exécution de tâche
 * @param {string} message - Message d'erreur
 * @param {number} [taskId] - ID de la tâche
 * @param {string} [taskType] - Type de la tâche
 * @param {Error} [originalError] - Erreur d'origine
 * @returns {AppError} Erreur d'exécution de tâche
 */
function createTaskExecutionError(message, taskId = null, taskType = null, originalError = null) {
  return new AppError(
    message || 'Erreur lors de l\'exécution de la tâche',
    ErrorTypes.TASK_EXECUTION,
    null,
    { taskId, taskType },
    originalError
  );
}

/**
 * Wrapper pour capturer et standardiser les erreurs dans les fonctions asynchrones
 * @param {function} fn - Fonction asynchrone à exécuter
 * @param {string} [errorType] - Type d'erreur par défaut si une erreur brute est capturée
 * @returns {function} Fonction qui gère la capture d'erreurs
 */
function asyncErrorHandler(fn, errorType = ErrorTypes.GENERIC) {
  return async function(...args) {
    try {
      return await fn(...args);
    } catch (error) {
      // Si c'est déjà une AppError, la propager telle quelle
      if (error instanceof AppError) {
        throw error;
      }
      
      // Sinon, créer une AppError standardisée
      throw new AppError(
        error.message || 'Une erreur est survenue',
        errorType,
        null,
        null,
        error
      );
    }
  };
}

/**
 * Middleware Express pour capturer et standardiser les erreurs dans les contrôleurs
 * @param {function} controller - Fonction de contrôleur à exécuter
 * @returns {function} Middleware Express
 */
function catchErrors(controller) {
  return async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (error) {
      next(error instanceof AppError ? error : new AppError(
        error.message || 'Une erreur est survenue dans le contrôleur',
        ErrorTypes.GENERIC,
        null,
        null,
        error
      ));
    }
  };
}

module.exports = {
  AppError,
  ErrorTypes,
  DefaultStatusCodes,
  createAuthenticationError,
  createAuthorizationError,
  createNotFoundError,
  createValidationError,
  createExternalServiceError,
  createClaudeApiError,
  createDatabaseError,
  createTaskExecutionError,
  asyncErrorHandler,
  catchErrors
};