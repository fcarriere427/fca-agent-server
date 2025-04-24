// FCA-Agent - Middleware de log des réponses
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

// Répertoire des logs
const logsDir = path.join(__dirname, '..', 'logs');
const responseLogFile = path.join(logsDir, 'responses.log');

// S'assurer que le répertoire des logs existe
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Fonction de log des réponses
function logResponse(id, type, data) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${type} - ID: ${id}\n`;
    const detailsEntry = `Data: ${JSON.stringify(data, null, 2)}\n\n`;
    
    fs.appendFileSync(responseLogFile, logEntry + detailsEntry);
  } catch (error) {
    logger.error('Erreur lors de l\'écriture dans le fichier de log des réponses:', error);
  }
}

// Fonctions spécifiques
const logResponseCache = (responseId, length) => {
  logResponse(responseId, 'RESPONSE_CACHED', { length });
};

const logResponseSent = (responseId, length) => {
  logResponse(responseId, 'RESPONSE_SENT', { length });
};

const logResponseRequest = (responseId) => {
  logResponse(responseId, 'RESPONSE_REQUESTED', {});
};

const logClaudeResponse = (taskId, type, data) => {
  const safeData = { 
    ...data,
    response: data.response ? `${data.response.substring(0, 200)}... (${data.response.length} caractères)` : null
  };
  logResponse(taskId, 'CLAUDE_RESPONSE', { type, ...safeData });
};

module.exports = {
  logResponseCache,
  logResponseSent,
  logResponseRequest,
  logClaudeResponse
};