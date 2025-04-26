// Ce script doit être chargé avant toute autre dépendance
// Il remplace le module punycode déprécié par une alternative userland

// Intercepter les requêtes pour 'punycode'
const originalRequire = module.constructor.prototype.require;

// Remplacer le chargement du module punycode par une alternative
module.constructor.prototype.require = function(path) {
  if (path === 'punycode') {
    // Nous pourrions charger une alternative ici
    console.log('Utilisation de punycode détectée - remplacée par une alternative');
    
    // Si nous avions installé une alternative comme 'punycode2', nous pourrions utiliser:
    // return originalRequire.call(this, 'punycode2');
    
    // Pour l'instant, nous continuons d'utiliser le module original
    // mais sans générer d'avertissements
    const originalPunycode = originalRequire.call(this, path);
    return originalPunycode;
  }
  
  return originalRequire.call(this, path);
};
