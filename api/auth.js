// FCA-Agent - Routes pour l'authentification simplifiée par clé API fixe
const express = require('express');
const router = express.Router();
const { createModuleLogger } = require('../utils/logger');
const MODULE_NAME = 'SERVER:API:AUTH';
const log = createModuleLogger(MODULE_NAME);

// GET /api/auth/key - Récupérer la clé API (maintenu pour compatibilité avec l'ancienne extension)
router.post('/login', (req, res) => {
  log.info('Tentative de connexion avec l\'ancien système');
  
  try {
    const { password } = req.body;
    
    // Validation
    if (!password) {
      log.warn('Tentative sans mot de passe');
      return res.status(400).json({ error: 'Mot de passe requis' });
    }
    
    // Vérification du mot de passe (pour rétrocompatibilité)
    if (password !== process.env.AUTH_PASSWORD) {
      log.warn('Tentative avec mot de passe incorrect');
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }
    
    // Authentification réussie
    log.info('Authentification réussie - distribution de la clé API fixe');
    
    // Utiliser la clé API fixe comme token
    const apiKey = process.env.API_KEY;
    
    // Log de la clé API pour débogage (premiers et derniers caractères seulement)
    log.info(`API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length-5)}`);
    
    // Renvoyer la clé API fixe à l'extension
    res.status(200).json({ 
      success: true, 
      message: 'Authentification réussie',
      token: apiKey // Utiliser la clé API comme token pour rétrocompatibilité
    });
  } catch (error) {
    log.error('Erreur lors de l\'authentification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/logout - Déconnexion (conservé pour compatibilité)
router.post('/logout', (req, res) => {
  log.info('Tentative de déconnexion (opération simulue avec clé API fixe)');
  
  // Avec une clé API fixe, pas besoin de réellement faire quoi que ce soit
  res.status(200).json({ 
    success: true, 
    message: 'Déconnecté avec succès' 
  });
});

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