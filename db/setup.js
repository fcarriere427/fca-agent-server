// FCA-Agent - Configuration de base de données simplifiée
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { createModuleLogger } = require('../utils/logger');
const MODULE_NAME = 'DB:SETUP';
const log = createModuleLogger(MODULE_NAME);

// Chemin vers la base de données
const dbPath = process.env.DB_PATH || path.join(__dirname, 'fca-agent.db');

// Instance de la base de données
let db;

/**
 * Exécute une requête SQL dans une transaction
 * @param {string} sql - Requête SQL à exécuter
 * @returns {Promise<void>}
 */
async function runQuery(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) {
        log.error(`Erreur lors de l'exécution de la requête: ${sql}`, err);
        reject(err);
        return;
      }
      resolve();
    });
  });
}

/**
 * Initialisation de la base de données
 * @returns {Promise<void>}
 */
async function setupDatabase() {
  try {
    log.info(`Initialisation de la base de données: ${dbPath}`);
    
    // Créer une connexion à la base de données
    await connectToDatabase();
    
    // Créer les tables nécessaires
    await createTables();
    
    log.info('Base de données initialisée avec succès');
  } catch (error) {
    log.error('Erreur lors de l\'initialisation de la base de données:', error);
    throw error;
  }
}

/**
 * Établit une connexion à la base de données
 * @returns {Promise<void>}
 */
async function connectToDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        log.error('Erreur lors de la connexion à la base de données:', err);
        reject(err);
        return;
      }
      
      log.info('Connexion à la base de données établie');
      resolve();
    });
  });
}

/**
 * Crée les tables nécessaires dans la base de données
 * @returns {Promise<void>}
 */
async function createTables() {
  try {
    // Table des tâches
    await runQuery(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      input TEXT,
      result TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`);
    
    // Table des configurations
    await runQuery(`CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    
    log.info('Tables créées avec succès');
  } catch (error) {
    log.error('Erreur lors de la création des tables:', error);
    throw error;
  }
}

/**
 * Obtenir l'instance de la base de données
 * @returns {sqlite3.Database} Instance de la base de données
 * @throws {Error} Si la base de données n'est pas initialisée
 */
function getDb() {
  if (!db) {
    throw new Error('La base de données n\'est pas initialisée');
  }
  return db;
}

/**
 * Fermer la connexion à la base de données
 * @returns {Promise<void>}
 */
async function closeDb() {
  if (!db) {
    return;
  }
  
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        log.error('Erreur lors de la fermeture de la base de données:', err);
        reject(err);
        return;
      }
      
      log.info('Connexion à la base de données fermée');
      db = null;
      resolve();
    });
  });
}

module.exports = {
  setupDatabase,
  getDb,
  closeDb
};
