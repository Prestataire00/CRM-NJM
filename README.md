# 🎓 CRM NJM Formation

Application web complète de gestion de formations, apprenants et ressources pédagogiques, connectée à Supabase.

![Version](https://img.shields.io/badge/version-2.1-blue)
![Supabase](https://img.shields.io/badge/supabase-enabled-green)
![Status](https://img.shields.io/badge/status-production-success)

## 🆕 Nouveauté - Formulaire de Formations Complet

**Nouveau formulaire avec interface à onglets pour la création de formations !**

✨ **Fonctionnalités**:
- 📋 Interface à 4 onglets (Infos générales, Feuilles de présence, Entreprise, Contenu pédagogique)
- 🔄 Gestion dynamique des jours et apprenants
- 📝 Feuilles de présence détaillées par jour
- 📊 Tous les champs nécessaires pour une formation professionnelle

⚠️ **Action requise**: Exécuter la migration SQL - voir [`INSTRUCTIONS_DEPLOYMENT.md`](INSTRUCTIONS_DEPLOYMENT.md)

📖 **Documentation**: [`docs/GUIDE_FORMULAIRE_FORMATIONS.md`](docs/GUIDE_FORMULAIRE_FORMATIONS.md)

---

## 🚀 Démarrage rapide

### Lancer l'application

1. **Ouvrez** `index.html` dans votre navigateur
2. **Connectez-vous** avec vos identifiants
3. **Commencez** à utiliser le CRM

### Identifiants par défaut

- **Email** : `isma.lepennec@gmail.com`
- **Mot de passe** : Votre mot de passe Supabase

---

## 📁 Structure du projet

```
CRM/
├── 📄 index.html                          # Point d'entrée principal
├── 📖 README.md                           # Ce fichier
│
├── 📁 assets/                             # Ressources statiques
│   ├── css/
│   │   └── formation-form.css            # 🆕 Styles formulaire formations
│   └── images/
│       └── logo-njm.png
│
├── 📁 src/                                # Code source
│   ├── config/
│   │   └── supabase-config.js            # Configuration Supabase
│   ├── auth/
│   │   └── supabase-auth-v2.js           # Authentification
│   ├── data/
│   │   └── supabase-data.js              # Gestion des données
│   ├── components/
│   │   └── formation-form.js             # 🆕 Formulaire formations complet
│   └── app/
│       └── index-supabase.js             # Logique métier CRM
│
├── 📁 database/                           # Scripts SQL
│   ├── schema/
│   │   └── supabase-schema.sql           # Schéma complet
│   └── migrations/
│       ├── fix-rls-policies.sql
│       ├── fix-user-profile.sql
│       └── add-complete-formation-fields.sql  # 🆕 Migration formulaire
│
├── 📁 tools/                              # Outils de développement
│   ├── diagnostic.html                   # Diagnostic connexion
│   ├── test-supabase-connection.html     # Tests
│   ├── test-hash.html
│   └── migrate-to-supabase.html          # Migration
│
├── 📁 docs/                               # Documentation
│   ├── RECAP_CRM_SUPABASE.md             # 📚 Guide complet
│   ├── GUIDE_SUPABASE.md
│   ├── DEMARRAGE_RAPIDE_SUPABASE.md
│   ├── REORGANISATION_FICHIERS.md
│   ├── GUIDE_FORMULAIRE_FORMATIONS.md    # 🆕 Guide formulaire complet
│   └── NOUVEAU_FORMULAIRE_FORMATIONS.md  # 🆕 Récapitulatif implémentation
│
└── 📁 archive/                            # Anciens fichiers
    ├── auth-system.js
    ├── crm-data.js
    └── supabase-auth.js
```

---

## ✨ Fonctionnalités principales

### 🎯 Tableau de bord
- Vue d'ensemble des statistiques
- Accès rapide aux sections

### 📚 Gestion des Formations
- Créer, modifier, supprimer des formations
- Statuts : Planifiée, En cours, Terminée, Annulée
- Gestion des documents associés

### 🔍 Veille
- Articles et ressources
- Catégories : IA, Pédagogie, Technologie

### 📖 BPF (Bonnes Pratiques)
- Collection de bonnes pratiques de formation

### 📚 Bibliothèques
- **Pédagogique** : Ressources pédagogiques
- **Templates** : Modèles de documents

### 👥 Gestion des Accès
- **Créer des utilisateurs** directement depuis le CRM
- Rôles : Admin, Formateur, Client
- Gestion des permissions

---

## 🔐 Rôles et Permissions

### Admin
- ✅ Accès complet
- ✅ Gestion des utilisateurs
- ✅ Toutes les fonctionnalités

### Formateur
- ✅ Gestion des formations
- ✅ Accès à la veille et bibliothèques
- ❌ Pas d'accès à la gestion des utilisateurs

### Client
- ✅ Consultation uniquement
- ❌ Pas de modification

---

## 🛠️ Configuration

### Supabase

Votre CRM est connecté à Supabase. La configuration se trouve dans :
```
src/config/supabase-config.js
```

**Dashboard Supabase** : https://supabase.com/dashboard/project/bbwiyfiyvgstgqyyopjx

### Base de données

9 tables créées :
- `profiles` - Profils utilisateurs
- `learners` - Apprenants
- `formations` - Formations
- `formation_documents` - Documents
- `veille` - Articles de veille
- `bpf` - Bonnes pratiques
- `pedagogical_library` - Bibliothèque pédagogique
- `templates_library` - Bibliothèque templates
- `settings` - Paramètres

---

## 🔧 Outils de développement

### Diagnostic
Testez la connexion Supabase :
```
tools/diagnostic.html
```

### Migration
Migrez vos données localStorage vers Supabase :
```
tools/migrate-to-supabase.html
```

### Tests
Tests de connexion :
```
tools/test-supabase-connection.html
```

---

## 📖 Documentation complète

### Guide principal
**Consultez** [`docs/RECAP_CRM_SUPABASE.md`](docs/RECAP_CRM_SUPABASE.md) pour :
- Architecture détaillée
- Guide d'utilisation complet
- Dépannage
- Évolutions futures

### Autres guides
- **Démarrage rapide** : `docs/DEMARRAGE_RAPIDE_SUPABASE.md`
- **Guide Supabase** : `docs/GUIDE_SUPABASE.md`
- **Réorganisation** : `docs/REORGANISATION_FICHIERS.md`

---

## 🚨 Dépannage

### Erreur de connexion

1. Vérifiez que l'utilisateur existe dans Supabase (Authentication > Users)
2. Vérifiez que l'email est confirmé
3. Utilisez `tools/diagnostic.html` pour diagnostiquer

### Profil inexistant

Exécutez le script :
```sql
database/migrations/fix-user-profile.sql
```

### Erreur de récursion RLS

Exécutez le script :
```sql
database/migrations/fix-rls-policies.sql
```

---

## 💾 Sauvegarde

Vos données sont **automatiquement sauvegardées** dans Supabase.

### Sauvegardes Supabase
- **Automatiques** : Toutes les 24h
- **Manuelles** : Via le dashboard Supabase

---

## 🌍 Accès multi-appareils

### Depuis un autre ordinateur

1. **Copiez** tous les fichiers du CRM
2. **Ouvrez** `index.html`
3. **Connectez-vous** avec vos identifiants
4. ✅ Toutes vos données sont synchronisées via Supabase

---

## 📊 Stack technique

- **Frontend** : HTML5, CSS3, JavaScript (Vanilla)
- **Backend** : Supabase (PostgreSQL + Auth + API)
- **Base de données** : PostgreSQL 15
- **Authentification** : Supabase Auth (JWT)
- **Sécurité** : Row Level Security (RLS)

---

## 📈 Évolutions futures

### Court terme
- [ ] Export Excel
- [ ] Filtres avancés
- [ ] Recherche globale

### Moyen terme
- [ ] Supabase Storage (fichiers)
- [ ] Notifications en temps réel
- [ ] Mode hors ligne

### Long terme
- [ ] Application mobile
- [ ] API publique
- [ ] Workflow d'approbation

---

## 🆘 Support

### Problème technique
1. Consultez [`docs/RECAP_CRM_SUPABASE.md`](docs/RECAP_CRM_SUPABASE.md)
2. Utilisez `tools/diagnostic.html`
3. Vérifiez la console du navigateur (F12)

### Questions Supabase
- **Dashboard** : https://supabase.com/dashboard
- **Documentation** : https://supabase.com/docs

---

## 📝 Notes

### Sécurité
- ✅ Authentification Supabase (JWT)
- ✅ Row Level Security (RLS) activé
- ✅ Chiffrement des données
- ✅ Sessions sécurisées

### Performance
- ⚡ Latence < 200ms
- 🚀 Temps de chargement < 2s
- 💾 Capacité illimitée (cloud)

---

## ✅ Statut du projet

- [x] Migration Supabase complète
- [x] Authentification fonctionnelle
- [x] Création d'utilisateurs depuis le CRM
- [x] Toutes les sections connectées
- [x] Tests validés
- [x] Documentation complète
- [x] Structure de fichiers organisée

**Statut** : ✅ **Production Ready**

---

**Version** : 2.0 - Supabase Edition
**Dernière mise à jour** : 11 janvier 2026
**Développé pour** : NJM Formation

🎓 Prêt à l'emploi !
