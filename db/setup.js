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