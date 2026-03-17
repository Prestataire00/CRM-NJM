# Instructions de Test - Système d'Authentification

## Problème résolu

Deux problèmes ont été corrigés :

1. ✅ **Mot de passe visible** : Ajout d'une icône œil pour afficher/masquer le mot de passe
2. ✅ **Connexion impossible** : Correction du système de hachage des mots de passe

## Tester la connexion

### Option 1 : Reset du LocalStorage (Recommandé)

Si vous aviez déjà testé l'application, les anciennes données peuvent empêcher la connexion. Pour reset :

1. Ouvrez la Console JavaScript de votre navigateur :
   - **Chrome/Edge** : F12 ou Clic droit > Inspecter > Console
   - **Firefox** : F12 ou Clic droit > Examiner l'élément > Console
   - **Safari** : Cmd+Option+C

2. Copiez et collez cette commande dans la console :
   ```javascript
   localStorage.clear(); location.reload();
   ```

3. Appuyez sur Entrée

4. La page va se recharger automatiquement

### Option 2 : Mode Navigation Privée

1. Ouvrez une fenêtre de navigation privée :
   - **Chrome** : Ctrl+Shift+N (Windows) ou Cmd+Shift+N (Mac)
   - **Firefox** : Ctrl+Shift+P (Windows) ou Cmd+Shift+P (Mac)
   - **Safari** : Cmd+Shift+N

2. Ouvrez le fichier [index.html](index.html)

## Se connecter

Après avoir reset le LocalStorage, utilisez ces identifiants :

```
Email: admin@njm.fr
Mot de passe: Admin123!
```

**Note** : Le mot de passe est sensible à la casse. Assurez-vous d'utiliser :
- `A` majuscule au début
- `dmin123` en minuscules
- `!` à la fin

## Fonctionnalité œil du mot de passe

Cliquez sur l'icône œil à droite du champ mot de passe pour :
- 👁️ **Œil ouvert** : Le mot de passe est visible en texte clair
- 👁️‍🗨️ **Œil barré** : Le mot de passe est masqué (••••••••)

## Vérifier que tout fonctionne

Après la connexion, vous devriez :

1. ✅ Être redirigé vers le tableau de bord
2. ✅ Voir "Administrateur" en haut à droite
3. ✅ Pouvoir accéder à "Gestion des Accès" dans le menu
4. ✅ Voir 1 utilisateur (admin) dans la liste

## Si ça ne fonctionne toujours pas

### Déboguer le problème

1. Ouvrez la Console JavaScript (F12)
2. Tentez de vous connecter
3. Regardez les erreurs éventuelles dans la console
4. Vérifiez que les fichiers sont bien chargés :
   ```javascript
   console.log(typeof AuthSystem); // Devrait afficher "object"
   console.log(typeof CRMData);    // Devrait afficher "object"
   ```

### Vérifier les données stockées

Dans la console, exécutez :
```javascript
const data = JSON.parse(localStorage.getItem('njm_crm_data'));
console.log('Utilisateurs:', data?.auth?.users);
```

Vous devriez voir un utilisateur admin avec :
- email: "admin@njm.fr"
- role: "admin"
- password: (un hash numérique)

## Créer un nouvel utilisateur

Une fois connecté :

1. Allez dans **Gestion des Accès**
2. Cliquez sur **+ Nouvel Utilisateur**
3. Remplissez le formulaire
4. Le mot de passe doit respecter :
   - Minimum 8 caractères
   - 1 majuscule
   - 1 minuscule
   - 1 chiffre
   - 1 caractère spécial (!@#$%^&*(),.?":{}|<>)

Exemple de mot de passe valide : `Formateur2026!`

## Changelog

### Version 1.0.1 (10/01/2026)

- ✅ Ajout de l'icône œil pour afficher/masquer le mot de passe
- ✅ Correction du système de hachage (utilisation de `hashPasswordSync` au lieu de `hashPassword`)
- ✅ Modification de `mustChangePassword: false` pour permettre la connexion avec le mot de passe par défaut
- ✅ Amélioration du styling du bouton œil

---

**Besoin d'aide ?** Consultez :
- [GUIDE_DEMARRAGE.md](GUIDE_DEMARRAGE.md) - Guide de démarrage rapide
- [AUTHENTIFICATION.md](AUTHENTIFICATION.md) - Documentation complète
