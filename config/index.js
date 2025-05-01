/**
 * FCA-Agent - Module de configuration centralisé
 * 
 * Ce module gère toute la configuration du serveur de manière centralisée avec:
 * - Valeurs par défaut
 * - Variables d'environnement (.env)
 * - Possibilité de recharger à chaud
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { createModuleLogger } = require('../utils/logger');

// Initialiser le logger
const MODULE_NAME = 'CONFIG';
const log = createModuleLogger(MODULE_NAME);

// Configuration par défaut
const defaultConfig = {
  // Serveur
  port: 3001,
  nodeEnv: 'development',
  
  // Sécurité
  apiKey: null, // Doit être défini dans .env
  
  // API Claude (Anthropic)
  anthropicApiKey: null, // Doit être défini dans .env
  claudeModel: 'claude-3-haiku-20240307',
  
  // Base de données
  dbPath: path.join(__dirname, '../db/fca-agent.db'),
  
  // Logging
  logLevel: 'info',
  logDir: path.join(__dirname, '../logs'),
  
  // Cache et performances
  responsesCacheSize: 100, // Nombre de réponses gardées en cache
  responsesExpiration: 3600000, // 1 heure en millisecondes
  
  // CORS
  allowedOrigins: [
    'chrome-extension://geijajfenikceeemehghgabl61pbded1', 
    'http://localhost:3001', 
    '*'
  ]
};

/**
 * Classe de configuration centralisée
 */
class ConfigManager {
  constructor() {
    this.config = { ...defaultConfig };
    this.loadFromEnv();
    this.validate();
  }
  
  /**
   * Charge la configuration depuis les variables d'environnement
   */
  loadFromEnv() {
    try {
      // Charger .env si le fichier existe
      const envPath = path.join(__dirname, '../.env');
      if (fs.existsSync(envPath)) {
        log.info('Chargement de la configuration depuis .env');
        const envResult = dotenv.config({ path: envPath });
        
        if (envResult.error) {
          log.error('Erreur lors du chargement du fichier .env', envResult.error);
        }
      } else {
        log.warn('Fichier .env non trouvé, utilisation des valeurs d\'environnement ou par défaut');
      }
      
      // Mettre à jour la configuration avec les variables d'environnement
      this.config.port = process.env.PORT || this.config.port;
      this.config.nodeEnv = process.env.NODE_ENV || this.config.nodeEnv;
      this.config.apiKey = process.env.API_KEY || this.config.apiKey;
      this.config.anthropicApiKey = process.env.ANTHROPIC_API_KEY || this.config.anthropicApiKey;
      this.config.claudeModel = process.env.CLAUDE_MODEL || this.config.claudeModel;
      this.config.dbPath = process.env.DB_PATH || this.config.dbPath;
      this.config.logLevel = process.env.LOG_LEVEL || this.config.logLevel;
      
      if (process.env.LOG_DIR) {
        this.config.logDir = process.env.LOG_DIR;
      }
      
      // Performances et cache (si définis dans .env)
      if (process.env.RESPONSES_CACHE_SIZE) {
        this.config.responsesCacheSize = parseInt(process.env.RESPONSES_CACHE_SIZE, 10);
      }
      
      if (process.env.RESPONSES_EXPIRATION) {
        this.config.responsesExpiration = parseInt(process.env.RESPONSES_EXPIRATION, 10);
      }
      
      // Configurations spécifiques (parsage de JSON si nécessaire)
      if (process.env.ALLOWED_ORIGINS) {
        try {
          this.config.allowedOrigins = JSON.parse(process.env.ALLOWED_ORIGINS);
        } catch (e) {
          log.error('Format invalide pour ALLOWED_ORIGINS, utilisation des valeurs par défaut', e);
        }
      }
      
      log.info('Configuration chargée avec succès');
    } catch (error) {
      log.error('Erreur lors du chargement de la configuration', error);
    }
  }
  
  /**
   * Valide la configuration et vérifie les valeurs critiques
   */
  validate() {
    const criticalMissing = [];
    
    // Vérifier les valeurs critiques
    if (!this.config.apiKey) {
      criticalMissing.push('API_KEY');
    }
    
    if (!this.config.anthropicApiKey) {
      criticalMissing.push('ANTHROPIC_API_KEY');
    }
    
    // Afficher un avertissement pour les valeurs manquantes
    if (criticalMissing.length > 0) {
      log.warn(`Configuration incomplète. Variables critiques manquantes: ${criticalMissing.join(', ')}`);
    }
    
    // Validation des valeurs numériques
    if (isNaN(parseInt(this.config.port, 10))) {
      log.error('PORT invalide, utilisation de la valeur par défaut');
      this.config.port = defaultConfig.port;
    }
    
    log.info('Validation de la configuration terminée');
  }
  
  /**
   * Recharge la configuration depuis le fichier .env
   * Utile pour les mises à jour sans redémarrer le serveur
   */
  reload() {
    log.info('Rechargement de la configuration');
    this.loadFromEnv();
    this.validate();
    return this.getAll();
  }
  
  /**
   * Récupère une valeur de configuration spécifique
   * @param {string} key - Clé de configuration
   * @returns {any} Valeur de configuration
   */
  get(key) {
    return this.config[key];
  }
  
  /**
   * Récupère toute la configuration
   * @returns {Object} Configuration complète
   */
  getAll() {
    return { ...this.config };
  }
  
  /**
   * Définit ou met à jour une valeur de configuration
   * Note: Ces modifications sont temporaires et seront perdues au redémarrage
   * @param {string} key - Clé de configuration
   * @param {any} value - Nouvelle valeur
   */
  set(key, value) {
    log.info(`Mise à jour de la configuration: ${key}`, { oldValue: this.config[key], newValue: value });
    this.config[key] = value;
  }
}

// Créer et exporter une instance singleton
const configManager = new ConfigManager();

module.exports = configManager;
