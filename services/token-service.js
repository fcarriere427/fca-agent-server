// FCA-Agent - Service de gestion des tokens JWT et Refresh
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb } = require('../db/setup');
const { logger } = require('../config/logger');

// Durée de validité des tokens (en secondes)
const ACCESS_TOKEN_EXPIRATION = process.env.JWT_EXPIRATION || '1h'; // 1 heure par défaut
const REFRESH_TOKEN_EXPIRATION = '30d'; // 30 jours pour refresh token

/**
 * Génération d'un JWT (token d'accès)
 * @param {Object} userData - Données utilisateur à inclure dans le token
 * @returns {String} - Token JWT signé
 */
function generateAccessToken(userData) {
  const jwtSecret = process.env.JWT_SECRET || 'default_secret_key_for_dev';
  
  return jwt.sign(
    { id: userData.id, username: userData.username },
    jwtSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRATION }
  );
}

/**
 * Génération d'un token de rafraîchissement
 * @param {Object} userData - Données utilisateur
 * @param {String} ipAddress - Adresse IP de l'utilisateur
 * @param {String} userAgent - User-Agent du client
 * @returns {Promise<String>} - Token de rafraîchissement
 */
async function generateRefreshToken(userData, ipAddress, userAgent) {
  return new Promise((resolve, reject) => {
    try {
      // Générer un token aléatoire
      const refreshToken = crypto.randomBytes(40).toString('hex');
      
      // Calculer la date d'expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Expire dans 30 jours
      
      const db = getDb();
      
      // Enregistrer le refresh token dans la base de données
      db.run(
        `INSERT INTO refresh_tokens 
        (user_id, token, expires_at, ip_address, user_agent) 
        VALUES (?, ?, ?, ?, ?)`,
        [
          userData.id,
          refreshToken,
          expiresAt.toISOString(),
          ipAddress || 'unknown',
          userAgent || 'unknown'
        ],
        function(err) {
          if (err) {
            logger.error('Erreur lors de la création du refresh token:', err);
            return reject(err);
          }
          
          logger.debug(`Refresh token créé pour l'utilisateur ${userData.username}`);
          resolve(refreshToken);
        }
      );
    } catch (error) {
      logger.error('Erreur lors de la génération du refresh token:', error);
      reject(error);
    }
  });
}

/**
 * Vérification de la validité d'un token de rafraîchissement
 * @param {String} refreshToken - Token de rafraîchissement à vérifier
 * @returns {Promise<Object>} - Données utilisateur si valide
 */
function verifyRefreshToken(refreshToken) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    db.get(
      `SELECT rt.*, u.username 
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = ? AND rt.expires_at > CURRENT_TIMESTAMP
       AND rt.used = 0 AND rt.revoked = 0`,
      [refreshToken],
      (err, token) => {
        if (err) {
          logger.error('Erreur lors de la vérification du refresh token:', err);
          return reject(err);
        }
        
        if (!token) {
          return reject(new Error('Refresh token invalide ou expiré'));
        }
        
        // Marquer le token comme utilisé
        db.run('UPDATE refresh_tokens SET used = 1 WHERE id = ?', [token.id], function(err) {
          if (err) {
            logger.error('Erreur lors de la mise à jour du refresh token:', err);
          }
        });
        
        // Renvoyer les données utilisateur
        resolve({
          id: token.user_id,
          username: token.username
        });
      }
    );
  });
}

/**
 * Révocation de tous les refresh tokens d'un utilisateur
 * @param {Number} userId - ID de l'utilisateur
 * @returns {Promise<void>}
 */
function revokeAllRefreshTokens(userId) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    db.run(
      'UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?',
      [userId],
      function(err) {
        if (err) {
          logger.error('Erreur lors de la révocation des refresh tokens:', err);
          return reject(err);
        }
        
        logger.info(`Tous les refresh tokens de l'utilisateur ${userId} ont été révoqués`);
        resolve();
      }
    );
  });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeAllRefreshTokens
};
