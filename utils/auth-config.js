// Configuration simplifiée de l'authentification

// Utilisation de la variable d'environnement pour le mot de passe
// Valeur par défaut seulement pour le développement
module.exports = {
  // Mot de passe récupéré depuis les variables d'environnement
  password: process.env.AUTH_PASSWORD || 'dev-password-only',
  
  // Durée de validité du cookie d'authentification (en millisecondes)
  // Par défaut: 24 heures
  cookieMaxAge: 24 * 60 * 60 * 1000,
  
  // Nom du cookie d'authentification
  cookieName: 'fca-agent-auth'
};