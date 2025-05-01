// FCA-Agent - Routes pour les tâches
const express = require('express');
const router = express.Router();
const { createModuleLogger } = require('../utils/logger');
const MODULE_NAME = 'SERVER:API:TASKS';
const log = createModuleLogger(MODULE_NAME);
const { authMiddleware } = require('../utils/auth');
const apiResponse = require('../utils/api-response');
const taskService = require('../services/task-service');
const cacheService = require('../services/cache-service');

// Middleware d'authentification pour les routes de tâches
router.use(authMiddleware);

// GET /api/tasks/hello - Route de test simple
router.get('/hello', (req, res) => {
  log.info('Route de test /hello appelée');
  return apiResponse.success(res, { message: 'Hello World - Test de l\'API réussi !' }, 200, 'Test API réussi');
});

// POST /api/tasks - Créer une nouvelle tâche
router.post('/', async (req, res) => {
  try {
    const { type, data } = req.body;
    // ID utilisateur par défaut pour l'authentification simplifiée
    const userId = 1; // On utilise un ID fixe puisque simple-auth n'utilise pas d'ID utilisateur
    
    // Validation
    if (!type) {
      return apiResponse.error(res, 'Type de tâche requis', 400);
    }
    
    try {
      // Créer la tâche dans la base de données
      const task = await taskService.createTask(userId, type, data);
      
      // Exécuter la tâche
      const result = await taskService.executeTask(task, data);
      
      // Formater la réponse selon le résultat
      if (result.fullResponseAvailable) {
        return apiResponse.success(res, {
          taskId: result.taskId,
          status: result.status,
          responseId: result.responseId,
          preview: result.preview,
          fullResponseAvailable: true,
          expiresAt: result.expiresAt // Nouvelle propriété
        }, 200, 'Tâche exécutée avec succès');
      } else {
        return apiResponse.success(res, { 
          taskId: result.taskId,
          status: result.status,
          result: result.result
        }, 200, 'Tâche exécutée avec succès');
      }
    } catch (error) {
      log.error('Erreur lors de l\'exécution de la tâche:', error);
      return apiResponse.serverError(res, error);
    }
  } catch (error) {
    log.error('Erreur lors de la création de la tâche:', error);
    return apiResponse.serverError(res, error);
  }
});

// GET /api/tasks - Obtenir la liste des tâches
router.get('/', async (req, res) => {
  try {
    // ID utilisateur par défaut pour l'authentification simplifiée
    const userId = 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await taskService.getTasksList(userId, limit, offset);
    
    return apiResponse.success(res, result);
  } catch (error) {
    log.error('Erreur lors de la récupération des tâches:', error);
    return apiResponse.serverError(res, error);
  }
});

// GET /api/tasks/:id - Obtenir les détails d'une tâche
router.get('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    // ID utilisateur par défaut pour l'authentification simplifiée
    const userId = 1;
    
    try {
      const task = await taskService.getTaskDetails(taskId, userId);
      return apiResponse.success(res, { task });
    } catch (error) {
      if (error.message === 'Tâche non trouvée') {
        return apiResponse.error(res, 'Tâche non trouvée', 404);
      }
      throw error;
    }
  } catch (error) {
    log.error('Erreur lors de la récupération de la tâche:', error);
    return apiResponse.serverError(res, error);
  }
});

// GET /api/tasks/response/:id - Récupérer une réponse en cache
router.get('/response/:id', (req, res) => {
  try {
    const responseId = req.params.id;
    
    const cachedResponse = taskService.getCachedResponse(responseId);
    if (!cachedResponse) {
      return apiResponse.error(res, 'Réponse non trouvée ou expirée', 404);
    }
    
    return apiResponse.success(res, { response: cachedResponse }, 200, 'Réponse récupérée avec succès');
  } catch (error) {
    log.error('Erreur lors de la récupération de la réponse:', error);
    return apiResponse.serverError(res, error);
  }
});

// GET /api/tasks/cache/keys - Obtenir les clés de cache disponibles
router.get('/cache/keys', (req, res) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false'; // Par défaut, uniquement les entrées actives
    const keys = taskService.getCacheKeys(activeOnly);
    return apiResponse.success(res, { keys }, 200, `${keys.length} clés trouvées`);
  } catch (error) {
    log.error('Erreur lors de la récupération des clés de cache:', error);
    return apiResponse.serverError(res, error);
  }
});

// GET /api/tasks/cache/stats - Obtenir les statistiques du cache
router.get('/cache/stats', (req, res) => {
  try {
    const stats = taskService.getCacheStats();
    return apiResponse.success(res, { stats }, 200, 'Statistiques du cache');
  } catch (error) {
    log.error('Erreur lors de la récupération des statistiques du cache:', error);
    return apiResponse.serverError(res, error);
  }
});

// POST /api/tasks/cache/configure - Configurer le cache
router.post('/cache/configure', (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config || typeof config !== 'object') {
      return apiResponse.error(res, 'Configuration invalide', 400);
    }
    
    cacheService.configure(config);
    
    return apiResponse.success(res, { 
      message: 'Configuration mise à jour',
      config: cacheService.getStats().config
    }, 200, 'Cache configuré');
  } catch (error) {
    log.error('Erreur lors de la configuration du cache:', error);
    return apiResponse.serverError(res, error);
  }
});

// POST /api/tasks/cache/cleanup - Nettoyer le cache
router.post('/cache/cleanup', (req, res) => {
  try {
    const removedCount = cacheService.cleanup();
    
    return apiResponse.success(res, { 
      removedCount,
      stats: cacheService.getStats()
    }, 200, `${removedCount} entrées supprimées`);
  } catch (error) {
    log.error('Erreur lors du nettoyage du cache:', error);
    return apiResponse.serverError(res, error);
  }
});

// POST /api/tasks/response/renew/:id - Renouveler l'expiration d'une réponse en cache
router.post('/response/renew/:id', (req, res) => {
  try {
    const responseId = req.params.id;
    const { ttl } = req.body; // Durée en millisecondes (optionnelle)
    
    if (!cacheService.has(responseId)) {
      return apiResponse.error(res, 'Réponse non trouvée en cache', 404);
    }
    
    const renewed = cacheService.renewExpiry(responseId, ttl);
    
    if (renewed) {
      return apiResponse.success(res, { 
        responseId,
        message: 'Expiration de la réponse renouvelée'
      }, 200, 'Expiration renouvelée');
    } else {
      return apiResponse.error(res, 'Impossible de renouveler l\'expiration', 400);
    }
  } catch (error) {
    log.error('Erreur lors du renouvellement de l\'expiration:', error);
    return apiResponse.serverError(res, error);
  }
});

module.exports = { router };