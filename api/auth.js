// FCA-Agent - Routes pour l'authentification
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');
const { getDb } = require('../db/setup');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/register - Enregistrement d'un utilisateur
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }
    
    const db = getDb();
    
    // Vérifier si l'utilisateur existe déjà
    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
      if (err) {
        logger.error('Erreur lors de la vérification de l\'utilisateur:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      if (row) {
        return res.status(400).json({ error: 'Cet utilisateur existe déjà' });
      }
      
      try {
        // Hachage du mot de passe
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Insertion de l'utilisateur
        db.run(
          'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
          [username, passwordHash, email || ''],
          function(err) {
            if (err) {
              logger.error('Erreur lors de la création de l\'utilisateur:', err);
              return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            logger.info(`Nouvel utilisateur créé: ${username} (id: ${this.lastID})`);
            res.status(201).json({ 
              success: true, 
              message: 'Utilisateur créé avec succès',
              userId: this.lastID
            });
          }
        );
      } catch (error) {
        logger.error('Erreur lors du hachage du mot de passe:', error);
        res.status(500).json({ error: 'Erreur serveur' });
      }
    });
  } catch (error) {
    logger.error('Erreur lors de l\'enregistrement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login - Connexion utilisateur
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }
    
    const db = getDb();
    
    // Recherche de l'utilisateur
    db.get('SELECT id, username, password_hash FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        logger.error('Erreur lors de la recherche de l\'utilisateur:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }
      
      try {
        // Vérification du mot de passe
        const match = await bcrypt.compare(password, user.password_hash);
        
        if (!match) {
          return res.status(401).json({ error: 'Identifiants invalides' });
        }
        
        // Création du token JWT
        const token = jwt.sign(
          { id: user.id, username: user.username },
          process.env.JWT_SECRET || 'default_secret_key_for_dev',
          { expiresIn: process.env.JWT_EXPIRATION || '1d' }
        );
        
        // Mise à jour de la date de dernière connexion
        db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        
        logger.info(`Utilisateur connecté: ${username} (id: ${user.id})`);
        res.status(200).json({ 
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username
          }
        });
      } catch (error) {
        logger.error('Erreur lors de la vérification du mot de passe:', error);
        res.status(500).json({ error: 'Erreur serveur' });
      }
    });
  } catch (error) {
    logger.error('Erreur lors de la connexion:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/profile - Obtenir le profil utilisateur
router.get('/profile', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    
    db.get('SELECT id, username, email, created_at, last_login FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err) {
        logger.error('Erreur lors de la récupération du profil:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      res.status(200).json({ user });
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;