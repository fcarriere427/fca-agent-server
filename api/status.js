// FCA-Agent - Routes pour le statut du serveur
const express = require('express');
const router = express.Router();
const { createModuleLogger } = require('../utils/logger');
const MODULE_NAME = 'API:STATUS';
const log = createModuleLogger(MODULE_NAME);
const { getDb } = require('../db/setup');
const apiResponse = require('../utils/api-response');

// GET /api/status - Vérifier l'état du serveur
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    let dbStatus = 'connected';
    
    // Vérifier la connexion à la base de données
    db.get('SELECT 1', (err) => {
      if (err) {
        log.warn('Erreur lors de la vérification de la base de données:', err);
        dbStatus = 'error';
      }
      
      // Vérifier la clé API Claude
      const claudeApiKey = process.env.ANTHROPIC_API_KEY;
      const claudeStatus = claudeApiKey ? 'configured' : 'not_configured';
      
      return apiResponse.success(res, {
        status: 'connected',
        version: '0.1.0',
        uptime: process.uptime(),
        database: dbStatus,
        claude_api: claudeStatus,
        timestamp: new Date().toISOString(),
        debug: false  // Explicitement défini comme false
      }, 200, 'Serveur en ligne');
    });
  } catch (error) {
    log.warn('Erreur lors de la vérification du statut:', error);
    return apiResponse.serverError(res, error, 500);
  }
});

module.exports = router;