/**
 * FCA-Agent - Configuration spécifique à l'API Claude
 * 
 * Ce module expose la configuration liée à l'API Claude (Anthropic)
 */

const config = require('./index');
const { createModuleLogger } = require('../utils/logger');

// Initialiser le logger
const MODULE_NAME = 'SERVER:CONFIG:CLAUDE';
const log = createModuleLogger(MODULE_NAME);

/**
 * Récupère la configuration de l'API Claude
 * @returns {Object} Configuration Claude
 */
function getClaudeConfig() {
  const claudeConfig = {
    apiKey: config.get('anthropicApiKey'),
    model: config.get('claudeModel')
  };
  
  if (!claudeConfig.apiKey) {
    log.warn('Clé API Claude non configurée');
  }
  
  // Ne pas logger la clé API pour des raisons de sécurité
  log.info('Configuration Claude récupérée', { model: claudeConfig.model });
  
  return claudeConfig;
}

/**
 * Met à jour la configuration du modèle Claude
 * @param {string} model - Nouveau modèle à utiliser
 */
function setClaudeModel(model) {
  if (!model) {
    log.error('Tentative de définition d\'un modèle vide');
    return;
  }
  
  log.info(`Modification du modèle Claude: ${config.get('claudeModel')} -> ${model}`);
  config.set('claudeModel', model);
}

module.exports = {
  getClaudeConfig,
  setClaudeModel
};
