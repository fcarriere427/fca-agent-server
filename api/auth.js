// FCA-Agent - Routes pour l'authentification
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');
const { getDb } = require('../db/setup');
const authMiddleware = require('../middleware/auth');

// Route de débogage - Vérifier un token JWT
router.post('/verify-token', (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token requis' });
    }
    
    // Vérifier le token
    jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key_for_dev', (err, decoded) => {
      if (err) {
        logger.error(`Erreur de vérification du token: ${err.name} - ${err.message}`);
        
        return res.status(200).json({ 
          valid: false, 
          error: err.name, 
          message: err.message 
        });
      }
      
      return res.status(200).json({ 
        valid: true, 
        decoded: {
          id: decoded.id,
          username: decoded.username,
          exp: decoded.exp,
          iat: decoded.iat
        }
      });
    });
  } catch (error) {
    logger.error('Erreur lors de la vérification du token:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

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
        
        logger.info(`Token JWT généré pour ${username} (id: ${user.id})`);
        
        // Mise à jour de la date de dernière connexion
        db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        
        logger.info(`Utilisateur connecté: ${username} (id: ${user.id})`);
        const responseData = { 
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username
          }
        };
        logger.info(`Données de réponse: ${JSON.stringify(responseData)}`);
        res.status(200).json(responseData);
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
    logger.info(`Récupération du profil pour l'utilisateur ${req.user.username} (id: ${req.user.id})`);
    const db = getDb();
    
    db.get('SELECT id, username, email, created_at, last_login, last_activity FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err) {
        logger.error('Erreur lors de la récupération du profil:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      if (!user) {
        logger.error(`Utilisateur id=${req.user.id} non trouvé dans la base de données`);
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      // Compter le nombre total de tâches
      db.get('SELECT COUNT(*) as taskCount FROM tasks WHERE user_id = ?', [req.user.id], (err, taskStats) => {
        if (err) {
          logger.error('Erreur lors du comptage des tâches:', err);
          return res.status(200).json({ user }); // On continue malgré l'erreur
        }
        
        // Renvoyer le profil avec les statistiques
        res.status(200).json({
          user,
          stats: {
            taskCount: taskStats ? taskStats.taskCount : 0
          }
        });
      });
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/change-password - Changer le mot de passe
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
    }
    
    const db = getDb();
    
    // Vérifier le mot de passe actuel
    db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id], async (err, user) => {
      if (err) {
        logger.error('Erreur lors de la vérification du mot de passe:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      try {
        // Vérifier si le mot de passe actuel est correct
        const match = await bcrypt.compare(currentPassword, user.password_hash);
        
        if (!match) {
          return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
        }
        
        // Hacher le nouveau mot de passe
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
        
        // Mettre à jour le mot de passe
        db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, req.user.id], function(err) {
          if (err) {
            logger.error('Erreur lors de la mise à jour du mot de passe:', err);
            return res.status(500).json({ error: 'Erreur serveur' });
          }
          
          logger.info(`Mot de passe changé pour l'utilisateur ${req.user.username} (id: ${req.user.id})`);
          res.status(200).json({ success: true, message: 'Mot de passe mis à jour avec succès' });
        });
      } catch (error) {
        logger.error('Erreur lors du changement de mot de passe:', error);
        res.status(500).json({ error: 'Erreur serveur' });
      }
    });
  } catch (error) {
    logger.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;