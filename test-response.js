// Script de test pour vérifier la transmission de réponses longues
const express = require('express');
const cors = require('cors');
const app = express();

// Configuration CORS
app.use(cors({
  origin: '*',
  credentials: true
}));

// Cache de test
const responseCache = {};

// Créer une réponse longue de test
const testResponseId = 'test-response-123';
responseCache[testResponseId] = 'Ceci est une réponse de test très longue. '.repeat(500);

// Endpoint de test pour récupérer la référence
app.get('/api/test/reference', (req, res) => {
  console.log('Référence demandée');
  res.json({
    responseId: testResponseId,
    preview: responseCache[testResponseId].substring(0, 50) + '...',
    fullResponseAvailable: true
  });
});

// Endpoint de test pour récupérer la réponse complète (JSON)
app.get('/api/test/response-json/:id', (req, res) => {
  console.log('Réponse complète JSON demandée pour:', req.params.id);
  
  const responseId = req.params.id;
  if (!responseCache[responseId]) {
    return res.status(404).json({ error: 'Réponse non trouvée' });
  }
  
  console.log('Envoi de la réponse complète en JSON, longueur:', responseCache[responseId].length);
  
  // Envoyer en JSON
  res.status(200).json({ 
    response: responseCache[responseId],
    id: responseId
  });
});

// Endpoint de test pour récupérer la réponse complète (texte brut)
app.get('/api/test/response/:id', (req, res) => {
  console.log('Réponse complète en texte brut demandée pour:', req.params.id);
  
  const responseId = req.params.id;
  if (!responseCache[responseId]) {
    return res.status(404).json({ error: 'Réponse non trouvée' });
  }
  
  console.log('Envoi de la réponse complète en texte brut, longueur:', responseCache[responseId].length);
  
  // Envoyer en text/plain
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(responseCache[responseId]);
});

// Démarrer le serveur de test
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Serveur de test démarré sur le port ${PORT}`);
  console.log(`Test URL: http://localhost:${PORT}/api/test/reference`);
  console.log(`Pour tester la différence entre JSON et texte brut:`);
  console.log(`- JSON: http://localhost:${PORT}/api/test/response-json/${testResponseId}`);
  console.log(`- Texte brut: http://localhost:${PORT}/api/test/response/${testResponseId}`);
});