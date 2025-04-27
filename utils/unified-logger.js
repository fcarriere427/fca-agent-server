// FCA-Agent - Module de journalisation unifié pour le serveur
// Ce module remplace tous les loggers spécifiques et fournit une interface unifiée
// permettant de distinguer les sources à l'aide de préfixes et niveaux de log configurables

const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * Configuration globale du logger
 * Peut être modifiée pendant l'exécution
 */
const logConfig = {
  // Niveau minimum des logs à afficher/stocker
  level: process.env.LOG_LEVEL || 'info',
  
  // Répertoire de stockage des logs
  logDir: process.env.LOG_DIR || path.join(__dirname, '../logs'),
  
  // Taille maximale des fichiers de log avant rotation (10MB par défaut)
  maxSize: 10 * 1024 * 1024,
  
  // Nombre maximum de fichiers de log à conserver
  maxFiles: 5,
  
  // Si true, affiche les logs dans la console
  consoleOutput: true,
  
  // Si true, affiche les traces de stack pour les erreurs
  showStackTrace: true,
  
  // Configuration par module
  modules: {
    // Par défaut, tous les modules sont activés au niveau configuré
    '*': true
    // Exemples:
    // 'server': 'debug', // Active les logs de debug pour le module server
    // 'claude': false    // Désactive les logs du module claude
  }
};

// S'assurer que le répertoire des logs existe
if (!fs.existsSync(logConfig.logDir)) {
  fs.mkdirSync(logConfig.logDir, { recursive: true });
}

// Format personnalisé pour les logs avec module et timestamp
const logFormat = winston.format.printf(({ level, message, timestamp, module, ...metadata }) => {
  let formattedMessage = `${timestamp} ${level.toUpperCase()} [${module || 'default'}]: ${message}`;
  
  // Ajouter les métadonnées s'il y en a
  if (Object.keys(metadata).length > 0 && metadata.stack !== undefined) {
    return `${formattedMessage}\n${metadata.stack}`;
  } else if (Object.keys(metadata).length > 0) {
    return `${formattedMessage}\n${JSON.stringify(metadata, null, 2)}`;
  }
  
  return formattedMessage;
});

// Création du logger Winston
const winstonLogger = winston.createLogger({
  level: logConfig.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Fichier pour les erreurs uniquement
    new winston.transports.File({ 
      filename: path.join(logConfig.logDir, 'error.log'), 
      level: 'error',
      maxsize: logConfig.maxSize,
      maxFiles: logConfig.maxFiles,
    }),
    // Fichier pour tous les logs
    new winston.transports.File({ 
      filename: path.join(logConfig.logDir, 'all.log'),
      maxsize: logConfig.maxSize,
      maxFiles: logConfig.maxFiles,
    })
  ]
});

// Ajouter la sortie console si activée
if (logConfig.consoleOutput) {
  winstonLogger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  );
}

/**
 * Détermine si un message doit être journalisé selon la configuration du module
 * @param {string} level - Niveau du log
 * @param {string} module - Nom du module
 * @returns {boolean} - True si le message doit être journalisé
 */
function shouldLog(level, module) {
  // Ordre des niveaux de log dans Winston
  const levels = { error: 0, warn: 1, info: 2, debug: 3 };
  
  // Déterminer le niveau configuré pour ce module
  let moduleLevel;
  
  if (typeof logConfig.modules[module] === 'string') {
    // Si le module a un niveau spécifique configuré
    moduleLevel = logConfig.modules[module];
  } else if (logConfig.modules[module] === false) {
    // Si le module est explicitement désactivé
    return false;
  } else if (logConfig.modules[module] === true || !module || !logConfig.modules[module]) {
    // Si le module est explicitement activé ou non configuré, utiliser le niveau global
    moduleLevel = logConfig.level;
  }
  
  // Comparer les niveaux
  return levels[level] <= levels[moduleLevel];
}

/**
 * Classe Logger - Représente un logger pour un module spécifique
 */
class Logger {
  /**
   * Crée une nouvelle instance de Logger
   * @param {string} module - Nom du module associé à ce logger
   */
  constructor(module) {
    this.module = module;
  }
  
  /**
   * Log de niveau debug
   * @param {string} message - Message à journaliser
   * @param {Object} [metadata] - Métadonnées supplémentaires
   */
  debug(message, metadata = {}) {
    if (shouldLog('debug', this.module)) {
      winstonLogger.debug(message, { module: this.module, ...metadata });
    }
  }
  
  /**
   * Log de niveau info
   * @param {string} message - Message à journaliser
   * @param {Object} [metadata] - Métadonnées supplémentaires
   */
  info(message, metadata = {}) {
    if (shouldLog('info', this.module)) {
      winstonLogger.info(message, { module: this.module, ...metadata });
    }
  }
  
  /**
   * Log de niveau warn
   * @param {string} message - Message à journaliser
   * @param {Object} [metadata] - Métadonnées supplémentaires
   */
  warn(message, metadata = {}) {
    if (shouldLog('warn', this.module)) {
      winstonLogger.warn(message, { module: this.module, ...metadata });
    }
  }
  
  /**
   * Log de niveau error
   * @param {string} message - Message d'erreur
   * @param {Error|Object} [errorOrMetadata] - Objet d'erreur ou métadonnées
   */
  error(message, errorOrMetadata = {}) {
    if (shouldLog('error', this.module)) {
      let metadata = {};
      
      if (errorOrMetadata instanceof Error) {
        metadata.stack = errorOrMetadata.stack;
        metadata.message = errorOrMetadata.message;
      } else {
        metadata = errorOrMetadata;
      }
      
      winstonLogger.error(message, { module: this.module, ...metadata });
    }
  }
  
  // Méthodes de compatibilité avec l'ancien logger
  log(message, metadata = {}) {
    this.info(message, metadata);
  }
}

/**
 * Crée un logger pour un module spécifique
 * @param {string} module - Nom du module
 * @returns {Logger} - Instance de Logger configurée pour le module
 */
function createLogger(module) {
  return new Logger(module);
}

// Logger par défaut pour les cas où aucun module n'est spécifié
const defaultLogger = createLogger('default');

// Fonctions utilitaires spécifiques aux besoins précis
const responseLogger = createLogger('SERVER:RESPONSE');

/**
 * Log pour le cache de réponses
 * @param {string} responseId - ID de la réponse
 * @param {number} length - Longueur de la réponse
 */
function logResponseCache(responseId, length) {
  responseLogger.info(`Réponse mise en cache: ID=${responseId}, longueur=${length} caractères`);
}

/**
 * Log pour l'envoi d'une réponse
 * @param {string} responseId - ID de la réponse
 */
function logResponseSent(responseId) {
  responseLogger.info(`Réponse envoyée: ID=${responseId}`);
}

/**
 * Log pour une demande de réponse
 * @param {string} responseId - ID de la réponse
 */
function logResponseRequest(responseId) {
  responseLogger.info(`Réponse demandée: ID=${responseId}`);
}

/**
 * Log pour une réponse de Claude
 * @param {string} taskId - ID de la tâche
 * @param {string} type - Type de réponse
 * @param {Object} result - Résultat de la réponse
 */
function logClaudeResponse(taskId, type, result) {
  const claudeLogger = createLogger('SERVER:CLAUDE');
  claudeLogger.info(`Réponse de Claude pour la tâche ${taskId} (${type})`);
  
  if (result && result.usage) {
    claudeLogger.info(`Utilisation: ${JSON.stringify(result.usage)}`);
  }
  
  if (result && result.error) {
    claudeLogger.error(`Erreur: ${result.error}`);
  }
}

// Rediriger console.log, console.error, etc. vers Winston
// Cela garantit que les appels console.* standards sont correctement formatés
const originalConsoleLog = console.log;
console.log = function() {
  const args = Array.from(arguments).map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  defaultLogger.info(args);
};

const originalConsoleError = console.error;
console.error = function() {
  const args = Array.from(arguments).map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  defaultLogger.error(args);
};

const originalConsoleWarn = console.warn;
console.warn = function() {
  const args = Array.from(arguments).map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  defaultLogger.warn(args);
};

const originalConsoleInfo = console.info;
console.info = function() {
  const args = Array.from(arguments).map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  defaultLogger.info(args);
};

// Capture des logs du processus node non gérés
process.on('uncaughtException', (err) => {
  defaultLogger.error(`Exception non gérée: ${err.message}`, err);
  // Laisser le temps au log d'être écrit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  defaultLogger.error(`Promesse rejetée non gérée`, reason);
});

// Fonction de compatibilité avec l'ancien code
const createModuleLogger = createLogger;

// Exports
module.exports = {
  // Loggers
  logger: defaultLogger,
  createLogger,
  createModuleLogger,
  
  // Configuration
  logConfig,
  
  // Fonctions utilitaires spécifiques
  logResponseCache,
  logResponseSent,
  logResponseRequest,
  logClaudeResponse
};
