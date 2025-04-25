// FCA-Agent - Routes pour l'authentification simplifiée
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const authConfig = require('../utils/auth-config');

// POST /api/auth/login - Connexion utilisateur simplifiée
router.post('/login', (req, res) => {
  try {
    const { password } = req.body;
    
    // Validation
    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }
    
    // Vérification simple du mot de passe
    if (password !== authConfig.password) {
      logger.warn('Tentative de connexion avec mot de passe incorrect');
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }
    
    // Authentification réussie
    logger.info('Authentification réussie');
    
    // Définir un cookie d'authentification avec config CORS-friendly
    res.cookie(authConfig.cookieName, 'authenticated', {
      maxAge: authConfig.cookieMaxAge,
      httpOnly: true,
      sameSite: 'none',  // nécessaire pour CORS avec credentials
      secure: true       // requis avec sameSite: 'none'
    });
    
    // Répondre avec succès
    res.status(200).json({ 
      success: true, 
      message: 'Authentification réussie'
    });
  } catch (error) {
    logger.error('Erreur lors de l\'authentification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/logout - Déconnexion
router.post('/logout', (req, res) => {
  try {
    // Supprimer le cookie d'authentification
    res.clearCookie(authConfig.cookieName);
    
    logger.info('Déconnexion réussie');
    res.status(200).json({ success: true, message: 'Déconnecté avec succès' });
  } catch (error) {
    logger.error('Erreur lors de la déconnexion:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/check - Vérifier si l'utilisateur est authentifié
router.get('/check', (req, res) => {
  try {
    // Vérifier si le cookie d'authentification existe
    const authCookie = req.cookies[authConfig.cookieName];
    
    if (!authCookie) {
      return res.status(200).json({ authenticated: false });
    }
    
    res.status(200).json({ authenticated: true });
  } catch (error) {
    logger.error('Erreur lors de la vérification de l\'authentification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;