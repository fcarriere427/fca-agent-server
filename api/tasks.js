// FCA-Agent - Routes pour les tâches
const express = require('express');
const router = express.Router();
const { logger } = require('../config/logger');
const { getDb } = require('../db/setup');
const claudeService = require('../services/claude-service');

// On importe juste l'authMiddleware comme une fonction
const authMiddleware = require('./auth').authMiddleware;

// Middleware d'authentification pour les routes de tâches - utilisation directe de la fonction
router.use(authMiddleware);

// POST /api/tasks - Créer une nouvelle tâche
router.post('/', async (req, res) => {
  try {
    const { type, data } = req.body;
    const userId = req.user.id;
    
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
          
          // Retourner le résultat
          res.status(200).json({ 
            taskId,
            status,
            result
          });
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
    const userId = req.user.id;
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

// GET /api/tasks/:id - Obtenir les détails d'une tâche
router.get('/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;
    
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

module.exports = router;