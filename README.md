# Scriptorium

Scriptorium est un atelier d'écriture de bureau pour Windows. Le projet privilégie le stockage local et les sauvegardes exportables.

## Stack

- Electron + Vite
- React + TypeScript
- TipTap pour l'édition de texte
- Bibliothèque conservée localement dans le dossier de données utilisateur de l'application

## Prérequis

- Windows 10 ou 11
- Node.js 20 ou plus récent
- npm

## Développement

```bash
npm install
npm run dev
```

## Construire l'installateur Windows

```bash
npm run dist:win
```

L'installateur est généré dans le dossier `release`.

## État du prototype

Version 0.1.0 : bibliothèque locale, création et suppression de manuscrits, édition riche de base, sauvegarde JSON et import/export de bibliothèque.

Les mises à jour automatiques avec demande de confirmation seront ajoutées dans une étape dédiée avant publication de versions installables.