// FCA-Agent - Routes pour les tâches
const express = require('express');
const router = express.Router();
const { 
  createModuleLogger,
  logResponseCache, 
  logResponseSent, 
  logResponseRequest,
  logClaudeResponse 
} = require('../utils/logger');
const MODULE_NAME = 'SERVER:API:TASKS';
const log = createModuleLogger(MODULE_NAME);
const { getDb } = require('../db/setup');
const claudeService = require('../services/claude-service');
const { authMiddleware } = require('../utils/auth');
const apiResponse = require('../utils/api-response');

// Stockage temporaire des réponses complètes
const responseCache = {};

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
    
    // Enregistrer la tâche dans la base de données
    const db = getDb();
    db.run(
      'INSERT INTO tasks (user_id, type, status, input) VALUES (?, ?, ?, ?)',
      [userId, type, 'pending', JSON.stringify(data)],
      async function(err) {
        if (err) {
          log.error('Erreur lors de la création de la tâche:', err);
          return apiResponse.serverError(res, err);
        }
        
        const taskId = this.lastID;
        log.info(`Nouvelle tâche créée: ${type} (id: ${taskId})`);
        
        try {
          // Traitement de la tâche en fonction de son type
          let result;
          
          switch (type) {
            case 'processUserInput':
              result = await claudeService.processMessage(data.input);
              break;
            case 'gmail-summary':
              result = await claudeService.summarizeGmailEmails(data.emails, data.searchQuery);
              break;
            default:
              result = { error: 'Type de tâche non pris en charge' };
          }
          
          // Mettre à jour le statut de la tâche
          const status = result.error ? 'error' : 'completed';
          db.run(
            'UPDATE tasks SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, JSON.stringify(result), taskId]
          );
          
          // Log détaillé de la réponse
          console.log('Réponse complète de Claude:', {
            responseLength: result.response ? result.response.length : 0,
            responseStart: result.response ? result.response.substring(0, 100) + '...' : 'Pas de réponse',
            responseType: result.response ? typeof result.response : 'undefined'
          });
          
          // Log de la réponse de Claude dans le fichier spécifique
          logClaudeResponse(taskId, type, result);
          
          // Stocker la réponse complète dans le cache temporaire
          if (result && result.response) {
            const responseId = `response_${taskId}_${Date.now()}`;
            
            // Stocker une version saine de la réponse pour éviter les problèmes de sérialisation
            const safeResponse = result.response
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // Caractères de contrôle
              .replace(/\u2028/g, '\n')  // Line separator
              .replace(/\u2029/g, '\n'); // Paragraph separator
            
            responseCache[responseId] = safeResponse;
            
            // Log explicite pour le cache
            log.info(`Réponse mise en cache: ID=${responseId}, longueur=${safeResponse.length} caractères`);
            logResponseCache(responseId, safeResponse.length);
            
            // Créer un fichier log des clés du cache pour debugging
            const cacheKeys = Object.keys(responseCache);
            log.info(`Clés disponibles dans le cache: ${cacheKeys.join(', ')}`);
            
            // Supprimer la cache après 10 minutes
            setTimeout(() => {
              delete responseCache[responseId];
              log.info(`Cache supprimée pour ${responseId}`);
            }, 10 * 60 * 1000);
            
            // Renvoyer une référence à la réponse complète au lieu de la réponse elle-même
            return apiResponse.success(res, { 
            taskId,
            status,
            responseId,
            // Envoyer un court aperçu de la réponse - s'assurer qu'il est correctement encodé
            preview: safeResponse.substring(0, 100) + '...',
            fullResponseAvailable: true
            }, 200, 'Tâche exécutée avec succès');
          } else {
            // Si pas de réponse ou réponse courte, renvoyer directement
            return apiResponse.success(res, { 
            taskId,
            status,
            result
            }, 200, 'Tâche exécutée avec succès');
          }
        } catch (error) {
          log.error(`Erreur lors de l'exécution de la tâche ${taskId}:`, error);
          
          // Mettre à jour le statut de la tâche en cas d'erreur
          db.run(
            'UPDATE tasks SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['error', JSON.stringify({ error: error.message }), taskId]
          );
          
          return apiResponse.serverError(res, error, 500);
        }
      }
    );
  } catch (error) {
    log.error('Erreur lors de la création de la tâche:', error);
    return apiResponse.serverError(res, error);
  }
});

// GET /api/tasks - Obtenir la liste des tâches
router.get('/', (req, res) => {
  try {
    // ID utilisateur par défaut pour l'authentification simplifiée
    const userId = 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    const db = getDb();
    db.all(
      'SELECT id, type, status, created_at, completed_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset],
      (err, tasks) => {
        if (err) {
          log.error('Erreur lors de la récupération des tâches:', err);
          return apiResponse.serverError(res, err);
        }
        
        // Compter le nombre total de tâches
        db.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?', [userId], (err, result) => {
          if (err) {
            log.error('Erreur lors du comptage des tâches:', err);
            return apiResponse.serverError(res, err);
          }
          
          return apiResponse.success(res, { 
            tasks,
            total: result.count,
            limit,
            offset
          });
        });
      }
    );
  } catch (error) {
    log.error('Erreur lors de la récupération des tâches:', error);
    return apiResponse.serverError(res, error);
  }
});

// Remarque: Route de test déjà définie plus haut dans le fichier

// GET /api/tasks/:id - Obtenir les détails d'une tâche
router.get('/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    // ID utilisateur par défaut pour l'authentification simplifiée
    const userId = 1;
    
    const db = getDb();
    db.get(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, userId],
      (err, task) => {
        if (err) {
          log.error('Erreur lors de la récupération de la tâche:', err);
          return apiResponse.serverError(res, err);
        }
        
        if (!task) {
          return apiResponse.error(res, 'Tâche non trouvée', 404);
        }
        
        // Conversion des chaînes JSON en objets
        try {
          if (task.input) task.input = JSON.parse(task.input);
          if (task.result) task.result = JSON.parse(task.result);
        } catch (error) {
          log.warn('Erreur lors de la conversion JSON pour la tâche', taskId, error);
        }
        
        return apiResponse.success(res, { task });
      }
    );
  } catch (error) {
    log.error('Erreur lors de la récupération de la tâche:', error);
    return apiResponse.serverError(res, error);
  }
});

module.exports = { router, responseCache };