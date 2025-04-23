// FCA-Agent - Route de test pour l'API Claude
const express = require('express');
const router = express.Router();
const { processMessage } = require('../services/claude-service');
const { logger } = require('../utils/logger');

// Route simple pour tester l'API Claude
router.post('/test', async (req, res) => {
  try {
    // Message simple pour tester l'API
    const testMessage = req.body.message || "Bonjour, ceci est un test de l'API Claude. Peux-tu confirmer que tu me reçois?";
    
    logger.info(`Test de l'API Claude avec le message: "${testMessage.substring(0, 50)}..."`);
    
    // Appel au service Claude
    const result = await processMessage(testMessage);
    
    // Réponse avec les détails
    res.status(200).json({
      status: 'success',
      message: 'API Claude connectée avec succès',
      response: result.response,
      model: result.model,
      usage: result.usage
    });
    
  } catch (error) {
    logger.error('Erreur lors du test de l\'API Claude:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Échec de connexion à l\'API Claude',
      error: error.message
    });
  }
});

module.exports = router;