// FCA-Agent - Routes pour les tâches
const express = require('express');
const router = express.Router();
const { 
  logger,
  logResponseCache, 
  logResponseSent, 
  logResponseRequest,
  logClaudeResponse 
} = require('../utils/logger');
const { getDb } = require('../db/setup');
const claudeService = require('../services/claude-service');
const authMiddleware = require('../utils/auth');

// Stockage temporaire des réponses complètes
const responseCache = {};

// Middleware d'authentification pour les routes de tâches
router.use(authMiddleware);

// GET /api/tasks/hello - Route de test simple
router.get('/hello', (req, res) => {
  // Définir les en-têtes CORS pour permettre l'accès depuis n'importe quelle origine
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Envoyer une réponse simple
  res.send('Hello World - Test de l\'API réussi !');
  
  logger.info('Route de test /hello appelée avec succès');
});

// POST /api/tasks - Créer une nouvelle tâche
router.post('/', async (req, res) => {
  try {
    const { type, data } = req.body;
    // ID utilisateur par défaut pour l'authentification simplifiée
    const userId = 1; // On utilise un ID fixe puisque simple-auth n'utilise pas d'ID utilisateur
    
    // Validation
    if (!type) {
      return res.status(400).json({ error: 'Type de tâche requis' });
    }
    
    // Enregistrer la tâche dans la base de données
    const db = getDb();
    db.run(
      'INSERT INTO tasks (user_id, type, status, input) VALUES (?, ?, ?, ?)',
      [userId, type, 'pending', JSON.stringify(data)],
      async function(err) {
        if (err) {
          logger.error('Erreur lors de la création de la tâche:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        const taskId = this.lastID;
        logger.info(`Nouvelle tâche créée: ${type} (id: ${taskId})`);
        
        try {
          // Traitement de la tâche en fonction de son type
          let result;
          
          switch (type) {
            case 'processUserInput':
              result = await claudeService.processMessage(data.input);
              break;
            case 'email-summary':
              result = await claudeService.summarizeEmails(data.prompt);
              break;
            case 'gmail-summary':
              result = await claudeService.summarizeGmailEmails(data.emails, data.searchQuery);
              break;
            case 'teams-summary':
              result = await claudeService.summarizeTeams(data.prompt);
              break;
            case 'draft-email':
              result = await claudeService.draftEmail(data.prompt);
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
            logger.info(`Réponse mise en cache: ID=${responseId}, longueur=${safeResponse.length} caractères`);
            logResponseCache(responseId, safeResponse.length);
            
            // Créer un fichier log des clés du cache pour debugging
            const cacheKeys = Object.keys(responseCache);
            logger.info(`Clés disponibles dans le cache: ${cacheKeys.join(', ')}`);
            
            // Supprimer la cache après 10 minutes
            setTimeout(() => {
              delete responseCache[responseId];
              logger.info(`Cache supprimée pour ${responseId}`);
            }, 10 * 60 * 1000);
            
            // Renvoyer une référence à la réponse complète au lieu de la réponse elle-même
            res.status(200).json({ 
              taskId,
              status,
              responseId,
              // Envoyer un court aperçu de la réponse - s'assurer qu'il est correctement encodé
              preview: safeResponse.substring(0, 100) + '...',
              fullResponseAvailable: true
            });
          } else {
            // Si pas de réponse ou réponse courte, renvoyer directement
            res.status(200).json({ 
              taskId,
              status,
              result
            });
          }
        } catch (error) {
          logger.error(`Erreur lors de l'exécution de la tâche ${taskId}:`, error);
          
          // Mettre à jour le statut de la tâche en cas d'erreur
          db.run(
            'UPDATE tasks SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['error', JSON.stringify({ error: error.message }), taskId]
          );
          
          res.status(500).json({ 
            error: 'Erreur lors de l\'exécution de la tâche',
            message: error.message
          });
        }
      }
    );
  } catch (error) {
    logger.error('Erreur lors de la création de la tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
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
          logger.error('Erreur lors de la récupération des tâches:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        // Compter le nombre total de tâches
        db.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?', [userId], (err, result) => {
          if (err) {
            logger.error('Erreur lors du comptage des tâches:', err);
            return res.status(500).json({ error: 'Erreur serveur' });
          }
          
          res.status(200).json({ 
            tasks,
            total: result.count,
            limit,
            offset
          });
        });
      }
    );
  } catch (error) {
    logger.error('Erreur lors de la récupération des tâches:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/tasks/response/:id - Récupérer une réponse cachée par ID
router.get('/response/:id', (req, res) => {
  try {
    const responseId = req.params.id;
    
    // Log détaillé de la requête
    logger.info(`[DEBUG] Requête de réponse reçue pour ID: ${responseId}`);
    logger.info(`[DEBUG] Headers de la requête: ${JSON.stringify(req.headers)}`);
    
    // Log du contenu actuel du cache
    const cacheKeys = Object.keys(responseCache);
    logger.info(`[DEBUG] Clés actuellement en cache: ${cacheKeys.join(', ')}`);
    logger.info(`[DEBUG] Vérification si ${responseId} existe dans le cache: ${responseCache[responseId] ? 'OUI' : 'NON'}`);
    
    logResponseRequest(responseId);
    
    // Vérifier si la réponse existe dans le cache
    if (!responseCache[responseId]) {
      logger.error(`Réponse non trouvée dans le cache: ${responseId}`);
      return res.status(404).json({ error: 'Réponse non trouvée ou expirée' });
    }
    
    // Log détaillé de la réponse avant envoi
    logger.info(`Envoi de réponse complète depuis le cache: ID=${responseId}, longueur=${responseCache[responseId].length}`);
    logger.info(`[DEBUG] Type de contenu de la réponse: ${typeof responseCache[responseId]}`);
    logger.info(`[DEBUG] Début de la réponse: ${responseCache[responseId].substring(0, 50)}...`);
    
    // Log complet des headers qui seront envoyés
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-Response-Id', responseId);
    res.setHeader('X-Response-Length', responseCache[responseId].length.toString());
    
    // Ajouter des en-têtes CORS très permissifs
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Max-Age', '3600');
    
    logger.info(`[DEBUG] Headers de réponse: ${JSON.stringify(res.getHeaders())}`);
    
    logResponseSent(responseId, responseCache[responseId].length);
    
    // Envoyer la réponse en format texte brut
    res.status(200).send(responseCache[responseId]);
    
    logger.info(`[DEBUG] Réponse envoyée avec succès pour ${responseId}`);
  } catch (error) {
    logger.error(`[DEBUG] Erreur lors de la récupération de la réponse cachée: ${error.message}`, error);
    logger.error(`[DEBUG] Stack trace: ${error.stack}`);
    res.status(500).json({ error: 'Erreur serveur', message: error.message });
  }
});

// Route simple pour tester la communication
router.get('/hello', (req, res) => {
  console.log('Route /hello appelée');
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.send('Hello World from FCA-Agent server');
});

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
          logger.error('Erreur lors de la récupération de la tâche:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        if (!task) {
          return res.status(404).json({ error: 'Tâche non trouvée' });
        }
        
        // Conversion des chaînes JSON en objets
        try {
          if (task.input) task.input = JSON.parse(task.input);
          if (task.result) task.result = JSON.parse(task.result);
        } catch (error) {
          logger.warn('Erreur lors de la conversion JSON pour la tâche', taskId, error);
        }
        
        res.status(200).json({ task });
      }
    );
  } catch (error) {
    logger.error('Erreur lors de la récupération de la tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajout d'une route de secours pour tester le système de réponse
router.get('/test/cache-status', (req, res) => {
  try {
    const cacheKeys = Object.keys(responseCache);
    const cacheStatus = cacheKeys.map(key => ({
      id: key,
      length: responseCache[key] ? responseCache[key].length : 0,
      preview: responseCache[key] ? responseCache[key].substring(0, 50) + '...' : 'Vide'
    }));
    
    res.status(200).json({
      cacheSize: cacheKeys.length,
      entries: cacheStatus
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération du statut du cache:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = { router, responseCache };