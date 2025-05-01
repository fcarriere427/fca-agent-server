// FCA-Agent - Service de gestion du cache
const { createModuleLogger } = require('../utils/logger');
const { AppError, ErrorTypes } = require('../utils/error');
const MODULE_NAME = 'SERVER:SERVICES:CACHE-SERVICE';
const log = createModuleLogger(MODULE_NAME);

// Configuration par défaut du cache
const DEFAULT_CONFIG = {
  // Durée de vie par défaut des entrées de cache (10 minutes)
  defaultTTL: 10 * 60 * 1000,
  // Taille maximum de l'aperçu des réponses volumineuses 
  previewSize: 100,
  // Seuil pour considérer une réponse comme volumineuse
  largeResponseThreshold: 500,
  // Préfixe pour les identifiants de cache
  idPrefix: 'cache_',
  // Intervalle de nettoyage du cache (30 minutes)
  cleanupInterval: 30 * 60 * 1000
};

// Structure principale du cache avec métadonnées
const cache = {
  // Données du cache: clé -> { value, expiry, metadata }
  entries: {},
  // Configuration active
  config: { ...DEFAULT_CONFIG },
  // Statistiques d'utilisation
  stats: {
    hits: 0,
    misses: 0,
    totalEntries: 0,
    totalBytes: 0
  }
};

/**
 * Nettoie les caractères problématiques d'une chaîne pour le stockage en cache
 * @param {string} text - Texte à assainir
 * @returns {string} - Texte assaini
 */
function sanitizeText(text) {
  if (typeof text !== 'string') {
    return String(text);
  }
  
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // Caractères de contrôle
    .replace(/\u2028/g, '\n')  // Line separator
    .replace(/\u2029/g, '\n'); // Paragraph separator
}

/**
 * Génère un identifiant unique pour le cache
 * @param {string} prefix - Préfixe pour l'ID (par défaut: config.idPrefix)
 * @param {string} source - Source de données pour inclure dans l'ID (ex: taskId)
 * @returns {string} - Identifiant unique
 */
function generateCacheId(prefix = null, source = '') {
  const actualPrefix = prefix || cache.config.idPrefix;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${actualPrefix}${source ? `_${source}` : ''}_${timestamp}_${random}`;
}

/**
 * Stocke une valeur dans le cache
 * @param {string} value - Valeur à mettre en cache
 * @param {Object} options - Options pour le stockage
 * @param {string} [options.id] - ID personnalisé (si non fourni, un ID est généré)
 * @param {number} [options.ttl] - Durée de vie en ms (si non fournie, utilise la valeur par défaut)
 * @param {Object} [options.metadata] - Métadonnées associées à l'entrée
 * @returns {Object} - Informations sur l'entrée de cache créée
 */
function set(value, options = {}) {
  const { 
    id = null, 
    ttl = cache.config.defaultTTL,
    metadata = {}
  } = options;
  
  // Générer un ID s'il n'est pas fourni
  const cacheId = id || generateCacheId();
  
  // Assainir et calculer la taille de la valeur
  const sanitizedValue = sanitizeText(value);
  const valueSize = Buffer.byteLength(sanitizedValue, 'utf8');
  
  // Calculer l'heure d'expiration
  const now = Date.now();
  const expiry = now + ttl;
  
  // Stocker dans le cache avec métadonnées
  cache.entries[cacheId] = {
    value: sanitizedValue,
    expiry,
    created: now,
    size: valueSize,
    metadata: {
      ...metadata,
      ttl
    }
  };
  
  // Mettre à jour les statistiques
  cache.stats.totalEntries++;
  cache.stats.totalBytes += valueSize;
  
  log.info(`Cache - Nouvelle entrée: ID=${cacheId}, taille=${valueSize} octets, expire dans ${ttl/1000}s`);
  
  // Programmer la suppression automatique
  setTimeout(() => {
    remove(cacheId);
  }, ttl);
  
  // Déterminer si c'est une réponse volumineuse
  const isLargeResponse = sanitizedValue.length > cache.config.largeResponseThreshold;
  
  // Générer un aperçu si c'est une réponse volumineuse
  const preview = isLargeResponse 
    ? sanitizedValue.substring(0, cache.config.previewSize) + '...'
    : null;
  
  // Renvoyer les informations sur l'entrée de cache
  return {
    id: cacheId,
    preview: preview,
    isLargeResponse,
    expiresAt: expiry,
    ttl
  };
}

/**
 * Récupère une valeur du cache
 * @param {string} id - Identifiant de l'entrée de cache
 * @param {boolean} [updateStats=true] - Si vrai, met à jour les statistiques
 * @returns {Object|null} - Entrée du cache ou null si non trouvée
 */
function get(id, updateStats = true) {
  // Validation de l'ID
  if (!id || typeof id !== 'string') {
    log.warn(`Cache - ID invalide: ${id}`);
    if (updateStats) {
      cache.stats.misses++;
    }
    return null;
  }
  
  // Vérifier si l'entrée existe
  if (!cache.entries[id]) {
    if (updateStats) {
      cache.stats.misses++;
    }
    log.debug(`Cache - Entrée non trouvée: ${id}`);
    return null;
  }
  
  const entry = cache.entries[id];
  
  // Vérifier si l'entrée est expirée
  if (entry.expiry < Date.now()) {
    remove(id);
    if (updateStats) {
      cache.stats.misses++;
    }
    log.debug(`Cache - Entrée expirée: ${id}`);
    return null;
  }
  
  // Mettre à jour les statistiques
  if (updateStats) {
    cache.stats.hits++;
  }
  
  log.debug(`Cache - Entrée récupérée: ${id}`);
  
  // Renvoyer une copie de l'entrée
  return {
    value: entry.value,
    metadata: entry.metadata,
    created: entry.created,
    expiry: entry.expiry,
    size: entry.size,
    timeRemaining: entry.expiry - Date.now()
  };
}

/**
 * Vérifie si une entrée existe et est valide dans le cache
 * @param {string} id - Identifiant de l'entrée de cache
 * @returns {boolean} - Vrai si l'entrée existe et n'est pas expirée
 */
function has(id) {
  if (!cache.entries[id]) {
    return false;
  }
  
  // Vérifier si l'entrée est expirée
  if (cache.entries[id].expiry < Date.now()) {
    remove(id);
    return false;
  }
  
  return true;
}

/**
 * Supprime une entrée du cache
 * @param {string} id - Identifiant de l'entrée à supprimer
 * @returns {boolean} - Vrai si l'entrée a été supprimée
 */
function remove(id) {
  if (cache.entries[id]) {
    // Mettre à jour les statistiques
    cache.stats.totalEntries--;
    cache.stats.totalBytes -= cache.entries[id].size;
    
    // Supprimer l'entrée
    delete cache.entries[id];
    
    log.debug(`Cache - Entrée supprimée: ${id}`);
    return true;
  }
  
  return false;
}

/**
 * Nettoie les entrées expirées du cache
 * @returns {number} - Nombre d'entrées supprimées
 */
function cleanup() {
  const now = Date.now();
  let removedCount = 0;
  
  // Parcourir toutes les entrées
  Object.keys(cache.entries).forEach(id => {
    if (cache.entries[id].expiry < now) {
      remove(id);
      removedCount++;
    }
  });
  
  if (removedCount > 0) {
    log.info(`Cache - Nettoyage: ${removedCount} entrées expirées supprimées`);
  }
  
  return removedCount;
}

/**
 * Stocke une réponse volumineuse dans le cache avec formatage automatique
 * @param {string} response - Contenu de la réponse
 * @param {Object} metadata - Métadonnées associées (taskId, type, etc.)
 * @param {number} [ttl] - Durée de vie personnalisée
 * @returns {Object} - Informations sur la réponse mise en cache
 */
function cacheResponse(response, metadata = {}, ttl = null) {
  // Utiliser la durée par défaut si non spécifiée
  const actualTTL = ttl || cache.config.defaultTTL;
  
  // Stocker la réponse dans le cache
  const cacheInfo = set(response, {
    ttl: actualTTL,
    metadata: {
      ...metadata,
      type: 'response'
    }
  });
  
  return {
    responseId: cacheInfo.id,
    preview: cacheInfo.preview,
    fullResponseAvailable: cacheInfo.isLargeResponse,
    expiresAt: cacheInfo.expiresAt
  };
}

/**
 * Récupère une réponse mise en cache
 * @param {string} responseId - ID de la réponse en cache
 * @returns {string|null} - Réponse complète ou null si non trouvée
 */
function getCachedResponse(responseId) {
  if (!responseId || typeof responseId !== 'string') {
    log.warn(`Cache - ID de réponse invalide: ${responseId}`);
    return null;
  }
  
  try {
    const entry = get(responseId);
    
    if (!entry) {
      return null;
    }
    
    // Vérifier si la réponse a le type correct
    if (entry.metadata && entry.metadata.type !== 'response') {
      log.warn(`Cache - Entrée de type incorrect: ${responseId}, type=${entry.metadata.type}`);
      return null;
    }
    
    return entry.value;
  } catch (error) {
    log.error(`Cache - Erreur lors de la récupération de la réponse ${responseId}:`, error);
    return null;
  }
}

/**
 * Met à jour la configuration du cache
 * @param {Object} newConfig - Nouvelles valeurs de configuration
 */
function configure(newConfig = {}) {
  // Fusionner les nouvelles configurations avec les existantes
  cache.config = {
    ...cache.config,
    ...newConfig
  };
  
  log.info('Cache - Configuration mise à jour', cache.config);
}

/**
 * Obtient les statistiques du cache
 * @returns {Object} - Statistiques et informations sur le cache
 */
function getStats() {
  const now = Date.now();
  const entriesCount = Object.keys(cache.entries).length;
  
  // Compter les entrées actives et expirées
  let activeEntries = 0;
  let expiredEntries = 0;
  
  Object.values(cache.entries).forEach(entry => {
    if (entry.expiry > now) {
      activeEntries++;
    } else {
      expiredEntries++;
    }
  });
  
  return {
    ...cache.stats,
    activeEntries,
    expiredEntries,
    currentEntries: entriesCount,
    config: cache.config,
    hitRatio: cache.stats.hits + cache.stats.misses > 0 
      ? cache.stats.hits / (cache.stats.hits + cache.stats.misses)
      : 0
  };
}

/**
 * Liste toutes les clés disponibles dans le cache
 * @param {boolean} [activeOnly=true] - Si vrai, renvoie uniquement les clés actives
 * @returns {Object[]} - Liste des clés avec leurs métadonnées
 */
function listKeys(activeOnly = true) {
  const now = Date.now();
  const keys = Object.keys(cache.entries);
  
  return keys
    .filter(key => !activeOnly || cache.entries[key].expiry > now)
    .map(key => {
      const entry = cache.entries[key];
      return {
        id: key,
        created: entry.created,
        expiry: entry.expiry,
        timeRemaining: Math.max(0, entry.expiry - now),
        size: entry.size,
        metadata: entry.metadata
      };
    });
}

/**
 * Renouvelle la durée de vie d'une entrée de cache
 * @param {string} id - Identifiant de l'entrée
 * @param {number} [ttl] - Nouvelle durée de vie (si non fournie, utilise la valeur par défaut)
 * @returns {boolean} - Vrai si l'entrée a été renouvelée
 */
function renewExpiry(id, ttl = null) {
  // Validation de l'ID
  if (!id || typeof id !== 'string') {
    log.warn(`Cache - ID invalide pour le renouvellement: ${id}`);
    return false;
  }
  
  // Vérifier si l'entrée existe
  if (!cache.entries[id]) {
    log.debug(`Cache - Entrée non trouvée pour le renouvellement: ${id}`);
    return false;
  }
  
  try {
    const actualTTL = ttl || cache.config.defaultTTL;
    const now = Date.now();
    
    // Mettre à jour l'heure d'expiration
    cache.entries[id].expiry = now + actualTTL;
    cache.entries[id].metadata.ttl = actualTTL;
    
    log.debug(`Cache - Expiration renouvelée: ${id}, nouvelle expiration dans ${actualTTL/1000}s`);
    
    // Reprogrammer la suppression automatique
    setTimeout(() => {
      remove(id);
    }, actualTTL);
    
    return true;
  } catch (error) {
    log.error(`Cache - Erreur lors du renouvellement de l'expiration de ${id}:`, error);
    return false;
  }
}

// Initialiser le nettoyage périodique
setInterval(cleanup, cache.config.cleanupInterval);

module.exports = {
  // Fonctions principales
  set,
  get,
  has,
  remove,
  cleanup,
  // Fonctions spécifiques aux réponses
  cacheResponse,
  getCachedResponse,
  // Utilitaires
  generateCacheId,
  sanitizeText,
  // Configuration
  configure,
  // Statistiques et informations
  getStats,
  listKeys,
  renewExpiry
};