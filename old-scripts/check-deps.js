// Script pour vérifier les versions des dépendances
console.log('Vérification des dépendances...');

try {
  // Examiner la version de Express et ses dépendances
  const express = require('express');
  console.log('Express version:', express.version);

  // Vérifier si express a une dépendance sur uri-js (souvent source de l'utilisation de punycode)
  try {
    require('uri-js');
    console.log('uri-js est installé');
  } catch (e) {
    console.log('uri-js n\'est pas directement installé');
  }

  // Vérifier certaines dépendances courantes qui utilisent punycode
  const checkDep = (name) => {
    try {
      const pkg = require(name + '/package.json');
      console.log(`${name} version: ${pkg.version}`);
    } catch (e) {
      console.log(`${name} n'est pas installé directement`);
    }
  };

  // Vérifier les packages courants qui utilisent punycode
  checkDep('uri-js');
  checkDep('whatwg-url');
  checkDep('node-url');
  checkDep('url');
  checkDep('tough-cookie');
  checkDep('request');
  checkDep('node-fetch');
  
} catch (err) {
  console.error('Erreur lors de la vérification des dépendances:', err);
}
