// FCA-Agent - Service d'interaction avec l'API Claude d'Anthropic
const { Anthropic } = require('@anthropic-ai/sdk');
const { logger } = require('../utils/logger');

// Initialisation du client Anthropic avec vérification
const apiKey = process.env.ANTHROPIC_API_KEY || 'PLACEHOLDER_KEY';
let anthropic;

try {
  // Vérification de la clé API
  if (apiKey === 'PLACEHOLDER_KEY' || apiKey === 'your_anthropic_api_key_here') {
    logger.error('Clé API Anthropic non configurée correctement dans .env');
    throw new Error('Clé API Anthropic non configurée');
  }
  
  // Initialisation du client avec la nouvelle structure de la version 0.39.0
  anthropic = new Anthropic({
    apiKey: apiKey,
  });
  
  logger.info('Client Anthropic initialisé avec succès');
} catch (error) {
  logger.error('Erreur lors de l\'initialisation du client Anthropic:', error);
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
    logger.info(`Traitement du message: "${message.substring(0, 50)}..."`);
    
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: message }
      ],
      temperature: 0.7,
    });
    
    logger.info(`Réponse reçue: ${response.id}`);
    return {
      response: response.content[0].text,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    logger.error('Erreur lors du traitement du message:', error);
    throw new Error(`Erreur API Claude: ${error.message}`);
  }
}

// Fonction pour résumer des emails
async function summarizeEmails(prompt) {
  try {
    logger.info(`Résumé des emails: "${prompt.substring(0, 50)}..."`);
    
    const systemPrompt = `Vous êtes un assistant professionnel qui résume efficacement les emails. 
    Je vais vous fournir plusieurs emails et vous devrez:
    1. Identifier les messages importants nécessitant une attention ou une action
    2. Résumer le contenu principal de chaque email important
    3. Regrouper les emails par thème ou projet si pertinent
    4. Suggérer des actions concrètes basées sur le contenu des emails
    
    Votre résumé doit être concis, structuré et professionnel.`;
    
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    });
    
    logger.info(`Résumé d'emails généré: ${response.id}`);
    return {
      response: response.content[0].text,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    logger.error('Erreur lors du résumé des emails:', error);
    throw new Error(`Erreur API Claude: ${error.message}`);
  }
}

// Fonction pour résumer des conversations Teams
async function summarizeTeams(prompt) {
  try {
    logger.info(`Résumé des conversations Teams: "${prompt.substring(0, 50)}..."`);
    
    const systemPrompt = `Vous êtes un assistant professionnel qui résume efficacement les conversations Microsoft Teams.
    Je vais vous fournir plusieurs messages et vous devrez:
    1. Identifier les points clés de la conversation
    2. Résumer les décisions prises et les actions à entreprendre
    3. Extraire les informations importantes partagées
    4. Noter les questions non résolues ou les points nécessitant un suivi
    
    Votre résumé doit être concis, structuré et orienté action.`;
    
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    });
    
    logger.info(`Résumé Teams généré: ${response.id}`);
    return {
      response: response.content[0].text,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    logger.error('Erreur lors du résumé des conversations Teams:', error);
    throw new Error(`Erreur API Claude: ${error.message}`);
  }
}

// Fonction pour rédiger un email
async function draftEmail(prompt) {
  try {
    logger.info(`Rédaction d'email: "${prompt.substring(0, 50)}..."`);
    
    const systemPrompt = `Vous êtes un assistant professionnel expert en communication écrite professionnelle.
    Je vais vous demander de rédiger un email et vous devrez:
    1. Créer un email professionnel, clair et concis
    2. Utiliser un ton approprié au contexte professionnel
    3. Structurer l'email avec une introduction claire, un corps pertinent et une conclusion
    4. Inclure un objet approprié pour l'email
    
    Rédigez l'email comme si vous étiez moi en m'adressant à mon destinataire.
    Format:
    
    Objet: [Objet de l'email]
    
    [Corps de l'email]`;
    
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
    });
    
    logger.info(`Email rédigé: ${response.id}`);
    return {
      response: response.content[0].text,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    logger.error('Erreur lors de la rédaction de l\'email:', error);
    throw new Error(`Erreur API Claude: ${error.message}`);
  }
}

// Fonction spécifique pour synthétiser les emails Gmail
async function summarizeGmailEmails(emails, searchQuery = '') {
  try {
    logger.info(`Synthèse des emails Gmail${searchQuery ? ` sur le sujet: ${searchQuery}` : ''}`);    
    
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
    
    logger.info(`Synthèse des emails Gmail générée: ${response.id}`);
    // Vérifier le contenu de la réponse
    const responseText = response.content[0].text;
    logger.info(`Longueur de la réponse: ${responseText.length} caractères`);
    logger.info(`Début de la réponse: ${responseText.substring(0, 100)}...`);
    
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
    logger.error('Erreur lors de la synthèse des emails Gmail:', error);
    throw new Error(`Erreur API Claude: ${error.message}`);
  }
}

// Fonction pour analyser une capture d'écran
async function analyzeScreenshot(imageBase64, prompt) {
  try {
    logger.info('Analyse de capture d\'écran en cours...');
    
    // Format pour l'image en base64
    const imageContent = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: imageBase64.replace(/^data:image\/\w+;base64,/, '') // Retirer l'en-tête si présent
      }
    };
    
    const systemPrompt = `Vous êtes un assistant spécialisé dans l'analyse d'interfaces utilisateur.
    Je vais vous fournir une capture d'écran d'une application professionnelle.
    Veuillez:
    1. Décrire ce que vous voyez dans l'interface
    2. Identifier les éléments clés (formulaires, boutons, tableaux, etc.)
    3. Me guider sur la manière d'interagir avec cette interface selon ma demande`;
    
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL, // Utiliser le modèle par défaut pour réduire les coûts
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        { 
          role: 'user', 
          content: [
            imageContent,
            { type: 'text', text: prompt || 'Décrivez ce que vous voyez dans cette capture d\'écran et aidez-moi à comprendre l\'interface.' }
          ]
        }
      ],
      temperature: 0.3,
    });
    
    logger.info(`Analyse de capture d'écran terminée: ${response.id}`);
    return {
      response: response.content[0].text,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    logger.error('Erreur lors de l\'analyse de la capture d\'écran:', error);
    throw new Error(`Erreur API Claude: ${error.message}`);
  }
}

module.exports = {
  processMessage,
  summarizeEmails,
  summarizeTeams,
  draftEmail,
  analyzeScreenshot,
  summarizeGmailEmails
};