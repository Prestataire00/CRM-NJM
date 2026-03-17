# Serveur Local - CRM NJM Conseil

## Accès rapide

**URL du CRM :** http://localhost:3000

---

## Démarrer le serveur

### Prérequis
- Node.js installé sur votre machine

### Étapes

1. **Ouvrir le Terminal**
   - Sur Mac : `Cmd + Espace` → taper "Terminal" → Entrée
   - Sur Windows : `Win + R` → taper "cmd" → Entrée

2. **Naviguer vers le dossier du projet**
   ```bash
   cd "/Users/ismaellepennec/Documents/IA INFINITY /Formation interne/Vibes coding/IDE/CRM"
   ```

3. **Lancer le serveur**
   ```bash
   node server.js
   ```

4. **Ouvrir le CRM**
   - Ouvrez votre navigateur (Chrome, Firefox, Safari...)
   - Allez à l'adresse : **http://localhost:3000**

---

## Arrêter le serveur

Dans le terminal où le serveur tourne, appuyez sur :
```
Ctrl + C
```

---

## Résumé des commandes

| Action | Commande |
|--------|----------|
| Aller dans le dossier | `cd "/Users/ismaellepennec/Documents/IA INFINITY /Formation interne/Vibes coding/IDE/CRM"` |
| Démarrer le serveur | `node server.js` |
| Arrêter le serveur | `Ctrl + C` |
| URL du CRM | http://localhost:3000 |

---

## En cas de problème

### "Port 3000 déjà utilisé"
Le serveur tourne peut-être déjà. Vérifiez vos onglets de terminal ou redémarrez votre ordinateur.

### "node: command not found"
Node.js n'est pas installé. Téléchargez-le sur : https://nodejs.org/

### Erreur Google Docs "redirect_uri_mismatch"
Ajoutez `http://localhost:3000` dans les URIs autorisées de votre projet Google Cloud Console (voir documentation Google OAuth).

---

## Astuce VSCode

Si vous utilisez VSCode, vous pouvez ouvrir un terminal intégré avec `Ctrl + ù` (ou `Cmd + ù` sur Mac) et lancer directement `node server.js`.
