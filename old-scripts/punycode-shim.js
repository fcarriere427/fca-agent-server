// Shim pour remplacer le module punycode par punycode2
try {
  // Cette technique s'appelle "monkey patching" du module system de Node.js
  const Module = require('module');
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function(path) {
    // Remplacer les demandes de 'punycode' par 'punycode2'
    if (path === 'punycode') {
      try {
        // Essayer de charger le remplacement punycode2
        return originalRequire.call(this, 'punycode2');
      } catch (error) {
        // Fallback au module natif en cas d'échec
        console.warn('Module punycode2 non trouvé, utilisation du module punycode natif déprécié');
        return originalRequire.call(this, path);
      }
    }
    
    // Pour toutes les autres demandes, comportement normal
    return originalRequire.call(this, path);
  };

  console.log('Shim punycode → punycode2 installé avec succès');
} catch (error) {
  console.error('Erreur lors de l\'installation du shim punycode:', error);
}
