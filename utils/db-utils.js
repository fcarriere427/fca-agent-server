// FCA-Agent - Utilitaires pour la base de données avec promesses
const { createModuleLogger } = require('./logger');
const { AppError, ErrorTypes, createDatabaseError } = require('./error');
const { getDb } = require('../db/setup');
const MODULE_NAME = 'UTILS:DB-UTILS';
const log = createModuleLogger(MODULE_NAME);

/**
 * Exécute une requête SQL de type SELECT et retourne tous les résultats
 * @param {string} sql - Requête SQL à exécuter
 * @param {Array} params - Paramètres à passer à la requête
 * @returns {Promise<Array>} - Résultats de la requête
 */
async function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    log.debug(`Exécution de la requête: ${sql}`);
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        log.error(`Erreur de base de données (query): ${err.message}`, { sql, params });
        reject(createDatabaseError(`Erreur lors de l'exécution de la requête: ${sql}`, err));
        return;
      }
      
      log.debug(`Requête exécutée avec succès: ${rows?.length || 0} résultats`);
      resolve(rows);
    });
  });
}

/**
 * Exécute une requête SQL de type SELECT et retourne un seul résultat
 * @param {string} sql - Requête SQL à exécuter
 * @param {Array} params - Paramètres à passer à la requête
 * @returns {Promise<Object|null>} - Résultat de la requête ou null si aucun résultat
 */
async function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    log.debug(`Exécution de la requête (one): ${sql}`);
    
    db.get(sql, params, (err, row) => {
      if (err) {
        log.error(`Erreur de base de données (queryOne): ${err.message}`, { sql, params });
        reject(createDatabaseError(`Erreur lors de l'exécution de la requête: ${sql}`, err));
        return;
      }
      
      log.debug(`Requête exécutée avec succès: ${row ? 'Résultat trouvé' : 'Aucun résultat'}`);
      resolve(row);
    });
  });
}

/**
 * Exécute une requête SQL de modification (INSERT, UPDATE, DELETE)
 * @param {string} sql - Requête SQL à exécuter
 * @param {Array} params - Paramètres à passer à la requête
 * @returns {Promise<Object>} - Informations sur l'opération (lastID, changes)
 */
async function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    log.debug(`Exécution de la commande: ${sql}`);
    
    db.run(sql, params, function(err) {
      if (err) {
        log.error(`Erreur de base de données (run): ${err.message}`, { sql, params });
        reject(createDatabaseError(`Erreur lors de l'exécution de la commande: ${sql}`, err));
        return;
      }
      
      // 'this' contient lastID (pour les INSERT) et changes (nombre de lignes affectées)
      const result = { 
        lastID: this.lastID, 
        changes: this.changes 
      };
      
      log.debug(`Commande exécutée avec succès: ${result.changes} lignes affectées, dernier ID: ${result.lastID}`);
      resolve(result);
    });
  });
}

/**
 * Récupère un enregistrement par ID, avec gestion de l'erreur "non trouvé"
 * @param {string} table - Nom de la table
 * @param {number|string} id - ID de l'enregistrement à récupérer
 * @param {string} [idField='id'] - Nom du champ d'ID
 * @param {string} [entityName] - Nom de l'entité pour le message d'erreur (par défaut: table)
 * @returns {Promise<Object>} - Enregistrement trouvé
 * @throws {AppError} - Erreur NotFound si aucun enregistrement trouvé
 */
async function getById(table, id, idField = 'id', entityName = null) {
  const entity = entityName || table;
  
  const row = await queryOne(`SELECT * FROM ${table} WHERE ${idField} = ?`, [id]);
  
  if (!row) {
    throw new AppError(
      `${entity} avec l'ID ${id} non trouvé(e)`,
      ErrorTypes.NOT_FOUND,
      404,
      { table, id, idField }
    );
  }
  
  return row;
}

/**
 * Vérifie si un enregistrement existe
 * @param {string} table - Nom de la table
 * @param {string} field - Nom du champ à vérifier
 * @param {*} value - Valeur à rechercher
 * @returns {Promise<boolean>} - True si l'enregistrement existe
 */
async function exists(table, field, value) {
  const row = await queryOne(`SELECT 1 FROM ${table} WHERE ${field} = ? LIMIT 1`, [value]);
  return !!row;
}

module.exports = {
  query,
  queryOne,
  run,
  getById,
  exists
};
