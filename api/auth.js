// FCA-Agent - Routes pour l'authentification par clé API fixe
const express = require('express');
const router = express.Router();
const { createModuleLogger } = require('../utils/logger');
const MODULE_NAME = 'SERVER:API:AUTH';
const log = createModuleLogger(MODULE_NAME);

// GET /api/auth/check - Vérifier si la clé API est valide
router.get('/check', (req, res) => {
  log.info('Vérification de la clé API');
  
  try {
    // Récupérer la clé API du fichier .env
    const apiKey = process.env.API_KEY;
    
    // Vérifier l'en-tête API-Key ou Authorization (pour compatibilité)
    const requestApiKey = req.headers['api-key'] || 
                          (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
                            ? req.headers.authorization.substring(7) 
                            : null);
    
    // Log détaillé des informations d'authentification
    if (requestApiKey) {
      log.info(`API Key: ${requestApiKey.substring(0, 5)}...${requestApiKey.substring(requestApiKey.length-5)}`);
    } else {
      log.info('API Key: absente');
    }
    
    if (!requestApiKey || requestApiKey !== apiKey) {
      log.info('Clé API invalide ou absente');
      // IMPORTANT: Status 200 et authenticated: false
      return res.status(200).json({ authenticated: false });
    }
    
    log.info('Clé API valide');
    // IMPORTANT: Status 200 et authenticated: true
    res.status(200).json({ authenticated: true });
  } catch (error) {
    log.error('Erreur lors de la vérification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;