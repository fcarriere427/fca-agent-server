// FCA-Agent - Routes pour les tâches
const express = require('express');
const router = express.Router();
const { createModuleLogger } = require('../utils/logger');
const MODULE_NAME = 'API:TASKS';
const log = createModuleLogger(MODULE_NAME);
const { authMiddleware } = require('../utils/auth');
const apiResponse = require('../utils/api-response');
const { AppError, ErrorTypes, catchErrors, createValidationError } = require('../utils/error');
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
router.post('/', catchErrors(async (req, res) => {
  const { type, data } = req.body;
  // ID utilisateur par défaut pour l'authentification simplifiée
  const userId = 1; // On utilise un ID fixe puisque simple-auth n'utilise pas d'ID utilisateur
  
  // Validation
  if (!type) {
    throw createValidationError('Type de tâche requis');
  }
  
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
      expiresAt: result.expiresAt
    }, 200, 'Tâche exécutée avec succès');
  } else {
    return apiResponse.success(res, { 
      taskId: result.taskId,
      status: result.status,
      result: result.result
    }, 200, 'Tâche exécutée avec succès');
  }
}));

// GET /api/tasks - Obtenir la liste des tâches
router.get('/', catchErrors(async (req, res) => {
  // ID utilisateur par défaut pour l'authentification simplifiée
  const userId = 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  
  const result = await taskService.getTasksList(userId, limit, offset);
  
  return apiResponse.success(res, result);
}));

// GET /api/tasks/response/:id - Récupérer une réponse en cache
router.get('/response/:id', catchErrors(async (req, res) => {
  const responseId = req.params.id;
  
  const cachedResponse = taskService.getCachedResponse(responseId);
  if (!cachedResponse) {
    throw new AppError(
      'Réponse non trouvée ou expirée',
      ErrorTypes.NOT_FOUND,
      404,
      { responseId }
    );
  }
  
  return apiResponse.success(res, { response: cachedResponse }, 200, 'Réponse récupérée avec succès');
}));

// GET /api/tasks/cache/keys - Obtenir les clés de cache disponibles
router.get('/cache/keys', catchErrors(async (req, res) => {
  const activeOnly = req.query.activeOnly !== 'false'; // Par défaut, uniquement les entrées actives
  const keys = taskService.getCacheKeys(activeOnly);
  return apiResponse.success(res, { keys }, 200, `${keys.length} clés trouvées`);
}));

// GET /api/tasks/cache/stats - Obtenir les statistiques du cache
router.get('/cache/stats', catchErrors(async (req, res) => {
  const stats = taskService.getCacheStats();
  return apiResponse.success(res, { stats }, 200, 'Statistiques du cache');
}));

// POST /api/tasks/cache/configure - Configurer le cache
router.post('/cache/configure', catchErrors(async (req, res) => {
  const { config } = req.body;
  
  if (!config || typeof config !== 'object') {
    throw createValidationError('Configuration invalide', { receivedType: typeof config });
  }
  
  cacheService.configure(config);
  
  return apiResponse.success(res, { 
    message: 'Configuration mise à jour',
    config: cacheService.getStats().config
  }, 200, 'Cache configuré');
}));

// POST /api/tasks/cache/cleanup - Nettoyer le cache
router.post('/cache/cleanup', catchErrors(async (req, res) => {
  const removedCount = cacheService.cleanup();
  
  return apiResponse.success(res, { 
    removedCount,
    stats: cacheService.getStats()
  }, 200, `${removedCount} entrées supprimées`);
}));

// POST /api/tasks/response/renew/:id - Renouveler l'expiration d'une réponse en cache
router.post('/response/renew/:id', catchErrors(async (req, res) => {
  const responseId = req.params.id;
  const { ttl } = req.body; // Durée en millisecondes (optionnelle)
  
  if (!cacheService.has(responseId)) {
    throw new AppError(
      'Réponse non trouvée en cache',
      ErrorTypes.NOT_FOUND,
      404,
      { responseId }
    );
  }
  
  const renewed = cacheService.renewExpiry(responseId, ttl);
  
  if (renewed) {
    return apiResponse.success(res, { 
      responseId,
      message: 'Expiration de la réponse renouvelée'
    }, 200, 'Expiration renouvelée');
  } else {
    throw new AppError(
      'Impossible de renouveler l\'expiration',
      ErrorTypes.CACHE,
      400,
      { responseId, ttl }
    );
  }
}));

// GET /api/tasks/:id - Obtenir les détails d'une tâche
router.get('/:id', catchErrors(async (req, res) => {
  const taskId = req.params.id;
  // ID utilisateur par défaut pour l'authentification simplifiée
  const userId = 1;
  
  const task = await taskService.getTaskDetails(taskId, userId);
  return apiResponse.success(res, { task });
}));

module.exports = { router };