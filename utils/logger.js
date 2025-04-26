// FCA-Agent - Configuration du logger
const winston = require('winston');

// Format personnalisé
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level.toUpperCase()}: ${message}`;
});

// Configuration du logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Console seulement - le service s'occupera de rediriger vers les fichiers
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

// Messages d'erreur sur stderr, autres sur stdout
const originalError = logger.error;
logger.error = function (message, ...args) {
  // Rediriger les erreurs vers stderr
  console.error(`${new Date().toISOString()} ERROR: ${message}`);
  return originalError.call(this, message, ...args);
};

// Fonctions de log spécifiques pour les réponses
const logResponseCache = (responseId, length) => {
  logger.info(`RESPONSE_CACHED - ID: ${responseId} - Length: ${length}`);
};

const logResponseSent = (responseId, length) => {
  logger.info(`RESPONSE_SENT - ID: ${responseId} - Length: ${length}`);
};

const logResponseRequest = (responseId) => {
  logger.info(`RESPONSE_REQUESTED - ID: ${responseId}`);
};

const logClaudeResponse = (taskId, type, data) => {
  const safeData = { 
    ...data,
    response: data.response ? `${data.response.substring(0, 200)}... (${data.response.length} caractères)` : null
  };
  logger.info(`CLAUDE_RESPONSE - ID: ${taskId} - Type: ${type} - Data: ${JSON.stringify(safeData, null, 2)}`);
};

module.exports = { 
  logger,
  logResponseCache,
  logResponseSent, 
  logResponseRequest,
  logClaudeResponse
};