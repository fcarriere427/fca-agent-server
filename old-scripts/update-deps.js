// Script pour identifier les packages qui utilisent punycode
const Module = require('module');
const originalRequire = Module.prototype.require;

// Crée un hook pour intercepter tous les appels require
Module.prototype.require = function(path) {
  if (path === 'punycode') {
    console.log('punycode requis par:', new Error().stack.split('\n')[2]);
  }
  return originalRequire.call(this, path);
};

// Exécute un simple test qui charge tous les packages
console.log('Chargement des dépendances pour identifier les utilisations de punycode...');

// Liste des modules à tester
const modulesToTest = [
  '@anthropic-ai/sdk',
  'express',
  'cors',
  'helmet',
  'morgan',
  'cookie-parser',
  'bcrypt',
  'sqlite3',
  'winston',
  'dotenv'
];

// Charge chaque module pour voir s'il utilise punycode
modulesToTest.forEach(module => {
  try {
    console.log(`Chargement de ${module}...`);
    require(module);
  } catch (err) {
    console.error(`Erreur lors du chargement de ${module}:`, err.message);
  }
});

console.log('Analyse terminée.');
