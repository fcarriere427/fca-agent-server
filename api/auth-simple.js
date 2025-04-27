// FCA-Agent - Routes pour l'authentification par clé API fixe (version simplifiée)
const express = require('express');
const router = express.Router();
const { setupAuthRoutes } = require('../utils/auth-simple');

// Configuration des routes d'authentification
setupAuthRoutes(router);

module.exports = router;