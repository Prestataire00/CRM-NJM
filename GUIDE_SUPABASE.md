# Guide de Migration vers Supabase - CRM NJM Conseil

## 📋 Vue d'ensemble

Ce guide vous accompagne dans la migration complète de votre CRM du localStorage vers Supabase, une base de données PostgreSQL avec authentification et API temps réel.

## 🎯 Avantages de Supabase

- ✅ **Données persistantes** : Plus de perte de données lors du nettoyage du navigateur
- ✅ **Multi-utilisateurs** : Accès depuis n'importe quel appareil
- ✅ **Sécurité renforcée** : Authentification Supabase + Row Level Security (RLS)
- ✅ **Temps réel** : Synchronisation automatique entre utilisateurs
- ✅ **Sauvegarde automatique** : Vos données sont sauvegardées dans le cloud
- ✅ **Scalabilité** : Supporte des milliers d'utilisateurs

## 📦 Fichiers créés

1. **[supabase-config.js](supabase-config.js)** - Configuration et initialisation du client Supabase
2. **[supabase-schema.sql](supabase-schema.sql)** - Schéma de la base de données (tables, indexes, RLS)
3. **[supabase-auth.js](supabase-auth.js)** - Système d'authentification avec Supabase Auth
4. **[supabase-data.js](supabase-data.js)** - Gestion des données via l'API Supabase
5. **[migrate-to-supabase.html](migrate-to-supabase.html)** - Interface de migration des données

## 🚀 Étapes d'installation

### Étape 1 : Créer le schéma de base de données

1. Connectez-vous à votre dashboard Supabase : https://supabase.com/dashboard/project/bbwiyfiyvgstgqyyopjx
2. Allez dans **SQL Editor** (menu de gauche)
3. Cliquez sur **New Query**
4. Copiez-collez tout le contenu du fichier [supabase-schema.sql](supabase-schema.sql)
5. Cliquez sur **Run** pour exécuter le script

✅ **Résultat attendu** : Toutes les tables, indexes, policies RLS et triggers sont créés.

### Étape 2 : Créer un utilisateur administrateur

Vous avez deux options :

#### Option A : Via le Dashboard Supabase (Recommandé)

1. Allez dans **Authentication** > **Users** dans votre dashboard
2. Cliquez sur **Add User** (ou **Invite user**)
3. Remplissez :
   - **Email** : `admin@njm.fr` (ou votre email)
   - **Password** : Créez un mot de passe fort (ex: `Admin2026!Secure`)
   - **Auto Confirm User** : ✅ Cochez cette case
4. Cliquez sur **Create user**
5. Le profil sera créé automatiquement grâce au trigger

#### Option B : Via SQL

```sql
-- Insérer un utilisateur dans auth.users
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@njm.fr',
    crypt('Admin2026!Secure', gen_salt('bf')),
    NOW(),
    '{"name": "Administrateur", "role": "admin"}'::jsonb,
    NOW(),
    NOW()
);
```

### Étape 3 : Vérifier les Row Level Security (RLS) Policies

Les policies sont déjà créées par le schéma SQL. Vérifiez qu'elles sont actives :

1. Allez dans **Authentication** > **Policies**
2. Vérifiez que chaque table a ses policies :
   - `profiles` : 4 policies (view own, admins view all, admins update, admins insert)
   - `learners` : 4 policies (view, insert, update, delete)
   - `formations` : 4 policies (view, insert, update, delete)
   - etc.

### Étape 4 : Intégrer Supabase dans votre HTML

Ouvrez votre fichier [index.html](index.html) et ajoutez les scripts Supabase **AVANT** la balise `</body>` :

```html
<!-- Supabase Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Supabase Configuration -->
<script src="supabase-config.js"></script>

<!-- Supabase Auth (remplace auth-system.js) -->
<script src="supabase-auth.js"></script>

<!-- Supabase Data (remplace crm-data.js) -->
<script src="supabase-data.js"></script>

<!-- Scripts existants -->
<script src="crm-data.js"></script> <!-- ⚠️ À COMMENTER après migration -->
<script src="auth-system.js"></script> <!-- ⚠️ À COMMENTER après migration -->
```

### Étape 5 : Migrer vos données existantes

1. Ouvrez le fichier [migrate-to-supabase.html](migrate-to-supabase.html) dans votre navigateur
2. Connectez-vous d'abord avec votre compte admin Supabase dans l'application principale
3. Revenez sur `migrate-to-supabase.html`
4. Cliquez sur **"📊 Analyser les données"**
5. Vérifiez le nombre d'items à migrer
6. Cliquez sur **"🚀 Démarrer la migration"**
7. Attendez que la migration se termine (une barre de progression s'affiche)

✅ **Résultat attendu** : Toutes vos données du localStorage sont maintenant dans Supabase.

### Étape 6 : Adapter votre code existant

#### Remplacer les appels à `AuthSystem` par `SupabaseAuth`

**AVANT** (avec localStorage) :
```javascript
const result = AuthSystem.login(email, password);
if (result.success) {
    console.log('Connecté !', result.user);
}
```

**APRÈS** (avec Supabase) :
```javascript
const result = await SupabaseAuth.login(email, password);
if (result.success) {
    console.log('Connecté !', result.user);
}
```

⚠️ **Important** : Toutes les méthodes sont maintenant **asynchrones** (`async/await`).

#### Remplacer les appels à `CRMData` par `SupabaseData`

**AVANT** (avec localStorage) :
```javascript
CRMData.addLearner({
    name: 'John Doe',
    email: 'john@example.com'
});
```

**APRÈS** (avec Supabase) :
```javascript
const result = await SupabaseData.addLearner({
    name: 'John Doe',
    email: 'john@example.com'
});

if (result.success) {
    console.log('Apprenant ajouté', result.data);
}
```

### Étape 7 : Tester la connexion

1. Ouvrez [index.html](index.html) dans votre navigateur
2. Connectez-vous avec les identifiants admin créés à l'Étape 2
3. Vérifiez que :
   - ✅ La connexion fonctionne
   - ✅ Les données migrées s'affichent
   - ✅ Vous pouvez ajouter de nouveaux éléments
   - ✅ Les modifications sont sauvegardées

## 📊 Structure de la base de données

### Tables créées

| Table | Description | Nombre de colonnes |
|-------|-------------|-------------------|
| `profiles` | Profils utilisateurs (étend auth.users) | 9 |
| `learners` | Apprenants | 10 |
| `formations` | Formations | 11 |
| `formation_documents` | Documents de formation | 7 |
| `veille` | Veille (formation, métier, légal) | 9 |
| `bpf` | Bilans pédagogiques et financiers | 8 |
| `pedagogical_library` | Bibliothèque pédagogique | 9 |
| `templates_library` | Bibliothèque de templates | 9 |
| `settings` | Paramètres de l'application | 4 |

### Sécurité : Row Level Security (RLS)

Chaque table a des **policies** qui contrôlent l'accès :

- **Admins** : Accès complet à toutes les données
- **Formateurs** : Accès en lecture/écriture aux formations, veille, bibliothèques
- **Clients** : Accès uniquement à leurs propres données

Exemple de policy :
```sql
-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

## 🔧 API Supabase disponible

### Authentification (`SupabaseAuth`)

```javascript
// Connexion
const result = await SupabaseAuth.login(email, password);

// Déconnexion
await SupabaseAuth.logout();

// Vérifier la session
const user = await SupabaseAuth.checkSession();

// Changer le mot de passe
await SupabaseAuth.changePassword(currentPassword, newPassword);

// Admin : Créer un utilisateur
await SupabaseAuth.registerUser(adminUserId, {
    name: 'John Doe',
    email: 'john@example.com',
    role: 'formateur',
    password: 'SecurePass123!'
});

// Admin : Récupérer tous les utilisateurs
const { users } = await SupabaseAuth.getAllUsers(adminUserId);

// Admin : Mettre à jour un utilisateur
await SupabaseAuth.updateUser(adminUserId, userId, {
    name: 'New Name',
    active: false
});

// Admin : Supprimer un utilisateur
await SupabaseAuth.deleteUser(adminUserId, userId);

// Vérifier les permissions
const isAdmin = await SupabaseAuth.isAdmin(userId);
const hasPermission = await SupabaseAuth.hasPermission(userId, 'edit_formations');
```

### Données (`SupabaseData`)

#### Apprenants (Learners)

```javascript
// Récupérer tous les apprenants
const { data: learners } = await SupabaseData.getLearners();

// Ajouter un apprenant
const result = await SupabaseData.addLearner({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '0123456789',
    company: 'ABC Corp',
    status: 'active'
});

// Mettre à jour un apprenant
await SupabaseData.updateLearner(learnerId, { status: 'completed' });

// Supprimer un apprenant
await SupabaseData.deleteLearner(learnerId);

// Compter les apprenants de l'année fiscale
const count = await SupabaseData.getLearnersCount();
```

#### Formations

```javascript
// Récupérer toutes les formations (avec documents)
const { data: formations } = await SupabaseData.getFormations();

// Ajouter une formation
const result = await SupabaseData.addFormation({
    title: 'Formation React',
    description: 'Apprendre React.js',
    start_date: '2026-02-01',
    end_date: '2026-02-05',
    status: 'planned',
    trainer: 'Marie Martin',
    location: 'Paris',
    max_participants: 12
});

// Ajouter un document à une formation
await SupabaseData.addFormationDocument(formationId, {
    name: 'Support de cours.pdf',
    type: 'pdf',
    file_url: 'https://...',
    file_size: 1024000
});

// Mettre à jour une formation
await SupabaseData.updateFormation(formationId, { status: 'in_progress' });

// Supprimer une formation
await SupabaseData.deleteFormation(formationId);
```

#### Veille

```javascript
// Récupérer toute la veille
const { data: veille } = await SupabaseData.getVeille();

// Récupérer la veille par type
const { data: veilleFormation } = await SupabaseData.getVeille('formation');

// Ajouter un item de veille
await SupabaseData.addVeille('metier', {
    title: 'Nouvelle réglementation',
    content: 'Description...',
    source: 'Journal officiel',
    url: 'https://...'
});

// Marquer comme lu/non lu
await SupabaseData.toggleVeilleRead(veilleId);

// Supprimer
await SupabaseData.deleteVeille(veilleId);
```

#### BPF (Bilans Pédagogiques et Financiers)

```javascript
// Récupérer tous les BPF
const { data: bpf } = await SupabaseData.getBPF();

// Ajouter un BPF
await SupabaseData.addBPF({
    year: 2025,
    title: 'BPF 2025',
    description: 'Bilan de l\'année 2025',
    file_url: 'https://...',
    status: 'draft'
});
```

#### Bibliothèques

```javascript
// Bibliothèque pédagogique
const { data: vente } = await SupabaseData.getPedagogicalLibrary('vente');

await SupabaseData.addToPedagogicalLibrary('marketing', {
    title: 'Guide Marketing Digital',
    description: 'Guide complet',
    file_url: 'https://...',
    file_type: 'pdf',
    file_size: 2048000,
    tags: ['marketing', 'digital', 'guide']
});

// Bibliothèque de templates
const { data: templates } = await SupabaseData.getTemplatesLibrary('pedagogiques');

await SupabaseData.addTemplate('formateurs', {
    title: 'CV Formateur',
    description: 'CV de Jean Dupont',
    file_url: 'https://...',
    file_type: 'pdf',
    expiry_date: '2026-12-31'
});

// Récupérer les documents qui expirent bientôt
const { data: expiring } = await SupabaseData.getExpiringDocuments();
```

#### Paramètres

```javascript
// Récupérer un paramètre
const { data: company } = await SupabaseData.getSetting('company');

// Mettre à jour un paramètre
await SupabaseData.updateSetting('theme', 'dark');

// Mettre à jour plusieurs paramètres
await SupabaseData.updateSettings({
    company: { name: 'NJM Conseil', siret: '123456789' },
    theme: 'default',
    logo: 'logo-njm.png'
});
```

#### Statistiques du tableau de bord

```javascript
const { stats } = await SupabaseData.getDashboardStats();
console.log(stats);
// {
//     learnersCount: 45,
//     formationsCompleted: 12,
//     formationsInProgress: 3,
//     clientAccesses: 28
// }
```

## 🔐 Sécurité et bonnes pratiques

### 1. Gestion des clés API

⚠️ **IMPORTANT** : La clé `ANON_KEY` dans `supabase-config.js` est **publique** et peut être exposée côté client. C'est normal ! La sécurité est assurée par :

- Les **Row Level Security (RLS) policies** sur chaque table
- L'**authentification** via Supabase Auth
- Les **tokens JWT** générés à la connexion

### 2. Ne jamais exposer la clé `SERVICE_ROLE`

La clé `SERVICE_ROLE` (disponible dans Settings > API) **NE DOIT JAMAIS** être utilisée côté client. Elle bypasse toutes les policies RLS et donne un accès admin total.

### 3. Validation des permissions

Toujours vérifier les permissions avant les opérations sensibles :

```javascript
const isAdmin = await SupabaseAuth.isAdmin(userId);
if (!isAdmin) {
    alert('Accès refusé');
    return;
}

// Opération admin...
```

### 4. Gestion des erreurs

Toujours gérer les erreurs dans vos appels API :

```javascript
const result = await SupabaseData.addLearner(learnerData);

if (!result.success) {
    console.error('Erreur:', result.message);
    alert('Une erreur est survenue');
    return;
}

// Succès
console.log('Apprenant créé:', result.data);
```

## 🐛 Dépannage

### Erreur : "relation does not exist"

**Cause** : Les tables n'ont pas été créées dans Supabase.

**Solution** : Exécutez le schéma SQL ([supabase-schema.sql](supabase-schema.sql)) dans l'éditeur SQL de Supabase.

### Erreur : "new row violates row-level security policy"

**Cause** : Vous n'avez pas les permissions pour effectuer cette opération.

**Solution** :
1. Vérifiez que vous êtes connecté
2. Vérifiez votre rôle (admin, formateur, client)
3. Vérifiez que les policies RLS sont correctement configurées

### Erreur : "User not found" lors de la connexion

**Cause** : L'utilisateur n'existe pas dans Supabase Auth.

**Solution** : Créez un utilisateur admin via le dashboard Supabase (voir Étape 2).

### Les données ne s'affichent pas après migration

**Cause** : La migration a peut-être échoué ou vous n'êtes pas connecté.

**Solution** :
1. Vérifiez la console du navigateur pour les erreurs
2. Connectez-vous avec votre compte admin
3. Relancez la migration si nécessaire

### Erreur : "Invalid API key"

**Cause** : La clé API Supabase est incorrecte ou le projet n'existe pas.

**Solution** : Vérifiez les credentials dans [supabase-config.js](supabase-config.js).

## 📚 Ressources supplémentaires

- [Documentation Supabase](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

## ✅ Checklist de migration

- [ ] Schéma SQL exécuté dans Supabase
- [ ] Utilisateur admin créé
- [ ] Scripts Supabase ajoutés dans index.html
- [ ] Données migrées via migrate-to-supabase.html
- [ ] Connexion testée avec succès
- [ ] Ancien code localStorage commenté/supprimé
- [ ] Toutes les fonctionnalités testées
- [ ] Sauvegarde des anciennes données effectuée

## 🎉 Félicitations !

Votre CRM est maintenant connecté à Supabase ! Profitez d'une base de données persistante, sécurisée et scalable.

**Prochaines étapes recommandées** :
1. Configurer le stockage de fichiers avec Supabase Storage
2. Activer les sauvegardes automatiques
3. Configurer les webhooks pour les notifications
4. Implémenter le temps réel pour la collaboration multi-utilisateurs

---

**Support** : En cas de problème, consultez la [documentation Supabase](https://supabase.com/docs) ou créez une issue sur le projet.
