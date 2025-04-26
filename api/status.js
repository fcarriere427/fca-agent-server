// FCA-Agent - Routes pour le statut du serveur
const express = require('express');
const router = express.Router();
const { createModuleLogger } = require('../utils/logger');
const MODULE_NAME = 'SERVER:API:STATUS';
const log = createModuleLogger(MODULE_NAME);
const { getDb } = require('../db/setup');

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
      
      res.status(200).json({
        status: 'connected',
        version: '0.1.0',
        uptime: process.uptime(),
        database: dbStatus,
        claude_api: claudeStatus,
        timestamp: new Date().toISOString(),
        debug: false  // Explicitement défini comme false
      });
    });
  } catch (error) {
    log.warn('Erreur lors de la vérification du statut:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;