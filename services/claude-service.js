// FCA-Agent - Service d'interaction avec l'API Claude d'Anthropic
const { Anthropic } = require('@anthropic-ai/sdk');
const { createModuleLogger } = require('../utils/logger');
const { AppError, ErrorTypes, createClaudeApiError, asyncErrorHandler } = require('../utils/error');
const MODULE_NAME = 'SERVICES:CLAUDE-SERVICE';
const log = createModuleLogger(MODULE_NAME);

// Initialisation du client Anthropic avec vérification
const apiKey = process.env.ANTHROPIC_API_KEY || 'PLACEHOLDER_KEY';
let anthropic;

try {
  // Vérification de la clé API
  if (apiKey === 'PLACEHOLDER_KEY' || apiKey === 'your_anthropic_api_key_here') {
    log.error('Clé API Anthropic non configurée correctement dans .env');
    throw new AppError(
      'Clé API Anthropic non configurée', 
      ErrorTypes.CONFIG, 
      500, 
      { configKey: 'ANTHROPIC_API_KEY' }
    );
  }
  
  // Initialisation du client avec la nouvelle structure de la version 0.39.0
  anthropic = new Anthropic({
    apiKey: apiKey,
  });
  
  log.info('Initialisation du client Anthropic : OK');
} catch (error) {
  // Vérifier si c'est déjà une AppError
  const appError = error instanceof AppError 
    ? error 
    : new AppError(
        'Erreur lors de l\'initialisation du client Anthropic', 
        ErrorTypes.SYSTEM, 
        500, 
        null, 
        error
      );
  
  log.error(`Erreur lors de l'initialisation du client Anthropic: ${appError.message}`, {
    type: appError.type,
    details: appError.details
  });
  
  // Initialiser un objet de secours pour éviter les erreurs null
  anthropic = {
    messages: {
      create: async () => {
        throw appError;
      }
    }
  };
}

// Modèle Claude à utiliser - Haiku est le moins coûteux
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307';

// Fonction pour traiter un message utilisateur général
async function processMessage(message) {
  try {
    // Validation de l'entrée
    if (!message || typeof message !== 'string') {
      throw new AppError(
        'Le message doit être une chaîne de caractères non vide',
        ErrorTypes.VALIDATION,
        400,
        { receivedType: typeof message }
      );
    }
    
    log.info(`Traitement du message: "${message.substring(0, 50)}..."`);
    
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: message }
      ],
      temperature: 0.7,
    }).catch(error => {
      // Gestion spécifique des erreurs de l'API Anthropic
      throw createClaudeApiError(
        `Erreur lors de la communication avec l'API Claude: ${error.message}`,
        error
      );
    });
    
    log.info(`Réponse reçue: ${response.id}`);
    return {
      response: response.content[0].text,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    // Si c'est déjà une AppError, la propager
    if (error instanceof AppError) {
      throw error;
    }
    
    // Sinon, créer une nouvelle erreur standardisée
    log.error('Erreur lors du traitement du message:', error);
    throw createClaudeApiError(
      'Erreur lors du traitement du message par Claude',
      error
    );
  }
}

// Fonction spécifique pour synthétiser les emails Gmail
async function summarizeGmailEmails(emails, searchQuery = '') {
  try {
    // Validation des entrées
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new AppError(
        'Les emails doivent être fournis sous forme de tableau non vide',
        ErrorTypes.VALIDATION,
        400,
        { 
          receivedType: typeof emails, 
          isArray: Array.isArray(emails),
          emailsCount: emails ? emails.length : 0
        }
      );
    }
    
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
    }).catch(error => {
      // Gestion spécifique des erreurs de l'API Anthropic
      throw createClaudeApiError(
        `Erreur lors de la génération de la synthèse des emails: ${error.message}`,
        error
      );
    });
    
    log.info(`Synthèse des emails Gmail générée: ${response.id}`);
    // Vérifier le contenu de la réponse
    const responseText = response.content[0].text;
    log.info(`Longueur de la réponse: ${responseText.length} caractères`);
    
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
    // Si c'est déjà une AppError, la propager
    if (error instanceof AppError) {
      throw error;
    }
    
    // Sinon, créer une nouvelle erreur standardisée
    log.error('Erreur lors de la synthèse des emails Gmail:', error);
    throw createClaudeApiError(
      'Erreur lors de la génération de la synthèse des emails',
      error
    );
  }
}

module.exports = {
  processMessage,
  summarizeGmailEmails
};