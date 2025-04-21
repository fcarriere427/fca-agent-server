// Configuration simplifiée de l'authentification
module.exports = {
  // Mot de passe en clair pour l'authentification
  password: 'fca-agent-password',
  
  // Durée de validité du cookie d'authentification (en millisecondes)
  // Par défaut: 24 heures
  cookieMaxAge: 24 * 60 * 60 * 1000,
  
  // Nom du cookie d'authentification
  cookieName: 'fca-agent-auth'
};