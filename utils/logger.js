// FCA-Agent - Configuration du logger
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Format personnalisé avec timestamp cohérent
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level.toUpperCase()}: ${message}`;
});

// Répertoire des logs - utiliser un chemin absolu pour compatibilité avec le service
const logsDir = process.env.LOG_DIR || path.join(__dirname, '../logs');

// S'assurer que le répertoire des logs existe
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
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
    // Console pour le développement (avec couleurs)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // Fichier pour les erreurs uniquement
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Fichier pour tous les logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'all.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  ]
});

// Remplacer console.log, console.error, etc. pour capturer tous les logs
// Cela garantit que même les console.log() directs seront formatés et capturés par Winston
const originalConsoleLog = console.log;
console.log = function() {
  const args = Array.from(arguments).map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  logger.info(args);
};

const originalConsoleError = console.error;
console.error = function() {
  const args = Array.from(arguments).map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  logger.error(args);
};

const originalConsoleWarn = console.warn;
console.warn = function() {
  const args = Array.from(arguments).map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  logger.warn(args);
};

const originalConsoleInfo = console.info;
console.info = function() {
  const args = Array.from(arguments).map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  logger.info(args);
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

// Capture des logs du processus non gérés
process.on('uncaughtException', (err) => {
  logger.error(`Exception non gérée: ${err.message}`, { stack: err.stack });
  // Laisser le temps au log d'être écrit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Promesse rejetée non gérée: ${reason}`, { stack: reason.stack });
});

module.exports = { 
  logger,
  logResponseCache,
  logResponseSent, 
  logResponseRequest,
  logClaudeResponse
};