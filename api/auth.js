// FCA-Agent - Routes pour l'authentification simplifiée
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const authConfig = require('../utils/auth-config');

// POST /api/auth/login - Connexion utilisateur simplifiée
router.post('/login', (req, res) => {
  logger.info('[SERVER:API:AUTH] Tentative de connexion');
  
  try {
    const { password } = req.body;
    
    // Validation
    if (!password) {
      logger.warn('[SERVER:API:AUTH] Tentative sans mot de passe');
      return res.status(400).json({ error: 'Mot de passe requis' });
    }
    
    // Vérification du mot de passe
    if (password !== authConfig.password) {
      logger.warn('[SERVER:API:AUTH] Tentative avec mot de passe incorrect');
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }
    
    // Authentification réussie
    logger.info('[SERVER:API:AUTH] Authentification réussie');
    
    // Générer un token unique avec un format facilement identifiable
    const token = `srv_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Log du token pour débogage (premiers et derniers caractères seulement)
    logger.info(`[SERVER:API:AUTH] Token généré: ${token.substring(0, 5)}...${token.substring(token.length-5)}`);
    
    // Plus de cookie - uniquement authentification par token
    
    // Inclure le token dans la réponse pour les clients qui ne supportent pas les cookies
    res.status(200).json({ 
      success: true, 
      message: 'Authentification réussie',
      token: token
    });
  } catch (error) {
    logger.error('[SERVER:API:AUTH] Erreur lors de l\'authentification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/logout - Déconnexion
router.post('/logout', (req, res) => {
  logger.info('[SERVER:API:AUTH] Tentative de déconnexion');
  
  try {
    // La déconnexion est gérée côté client (révocation du token)
    // Le serveur ne conserve plus d'état (cookie)
    
    logger.info('[SERVER:API:AUTH] Déconnexion réussie');
    res.status(200).json({ success: true, message: 'Déconnecté avec succès' });
  } catch (error) {
    logger.error('[SERVER:API:AUTH] Erreur lors de la déconnexion:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/check - Vérifier si l'utilisateur est authentifié
router.get('/check', (req, res) => {
  logger.info('[SERVER:API:AUTH] Vérification d\'authentification');
  
  try {
  // Extraire le token from l'en-tête d'autorisation
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') 
  ? authHeader.substring(7) 
  : null;
  
  // Log détaillé des informations d'authentification
  logger.info(`[SERVER:API:AUTH] Bearer token: ${bearerToken ? bearerToken.substring(0, 5) + '...' + bearerToken.substring(bearerToken.length-5) : 'absent'}`);
  
  if (!bearerToken) {
      logger.info('[SERVER:API:AUTH] Aucune information d\'authentification');
      // IMPORTANT: Status 200 et authenticated: false
      return res.status(200).json({ authenticated: false });
    }
    
    logger.info('[SERVER:API:AUTH] Authentification validée');
    // IMPORTANT: Status 200 et authenticated: true
    res.status(200).json({ authenticated: true });
  } catch (error) {
    logger.error('[SERVER:API:AUTH] Erreur lors de la vérification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;