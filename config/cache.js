/**
 * FCA-Agent - Configuration spécifique au cache
 * 
 * Ce module expose la configuration liée au cache de réponses
 */

const config = require('./index');
const { createModuleLogger } = require('../utils/logger');

// Initialiser le logger
const MODULE_NAME = 'SERVER:CONFIG:CACHE';
const log = createModuleLogger(MODULE_NAME);

/**
 * Récupère la configuration du cache
 * @returns {Object} Configuration du cache
 */
function getCacheConfig() {
  return {
    size: config.get('responsesCacheSize'),
    expiration: config.get('responsesExpiration')
  };
}

/**
 * Met à jour la taille du cache
 * @param {number} size - Nouvelle taille du cache
 */
function setCacheSize(size) {
  if (typeof size !== 'number' || size <= 0) {
    log.error('Taille de cache invalide', { size });
    return;
  }
  
  log.info(`Modification de la taille du cache: ${config.get('responsesCacheSize')} -> ${size}`);
  config.set('responsesCacheSize', size);
}

/**
 * Met à jour la durée d'expiration du cache
 * @param {number} expiration - Nouvelle durée d'expiration en millisecondes
 */
function setCacheExpiration(expiration) {
  if (typeof expiration !== 'number' || expiration <= 0) {
    log.error('Durée d\'expiration invalide', { expiration });
    return;
  }
  
  log.info(`Modification de la durée d'expiration du cache: ${config.get('responsesExpiration')} -> ${expiration}ms`);
  config.set('responsesExpiration', expiration);
}

module.exports = {
  getCacheConfig,
  setCacheSize,
  setCacheExpiration
};
