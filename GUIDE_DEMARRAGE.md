# Guide de Démarrage Rapide - CRM NJM Conseil

## Démarrage en 3 étapes

### 1. Ouvrir l'application
Ouvrez le fichier [index.html](index.html) dans votre navigateur web.

### 2. Connexion initiale
Utilisez les identifiants administrateur par défaut :
```
Email: admin@njm.fr
Mot de passe: Admin123!
```

### 3. Gérer les accès
1. Cliquez sur **"Gestion des Accès"** dans le menu latéral
2. Vous verrez la liste des utilisateurs et pourrez :
   - ✅ Créer de nouveaux utilisateurs
   - ✏️ Modifier les utilisateurs existants
   - 🔑 Réinitialiser les mots de passe
   - 🗑️ Supprimer des utilisateurs

## Fonctionnalités principales

### 🔐 Sécurité robuste
- Mots de passe hachés (SHA-256)
- Protection anti-bruteforce (5 tentatives max)
- Sessions sécurisées avec expiration automatique (1h)
- Verrouillage temporaire après échecs (15 min)

### 👥 Gestion des utilisateurs
- **Statistiques en temps réel** : Total, Admins, Formateurs, Clients
- **CRUD complet** : Créer, Lire, Modifier, Supprimer
- **Recherche instantanée** : Par nom ou email
- **Gestion des rôles** : Admin, Formateur, Client

### 🔑 Rôles et permissions

| Rôle | Permissions |
|------|------------|
| **Admin** | Accès complet, gestion utilisateurs, paramètres |
| **Formateur** | Gestion formations, veille, bibliothèques |
| **Client** | Consultation données personnelles uniquement |

## Créer votre premier utilisateur

1. Cliquez sur le bouton **"+ Nouvel Utilisateur"**
2. Remplissez le formulaire :
   - **Nom** : Ex: "Marie Dupont"
   - **Email** : Ex: "marie.dupont@entreprise.fr"
   - **Rôle** : Choisissez Admin, Formateur ou Client
   - **Mot de passe** : Minimum 8 caractères avec majuscule, minuscule, chiffre et caractère spécial
   - **Compte actif** : Cochez pour activer immédiatement
3. Cliquez sur **"Enregistrer"**

## Règles de mot de passe

Chaque mot de passe doit contenir :
- ✅ Minimum 8 caractères
- ✅ Au moins 1 majuscule (A-Z)
- ✅ Au moins 1 minuscule (a-z)
- ✅ Au moins 1 chiffre (0-9)
- ✅ Au moins 1 caractère spécial (!@#$%^&*)

**Exemples valides** :
- `Formation2026!`
- `NJM@Conseil123`
- `Secure#Pass99`

## Actions disponibles

### Pour chaque utilisateur

| Action | Description |
|--------|-------------|
| **Éditer** | Modifier nom, email, rôle, statut |
| **Mot de passe** | Réinitialiser le mot de passe |
| **Supprimer** | Supprimer définitivement l'utilisateur |

### Protections automatiques

- ⛔ Impossible de se supprimer soi-même
- ⛔ Impossible de supprimer le dernier administrateur
- ⛔ Impossible d'avoir des emails en double

## Besoin d'aide ?

Consultez la [documentation complète](AUTHENTIFICATION.md) pour plus de détails sur :
- Les fonctionnalités avancées
- L'architecture technique
- Le dépannage
- Les bonnes pratiques de sécurité

---

**Prêt à commencer ?** Ouvrez [index.html](index.html) et connectez-vous avec `admin@njm.fr` / `Admin123!`
