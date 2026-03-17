# Système de Gestion des Accès - CRM NJM Conseil

## Vue d'ensemble

Ce CRM dispose d'un système d'authentification et de gestion des accès robuste avec :

- **Authentification sécurisée** : Hachage des mots de passe (SHA-256)
- **Gestion des sessions** : Sessions sécurisées avec expiration automatique
- **Système de rôles** : Admin, Formateur, Client avec permissions différenciées
- **Interface d'administration** : Gestion complète des utilisateurs
- **Sécurité renforcée** : Protection contre les attaques par force brute

## Identifiants par défaut

### Compte Administrateur

```
Email: admin@njm.fr
Mot de passe: Admin123!
```

**⚠️ IMPORTANT** : Vous devrez changer ce mot de passe lors de votre première connexion.

## Fonctionnalités du système

### 1. Authentification

- **Page de connexion sécurisée** avec validation des identifiants
- **Hachage des mots de passe** : Tous les mots de passe sont hachés en SHA-256
- **Protection anti-bruteforce** : Maximum 5 tentatives de connexion, puis verrouillage du compte pendant 15 minutes
- **Sessions sécurisées** : Expiration automatique après 1 heure d'inactivité
- **Déconnexion** : Déconnexion propre avec suppression de la session

### 2. Gestion des utilisateurs (Administrateur uniquement)

#### Interface de gestion

- **Tableau de bord des utilisateurs** avec statistiques en temps réel :
  - Total des utilisateurs
  - Nombre d'administrateurs
  - Nombre de formateurs
  - Nombre de clients

- **Liste complète des utilisateurs** avec :
  - Nom, email, rôle
  - Statut (actif/inactif)
  - Date de dernière connexion
  - Actions disponibles

#### Fonctionnalités CRUD

**Créer un utilisateur :**
- Formulaire avec validation complète
- Champs : Nom, Email, Rôle, Mot de passe, Statut
- Validation du format d'email
- Validation de la robustesse du mot de passe

**Modifier un utilisateur :**
- Édition de toutes les informations (sauf mot de passe)
- Activation/désactivation du compte
- Changement de rôle

**Supprimer un utilisateur :**
- Suppression définitive avec confirmation
- Protection : Impossible de se supprimer soi-même
- Protection : Impossible de supprimer le dernier administrateur

**Réinitialiser le mot de passe :**
- Réinitialisation par l'administrateur
- Nouvel utilisateur devra changer son mot de passe à la première connexion

#### Recherche et filtrage

- **Barre de recherche** : Recherche en temps réel par nom ou email
- **Tri automatique** : Liste triée par date de création

### 3. Système de rôles et permissions

#### Administrateur (admin)
- **Accès complet** à toutes les fonctionnalités
- Gestion des utilisateurs (création, modification, suppression)
- Réinitialisation des mots de passe
- Accès à toutes les sections du CRM
- Gestion des formations, veille, BPF, bibliothèques, paramètres

#### Formateur
- **Accès aux formations** : Création et gestion des formations
- **Accès à la veille** : Consultation et ajout d'informations de veille
- **Accès aux bibliothèques** : Consultation des supports et templates
- **Pas d'accès** : Gestion des utilisateurs, paramètres système

#### Client
- **Accès en lecture seule** aux données qui le concernent
- Consultation de ses formations
- Accès à l'espace client dédié
- **Pas d'accès** : Gestion, administration, données des autres clients

### 4. Sécurité avancée

#### Validation des mots de passe

Tous les mots de passe doivent respecter :
- **Minimum 8 caractères**
- **Au moins une majuscule** (A-Z)
- **Au moins une minuscule** (a-z)
- **Au moins un chiffre** (0-9)
- **Au moins un caractère spécial** (!@#$%^&*(),.?":{}|<>)

Exemple de mot de passe valide : `Admin123!`

#### Protection contre les attaques

- **Limitation des tentatives** : 5 tentatives maximum
- **Verrouillage temporaire** : 15 minutes après 5 échecs
- **Réinitialisation automatique** : Compteur remis à zéro après connexion réussie
- **Sessions sécurisées** : Tokens aléatoires, expiration automatique

#### Hachage des mots de passe

- **Algorithme** : SHA-256
- **Stockage** : Seuls les hashes sont stockés, jamais les mots de passe en clair
- **Irréversible** : Impossible de retrouver le mot de passe original

### 5. Gestion des sessions

- **Durée** : 1 heure d'inactivité avant expiration
- **Token unique** : Chaque session a un token cryptographique unique
- **Déconnexion automatique** : Si le compte est désactivé
- **Nettoyage** : Suppression des sessions expirées

## Utilisation

### Première connexion

1. Ouvrez [index.html](index.html) dans votre navigateur
2. Utilisez les identifiants par défaut :
   - Email : `admin@njm.fr`
   - Mot de passe : `Admin123!`
3. Vous serez redirigé vers le tableau de bord

### Créer un nouvel utilisateur

1. Naviguez vers **Gestion des Accès** dans le menu latéral
2. Cliquez sur **+ Nouvel Utilisateur**
3. Remplissez le formulaire :
   - **Nom complet** : Nom et prénom de l'utilisateur
   - **Email** : Adresse email (servira d'identifiant)
   - **Rôle** : Admin, Formateur ou Client
   - **Mot de passe** : Doit respecter les règles de sécurité
   - **Compte actif** : Cocher pour activer immédiatement
4. Cliquez sur **Enregistrer**

### Modifier un utilisateur

1. Dans la liste des utilisateurs, cliquez sur **Éditer**
2. Modifiez les informations souhaitées
3. Cliquez sur **Enregistrer**

### Réinitialiser un mot de passe

1. Dans la liste des utilisateurs, cliquez sur **Mot de passe**
2. Entrez un nouveau mot de passe (doit respecter les règles)
3. Cliquez sur **Réinitialiser**
4. L'utilisateur devra changer son mot de passe à la prochaine connexion

### Supprimer un utilisateur

1. Dans la liste des utilisateurs, cliquez sur **Supprimer**
2. Confirmez la suppression
3. L'utilisateur est supprimé définitivement

## Architecture technique

### Fichiers

- **[auth-system.js](auth-system.js)** : Système d'authentification et gestion des utilisateurs
- **[crm-data.js](crm-data.js)** : Gestion des données du CRM
- **[index.html](index.html)** : Interface utilisateur complète

### Stockage des données

- **LocalStorage** : Toutes les données sont stockées localement dans le navigateur
- **Structure JSON** : Organisation claire et extensible
- **Namespace** : Préfixe `njm_crm_` pour éviter les conflits

### Structure des données

```javascript
{
  auth: {
    users: [
      {
        id: 1,
        name: "Administrateur",
        email: "admin@njm.fr",
        password: "hash_sha256",
        role: "admin",
        active: true,
        created: "2026-01-10T...",
        lastLogin: "2026-01-10T...",
        mustChangePassword: false
      }
    ],
    sessions: [
      {
        token: "random_token",
        userId: 1,
        createdAt: timestamp,
        expiresAt: timestamp
      }
    ],
    loginAttempts: {
      "user@email.com": {
        count: 0,
        lastAttempt: timestamp
      }
    }
  }
}
```

## Bonnes pratiques

### Pour les administrateurs

1. **Changez le mot de passe par défaut** immédiatement
2. **Créez des comptes individuels** pour chaque utilisateur
3. **Utilisez des mots de passe robustes** pour tous les comptes admin
4. **Désactivez les comptes** plutôt que de les supprimer (traçabilité)
5. **Réinitialisez les mots de passe** en cas de suspicion de compromission
6. **Vérifiez régulièrement** les dates de dernière connexion

### Pour les utilisateurs

1. **Ne partagez jamais** votre mot de passe
2. **Changez votre mot de passe** si vous pensez qu'il a été compromis
3. **Déconnectez-vous** après utilisation sur un ordinateur partagé
4. **Utilisez un mot de passe unique** différent de vos autres comptes

## Dépannage

### Compte verrouillé

**Problème** : "Compte temporairement verrouillé. Réessayez dans X minutes."

**Solution** : Attendez 15 minutes ou contactez un administrateur pour réinitialiser votre compte.

### Session expirée

**Problème** : Déconnexion automatique après inactivité

**Solution** : Reconnectez-vous. Les sessions expirent après 1 heure d'inactivité pour des raisons de sécurité.

### Mot de passe refusé

**Problème** : "Le mot de passe doit contenir au moins..."

**Solution** : Assurez-vous que votre mot de passe respecte tous les critères :
- 8 caractères minimum
- 1 majuscule
- 1 minuscule
- 1 chiffre
- 1 caractère spécial

### Impossible de supprimer un utilisateur

**Problème** : "Impossible de supprimer le dernier administrateur"

**Solution** : Il doit toujours y avoir au moins un administrateur actif. Créez un nouvel administrateur avant de supprimer l'actuel.

## Support

Pour toute question ou problème technique, contactez l'équipe de développement NJM Conseil.

---

**Version** : 1.0.0
**Date** : 10 janvier 2026
**Développé par** : Claude (Anthropic) pour NJM Conseil
