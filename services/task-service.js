// FCA-Agent - Service de gestion des tâches
const claudeService = require('./claude-service');
const { createModuleLogger } = require('../utils/logger');
const { AppError, ErrorTypes, createTaskExecutionError, asyncErrorHandler } = require('../utils/error');
const cacheService = require('./cache-service');
const dbUtils = require('../utils/db-utils');
const MODULE_NAME = 'SERVER:SERVICES:TASK-SERVICE';
const log = createModuleLogger(MODULE_NAME);

/**
 * Crée une nouvelle tâche dans la base de données
 * @param {number} userId - ID de l'utilisateur (fixe avec simple-auth)
 * @param {string} type - Type de tâche
 * @param {Object} data - Données associées à la tâche
 * @returns {Promise<Object>} - Tâche créée avec son ID
 */
async function createTask(userId, type, data) {
  try {
    // Validation des entrées
    if (!userId) {
      throw new AppError('ID utilisateur requis', ErrorTypes.VALIDATION);
    }
    
    if (!type) {
      throw new AppError('Type de tâche requis', ErrorTypes.VALIDATION);
    }
    
    log.info(`Création d'une tâche: ${type}`);
    
    const result = await dbUtils.run(
      'INSERT INTO tasks (user_id, type, status, input) VALUES (?, ?, ?, ?)',
      [userId, type, 'pending', JSON.stringify(data)]
    );
    
    const taskId = result.lastID;
    log.info(`Nouvelle tâche créée: ${type} (id: ${taskId})`);
    return { taskId, type, status: 'pending' };
  } catch (error) {
    log.error('Exception lors de la création de la tâche:', error);
    
    // Transformer en AppError si ce n'en est pas déjà une
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      'Exception lors de la création de la tâche', 
      ErrorTypes.SYSTEM, 
      500, 
      { type }, 
      error
    );
  }
}

/**
 * Met à jour le statut et le résultat d'une tâche
 * @param {number} taskId - ID de la tâche à mettre à jour
 * @param {string} status - Nouveau statut ('completed' ou 'error')
 * @param {Object} result - Résultat de l'exécution de la tâche
 * @returns {Promise<void>}
 */
async function updateTaskStatus(taskId, status, result) {
  try {
    // Validation des paramètres
    if (!taskId) {
      throw new AppError('ID de tâche requis', ErrorTypes.VALIDATION);
    }
    
    if (!status) {
      throw new AppError('Statut requis', ErrorTypes.VALIDATION);
    }
    
    // Vérification des valeurs valides pour le statut
    const validStatuses = ['pending', 'completed', 'error', 'canceled'];
    if (!validStatuses.includes(status)) {
      throw new AppError(
        `Statut invalide: ${status}. Valeurs valides: ${validStatuses.join(', ')}`,
        ErrorTypes.VALIDATION,
        400,
        { taskId, providedStatus: status, validStatuses }
      );
    }
    
    log.info(`Mise à jour du statut de la tâche ${taskId}: ${status}`);
    
    const updateResult = await dbUtils.run(
      'UPDATE tasks SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, JSON.stringify(result), taskId]
    );
    
    // Vérifier si la mise à jour a affecté une ligne
    if (updateResult.changes === 0) {
      log.warn(`Aucune tâche trouvée avec l'ID ${taskId}`);
      throw new AppError(
        `Tâche non trouvée: ${taskId}`,
        ErrorTypes.NOT_FOUND,
        404,
        { taskId }
      );
    }
    
    log.info(`Tâche ${taskId} mise à jour avec succès`);
  } catch (error) {
    log.error(`Exception lors de la mise à jour de la tâche ${taskId}:`, error);
    
    // Transformer en AppError si ce n'en est pas déjà une
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      `Exception lors de la mise à jour de la tâche ${taskId}`,
      ErrorTypes.SYSTEM,
      500,
      { taskId, status },
      error
    );
  }
}

/**
 * Exécute une tâche selon son type
 * @param {Object} task - Tâche à exécuter (avec taskId et type)
 * @param {Object} data - Données pour l'exécution de la tâche
 * @returns {Promise<Object>} - Résultat de l'exécution
 */
async function executeTask(task, data) {
  try {
    // Validation des paramètres
    if (!task || !task.taskId || !task.type) {
      throw new AppError(
        'Paramètres de tâche invalides', 
        ErrorTypes.VALIDATION, 
        400, 
        { task }
      );
    }
    
    log.info(`Exécution de la tâche ${task.taskId} (type: ${task.type})`);
    
    let result;
    
    // Traitement de la tâche en fonction de son type
    switch (task.type) {
      case 'processUserInput':
        if (!data || !data.input) {
          throw new AppError(
            'Données d\'entrée manquantes pour le traitement du message utilisateur',
            ErrorTypes.VALIDATION,
            400,
            { taskId: task.taskId, taskType: task.type }
          );
        }
        result = await claudeService.processMessage(data.input);
        break;
      case 'gmail-summary':
        if (!data || !data.emails) {
          throw new AppError(
            'Données d\'emails manquantes pour le résumé',
            ErrorTypes.VALIDATION,
            400,
            { taskId: task.taskId, taskType: task.type }
          );
        }
        result = await claudeService.summarizeGmailEmails(data.emails, data.searchQuery);
        break;
      default:
        throw new AppError(
          `Type de tâche non pris en charge: ${task.type}`,
          ErrorTypes.TASK_NOT_SUPPORTED,
          400,
          { taskId: task.taskId, taskType: task.type }
        );
    }
    
    // Mettre à jour le statut de la tâche
    const status = 'completed';
    await updateTaskStatus(task.taskId, status, result);
    
    // Variables pour la gestion de la réponse
    let responseId = null;
    let preview = null;
    let fullResponseAvailable = false;
    let expiresAt = null;
    
    // Si la réponse est volumineuse, la mettre en cache
    if (result && result.response) {
      // Déterminer si la réponse doit être mise en cache en fonction de sa taille
      const largeResponseThreshold = cacheService.get('largeResponseThreshold') || 500;
      const isLarge = result.response.length > largeResponseThreshold;
      
      if (isLarge) {
        // Métadonnées pour le cache
        const metadata = {
          taskId: task.taskId,
          taskType: task.type,
          source: 'executeTask'
        };
        
        // Mettre en cache avec expiration standard
        const cacheResult = cacheService.cacheResponse(result.response, metadata);
        
        // Extraire les informations du cache
        responseId = cacheResult.responseId;
        preview = cacheResult.preview;
        fullResponseAvailable = cacheResult.fullResponseAvailable;
        expiresAt = cacheResult.expiresAt;
        
        log.info(`Réponse mise en cache: ID=${responseId}, expirera le ${new Date(expiresAt).toISOString()}`);
      }
    }
    
    return {
      taskId: task.taskId,
      status,
      result: fullResponseAvailable ? null : result,
      responseId,
      preview,
      fullResponseAvailable,
      expiresAt
    };
  } catch (error) {
    // Journalisation détaillée de l'erreur
    log.error(`Erreur lors de l'exécution de la tâche ${task?.taskId || 'inconnue'}:`, error);
    
    // Créer une AppError si ce n'est pas déjà le cas
    const appError = error instanceof AppError
      ? error
      : createTaskExecutionError(
          `Erreur lors de l'exécution de la tâche ${task?.type || 'inconnue'}`,
          task?.taskId,
          task?.type,
          error
        );
    
    try {
      // Mettre à jour le statut en cas d'erreur (si taskId est disponible)
      if (task?.taskId) {
        await updateTaskStatus(task.taskId, 'error', { 
          error: appError.message,
          type: appError.type,
          details: appError.details
        });
      }
    } catch (updateError) {
      // En cas d'erreur lors de la mise à jour du statut, journaliser mais continuer
      log.error(`Erreur secondaire lors de la mise à jour du statut de la tâche ${task?.taskId || 'inconnue'}:`, updateError);
    }
    
    // Propager l'erreur standardisée
    throw appError;
  }
}

/**
 * Récupère la liste des tâches d'un utilisateur avec pagination
 * @param {number} userId - ID de l'utilisateur
 * @param {number} limit - Nombre maximum de tâches à récupérer
 * @param {number} offset - Décalage pour la pagination
 * @returns {Promise<Object>} - Liste des tâches et métadonnées de pagination
 */
async function getTasksList(userId, limit = 10, offset = 0) {
  try {
    log.info(`Récupération des tâches pour l'utilisateur ${userId} (limit: ${limit}, offset: ${offset})`);
    
    // Récupération des tâches avec pagination
    const tasks = await dbUtils.query(
      'SELECT id, type, status, created_at, completed_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    
    // Comptage du nombre total de tâches
    const countResult = await dbUtils.queryOne(
      'SELECT COUNT(*) as count FROM tasks WHERE user_id = ?', 
      [userId]
    );
    
    const total = countResult ? countResult.count : 0;
    log.info(`${tasks.length} tâches récupérées (total: ${total})`);
    
    return {
      tasks,
      total,
      limit,
      offset
    };
  } catch (error) {
    log.error('Exception lors de la récupération des tâches:', error);
    
    // Transformer en AppError si ce n'en est pas déjà une
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      'Erreur lors de la récupération des tâches',
      ErrorTypes.SYSTEM,
      500,
      { userId, limit, offset },
      error
    );
  }
}

/**
 * Récupère les détails d'une tâche spécifique
 * @param {number} taskId - ID de la tâche
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<Object>} - Détails de la tâche
 */
async function getTaskDetails(taskId, userId) {
  try {
    // Validation des paramètres
    if (!taskId) {
      throw new AppError('ID de tâche requis', ErrorTypes.VALIDATION);
    }
    
    if (!userId) {
      throw new AppError('ID utilisateur requis', ErrorTypes.VALIDATION);
    }
    
    log.info(`Récupération des détails de la tâche ${taskId}`);
    
    const task = await dbUtils.queryOne(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, userId]
    );
    
    if (!task) {
      log.warn(`Tâche ${taskId} non trouvée pour l'utilisateur ${userId}`);
      throw new AppError(
        `Tâche ${taskId} non trouvée`,
        ErrorTypes.NOT_FOUND,
        404,
        { taskId, userId }
      );
    }
    
    // Conversion des chaînes JSON en objets
    try {
      if (task.input) task.input = JSON.parse(task.input);
      if (task.result) task.result = JSON.parse(task.result);
    } catch (jsonError) {
      log.warn('Erreur lors de la conversion JSON pour la tâche', taskId, jsonError);
      // On ne rejette pas la promesse ici, on continue avec les données brutes
      // mais on ajoute une note dans les logs pour faciliter le débogage
    }
    
    log.info(`Détails de la tâche ${taskId} récupérés avec succès`);
    return task;
  } catch (error) {
    log.error(`Exception lors de la récupération de la tâche ${taskId}:`, error);
    
    // Transformer en AppError si ce n'en est pas déjà une
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      `Erreur système lors de la récupération de la tâche ${taskId}`,
      ErrorTypes.SYSTEM,
      500,
      { taskId, userId },
      error
    );
  }
}

/**
 * Récupère une réponse mise en cache
 * @param {string} responseId - ID de la réponse en cache
 * @returns {string|null} - Réponse mise en cache ou null si non trouvée
 */
function getCachedResponse(responseId) {
  return cacheService.getCachedResponse(responseId);
}

/**
 * Obtient la liste des clés disponibles dans le cache
 * @param {boolean} [activeOnly=true] - Si vrai, renvoie uniquement les clés actives
 * @returns {Object[]} - Liste des clés avec leurs métadonnées
 */
function getCacheKeys(activeOnly = true) {
  return cacheService.listKeys(activeOnly);
}

/**
 * Stocke une réponse en cache avec durée limitée
 * @param {string} response - Contenu de la réponse
 * @param {Object} metadata - Métadonnées associées (taskId, type, etc.)
 * @param {number} [ttl] - Durée de vie personnalisée en ms
 * @returns {Object} - Informations sur la réponse mise en cache
 */
function cacheResponse(response, metadata = {}, ttl = null) {
  return cacheService.cacheResponse(response, metadata, ttl);
}

/**
 * Obtient les statistiques du cache
 * @returns {Object} - Statistiques et informations sur le cache
 */
function getCacheStats() {
  return cacheService.getStats();
}

// Exporter les fonctions du service avec gestion d'erreurs async standardisée
module.exports = {
  createTask: asyncErrorHandler(createTask, ErrorTypes.SYSTEM),
  updateTaskStatus: asyncErrorHandler(updateTaskStatus, ErrorTypes.SYSTEM),
  executeTask: asyncErrorHandler(executeTask, ErrorTypes.TASK_EXECUTION),
  getTasksList: asyncErrorHandler(getTasksList, ErrorTypes.SYSTEM),
  getTaskDetails: asyncErrorHandler(getTaskDetails, ErrorTypes.SYSTEM),
  getCachedResponse,
  getCacheKeys,
  cacheResponse,
  getCacheStats,
  // Exporter directement la référence au cache de réponses pour les routes JSONP
  responseCache: cacheService
};
