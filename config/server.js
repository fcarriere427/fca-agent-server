/**
 * FCA-Agent - Configuration spécifique au serveur
 * 
 * Ce module expose la configuration liée au serveur HTTP
 */

const config = require('./index');
const { createModuleLogger } = require('../utils/logger');

// Initialiser le logger
const MODULE_NAME = 'SERVER:CONFIG:SERVER';
const log = createModuleLogger(MODULE_NAME);

/**
 * Récupère la configuration du serveur
 * @returns {Object} Configuration du serveur
 */
function getServerConfig() {
  return {
    port: config.get('port'),
    nodeEnv: config.get('nodeEnv'),
    allowedOrigins: config.get('allowedOrigins')
  };
}

/**
 * Ajoute une origine CORS autorisée
 * @param {string} origin - Nouvelle origine à autoriser
 */
function addAllowedOrigin(origin) {
  if (!origin) {
    log.error('Tentative d\'ajout d\'une origine vide');
    return;
  }
  
  const allowedOrigins = config.get('allowedOrigins');
  
  if (allowedOrigins.includes(origin)) {
    log.info(`L'origine ${origin} est déjà autorisée`);
    return;
  }
  
  log.info(`Ajout de l'origine CORS: ${origin}`);
  allowedOrigins.push(origin);
  config.set('allowedOrigins', allowedOrigins);
}

/**
 * Vérifie si une origine est autorisée
 * @param {string} origin - Origine à vérifier
 * @returns {boolean} True si l'origine est autorisée
 */
function isOriginAllowed(origin) {
  const allowedOrigins = config.get('allowedOrigins');
  
  // Si '*' est dans la liste, toutes les origines sont autorisées
  if (allowedOrigins.includes('*')) {
    return true;
  }
  
  return allowedOrigins.includes(origin);
}

module.exports = {
  getServerConfig,
  addAllowedOrigin,
  isOriginAllowed
};
