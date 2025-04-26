// FCA-Agent - Service d'interaction avec l'API Claude d'Anthropic
const { Anthropic } = require('@anthropic-ai/sdk');
const { logger, createModuleLogger } = require('../utils/logger');
const MODULE_NAME = 'SERVER:SERVICES:CLAUDE-SERVICE';
const log = createModuleLogger(MODULE_NAME);

// Initialisation du client Anthropic avec vérification
const apiKey = process.env.ANTHROPIC_API_KEY || 'PLACEHOLDER_KEY';
let anthropic;

try {
  // Vérification de la clé API
  if (apiKey === 'PLACEHOLDER_KEY' || apiKey === 'your_anthropic_api_key_here') {
    log.error('Clé API Anthropic non configurée correctement dans .env');
    throw new Error('Clé API Anthropic non configurée');
  }
  
  // Initialisation du client avec la nouvelle structure de la version 0.39.0
  anthropic = new Anthropic({
    apiKey: apiKey,
  });
  
  log.info('Initialisation du client Anthropic : OK');
} catch (error) {
  log.error('Erreur lors de l\'initialisation du client Anthropic:', error);
  // Initialiser un objet de secours pour éviter les erreurs null
  anthropic = {
    messages: {
      create: async () => {
        throw new Error('Client Anthropic non initialisé correctement');
      }
    }
  };
}

// Modèle Claude à utiliser - Haiku est le moins coûteux
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307';

// Fonction pour traiter un message utilisateur général
async function processMessage(message) {
  try {
    log.info(`Traitement du message: "${message.substring(0, 50)}..."`)
    
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: message }
      ],
      temperature: 0.7,
    });
    
    log.info(`Réponse reçue: ${response.id}`);
    return {
      response: response.content[0].text,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    log.error('Erreur lors du traitement du message:', error);
    throw new Error(`Erreur API Claude: ${error.message}`);
  }
}


// Fonction spécifique pour synthétiser les emails Gmail
async function summarizeGmailEmails(emails, searchQuery = '') {
  try {
    log.info(`Synthèse des emails Gmail${searchQuery ? ` sur le sujet: ${searchQuery}` : ''}`);    
    
    const systemPrompt = `Vous êtes un assistant professionnel qui synthétise efficacement les emails Gmail.
    Je vais vous fournir plusieurs emails extraits de Gmail et vous devrez:
    1. Identifier les messages importants nécessitant une attention ou une action
    2. Résumer le contenu principal de chaque email important
    3. Regrouper les emails par thème ou projet
    4. Suggérer des actions concrètes basées sur le contenu des emails
    5. Si un sujet de recherche est spécifié, vous concentrer sur les emails pertinents
    
    Votre synthèse doit être:
    - Concise mais complète
    - Structurée par importance ou par thème
    - Orientée vers les actions à entreprendre
    - Professionnelle et facile à lire
    - Adaptée au contexte professionnel de l'utilisateur`;
    
    // Préparer le contenu formaté des emails pour Claude
    const emailsContent = emails.map((email, index) => {
      if (email.openEmail) {
        return `Email #${index + 1}:
        De: ${email.openEmail.sender.name} <${email.openEmail.sender.email}>
        Date: ${email.openEmail.time}
        Objet: ${email.openEmail.subject}
        
        ${email.openEmail.body}`;
      } else {
        return `Email #${index + 1}:
        De: ${email.sender}
        Date: ${email.time}
        Objet: ${email.subject}
        
        ${email.preview}`;
      }
    }).join('\n\n-----------\n\n');
    
    // Construire le prompt pour Claude
    const userPrompt = searchQuery
      ? `Voici une liste d'emails Gmail. Veuillez me faire une synthèse focalisée sur le sujet "${searchQuery}":\n\n${emailsContent}`
      : `Voici une liste d'emails Gmail. Veuillez me faire une synthèse complète:\n\n${emailsContent}`;
    
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
    });
    
    log.info(`Synthèse des emails Gmail générée: ${response.id}`);
    // Vérifier le contenu de la réponse
    const responseText = response.content[0].text;
    log.info(`Longueur de la réponse: ${responseText.length} caractères`);
    log.info(`Début de la réponse: ${responseText.substring(0, 100)}...`);
    log.info(`Réponse complète: ${responseText}`);
    
    // Assainir la réponse pour éviter les problèmes de sérialisation JSON
    // Remplacer les caractères problématiques par des espaces
    const cleanedResponse = responseText
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // Caractères de contrôle
      .replace(/\u2028/g, '\n')  // Line separator
      .replace(/\u2029/g, '\n'); // Paragraph separator
    
    return {
      response: cleanedResponse,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    log.error('Erreur lors de la synthèse des emails Gmail:', error);
    throw new Error(`Erreur API Claude: ${error.message}`);
  }
}

module.exports = {
  processMessage,
  summarizeGmailEmails
};