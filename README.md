# Serveur FCA-Agent

Ce serveur Node.js s'exécute sur un Raspberry Pi et sert d'intermédiaire entre l'extension de navigateur et l'API Claude d'Anthropic.

## Structure

- `index.js` - Point d'entrée du serveur
- `api/` - Routes API REST
- `services/` - Services métier
- `db/` - Configuration et accès à la base de données
- `config/` - Fichiers de configuration

## Installation

1. Assurez-vous que Node.js (v14+) est installé sur votre Raspberry Pi
2. Clonez ce dépôt
3. Installez les dépendances :
   ```
   npm install
   ```
4. Copiez `.env.example` vers `.env` et configurez les variables d'environnement
5. Créez le dossier `logs` à la racine du projet :
   ```
   mkdir logs
   ```

## Démarrage du serveur

```
npm start
```

Pour le développement avec redémarrage automatique :
```
npm run dev
```

## API

- `GET /api/status` - Vérifier l'état du serveur
- `POST /api/auth/login` - Authentification
- `POST /api/tasks` - Exécuter une tâche
- `GET /api/tasks` - Lister les tâches
- `GET /api/tasks/:id` - Obtenir les détails d'une tâche

## Logs

Les logs sont stockés dans le dossier `logs/` :
- `combined.log` - Tous les logs
- `error.log` - Uniquement les erreurs
