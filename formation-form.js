/**
 * FORMATION FORM - Gestion du formulaire complet de création de formations
 * Avec interface à onglets et gestion dynamique des jours/apprenants
 */

const FormationForm = {
    currentFormation: null,
    currentTab: 'general',
    attendanceSheets: [],
    learnersData: [],
    clientsData: [],
    subcontractorsData: [],

    /**
     * Charge les clients et sous-traitants pour les dropdowns
     */
    async loadClientsAndSubcontractors() {
        try {
            const [clientsResult, subcontractorsResult] = await Promise.all([
                SupabaseData.getClients(),  // Tous les clients sans filtre
                SupabaseData.getSubcontractors()
            ]);

            if (clientsResult.success) {
                this.clientsData = clientsResult.data || [];
            }
            if (subcontractorsResult.success) {
                this.subcontractorsData = subcontractorsResult.data || [];
            }
        } catch (error) {
            console.error('Erreur chargement clients/sous-traitants:', error);
        }
    },

    /**
     * Affiche le modal de création/édition de formation
     */
    async show(formationId = null) {
        // Charger les clients et sous-traitants pour les dropdowns
        await this.loadClientsAndSubcontractors();

        if (formationId) {
            // Mode édition
            await this.loadFormation(formationId);
        } else {
            // Mode création
            this.reset();
        }

        // Créer et afficher le modal
        this.createModal();
        this.switchTab('general');
    },

    /**
     * Charge une formation existante pour édition
     */
    async loadFormation(formationId) {
        try {
            const { data, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', formationId)
                .single();

            if (error) throw error;

            this.currentFormation = data;
            this.attendanceSheets = data.attendance_sheets || [];
            this.learnersData = data.learners_data || [];
        } catch (error) {
            console.error('Erreur chargement formation:', error);
            showToast('Erreur lors du chargement de la formation', 'error');
        }
    },

    /**
     * Réinitialise le formulaire
     */
    // Templates pré-remplis pour les formations courantes (données des fiches pédagogiques originales)
    FORMATION_TEMPLATES: {
        'Techniques de vente': {
            target_audience: 'commercial, technico-commercial, conseiller commercial',
            prerequisites: 'avoir une bonne connaissance de l\'offre (produits, services) et des tarifs',
            objectives: '-être capable de mettre en oeuvre les techniques d\'écoute active tout en menant la direction de la vente\n-être capable de valoriser les prix et services\n-être capable de verrouiller la vente',
            module_1: '-1-Les bases\n-les bases de ce qu\'est un vendeur : l\'écoute, l\'observation, la réactivité, le souci d\'amener des solutions\n-les bases de ce qu\'est un consommateur : l\'exigence, les motivations (primaire et secondaire), les freins, les besoins, les typologies\n-les étapes de la vente\n\n2-La découverte et l\'argumentation\n-focus sur la phase de découverte\n-identifier les motivations primaires et secondaires\n-écouter vraiment et identifier le vrai besoin du client\n-être attentif au non-verbal\n-être attentif aux termes employés par le client\n-le questionnement ouvert ; les questions creusées\n-les vertus de reformulation ; les moments de la reformulation',
            methods_tools: 'mises en situation, accompagnement terrain, techniques de vente (SONCAS, CAP...), accompagnement en rendez-vous et debrief, les 5 pourquoi, exercices CAP, PNL, méthode AEC, outils de coaching pour personnaliser les plans d\'actions individuels, base de données commerciale, exercices inter séances et debrief, méthodes de recommandations, atelier-retour',
            evaluation_methodology: 'par un questionnaire individuel en ligne, en fin de formation.',
            added_value: 'les outils personnalisés et la mise en pratique avec des outils de coaching.',
            access_delays: 'les dates disponibles le sont à partir du 6 mois'
        },
        'Management': {
            target_audience: 'managers, responsables d\'équipe, dirigeants',
            prerequisites: 'aucun prérequis spécifique',
            objectives: 'RAS',
            module_1: 'RAS',
            methods_tools: 'simulations, méthode Arc En Ciel, outils de coaching, plan d\'actions progressif, outils de CNV',
            evaluation_methodology: 'par un questionnaire individuel en ligne, en fin de formation.',
            added_value: 'RAS',
            access_delays: 'les dates disponibles le sont à partir du 6 mois'
        },
        'Manager commercial': {
            target_audience: 'managers commerciaux, directeurs commerciaux, responsables de vente',
            prerequisites: 'aucun prérequis spécifique',
            objectives: 'Apprendre les techniques de ventes',
            module_1: 'les outils, méthodes, le savoir-être pour vendre',
            methods_tools: 'simulations, méthode Arc En Ciel, outils de coaching, plan d\'actions progressif, outils de CNV',
            evaluation_methodology: 'par un questionnaire individuel en ligne, en fin de formation.',
            added_value: 'Apprendre les techniques de ventes',
            access_delays: 'les dates disponibles le sont à partir du 6 mois'
        }
    },

    onFormationNameChange(formationName) {
        const template = this.FORMATION_TEMPLATES[formationName];
        if (!template) return;

        // Ne pré-remplir que si les champs sont vides (ne pas écraser les données existantes)
        const fields = [
            { id: 'target_audience', key: 'target_audience' },
            { id: 'prerequisites', key: 'prerequisites' },
            { id: 'objectives', key: 'objectives' },
            { id: 'module_1', key: 'module_1' },
            { id: 'methods_tools', key: 'methods_tools' },
            { id: 'evaluation_methodology', key: 'evaluation_methodology' },
            { id: 'added_value', key: 'added_value' },
            { id: 'access_delays', key: 'access_delays' }
        ];

        let filled = 0;
        fields.forEach(field => {
            const el = document.getElementById(field.id);
            if (el && !el.value.trim()) {
                el.value = template[field.key] || '';
                filled++;
            }
        });

        if (filled > 0) {
            if (typeof showToast !== 'undefined') {
                showToast(`${filled} champ(s) pré-rempli(s) pour "${formationName}"`, 'info');
            }
        }
    },

    reset() {
        this.currentFormation = null;
        this.currentTab = 'general';
        this.attendanceSheets = [];
        this.learnersData = [];
    },

    /**
     * Crée le modal avec interface à onglets
     */
    createModal() {
        const existingModal = document.getElementById('formation-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'formation-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content-large">
                <div class="modal-header">
                    <h2>${this.currentFormation ? 'Modifier la formation' : 'Nouvelle Formation'}</h2>
                    <button onclick="FormationForm.close()" class="modal-close">&times;</button>
                </div>

                <!-- Onglets -->
                <div class="tabs-container">
                    <button class="tab-button active" data-tab="general" onclick="FormationForm.switchTab('general')">
                        📋 Informations générales
                    </button>
                    <button class="tab-button" data-tab="attendance" onclick="FormationForm.switchTab('attendance')">
                        📅 Feuilles de présence
                    </button>
                    <button class="tab-button" data-tab="company" onclick="FormationForm.switchTab('company')">
                        🏢 Entreprise & Apprenants
                    </button>
                    <button class="tab-button" data-tab="content" onclick="FormationForm.switchTab('content')">
                        📚 Contenu pédagogique
                    </button>
                </div>

                <form id="formation-form" onsubmit="FormationForm.save(event)" novalidate>
                    <!-- Onglet 1: Informations générales -->
                    <div id="tab-general" class="tab-content active">
                        ${this.renderGeneralTab()}
                    </div>

                    <!-- Onglet 2: Feuilles de présence -->
                    <div id="tab-attendance" class="tab-content">
                        ${this.renderAttendanceTab()}
                    </div>

                    <!-- Onglet 3: Entreprise & Apprenants -->
                    <div id="tab-company" class="tab-content">
                        ${this.renderCompanyTab()}
                    </div>

                    <!-- Onglet 4: Contenu pédagogique -->
                    <div id="tab-content" class="tab-content">
                        ${this.renderContentTab()}
                    </div>

                    <!-- Boutons d'action -->
                    <div class="modal-footer">
                        <button type="button" onclick="FormationForm.close()" class="btn-secondary">
                            Annuler
                        </button>
                        <button type="submit" class="btn-primary">
                            ${this.currentFormation ? 'Mettre à jour' : 'Créer la formation'}
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);

        // Charger les valeurs si édition
        if (this.currentFormation) {
            this.fillForm();
        }
    },

    /**
     * Render onglet 1: Informations générales
     */
    renderGeneralTab() {
        const f = this.currentFormation || {};
        const showSubcontractor = f.collaboration_mode === 'sous-traitant';

        // Build client options from loaded data (avec nom du compte utilisateur)
        const clientOptions = this.clientsData.map(c => {
            const displayName = c.user_name
                ? `${c.company_name} (Compte: ${c.user_name})`
                : c.company_name;
            return `<option value="${c.id}" ${f.client_id === c.id ? 'selected' : ''}>${displayName}</option>`;
        }).join('');

        // Build subcontractor options from loaded data
        const subcontractorOptions = this.subcontractorsData.map(s =>
            `<option value="${s.id}" ${f.subcontractor_id === s.id ? 'selected' : ''}>${s.first_name} ${s.last_name}</option>`
        ).join('');

        return `
            <div class="form-grid">
                <div class="form-group">
                    <label>Nom de la formation *</label>
                    <select id="formation_name" required onchange="FormationForm.onFormationNameChange(this.value)">
                        <option value="">Sélectionnez...</option>
                        <option value="Techniques de vente" ${f.formation_name === 'Techniques de vente' ? 'selected' : ''}>Techniques de vente</option>
                        <option value="Management" ${f.formation_name === 'Management' ? 'selected' : ''}>Management</option>
                        <option value="Manager commercial" ${f.formation_name === 'Manager commercial' ? 'selected' : ''}>Manager commercial</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Type de formation *</label>
                    <select id="formation_type" required>
                        <option value="">Sélectionnez...</option>
                        <option value="ecoles" ${f.formation_type === 'ecoles' ? 'selected' : ''}>Écoles</option>
                        <option value="entreprises" ${f.formation_type === 'entreprises' ? 'selected' : ''}>Entreprises</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Mode de collaboration *</label>
                    <select id="collaboration_mode" required onchange="FormationForm.onCollaborationModeChange(this.value)">
                        <option value="">Sélectionnez...</option>
                        <option value="direct" ${f.collaboration_mode === 'direct' ? 'selected' : ''}>Direct</option>
                        <option value="indirect" ${f.collaboration_mode === 'indirect' ? 'selected' : ''}>Indirect</option>
                        <option value="sous-traitant" ${f.collaboration_mode === 'sous-traitant' ? 'selected' : ''}>Sous-traitant</option>
                    </select>
                </div>

                <!-- Client dropdown (même style que sous-traitant mais en bleu) -->
                <div class="form-group form-group-full" style="background: #dbeafe; padding: 1rem; border-radius: 8px; border: 1px solid #93c5fd;">
                    <label style="color: #1e40af; font-weight: 600;">Client *</label>
                    <select id="client_id" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 8px; font-family: inherit; margin-top: 0.5rem;">
                        <option value="">Sélectionnez un client...</option>
                        ${clientOptions}
                    </select>
                    <p style="font-size: 0.75rem; color: #1e40af; margin-top: 0.5rem;">
                        Les clients sont créés dans Gestion des Accès > Créer un compte client
                    </p>
                </div>

                <!-- Sous-traitant dropdown (visible uniquement en mode sous-traitance) -->
                <div id="subcontractor-section" class="form-group form-group-full" style="display: ${showSubcontractor ? 'block' : 'none'}; background: #fef3c7; padding: 1rem; border-radius: 8px; border: 1px solid #fcd34d;">
                    <label style="color: #92400e; font-weight: 600;">Sous-traitant *</label>
                    <select id="subcontractor_id" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 8px; font-family: inherit; margin-top: 0.5rem;">
                        <option value="">Sélectionnez un sous-traitant...</option>
                        ${subcontractorOptions}
                    </select>
                    <p style="font-size: 0.75rem; color: #92400e; margin-top: 0.5rem;">
                        Les sous-traitants sont créés dans Gestion des Accès > Créer un compte formateur
                    </p>
                </div>

                <div class="form-group">
                    <label>Date de début *</label>
                    <input type="date" id="start_date" value="${f.start_date || ''}" required>
                </div>

                <div class="form-group">
                    <label>Date de fin *</label>
                    <input type="date" id="end_date" value="${f.end_date || ''}" required>
                </div>

                <div class="form-group" style="grid-column: span 2;">
                    <label>Dates (texte libre)</label>
                    <input type="text" id="custom_dates" value="${f.custom_dates || ''}" placeholder="ex : 13, 14, 15, 16 Janvier 2026">
                </div>

                <div class="form-group">
                    <label>Lieu de la formation</label>
                    <input type="text" id="training_location" value="${f.training_location || ''}">
                </div>

                <div class="form-group">
                    <label>Nombre de jours</label>
                    <input type="number" id="number_of_days" value="${f.number_of_days || ''}" min="1">
                </div>

                <div class="form-group">
                    <label>Montant de la formation (€)</label>
                    <input type="number" id="total_amount" value="${f.total_amount || ''}" step="0.01" min="0">
                </div>

                <div class="form-group">
                    <label>Statut</label>
                    <select id="status">
                        <option value="planned" ${f.status === 'planned' ? 'selected' : ''}>Planifiée</option>
                        <option value="in_progress" ${f.status === 'in_progress' ? 'selected' : ''}>En cours</option>
                        <option value="completed" ${f.status === 'completed' ? 'selected' : ''}>Terminée</option>
                        <option value="cancelled" ${f.status === 'cancelled' ? 'selected' : ''}>Annulée</option>
                    </select>
                </div>
            </div>
        `;
    },

    /**
     * Gère le changement de mode de collaboration
     */
    onCollaborationModeChange(mode) {
        const subcontractorSection = document.getElementById('subcontractor-section');
        if (subcontractorSection) {
            if (mode === 'sous-traitant') {
                subcontractorSection.style.display = 'block';
            } else {
                subcontractorSection.style.display = 'none';
            }
        }
    },

    /**
     * Render onglet 2: Feuilles de présence
     */
    renderAttendanceTab() {
        return `
            <div class="attendance-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3>Feuilles de présence</h3>
                    <button type="button" onclick="FormationForm.addAttendanceDay()" class="btn-add">
                        + Ajouter un jour
                    </button>
                </div>
                <div id="attendance-days-container">
                    ${this.renderAttendanceDays()}
                </div>
            </div>
        `;
    },

    /**
     * Render les jours de présence
     */
    renderAttendanceDays() {
        if (this.attendanceSheets.length === 0) {
            return '<p style="color: var(--gray-500); text-align: center; padding: 2rem;">Aucun jour ajouté. Cliquez sur "+ Ajouter un jour" pour commencer.</p>';
        }

        return this.attendanceSheets.map((day, index) => `
            <div class="attendance-day-card" data-day-index="${index}">
                <div class="card-header">
                    <h4>Jour ${day.day}</h4>
                    <button type="button" onclick="FormationForm.removeAttendanceDay(${index})" class="btn-delete">
                        🗑️ Supprimer
                    </button>
                </div>
                <div class="form-group">
                    <label>Date du jour ${day.day}</label>
                    <input type="date" value="${day.date || ''}" onchange="FormationForm.updateAttendanceDate(${index}, this.value)">
                </div>
                <div class="learners-hours-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <label>Heures par apprenant</label>
                        <button type="button" onclick="FormationForm.addLearnerToDay(${index})" class="btn-add-small">
                            + Ajouter apprenant
                        </button>
                    </div>
                    ${this.renderLearnerHours(index, day.learners_hours || [])}
                </div>
            </div>
        `).join('');
    },

    /**
     * Render les heures par apprenant pour un jour donné
     */
    renderLearnerHours(dayIndex, learnersHours) {
        if (learnersHours.length === 0) {
            return '<p style="color: var(--gray-500); font-size: 0.875rem;">Aucun apprenant ajouté pour ce jour.</p>';
        }

        return `
            <div class="learners-hours-list">
                ${learnersHours.map((learner, learnerIndex) => `
                    <div class="learner-hour-row">
                        <input type="text" placeholder="Nom apprenant" value="${learner.learner_name || ''}"
                            onchange="FormationForm.updateLearnerName(${dayIndex}, ${learnerIndex}, this.value)">
                        <input type="number" placeholder="Heures" value="${learner.hours || ''}" step="0.5" min="0"
                            onchange="FormationForm.updateLearnerHours(${dayIndex}, ${learnerIndex}, this.value)">
                        <button type="button" onclick="FormationForm.removeLearnerFromDay(${dayIndex}, ${learnerIndex})" class="btn-delete-small">
                            🗑️
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Render onglet 3: Entreprise & Apprenants
     */
    renderCompanyTab() {
        const f = this.currentFormation || {};
        return `
            <div class="form-section">
                <h3>Informations entreprise</h3>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Raison sociale</label>
                        <input type="text" id="company_name" value="${f.company_name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Adresse de l'entreprise</label>
                        <input type="text" id="company_address" value="${f.company_address || ''}">
                    </div>
                    <div class="form-group">
                        <label>Code postal</label>
                        <input type="text" id="company_postal_code" value="${f.company_postal_code || ''}">
                    </div>
                    <div class="form-group">
                        <label>Nom du dirigeant</label>
                        <input type="text" id="company_director_name" value="${f.company_director_name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Qualité</label>
                        <select id="company_director_title">
                            <option value="dirigeant" ${(f.company_director_title || 'dirigeant') === 'dirigeant' ? 'selected' : ''}>Dirigeant</option>
                            <option value="dirigeante" ${f.company_director_title === 'dirigeante' ? 'selected' : ''}>Dirigeante</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>E-mail</label>
                        <input type="email" id="client_email" value="${f.client_email || ''}" placeholder="email@entreprise.com">
                    </div>
                </div>
            </div>

            <div class="form-section" style="margin-top: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3>Liste des apprenants</h3>
                    <button type="button" onclick="FormationForm.addLearner()" class="btn-add">
                        + Ajouter apprenant
                    </button>
                </div>
                <div id="learners-list-container">
                    ${this.renderLearnersList()}
                </div>
                <div id="learners-total-section" style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; display: flex; justify-content: flex-end; align-items: center; border: 1px solid #e9ecef;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #1e1b4b;">
                        Total Heures Formation : <span id="total-formation-hours" style="color: #db2777;">0</span> h
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render la liste des apprenants
     */
    renderLearnersList() {
        if (this.learnersData.length === 0) {
            return '<p style="color: var(--gray-500); text-align: center; padding: 2rem;">Aucun apprenant ajouté. Cliquez sur "+ Ajouter apprenant" pour commencer.</p>';
        }

        return `
            <div class="learners-list">
                ${this.learnersData.map((learner, index) => `
                    <div class="learner-card">
                        <div class="learner-number">Apprenant ${index + 1}</div>
                        <div class="learner-inputs">
                            <input type="text" placeholder="Prénom" value="${learner.first_name || ''}"
                                onchange="FormationForm.updateLearnerField(${index}, 'first_name', this.value)">
                            <input type="text" placeholder="Nom" value="${learner.last_name || ''}"
                                onchange="FormationForm.updateLearnerField(${index}, 'last_name', this.value)">
                            <input type="number" placeholder="Heures" value="${learner.hours || ''}"
                                onchange="FormationForm.updateLearnerField(${index}, 'hours', this.value)"
                                style="width: 80px;" min="0" step="0.5">
                        </div>
                        <button type="button" onclick="FormationForm.removeLearner(${index})" class="btn-delete-small">
                            🗑️ Supprimer
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Calcule et affiche le total des heures
     */
    updateTotalHours() {
        // Heures pour UN apprenant (pas le cumul de tous les apprenants)
        const total = this.learnersData.length > 0
            ? (parseFloat(this.learnersData[0].hours) || 0)
            : 0;

        // Mise à jour de l'affichage dans l'onglet
        const displayEl = document.getElementById('total-formation-hours');
        if (displayEl) {
            displayEl.textContent = total;
        }

        // Mise à jour de la donnée locale si nécessaire pour d'autres usages
        if (this.currentFormation) {
            this.currentFormation.hours_per_learner = total;
        }
    },

    /**
     * Render onglet 4: Contenu pédagogique
     */
    renderContentTab() {
        const f = this.currentFormation || {};
        return `
            <div class="form-grid">
                <div class="form-group form-group-full">
                    <label>Public cible</label>
                    <textarea id="target_audience" rows="2">${f.target_audience || ''}</textarea>
                </div>

                <div class="form-group form-group-full">
                    <label>Pré-requis</label>
                    <textarea id="prerequisites" rows="2">${f.prerequisites || ''}</textarea>
                </div>

                <div class="form-group form-group-full">
                    <label>Objectifs</label>
                    <textarea id="objectives" rows="3">${f.objectives || ''}</textarea>
                </div>

                <div class="form-group form-group-full">
                    <label>Module 1</label>
                    <textarea id="module_1" rows="4">${f.module_1 || ''}</textarea>
                </div>

                <div class="form-group form-group-full">
                    <label>Contenus (r\u00E9sum\u00E9 court pour convention)</label>
                    <input type="text" id="content_summary" value="${f.content_summary || ''}" placeholder="Ex: les outils, m\u00E9thodes, le savoir-\u00EAtre pour vendre">
                </div>

                <div class="form-group form-group-full">
                    <label>Méthode, moyens, outils</label>
                    <textarea id="methods_tools" rows="3">${f.methods_tools || ''}</textarea>
                </div>

                <div class="form-group form-group-full">
                    <label>Méthodologie d'évaluation</label>
                    <textarea id="evaluation_methodology" rows="2">${f.evaluation_methodology || ''}</textarea>
                </div>

                <div class="form-group form-group-full">
                    <label>Le + apporté</label>
                    <textarea id="added_value" rows="2">${f.added_value || ''}</textarea>
                </div>

                <div class="form-group form-group-full">
                    <label>Délais d'accès</label>
                    <textarea id="access_delays" rows="2">${f.access_delays || ''}</textarea>
                </div>
            </div>
        `;
    },

    /**
     * Change d'onglet
     */
    switchTab(tabName) {
        // Mettre à jour les boutons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Mettre à jour le contenu
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`tab-${tabName}`).classList.add('active');

        this.currentTab = tabName;

        if (tabName === 'company') {
            this.updateTotalHours();
        }
    },

    /**
     * Gestion des jours de présence
     */
    addAttendanceDay() {
        const newDay = {
            day: this.attendanceSheets.length + 1,
            date: '',
            learners_hours: []
        };
        this.attendanceSheets.push(newDay);
        this.refreshAttendanceTab();
    },

    removeAttendanceDay(index) {
        this.attendanceSheets.splice(index, 1);
        // Réindexer les jours
        this.attendanceSheets.forEach((day, i) => {
            day.day = i + 1;
        });
        this.refreshAttendanceTab();
    },

    updateAttendanceDate(dayIndex, date) {
        this.attendanceSheets[dayIndex].date = date;
    },

    addLearnerToDay(dayIndex) {
        if (!this.attendanceSheets[dayIndex].learners_hours) {
            this.attendanceSheets[dayIndex].learners_hours = [];
        }
        this.attendanceSheets[dayIndex].learners_hours.push({
            learner_id: null,
            learner_name: '',
            hours: 0
        });
        this.refreshAttendanceTab();
    },

    removeLearnerFromDay(dayIndex, learnerIndex) {
        this.attendanceSheets[dayIndex].learners_hours.splice(learnerIndex, 1);
        this.refreshAttendanceTab();
    },

    updateLearnerName(dayIndex, learnerIndex, name) {
        this.attendanceSheets[dayIndex].learners_hours[learnerIndex].learner_name = name;
    },

    updateLearnerHours(dayIndex, learnerIndex, hours) {
        this.attendanceSheets[dayIndex].learners_hours[learnerIndex].hours = parseFloat(hours) || 0;
    },

    refreshAttendanceTab() {
        const container = document.getElementById('attendance-days-container');
        if (container) {
            container.innerHTML = this.renderAttendanceDays();
        }
    },

    /**
     * Gestion des apprenants
     */
    addLearner() {
        this.learnersData.push({
            id: Date.now(),
            first_name: '',
            last_name: '',
            hours: '',
            position: this.learnersData.length + 1
        });
        this.refreshLearnersTab();
    },

    removeLearner(index) {
        this.learnersData.splice(index, 1);
        // Réindexer les positions
        this.learnersData.forEach((learner, i) => {
            learner.position = i + 1;
        });
        this.refreshLearnersTab();
    },

    updateLearnerField(index, field, value) {
        this.learnersData[index][field] = value;
        if (field === 'hours') {
            this.updateTotalHours();
        }
    },

    refreshLearnersTab() {
        const container = document.getElementById('learners-list-container');
        if (container) {
            container.innerHTML = this.renderLearnersList();
            this.updateTotalHours();
        }
    },

    /**
     * Remplit le formulaire avec les données existantes
     */
    fillForm() {
        if (!this.currentFormation) return;

        const f = this.currentFormation;
        const fields = [
            'formation_name', 'formation_type', 'collaboration_mode', 'client_id', 'subcontractor_id',
            'start_date', 'end_date', 'custom_dates', 'training_location', 'number_of_days',
            'hours_per_day', 'hours_per_learner', 'total_amount', 'status',
            'company_name', 'company_address', 'company_postal_code', 'company_director_name', 'client_email',
            'target_audience', 'prerequisites', 'objectives', 'module_1',
            'methods_tools', 'access_delays', 'evaluation_methodology', 'added_value'
        ];

        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element && f[field]) {
                element.value = f[field];
            }
        });

        // Assurer la visibilité correcte de la section sous-traitant
        this.onCollaborationModeChange(f.collaboration_mode);
    },

    /**
     * Sauvegarde la formation
     */
    async save(event) {
        event.preventDefault();

        // Validation des champs obligatoires
        const requiredFields = [
            { id: 'formation_name', label: 'Nom de la formation', tab: 'general' },
            { id: 'formation_type', label: 'Type de formation', tab: 'general' },
            { id: 'collaboration_mode', label: 'Mode de collaboration', tab: 'general' },
            { id: 'client_id', label: 'Client', tab: 'general' },
            { id: 'start_date', label: 'Date de début', tab: 'general' },
            { id: 'end_date', label: 'Date de fin', tab: 'general' }
        ];

        for (const field of requiredFields) {
            const el = document.getElementById(field.id);
            if (!el || !el.value.trim()) {
                // Si on n'est pas sur le bon onglet, on y va
                if (this.currentTab !== field.tab) {
                    this.switchTab(field.tab);
                }

                // On met le focus sur le champ en erreur
                el.focus();

                // Message explicatif
                showToast(`Le champ "${field.label}" est obligatoire`, "error");
                return;
            }
        }

        // Récupérer les IDs depuis les dropdowns
        const collaborationMode = document.getElementById('collaboration_mode').value;
        const clientId = parseInt(document.getElementById('client_id').value);
        const subcontractorId = collaborationMode === 'sous-traitant'
            ? (document.getElementById('subcontractor_id')?.value ? parseInt(document.getElementById('subcontractor_id').value) : null)
            : null;

        // Validation du sous-traitant si en mode sous-traitance
        if (collaborationMode === 'sous-traitant' && !subcontractorId) {
            this.switchTab('general');
            showToast('Veuillez sélectionner un sous-traitant en mode sous-traitance', 'error');
            return;
        }

        // Récupérer les noms pour la rétrocompatibilité
        const selectedClient = this.clientsData.find(c => c.id === clientId);
        const clientName = selectedClient ? selectedClient.company_name : '';

        const selectedSubcontractor = this.subcontractorsData.find(s => s.id === subcontractorId);
        const subcontractorFirstName = selectedSubcontractor ? selectedSubcontractor.first_name : '';
        const subcontractorLastName = selectedSubcontractor ? selectedSubcontractor.last_name : '';

        const formData = {
            formation_name: document.getElementById('formation_name').value,
            formation_type: document.getElementById('formation_type').value,
            collaboration_mode: collaborationMode,
            // IDs pour les relations
            client_id: clientId,
            subcontractor_id: subcontractorId,
            // Noms pour la rétrocompatibilité et l'affichage
            client_name: clientName,
            subcontractor_first_name: subcontractorFirstName,
            subcontractor_last_name: subcontractorLastName,
            start_date: document.getElementById('start_date').value,
            end_date: document.getElementById('end_date').value,
            custom_dates: document.getElementById('custom_dates').value.trim() || null,
            training_location: document.getElementById('training_location').value,
            number_of_days: parseInt(document.getElementById('number_of_days').value) || null,
            hours_per_day: null,
            hours_per_learner: this.learnersData.length > 0 ? (parseFloat(this.learnersData[0].hours) || 0) : 0,
            total_amount: parseFloat(document.getElementById('total_amount').value) || null,
            status: document.getElementById('status').value,
            company_name: document.getElementById('company_name').value,
            company_address: document.getElementById('company_address').value,
            company_postal_code: document.getElementById('company_postal_code').value,
            company_director_name: document.getElementById('company_director_name').value,
            company_director_title: document.getElementById('company_director_title').value,
            client_email: document.getElementById('client_email').value,
            target_audience: document.getElementById('target_audience').value,
            prerequisites: document.getElementById('prerequisites').value,
            objectives: document.getElementById('objectives').value,
            module_1: document.getElementById('module_1').value,
            content_summary: document.getElementById('content_summary').value,
            methods_tools: document.getElementById('methods_tools').value,
            evaluation_methodology: document.getElementById('evaluation_methodology').value,
            added_value: document.getElementById('added_value').value,
            access_delays: document.getElementById('access_delays').value,
            attendance_sheets: this.attendanceSheets,
            learners_data: this.learnersData,
            // Champs pour compatibilité avec l'ancien format
            title: document.getElementById('formation_name').value,
            description: document.getElementById('objectives').value
        };

        try {
            if (this.currentFormation) {
                // Mode édition
                const { error } = await supabaseClient
                    .from('formations')
                    .update(formData)
                    .eq('id', this.currentFormation.id);

                if (error) throw error;
                showToast('Formation mise à jour avec succès !', 'success');
            } else {
                // Mode création
                const { data: createdFormation, error } = await supabaseClient
                    .from('formations')
                    .insert([{
                        ...formData,
                        created_by: (await supabaseClient.auth.getUser()).data.user.id
                    }])
                    .select()
                    .single();

                if (error) throw error;

                // === AUTO-CRÉATION ENTRÉE BPF ===
                try {
                    // Calcul de l'année fiscale (avant oct = année en cours, après = année suivante)
                    const startDate = new Date(formData.start_date);
                    const month = startDate.getMonth() + 1; // 1-12
                    const year = startDate.getFullYear();
                    const fiscalYear = month >= 10 ? year + 1 : year;

                    // Mapping du type de formation
                    const typeLabels = {
                        'ecoles': 'Écoles',
                        'entreprises': 'Entreprise'
                    };
                    const modeLabels = {
                        'direct': 'Direct',
                        'indirect': 'Indirect',
                        'sous-traitant': 'Sous-traitance'
                    };
                    const formationType = `${typeLabels[formData.formation_type] || formData.formation_type} - ${modeLabels[formData.collaboration_mode] || formData.collaboration_mode}`;

                    // Calcul du nombre de stagiaires et total heures (heures pour UN apprenant, pas le cumul)
                    const numberOfLearners = this.learnersData.length;
                    const totalHours = this.learnersData.length > 0 ? (parseFloat(this.learnersData[0].hours) || 0) : 0;

                    // Création de l'entrée BPF
                    const bpfData = {
                        formation_id: createdFormation.id,
                        formation_type: formationType,
                        company_name: formData.client_name,
                        year: fiscalYear,
                        amount_ht: formData.total_amount || 0,
                        number_of_learners: numberOfLearners,
                        total_hours: totalHours,
                        exported: false,
                        export_amount: 0
                    };

                    const bpfResult = await SupabaseData.addBPF(bpfData);
                    if (bpfResult.success) {
                        console.log('✅ BPF créé automatiquement:', bpfResult.data);
                    } else {
                        console.warn('⚠️ Erreur création BPF:', bpfResult.message);
                    }
                } catch (bpfError) {
                    console.error('Erreur création BPF automatique:', bpfError);
                    // Ne pas bloquer la création de formation si BPF échoue
                }
                // === FIN AUTO-CRÉATION BPF ===

                showToast('Formation créée avec succès !', 'success');
                addNotification('formation', `Formation créée — ${formData.formation_name || ''}`);
            }

            this.close();
            // Recharger la liste des formations
            if (typeof CRMApp !== 'undefined' && CRMApp.loadFormations) {
                CRMApp.loadFormations();
            }
        } catch (error) {
            console.error('Erreur sauvegarde formation:', error);
            showToast('Erreur sauvegarde: ' + error.message, 'error');
        }
    },

    /**
     * Ferme le modal
     */
    close() {
        const modal = document.getElementById('formation-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
        this.reset();
    }
};

// Rendre l'objet accessible globalement
window.FormationForm = FormationForm;
