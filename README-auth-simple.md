# Simplification du système d'authentification FCA-Agent

## Présentation

Ce document explique la simplification du système d'authentification du projet FCA-Agent. L'authentification actuelle était trop complexe pour un système utilisant simplement une clé API fixe.

## Changements effectués

### 1. Fichiers créés
- `utils/auth-simple.js` : Nouveau fichier unique contenant toute la logique d'authentification
- `api/auth-simple.js` : Nouvelle version simplifiée des routes d'authentification
- `index-simple.js` : Version modifiée du fichier principal utilisant le nouveau système

### 2. Comment utiliser le nouveau système

Pour adopter cette version simplifiée, vous pouvez :
1. Remplacer `utils/auth.js` par `utils/auth-simple.js`
2. Remplacer `api/auth.js` par `api/auth-simple.js`
3. Remplacer `index.js` par `index-simple.js`

Ou, plus simplement, suivre les étapes de migration ci-dessous.

## Migration

1. Renommez votre fichier `index.js` en `index.js.old` pour sauvegarder l'original
2. Copiez `index-simple.js` en `index.js`
3. Supprimez les anciens fichiers d'authentification devenus inutiles:
   - `utils/auth.js`
   - `utils/auth-config.js`
   - `api/auth.js` (après avoir sauvegardé)

## Configuration requise

Le nouveau système requiert toujours la définition d'une variable d'environnement `API_KEY` dans le fichier `.env` du serveur.

## Avantages du nouveau système

- **Simplicité** : Toute la logique d'authentification est centralisée dans un seul fichier
- **Maintenance facilitée** : Moins de code à maintenir et à comprendre
- **Performance** : Moins de fichiers à charger, moins de code à exécuter
- **Sécurité** : Le code simplifié est plus facile à auditer

## Comparaison avec l'ancien système

| Aspect | Ancien système | Nouveau système |
|--------|---------------|----------------|
| Fichiers dédiés | 3+ | 2 |
| Lignes de code | 650+ | ~100 |
| Fonctionnalités | Nombreuses inutilisées | Uniquement l'essentiel |
| Configuration | Complexe | Simple (.env uniquement) |
