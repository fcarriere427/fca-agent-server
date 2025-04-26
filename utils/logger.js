// FCA-Agent - Configuration du logger
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Format personnalisé
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level.toUpperCase()}: ${message}`;
});

// Répertoire des logs
const logsDir = path.join(__dirname, '../logs');

// S'assurer que le répertoire des logs existe
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Configuration du logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Console pour le développement
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // Fichier pour la persistance des erreurs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Fichier pour tous les logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'logs.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Fichier pour les réponses spécifiques
    new winston.transports.File({
      filename: path.join(logsDir, 'responses.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

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