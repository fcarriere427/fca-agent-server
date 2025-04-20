// FCA-Agent - Routes pour l'authentification
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { logger } = require('../config/logger');
const { getDb } = require('../db/setup');
const authMiddleware = require('../middleware/auth');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken, 
  revokeAllRefreshTokens 
} = require('../services/token-service');

// POST /api/auth/refresh - Rafraîchir le token d'accès en utilisant le refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requis' });
    }
    
    try {
      // Vérifier le refresh token et récupérer les données utilisateur
      const userData = await verifyRefreshToken(refreshToken);
      
      // Générer un nouveau token d'accès
      const newAccessToken = generateAccessToken(userData);
      
      // Générer un nouveau refresh token
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const newRefreshToken = await generateRefreshToken(userData, ipAddress, userAgent);
      
      logger.info(`Tokens rafraîchis pour l'utilisateur ${userData.username} (id: ${userData.id})`);
      
      // Renvoyer les nouveaux tokens
      res.status(200).json({
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: userData
      });
      
    } catch (error) {
      logger.error('Erreur de validation du refresh token:', error.message);
      return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
    }
  } catch (error) {
    logger.error('Erreur lors du rafraîchissement du token:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

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
        
        // Récupération de l'IP et de l'User-Agent pour le refresh token
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        
        // Génération du token d'accès (JWT)
        const accessToken = generateAccessToken(user);
        
        // Génération du refresh token
        const refreshToken = await generateRefreshToken(user, ipAddress, userAgent);
        
        logger.info(`Tokens générés pour ${username} (id: ${user.id})`);
        
        // Mise à jour de la date de dernière connexion
        db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        
        logger.info(`Utilisateur connecté: ${username} (id: ${user.id})`);
        const responseData = { 
          success: true,
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            username: user.username
          }
        };
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

// POST /api/auth/logout - Déconnexion et révocation des refresh tokens
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { refreshToken } = req.body;
    
    // Si un refresh token spécifique est fourni, révoquer seulement celui-ci
    if (refreshToken) {
      const db = getDb();
      
      db.run(
        'UPDATE refresh_tokens SET revoked = 1 WHERE token = ? AND user_id = ?',
        [refreshToken, userId],
        function(err) {
          if (err) {
            logger.error('Erreur lors de la révocation du refresh token:', err);
            return res.status(500).json({ error: 'Erreur serveur' });
          }
          
          logger.info(`Refresh token révoqué pour l'utilisateur ${req.user.username}`);
          res.status(200).json({ success: true, message: 'Déconnecté avec succès' });
        }
      );
    } else {
      // Si aucun refresh token n'est spécifié, révoquer tous les refresh tokens de l'utilisateur
      await revokeAllRefreshTokens(userId);
      
      logger.info(`Tous les refresh tokens révoqués pour l'utilisateur ${req.user.username}`);
      res.status(200).json({ success: true, message: 'Déconnecté de tous les appareils avec succès' });
    }
  } catch (error) {
    logger.error('Erreur lors de la déconnexion:', error);
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