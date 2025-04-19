// FCA-Agent - Service d'interaction avec l'API Claude d'Anthropic
const Anthropic = require('@anthropic-ai/sdk');
const { logger } = require('../config/logger');

// Initialisation du client Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'PLACEHOLDER_KEY',
});

// Modèle Claude à utiliser
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-3-opus-20240229';

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
      messages: [
        { role: 'system', content: systemPrompt },
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
      messages: [
        { role: 'system', content: systemPrompt },
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
      messages: [
        { role: 'system', content: systemPrompt },
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
      model: 'claude-3-opus-20240229', // Modèle avec capacité de vision
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
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
  analyzeScreenshot
};