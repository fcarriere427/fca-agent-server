// Script pour supprimer le dossier config
const fs = require('fs');
const path = require('path');

// Chemin vers le dossier config
const configDir = path.join(__dirname, 'config');

// Vérifier si le dossier existe
if (fs.existsSync(configDir)) {
  // Lire les fichiers dans le dossier
  const files = fs.readdirSync(configDir);
  
  // Supprimer chaque fichier
  files.forEach(file => {
    const filePath = path.join(configDir, file);
    fs.unlinkSync(filePath);
    console.log(`Fichier supprimé: ${filePath}`);
  });
  
  // Supprimer le dossier
  fs.rmdirSync(configDir);
  console.log(`Dossier supprimé: ${configDir}`);
} else {
  console.log(`Le dossier ${configDir} n'existe pas.`);
}
