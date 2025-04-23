// FCA-Agent - Configuration de base de données simplifiée
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { logger } = require('../utils/logger');

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
        // Table des tâches
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          input TEXT,
          result TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          completed_at TEXT
        )`, (err) => {
          if (err) {
            logger.error('Erreur lors de la création de la table tasks:', err);
            return reject(err);
          }
        });
        
        // Table des configurations
        db.run(`CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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