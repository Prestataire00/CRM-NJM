# 📝 Guide du Formulaire de Création de Formations

**Date**: 11 janvier 2026
**Version**: 2.0
**Statut**: ✅ Complet et fonctionnel

---

## 🎯 Vue d'ensemble

Le nouveau formulaire de création de formations offre une interface complète avec onglets pour gérer tous les aspects d'une formation, de la planification initiale au contenu pédagogique détaillé.

### Caractéristiques principales

✅ **Interface à onglets** - Organisation claire en 4 sections
✅ **Gestion dynamique** - Ajout/suppression de jours et apprenants
✅ **Feuilles de présence** - Suivi détaillé des heures par jour et par apprenant
✅ **Données complètes** - Tous les champs nécessaires pour une formation professionnelle
✅ **Édition en place** - Modification directe des formations existantes

---

## 📋 Structure du formulaire

### Onglet 1: Informations générales

**Champs disponibles:**

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| Nom de la formation | Liste déroulante | ✅ Oui | Techniques de vente / Management / Manager commercial |
| Type de formation | Liste déroulante | ✅ Oui | Écoles ou Entreprises |
| Mode de collaboration | Liste déroulante | ✅ Oui | Direct / Indirect / Sous-traitant |
| Nom du client | Texte | ✅ Oui | Nom de l'entreprise ou organisation |
| Date de début | Date | ✅ Oui | Date de début de la formation |
| Date de fin | Date | ✅ Oui | Date de fin de la formation |
| Lieu de la formation | Texte | ❌ Non | Adresse ou lieu de la formation |
| Nombre de jours | Nombre | ❌ Non | Durée totale en jours |
| Heures par jour | Nombre | ❌ Non | Durée quotidienne (ex: 7, 3.5) |
| Heures par apprenant | Nombre | ❌ Non | Total d'heures par apprenant |
| Montant de la formation | Nombre | ❌ Non | Prix total en euros |
| Statut | Liste déroulante | ❌ Non | Planifiée / En cours / Terminée / Annulée |

**Exemple de remplissage:**

```
Nom de la formation: Techniques de vente
Type de formation: Entreprises
Mode de collaboration: Direct
Nom du client: ACME Corporation
Date de début: 2026-02-15
Date de fin: 2026-02-17
Lieu: Paris - Salle de formation A
Nombre de jours: 3
Heures par jour: 7
Montant: 4500€
```

---

### Onglet 2: Feuilles de présence

**Fonctionnement:**

1. **Ajouter un jour**
   - Cliquez sur "+ Ajouter un jour"
   - Le système crée automatiquement "Jour 1", "Jour 2", etc.

2. **Configurer un jour**
   - Sélectionnez la date
   - Ajoutez les apprenants pour ce jour
   - Saisissez les heures pour chaque apprenant

3. **Ajouter des apprenants à un jour**
   - Cliquez sur "+ Ajouter apprenant" dans la section du jour
   - Entrez le nom de l'apprenant
   - Saisissez le nombre d'heures (ex: 7, 3.5)

4. **Supprimer**
   - Bouton 🗑️ pour supprimer un apprenant d'un jour
   - Bouton "Supprimer" pour retirer un jour complet

**Structure de données:**

```json
{
  "attendance_sheets": [
    {
      "day": 1,
      "date": "2026-02-15",
      "learners_hours": [
        {
          "learner_name": "Jean Dupont",
          "hours": 7
        },
        {
          "learner_name": "Marie Martin",
          "hours": 7
        }
      ]
    },
    {
      "day": 2,
      "date": "2026-02-16",
      "learners_hours": [...]
    }
  ]
}
```

**Exemple d'utilisation:**

```
Jour 1 - 15/02/2026
├── Jean Dupont: 7h
├── Marie Martin: 7h
└── Paul Durand: 6h (parti plus tôt)

Jour 2 - 16/02/2026
├── Jean Dupont: 7h
└── Marie Martin: 7h
(Paul Durand absent)
```

---

### Onglet 3: Entreprise & Apprenants

**Section Entreprise:**

| Champ | Description |
|-------|-------------|
| Raison sociale | Nom légal de l'entreprise |
| Adresse de l'entreprise | Adresse complète |
| Code postal | Code postal |
| Nom du dirigeant | Nom du responsable ou dirigeant |

**Section Apprenants:**

1. **Ajouter un apprenant**
   - Cliquez sur "+ Ajouter apprenant"
   - Numérotation automatique (Apprenant 1, 2, 3...)

2. **Informations par apprenant**
   - Prénom
   - Nom

3. **Gestion**
   - Ajout illimité d'apprenants
   - Suppression individuelle avec bouton 🗑️
   - Réindexation automatique après suppression

**Structure de données:**

```json
{
  "learners_data": [
    {
      "id": 1674567890123,
      "first_name": "Jean",
      "last_name": "Dupont",
      "position": 1
    },
    {
      "id": 1674567890456,
      "first_name": "Marie",
      "last_name": "Martin",
      "position": 2
    }
  ]
}
```

---

### Onglet 4: Contenu pédagogique

**Champs disponibles:**

| Champ | Description | Exemple |
|-------|-------------|---------|
| Public cible | À qui s'adresse la formation | "Commerciaux juniors et confirmés" |
| Pré-requis | Connaissances ou expériences nécessaires | "Aucun pré-requis" ou "3 ans d'expérience en vente" |
| Objectifs | Objectifs pédagogiques | "Maîtriser les techniques de closing..." |
| Module 1 | Détails du contenu du module | "Introduction aux techniques de vente\n- Écoute active\n- Questionnement..." |
| Méthode, moyens, outils | Approche pédagogique | "Formation en présentiel, exercices pratiques, jeux de rôle" |
| Délais d'accès | Temps nécessaire avant démarrage | "15 jours avant le début de la formation" |

**Exemple de contenu pédagogique:**

```
Public cible:
Commerciaux juniors et confirmés souhaitant améliorer leurs performances

Pré-requis:
Aucun pré-requis nécessaire

Objectifs:
- Maîtriser les techniques de closing
- Développer son écoute active
- Gérer les objections clients
- Augmenter son taux de conversion

Module 1:
Introduction aux techniques de vente modernes
- Les fondamentaux de la vente B2B
- L'écoute active et le questionnement
- La découverte des besoins clients
- Les techniques de closing efficaces

Méthode, moyens, outils:
Formation en présentiel avec alternance de théorie et pratique
- Exercices pratiques en groupe
- Jeux de rôle et mises en situation
- Support de cours numérique fourni
- Évaluation continue

Délais d'accès:
15 jours ouvrés avant le début de la formation
```

---

## 🔄 Workflow d'utilisation

### Créer une nouvelle formation

```
1. Cliquer sur "+ Nouvelle Formation"
   ↓
2. Remplir l'onglet "Informations générales"
   - Nom de la formation ✅
   - Type ✅
   - Mode de collaboration ✅
   - Client ✅
   - Dates ✅
   ↓
3. Passer à "Feuilles de présence"
   - Ajouter les jours de formation
   - Ajouter les apprenants et leurs heures pour chaque jour
   ↓
4. Passer à "Entreprise & Apprenants"
   - Compléter les infos entreprise
   - Ajouter tous les apprenants
   ↓
5. Passer à "Contenu pédagogique"
   - Remplir les objectifs et le programme
   ↓
6. Cliquer sur "Créer la formation"
   ✅ Formation sauvegardée dans Supabase
```

### Modifier une formation existante

```
1. Cliquer sur "Voir" dans la liste des formations
   ↓
2. Le formulaire s'ouvre avec toutes les données
   ↓
3. Naviguer entre les onglets pour modifier
   ↓
4. Cliquer sur "Mettre à jour"
   ✅ Modifications sauvegardées
```

---

## 💾 Stockage des données

### Base de données Supabase

**Table**: `formations`

**Nouveaux champs ajoutés:**

```sql
-- Informations générales
formation_name TEXT
formation_type TEXT (ecoles/entreprises)
collaboration_mode TEXT (direct/indirect/sous-traitant)
client_name TEXT

-- Détails formation
training_location TEXT
number_of_days INTEGER
hours_per_day DECIMAL(4,2)
hours_per_learner DECIMAL(4,2)
total_amount DECIMAL(10,2)

-- Entreprise
company_name TEXT
company_address TEXT
company_postal_code TEXT
company_director_name TEXT

-- Contenu pédagogique
target_audience TEXT
prerequisites TEXT
objectives TEXT
module_1 TEXT
methods_tools TEXT
access_delays TEXT

-- Données JSON
attendance_sheets JSONB
learners_data JSONB
```

### Migration nécessaire

**Important**: Pour utiliser le nouveau formulaire, vous devez exécuter le script de migration:

```
database/migrations/add-complete-formation-fields.sql
```

**Comment exécuter:**

1. Ouvrez Supabase Dashboard
2. Allez dans **SQL Editor**
3. Cliquez sur **New Query**
4. Copiez/collez le contenu du fichier `add-complete-formation-fields.sql`
5. Cliquez sur **Run**
6. ✅ Les nouveaux champs sont ajoutés

---

## 🎨 Interface utilisateur

### Onglets

Les onglets utilisent une interface moderne avec:

- **Navigation visuelle** - 📋 📅 🏢 📚
- **Indicateur actif** - Ligne rose sous l'onglet actif
- **Survol interactif** - Changement de couleur au survol
- **Responsive** - S'adapte aux petits écrans

### Boutons

| Type | Couleur | Utilisation |
|------|---------|-------------|
| **Primaire** | Rose | Créer / Mettre à jour |
| **Secondaire** | Gris | Annuler |
| **Ajouter** | Vert | + Ajouter jour / apprenant |
| **Supprimer** | Rouge | 🗑️ Supprimer |

### Cartes

- **Jour de présence** - Fond gris clair, bordure
- **Apprenant** - Numérotation, deux champs prénom/nom

---

## ⚙️ Fichiers techniques

### Fichiers créés

```
src/components/formation-form.js     # Logique du formulaire
assets/css/formation-form.css        # Styles du formulaire
database/migrations/add-complete-formation-fields.sql  # Migration SQL
docs/GUIDE_FORMULAIRE_FORMATIONS.md  # Ce guide
```

### Fichiers modifiés

```
index.html                   # Ajout des scripts CSS/JS
src/app/index-supabase.js    # Modification addFormation() et viewFormation()
```

### Intégration dans index.html

```html
<!-- Formation Form Component (Formulaire complet avec onglets) -->
<link rel="stylesheet" href="assets/css/formation-form.css">
<script src="src/components/formation-form.js"></script>
```

---

## 🚀 API JavaScript

### FormationForm.show()

Affiche le formulaire de création ou d'édition.

```javascript
// Créer une nouvelle formation
FormationForm.show();

// Éditer une formation existante
FormationForm.show(formationId);
```

### FormationForm.close()

Ferme le modal et réinitialise le formulaire.

```javascript
FormationForm.close();
```

### Gestion des jours

```javascript
// Ajouter un jour
FormationForm.addAttendanceDay();

// Supprimer un jour
FormationForm.removeAttendanceDay(dayIndex);

// Mettre à jour la date
FormationForm.updateAttendanceDate(dayIndex, date);
```

### Gestion des apprenants dans les jours

```javascript
// Ajouter un apprenant à un jour
FormationForm.addLearnerToDay(dayIndex);

// Supprimer un apprenant d'un jour
FormationForm.removeLearnerFromDay(dayIndex, learnerIndex);

// Mettre à jour le nom
FormationForm.updateLearnerName(dayIndex, learnerIndex, name);

// Mettre à jour les heures
FormationForm.updateLearnerHours(dayIndex, learnerIndex, hours);
```

### Gestion de la liste des apprenants

```javascript
// Ajouter un apprenant
FormationForm.addLearner();

// Supprimer un apprenant
FormationForm.removeLearner(index);

// Mettre à jour un champ
FormationForm.updateLearnerField(index, field, value);
```

---

## ✅ Tests recommandés

### Test 1: Création d'une formation complète

```
1. Ouvrir index.html
2. Aller dans "Formation 2026"
3. Cliquer sur "+ Nouvelle Formation"
4. Remplir tous les onglets
5. Créer la formation
6. Vérifier qu'elle apparaît dans la liste
```

### Test 2: Feuilles de présence dynamiques

```
1. Créer une formation
2. Aller dans l'onglet "Feuilles de présence"
3. Ajouter 3 jours
4. Ajouter 5 apprenants au jour 1
5. Ajouter 4 apprenants au jour 2 (un absent)
6. Supprimer le jour 3
7. Sauvegarder
8. Rouvrir la formation
9. Vérifier que les données sont bien là
```

### Test 3: Édition d'une formation

```
1. Ouvrir une formation existante
2. Modifier le nom du client
3. Ajouter un jour de présence
4. Modifier le contenu pédagogique
5. Mettre à jour
6. Rouvrir pour vérifier les changements
```

### Test 4: Suppression d'éléments

```
1. Créer une formation avec 5 jours et 6 apprenants
2. Supprimer le jour 3
3. Vérifier que la numérotation se réajuste
4. Supprimer l'apprenant 2
5. Vérifier que les positions se mettent à jour
```

---

## 🐛 Dépannage

### Le formulaire ne s'ouvre pas

**Cause possible**: Script `formation-form.js` non chargé

**Solution**:
```
1. Ouvrir la console du navigateur (F12)
2. Vérifier les erreurs de chargement
3. Vérifier que les scripts sont bien dans index.html
4. Recharger la page (Ctrl+F5)
```

### Les données ne se sauvegardent pas

**Cause possible**: Migration SQL non exécutée

**Solution**:
```
1. Ouvrir Supabase Dashboard
2. Exécuter database/migrations/add-complete-formation-fields.sql
3. Vérifier dans Table Editor que les colonnes existent
```

### Erreur "Column does not exist"

**Cause**: Champ manquant dans la base de données

**Solution**:
```sql
-- Exécuter dans Supabase SQL Editor
ALTER TABLE formations ADD COLUMN IF NOT EXISTS formation_name TEXT;
ALTER TABLE formations ADD COLUMN IF NOT EXISTS attendance_sheets JSONB DEFAULT '[]'::jsonb;
-- etc.
```

### Les apprenants ne s'ajoutent pas

**Vérification**:
```
1. Ouvrir la console (F12)
2. Regarder les erreurs JavaScript
3. Vérifier que learners_data est bien un tableau
4. Essayer de rafraîchir l'onglet
```

---

## 📊 Compatibilité

### Navigateurs supportés

✅ **Chrome** 90+
✅ **Firefox** 88+
✅ **Safari** 14+
✅ **Edge** 90+

### Anciennes formations

Les formations créées avec l'ancien système simple continuent de fonctionner. Le nouveau formulaire affiche:

- `client_name` si disponible, sinon `title`
- `formation_name` si disponible, sinon `description`

---

## 🎯 Bonnes pratiques

### Nommage des formations

```
✅ BON: "Techniques de vente - ACME Corp - Février 2026"
❌ MAUVAIS: "Formation 1"
```

### Feuilles de présence

- **Saisir les heures réelles** pour chaque apprenant
- **Marquer les absences** (ne pas ajouter l'apprenant au jour concerné)
- **Vérifier les totaux** avant validation

### Contenu pédagogique

- **Objectifs clairs et mesurables**
- **Programme détaillé** dans Module 1
- **Méthodes pédagogiques** précises

---

## 🔄 Évolutions futures possibles

### Court terme

- [ ] Export PDF des feuilles de présence
- [ ] Calcul automatique des totaux d'heures
- [ ] Validation des dates (fin > début)

### Moyen terme

- [ ] Modules 2, 3, 4... (gestion multi-modules)
- [ ] Signature électronique des feuilles de présence
- [ ] Import CSV des apprenants

### Long terme

- [ ] Génération automatique de conventions
- [ ] Envoi d'emails aux apprenants
- [ ] Questionnaires de satisfaction intégrés

---

## 📝 Conclusion

Le nouveau formulaire de création de formations offre une interface complète et professionnelle pour gérer tous les aspects d'une formation.

**Avantages**:

✅ Interface organisée en onglets
✅ Gestion dynamique et flexible
✅ Toutes les données en un seul endroit
✅ Édition facile des formations existantes
✅ Stockage sécurisé dans Supabase

**Prêt à l'emploi !** 🚀

---

**Version**: 2.0
**Date de création**: 11 janvier 2026
**Auteur**: Assistant Claude
**Statut**: ✅ Documentation complète
