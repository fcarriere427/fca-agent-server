// FCA-Agent - Configuration de la base de données
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { logger } = require('../config/logger');

// Chemin vers la base de données
const dbPath = process.env.DB_PATH || path.join(__dirname, 'fca-agent.db');

// Instance de la base de données
let db;

// Initialisation de la base de données
function setupDatabase() {
  return new Promise((resolve, reject) => {
    logger.info(`Initialisation de la base de données: ${dbPath}`);
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('Erreur lors de la connexion à la base de données:', err);
        return reject(err);
      }
      
      logger.info('Connexion à la base de données établie');
      
      // Création des tables
      db.serialize(() => {
        // Table des utilisateurs
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          email TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          last_login TEXT
        )`, (err) => {
          if (err) {
            logger.error('Erreur lors de la création de la table users:', err);
            return reject(err);
          }
        });
        
        // Vérifier si la colonne last_activity existe déjà
        db.all("PRAGMA table_info(users)", (err, rows) => {
          if (err) {
            logger.error('Erreur lors de la vérification du schéma:', err);
          } else {
            // Vérifier si last_activity existe dans les colonnes
            const hasLastActivity = rows.some(row => row.name === 'last_activity');
            
            if (!hasLastActivity) {
              logger.info('Ajout de la colonne last_activity à la table users');
              
              // Ajouter la colonne manquante
              db.run('ALTER TABLE users ADD COLUMN last_activity TEXT', (err) => {
                if (err) {
                  logger.error('Erreur lors de l\'ajout de la colonne last_activity:', err);
                } else {
                  logger.info('Colonne last_activity ajoutée avec succès');
                }
              });
            }
          }
        });
        
        // Table des tâches
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          input TEXT,
          result TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          completed_at TEXT,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`, (err) => {
          if (err) {
            logger.error('Erreur lors de la création de la table tasks:', err);
            return reject(err);
          }
        });
        
        // Table des refresh tokens
        db.run(`CREATE TABLE IF NOT EXISTS refresh_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          used BOOLEAN DEFAULT 0,
          revoked BOOLEAN DEFAULT 0,
          ip_address TEXT,
          user_agent TEXT,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`, (err) => {
          if (err) {
            logger.error('Erreur lors de la création de la table refresh_tokens:', err);
            return reject(err);
          }
        });
        
        // Table des configurations
        db.run(`CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          key TEXT NOT NULL,
          value TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          UNIQUE(user_id, key)
        )`, (err) => {
          if (err) {
            logger.error('Erreur lors de la création de la table settings:', err);
            return reject(err);
          }
          
          logger.info('Tables créées avec succès');
          resolve();
        });
      });
    });
  });
}

// Obtenir l'instance de la base de données
function getDb() {
  if (!db) {
    throw new Error('La base de données n\'est pas initialisée');
  }
  return db;
}

// Fermer la connexion à la base de données
function closeDb() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          logger.error('Erreur lors de la fermeture de la base de données:', err);
          return reject(err);
        }
        logger.info('Connexion à la base de données fermée');
        db = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  setupDatabase,
  getDb,
  closeDb
};