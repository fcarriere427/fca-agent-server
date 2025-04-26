// Script simple pour trouver qui utilise punycode
const Module = require('module');
const originalRequire = Module.prototype.require;

// Intercepter les appels à require
Module.prototype.require = function(path) {
  if (path === 'punycode') {
    console.log('punycode est utilisé par:', new Error().stack);
  }
  return originalRequire.call(this, path);
};

// Charger quelques modules clés pour voir qui utilise punycode
console.log('Chargement des modules pour détecter qui utilise punycode...');
require('express');
