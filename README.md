# Scriptorium

Atelier de création littéraire pour Windows, avec stockage local et sauvegardes exportables.

## Modules de la version 0.2.0
- Projets littéraires indépendants avec présentation et statistiques.
- Manuscrits organisés par projet, avec réglages typographiques par chapitre.
- Encyclopédie de l'univers : fiches de personnages, lieux, peuples, objets et créatures.
- Carnet d'idées.
- Suivi de progression : mots, chapitres, fiches et idées.
- Activation/désactivation individuelle des modules sans suppression des données.
- Sauvegarde JSON complète et import de l'ancienne bibliothèque.

## Technique
Electron, electron-vite, React, TypeScript et TipTap. Les données sont stockées localement dans le dossier utilisateur de l'application.

## Développement
```bash
npm install
npm run dev
```

## Installateur Windows
```bash
npm run dist:win
```

L'installateur NSIS est produit dans `release`.
