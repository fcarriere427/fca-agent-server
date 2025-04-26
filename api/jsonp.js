// FCA-Agent - Routes JSONP pour une communication plus simple
const express = require('express');
const router = express.Router();
const { createModuleLogger } = require('../utils/logger');
const MODULE_NAME = 'SERVER:API:JSONP';
const log = createModuleLogger(MODULE_NAME);

// Référence au cache de réponse (à récupérer depuis tasks.js)
let responseCache = {};

// Initialiser le cache en référence à celui de tasks.js
const initializeCache = (cache) => {
  responseCache = cache;
  log.info('Initalisation du cache JSONP : OK');
};

// GET /api/jsonp/response/:id - Récupérer une réponse cachée par ID en format JSONP
router.get('/response/:id', (req, res) => {
  try {
    const responseId = req.params.id;
    const callback = req.query.callback || 'handleResponse'; // Fonction callback côté client
    
    log.info(`Requête de réponse reçue pour ID: ${responseId}, callback: ${callback}`);
    
    // Log du contenu actuel du cache
    const cacheKeys = Object.keys(responseCache);
    log.info(`Clés en cache: ${cacheKeys.join(', ')}`);
    log.info(`Vérification si ${responseId} existe dans le cache: ${responseCache[responseId] ? 'OUI' : 'NON'}`);
    
    // Vérifier si la réponse existe dans le cache
    if (!responseCache[responseId]) {
      log.error(`Réponse non trouvée dans le cache: ${responseId}`);
      return res.send(`${callback}({"error": "Réponse non trouvée ou expirée"})`);
    }
    
    // Préparer la réponse en échappant les caractères spéciaux
    const response = responseCache[responseId]
      .replace(/\\/g, '\\\\')  // Échapper les backslashes
      .replace(/"/g, '\\"')    // Échapper les guillemets
      .replace(/\n/g, '\\n')   // Échapper les sauts de ligne
      .replace(/\r/g, '\\r')   // Échapper les retours chariot
      .replace(/\t/g, '\\t')   // Échapper les tabulations
      .replace(/\f/g, '\\f');  // Échapper les sauts de page
    
    // Log détaillé de la réponse avant envoi
    log.info(`Envoi de réponse complète: ID=${responseId}, longueur=${response.length}`);
    
    // Envoyer la réponse en format JSONP
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`${callback}({"response": "${response}"})`);
    
    log.info(`Réponse envoyée avec succès pour ${responseId}`);
  } catch (error) {
    log.error(`Erreur lors de la récupération: ${error.message}`, error);
    const callback = req.query.callback || 'handleResponse';
    res.send(`${callback}({"error": "Erreur serveur: ${error.message}"})`);
  }
});

// GET /api/jsonp/status - Vérifier le statut du serveur
router.get('/status', (req, res) => {
  const callback = req.query.callback || 'handleStatus';
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`${callback}({"status": "ok", "cacheSize": ${Object.keys(responseCache).length}})`);
});

// GET /api/jsonp/cache-keys - Récupérer les clés du cache
router.get('/cache-keys', (req, res) => {
  const callback = req.query.callback || 'handleCacheKeys';
  const keys = Object.keys(responseCache);
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`${callback}({"keys": ${JSON.stringify(keys)}})`);
});

// GET /api/jsonp/direct-text/:id - Route alternative qui retourne directement le texte
router.get('/direct-text/:id', (req, res) => {
  try {
    const responseId = req.params.id;
    
    // Vérifier si la réponse existe dans le cache
    if (!responseCache[responseId]) {
      const directLogger = createModuleLogger('SERVER:JSONP:DIRECT');
      directLogger.error(`Réponse non trouvée dans le cache: ${responseId}`);
      return res.status(404).send('Réponse non trouvée ou expirée');
    }
    
    // Log détaillé de la réponse avant envoi
    const directLogger = createModuleLogger('SERVER:JSONP:DIRECT');
    directLogger.info(`Envoi de réponse directe: ID=${responseId}, longueur=${responseCache[responseId].length}`);
    
    // Envoyer la réponse en format texte brut
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.send(responseCache[responseId]);
    
    directLogger.info(`Réponse directe envoyée avec succès pour ${responseId}`);
  } catch (error) {
    const directLogger = createModuleLogger('SERVER:JSONP:DIRECT');
    directLogger.error(`Erreur lors de l'envoi direct: ${error.message}`, error);
    res.status(500).send(`Erreur serveur: ${error.message}`);
  }
});

// GET /api/jsonp/iframe/:id - Route pour afficher la réponse dans un iframe
router.get('/iframe/:id', (req, res) => {
  try {
    const responseId = req.params.id;
    
    // Vérifier si la réponse existe dans le cache
    if (!responseCache[responseId]) {
      const iframeLogger = createModuleLogger('SERVER:JSONP:IFRAME');
      iframeLogger.error(`Réponse non trouvée dans le cache: ${responseId}`);
      return res.status(404).send('Réponse non trouvée ou expirée');
    }
    
    // Log détaillé de la réponse avant envoi
    const iframeLogger = createModuleLogger('SERVER:JSONP:IFRAME');
    iframeLogger.info(`Envoi de réponse HTML: ID=${responseId}, longueur=${responseCache[responseId].length}`);
    
    // Créer une page HTML simple avec la réponse
    const htmlResponse = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réponse FCA-Agent</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            line-height: 1.6;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            border: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        <h2>Réponse complète</h2>
        <pre>${responseCache[responseId].replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        <p><small>ID: ${responseId}</small></p>
      </body>
      </html>
    `;
    
    // Envoyer la réponse en format HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlResponse);
    
    iframeLogger.info(`Réponse HTML envoyée avec succès pour ${responseId}`);
  } catch (error) {
    const iframeLogger = createModuleLogger('SERVER:JSONP:IFRAME');
    iframeLogger.error(`Erreur lors de l'envoi HTML: ${error.message}`, error);
    res.status(500).send(`<html><body><h1>Erreur serveur</h1><p>${error.message}</p></body></html>`);
  }
});

// GET /api/jsonp/simple-page - Page de test simple
router.get('/simple-page', (req, res) => {
  const htmlResponse = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FCA-Agent - Test de récupération de réponse</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          color: #333;
        }
        .input-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        input[type="text"] {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        button {
          background-color: #4CAF50;
          border: none;
          color: white;
          padding: 10px 15px;
          text-align: center;
          text-decoration: none;
          display: inline-block;
          font-size: 16px;
          margin: 4px 2px;
          cursor: pointer;
          border-radius: 4px;
        }
        pre {
          white-space: pre-wrap;
          word-wrap: break-word;
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 5px;
          border: 1px solid #ddd;
          max-height: 300px;
          overflow: auto;
        }
        .status {
          margin-top: 20px;
          padding: 10px;
          background-color: #f0f0f0;
          border-radius: 5px;
        }
      </style>
    </head>
    <body>
      <h1>FCA-Agent - Test de récupération de réponse</h1>
      
      <div class="input-group">
        <label for="response-id">ID de réponse:</label>
        <input type="text" id="response-id" placeholder="response_123_1712345678900">
      </div>
      
      <button onclick="getDirectResponse()">Récupérer la réponse (Texte direct)</button>
      <button onclick="getJSONPResponse()">Récupérer la réponse (JSONP)</button>
      <button onclick="showInIframe()">Afficher dans un iframe</button>
      <button onclick="checkCacheKeys()">Vérifier les clés en cache</button>
      
      <div class="status" id="status">
        Statut: En attente...
      </div>
      
      <h2>Réponse:</h2>
      <pre id="response">Aucune réponse récupérée</pre>
      
      <div id="iframe-container" style="display: none; margin-top: 20px;">
        <h2>Réponse dans iframe:</h2>
        <iframe id="response-iframe" style="width: 100%; height: 400px; border: 1px solid #ddd;"></iframe>
      </div>
      
      <script>
        // Récupérer la réponse en texte direct
        function getDirectResponse() {
          const responseId = document.getElementById('response-id').value.trim();
          if (!responseId) {
            updateStatus('Veuillez saisir un ID de réponse');
            return;
          }
          
          updateStatus('Récupération de la réponse en cours...');
          
          fetch('/api/jsonp/direct-text/' + responseId)
            .then(response => {
              if (!response.ok) {
                throw new Error('Erreur HTTP: ' + response.status);
              }
              return response.text();
            })
            .then(text => {
              document.getElementById('response').textContent = text;
              updateStatus('Réponse récupérée avec succès (longueur: ' + text.length + ' caractères)');
            })
            .catch(error => {
              document.getElementById('response').textContent = 'Erreur: ' + error.message;
              updateStatus('Erreur: ' + error.message);
            });
        }
        
        // Récupérer la réponse en JSONP
        function getJSONPResponse() {
          const responseId = document.getElementById('response-id').value.trim();
          if (!responseId) {
            updateStatus('Veuillez saisir un ID de réponse');
            return;
          }
          
          updateStatus('Récupération de la réponse en cours (JSONP)...');
          
          // Supprimer l'ancien script s'il existe
          const oldScript = document.getElementById('jsonp-script');
          if (oldScript) {
            document.head.removeChild(oldScript);
          }
          
          // Définir la fonction de callback
          window.handleResponse = function(data) {
            if (data.error) {
              document.getElementById('response').textContent = 'Erreur: ' + data.error;
              updateStatus('Erreur: ' + data.error);
            } else {
              document.getElementById('response').textContent = data.response;
              updateStatus('Réponse récupérée avec succès (longueur: ' + data.response.length + ' caractères)');
            }
          };
          
          // Créer et ajouter le script
          const script = document.createElement('script');
          script.id = 'jsonp-script';
          script.src = '/api/jsonp/response/' + responseId + '?callback=handleResponse';
          document.head.appendChild(script);
        }
        
        // Afficher dans un iframe
        function showInIframe() {
          const responseId = document.getElementById('response-id').value.trim();
          if (!responseId) {
            updateStatus('Veuillez saisir un ID de réponse');
            return;
          }
          
          updateStatus('Chargement de la réponse dans l\'iframe...');
          
          const iframe = document.getElementById('response-iframe');
          iframe.src = '/api/jsonp/iframe/' + responseId;
          
          document.getElementById('iframe-container').style.display = 'block';
        }
        
        // Vérifier les clés en cache
        function checkCacheKeys() {
          updateStatus('Récupération des clés en cache...');
          
          // Supprimer l'ancien script s'il existe
          const oldScript = document.getElementById('jsonp-keys-script');
          if (oldScript) {
            document.head.removeChild(oldScript);
          }
          
          // Définir la fonction de callback
          window.handleCacheKeys = function(data) {
            if (data.keys && data.keys.length > 0) {
              document.getElementById('response').textContent = 'Clés en cache (' + data.keys.length + '):\n\n' + data.keys.join('\n');
              updateStatus('Clés récupérées avec succès: ' + data.keys.length + ' clés trouvées');
              
              // Si un champ de saisie est vide et qu'il y a des clés, suggérer la première
              const responseIdField = document.getElementById('response-id');
              if (!responseIdField.value && data.keys.length > 0) {
                responseIdField.value = data.keys[0];
              }
            } else {
              document.getElementById('response').textContent = 'Aucune clé trouvée dans le cache';
              updateStatus('Aucune clé trouvée dans le cache');
            }
          };
          
          // Créer et ajouter le script
          const script = document.createElement('script');
          script.id = 'jsonp-keys-script';
          script.src = '/api/jsonp/cache-keys?callback=handleCacheKeys';
          document.head.appendChild(script);
        }
        
        // Mettre à jour le statut
        function updateStatus(message) {
          const statusElement = document.getElementById('status');
          statusElement.innerHTML = 'Statut: ' + message;
        }
        
        // Vérifier les clés au chargement de la page
        window.onload = function() {
          checkCacheKeys();
        };
      </script>
    </body>
    </html>
  `;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(htmlResponse);
});

module.exports = { router, initializeCache };
