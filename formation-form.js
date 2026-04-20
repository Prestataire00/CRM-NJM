/**
 * FORMATION FORM - Formulaire de creation/edition de formations
 * 3 onglets : Formation | Client & Apprenants | Contenu pedagogique
 */

const FormationForm = {
    currentFormation: null,
    currentTab: 'general',
    learnersData: [],
    clientsData: [],
    subcontractorsData: [],

    // Templates pre-remplis
    FORMATION_TEMPLATES: {
        'Techniques de vente': {
            target_audience: 'commercial, technico-commercial, conseiller commercial',
            prerequisites: 'avoir une bonne connaissance de l\'offre (produits, services) et des tarifs',
            objectives: '-\u00EAtre capable de mettre en oeuvre les techniques d\'\u00E9coute active tout en menant la direction de la vente\n-\u00EAtre capable de valoriser les prix et services\n-\u00EAtre capable de verrouiller la vente',
            module_1: '-1-Les bases\n-les bases de ce qu\'est un vendeur : l\'\u00E9coute, l\'observation, la r\u00E9activit\u00E9, le souci d\'amener des solutions\n-les bases de ce qu\'est un consommateur : l\'exigence, les motivations (primaire et secondaire), les freins, les besoins, les typologies\n-les \u00E9tapes de la vente\n\n2-La d\u00E9couverte et l\'argumentation\n-focus sur la phase de d\u00E9couverte\n-identifier les motivations primaires et secondaires\n-\u00E9couter vraiment et identifier le vrai besoin du client\n-\u00EAtre attentif au non-verbal\n-\u00EAtre attentif aux termes employ\u00E9s par le client\n-le questionnement ouvert ; les questions creus\u00E9es\n-les vertus de reformulation ; les moments de la reformulation\n-la mise en \u0153uvre \u00e0 bon escient de l\'argumentation, autre que technique\n-l\'argumentation adapt\u00e9e \u00e0 la phase de d\u00e9couverte\n-les arguments face \u00e0 l\'objection prix\n-savoir vendre un prix\n-savoir vendre ses diff\u00e9rences\n-g\u00e9rer les objections par les termes et le ton ad\u00e9quat : l\'objection cadeau\n-apporter au client une solution pertinente : la sienne\n-savoir faire preuve de directivit\u00e9 douce : verrouiller la vente',
            content_summary: 'les outils, m\u00E9thodes, le savoir-\u00EAtre pour vendre',
            methods_tools: 'mises en situation, accompagnement terrain, techniques de vente (SONCAS, CAP...), accompagnement en rendez-vous et debrief, les 5 pourquoi, exercices CAP, PNL, m\u00E9thode AEC, outils de coaching pour personnaliser les plans d\'actions individuels, base de donn\u00E9es commerciale, exercices inter s\u00E9ances et debrief, m\u00E9thodes de recommandations, atelier-retour',
            evaluation_methodology: 'par un questionnaire individuel en ligne, en fin de formation.',
            added_value: 'les outils personnalis\u00E9s et la mise en pratique avec des outils de coaching.',
            access_delays: 'les dates disponibles le sont \u00E0 partir du 6 mois'
        },
        'Management': {
            target_audience: 'managers, responsables d\'\u00E9quipe, dirigeants',
            prerequisites: 'aucun pr\u00E9requis sp\u00E9cifique',
            objectives: '-\u00EAtre capable de communiquer\n-\u00EAtre capable de fermet\u00E9\n-\u00EAtre capable de g\u00E9rer les conflits',
            module_1: '-bien se connaitre pour bien manager: profil AEC\n-la notion de l\u00E9gitimit\u00E9\n-les qualit\u00E9s qui confortent la l\u00E9gitimit\u00E9\n-diagnostic individuel de son mode de management ; lien avec le profil AEC: points \u00E0 conserver, points \u00E0 faire progresser\n-d\u00E9finir les objectifs et clarifier les r\u00E8gles du jeu communes pour orienter l\'action de l\'\u00E9quipe. La notion de p\u00E9rim\u00E8tre\n\n-les 9 principes \u00E0 appliquer en management\n-la diff\u00E9rence de posture entre un poste de terrain et un poste de management\n-le lien entre direction et terrain. La notion de loyaut\u00E9.\n-la valeur d\'exemple : les valeurs, les croyances\nSusciter la motivation individuelle des membres de l\'\u00E9quipe\n-pratiquer un management du succ\u00E8s.\n-agir sur les leviers de motivation pertinents.\n-traiter les probl\u00E8mes de d\u00E9motivation qui risquent d\'affecter la performance de l\'\u00E9quipe\n\nCommuniquer\n-le feedback constructif\n-l\'adaptation selon Arc En Ciel Disc\n-la m\u00E9thode OSBD\n-les m\u00E9thodes pour dire \u00AB non \u00BB \u00E0 un collaborateur, \u00E0 un client\n-exemple : la derni\u00E8re fois que vous n\'avez pas r\u00E9ussi \u00E0 dire \u00AB non \u00BB\n-communiquer entre responsables, la r\u00E9partition des t\u00E2ches, les r\u00E8gles de fonctionnement en bin\u00F4me\n\nRendre les collaborateurs autonomes\n-abandonner le management \u00AB bonsa\u00EF \u00BB\n-diagnostic de votre \u00E9quipe : \u00E0 concevoir sur une grille\n-le pompier de service : avantages et inconv\u00E9nients\n-m\u00E9thode de responsabilisation : l\'art du questionnement\nTraiter les erreurs et g\u00E9rer les situations d\u00E9licates\n-distinguer erreur et faute\n-choisir le mode d\'intervention en fonction de la situation\n-traiter les erreurs dans une dynamique de progr\u00E8s\n-confronter un collaborateur sans le d\u00E9motiver\n-la notion de sanction',
            content_summary: 'les outils, m\u00E9thodes, le savoir-\u00EAtre pour manager',
            methods_tools: '-m\u00E9thode AEC Disc\n-outils de coaching\n-simulations\n-exercice : \u00E9crivez vos r\u00E8gles pour l\'\u00E9quipe\n-exercice : le cas David\n-m\u00E9thode SMART\n-exercice de cr\u00E9ation du mapping : le degr\u00E9 d\'autonomie des collaborateurs\n-intelligence \u00E9motionnelle\n-CNV',
            evaluation_methodology: 'par un questionnaire individuel en ligne, en fin de formation.',
            added_value: 'une formation impliquante avec des outils de coaching ; l\'apprenant terminera la session avec son plan individuel de progression',
            access_delays: 'les dates disponibles le sont \u00E0 partir du 6 mois'
        },
        'Manager commercial': {
            formation_name: 'Manager et piloter une \u00E9quipe commerciale',
            target_audience: 'responsable commercial en poste ou en future prise de poste',
            prerequisites: 'aucun',
            hours_per_learner: 14,
            number_of_days: 2,
            objectives: '-\u00EAtre capable de communiquer autour d\'une vision ou d\'un projet commercial\n-\u00EAtre capable de manager et d\u00E9velopper l\'\u00E9quipe commerciale',
            module_1: '1-Communiquer\n-communiquer la vision et la mission commerciale dans un style adapt\u00E9 \u00E0 son interlocuteur pour en assurer la compr\u00E9hension et l\'application.\n-appr\u00E9hender et appliquer des techniques de management inclusives prenant en compte la personnalit\u00E9, le niveau et l\'engagement de chacun\n-g\u00E9n\u00E9rer la coh\u00E9sion d\'\u00E9quipe, avec entraide et \u00E9quit\u00E9\n-r\u00E9soudre les conflits potentiels en adoptant une posture de facilitateur/m\u00E9diateur et en utilisant les techniques de n\u00E9gociation.\n-pr\u00E9parer et animer les r\u00E9unions commerciales\n-op\u00E9rer un feed back r\u00E9gulier aupr\u00E8s du dirigeant\n\n2-Manager\n-les 5 missions d\'un manager\n-construire les tableaux de bord pour manager l\'activit\u00E9 en utilisant les outils de l\'entreprise : CRM, ERP outils de Data.\n-concevoir le plan d\'actions commercial autour de 2 axes : prospection et fid\u00E9lisation\n-d\u00E9cliner les objectifs commerciaux de l\'entit\u00E9 en objectifs collectifs et/ou individuels pour mener \u00E0 bien le plan d\'action commercial.\n-contr\u00F4ler l\'activit\u00E9 et la relation client de chaque commercial\n-suivre les indicateurs de performances individuelles et collectives\n-utiliser les techniques de motivation individuelle et collective, dans le respect des comp\u00E9tences et sp\u00E9cificit\u00E9s individuelles des membres de l\'\u00E9quipe afin d\'atteindre les objectifs\n-maintenir et d\u00E9velopper les comp\u00E9tences au sein de l\'\u00E9quipe en utilisant le levier de la formation pour garantir la comp\u00E9titivit\u00E9 de l\'entreprise et l\'employabilit\u00E9 des \u00E9quipes.\n-mener les EAE et Entretiens Professionnels des commerciaux\n-recruter et accompagner les nouveaux commerciaux : on-boarding et mont\u00E9e en comp\u00E9tence\n-alimenter les commerciaux en connaissances : benchmarking, technicit\u00E9, fournisseurs, march\u00E9...\n-organiser, participer, animer et mesurer les \u00E9v\u00E8nements commerciaux (salons, portes ouvertes...)',
            content_summary: 'les outils, m\u00E9thodes et le savoir-\u00EAtre pour manager et piloter une \u00E9quipe commerciale',
            methods_tools: '-m\u00E9thode AEC Disc\n-outils de coaching\n-\u00E9tat des lieux du service et des routines\n-alternance de jeux de r\u00F4le et simulations\n-apports et facilitation du formateur\n-le parcours est bas\u00E9 sur une alternance de s\u00E9quences th\u00E9oriques et pratiques, avec retour d\'exp\u00E9rience\n-exemples d\'indicateurs commerciaux',
            evaluation_methodology: 'questionnaire individuel en ligne en fin de formation',
            added_value: 'formation totalement sur-mesure, employant des outils de coaching',
            access_delays: 'les dates disponibles le sont \u00E0 partir du 1er Juillet 2026'
        }
    },

    async loadClientsAndSubcontractors() {
        try {
            const [clientsResult, subcontractorsResult] = await Promise.all([
                SupabaseData.getClients(),
                SupabaseData.getSubcontractors()
            ]);
            if (clientsResult.success) this.clientsData = clientsResult.data || [];
            if (subcontractorsResult.success) this.subcontractorsData = subcontractorsResult.data || [];
        } catch (error) {
            console.error('Erreur chargement clients/sous-traitants:', error);
        }
    },

    async show(formationId = null) {
        await this.loadClientsAndSubcontractors();
        if (formationId) {
            await this.loadFormation(formationId);
        } else {
            this.reset();
        }
        this.createModal();
        this.switchTab('general');
    },

    async loadFormation(formationId) {
        try {
            const { data, error } = await supabaseClient
                .from('formations').select('*').eq('id', formationId).single();
            if (error) throw error;
            this.currentFormation = data;
            this.learnersData = data.learners_data || [];
        } catch (error) {
            console.error('Erreur chargement formation:', error);
            showToast('Erreur lors du chargement de la formation', 'error');
        }
    },

    reset() {
        this.currentFormation = null;
        this.currentTab = 'general';
        this.learnersData = [];
    },

    onFormationNameChange(value) {
        // Si "Autre", afficher le champ libre
        const customInput = document.getElementById('formation_name_custom');
        if (customInput) {
            customInput.style.display = value === '__custom__' ? 'block' : 'none';
        }
        // Pre-remplir depuis template si existant
        const template = this.FORMATION_TEMPLATES[value];
        if (!template) return;
        const fields = ['target_audience', 'prerequisites', 'objectives', 'module_1', 'content_summary', 'methods_tools', 'evaluation_methodology', 'added_value', 'access_delays', 'hours_per_learner', 'number_of_days'];
        let filled = 0;
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.value.trim() && template[id] !== undefined) { el.value = template[id]; filled++; }
        });
        // Pre-remplir le nom de formation personnalise si le template en fournit un
        if (template.formation_name) {
            const customInput = document.getElementById('formation_name_custom');
            if (customInput && !customInput.value.trim()) customInput.value = template.formation_name;
        }
        if (filled > 0) showToast(`${filled} champ(s) pr\u00E9-rempli(s) pour "${value}"`, 'info');
    },

    onCollaborationModeChange(mode) {
        const section = document.getElementById('subcontractor-section');
        if (section) section.style.display = mode === 'sous-traitant' ? 'block' : 'none';
    },

    onSubcontractorChange(subId) {
        const sub = this.subcontractorsData.find(s => s.id === parseInt(subId));
        if (!sub) return;
        // Auto-remplir les champs sous-traitant si vides
        const map = {
            'subcontractor_address': sub.address || '',
            'subcontractor_siret': sub.siret || '',
            'subcontractor_nda': sub.nda || '',
            'subcontractor_naf': sub.naf || '',
            'subcontractor_phone': sub.phone || '',
        };
        Object.entries(map).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el && !el.value.trim() && val) el.value = val;
        });
    },

    onClientChange(clientId) {
        const client = this.clientsData.find(c => c.id === parseInt(clientId));
        if (!client) return;
        // Auto-remplir les champs client en Tab 2
        const map = {
            'company_name': client.company_name || '',
            'company_address': client.address || '',
            'company_postal_code': [client.postal_code, client.city].filter(Boolean).join(' '),
            'company_director_name': client.contact_name || '',
            'client_email': client.email || '',
        };
        Object.entries(map).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el && !el.value.trim()) el.value = val;
        });
    },

    createModal() {
        const existing = document.getElementById('formation-modal');
        if (existing) existing.remove();

        const f = this.currentFormation || {};
        const modal = document.createElement('div');
        modal.id = 'formation-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content-large">
                <div class="modal-header">
                    <h2>${f.id ? 'Modifier la formation' : 'Nouvelle Formation'}</h2>
                    <button onclick="FormationForm.close()" class="modal-close">&times;</button>
                </div>
                <div class="tabs-container">
                    <button class="tab-button active" data-tab="general" onclick="FormationForm.switchTab('general')">
                        \uD83D\uDCCB La formation
                    </button>
                    <button class="tab-button" data-tab="client" onclick="FormationForm.switchTab('client')">
                        \uD83C\uDFE2 Client & Apprenants
                    </button>
                    <button class="tab-button" data-tab="content" onclick="FormationForm.switchTab('content')">
                        \uD83D\uDCDA Contenu p\u00E9dagogique
                    </button>
                </div>
                <form id="formation-form" onsubmit="FormationForm.save(event)" novalidate>
                    <div id="tab-general" class="tab-content active">${this.renderGeneralTab()}</div>
                    <div id="tab-client" class="tab-content">${this.renderClientTab()}</div>
                    <div id="tab-content" class="tab-content">${this.renderContentTab()}</div>
                    <div class="modal-footer">
                        <button type="button" onclick="FormationForm.close()" class="btn-secondary">Annuler</button>
                        <button type="submit" class="btn-primary">${f.id ? 'Mettre \u00E0 jour' : 'Cr\u00E9er la formation'}</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
        if (this.currentFormation) this.fillForm();
    },

    // ==================== TAB 1 : LA FORMATION ====================
    renderGeneralTab() {
        const f = this.currentFormation || {};
        const showSub = f.collaboration_mode === 'sous-traitant';
        const clientOpts = this.clientsData.map(c => {
            const name = c.user_name ? `${c.company_name} (Compte: ${c.user_name})` : c.company_name;
            return `<option value="${c.id}" ${f.client_id === c.id ? 'selected' : ''}>${name}</option>`;
        }).join('');
        const subOpts = this.subcontractorsData.map(s =>
            `<option value="${s.id}" ${f.subcontractor_id === s.id ? 'selected' : ''}>${s.first_name} ${s.last_name}</option>`
        ).join('');

        const isCustomName = f.formation_name && !this.FORMATION_TEMPLATES[f.formation_name];

        return `
            <div class="form-grid">
                <div class="form-group">
                    <label>Nom de la formation *</label>
                    <select id="formation_name_select" required onchange="FormationForm.onFormationNameChange(this.value)">
                        <option value="">S\u00E9lectionnez...</option>
                        <option value="Techniques de vente" ${f.formation_name === 'Techniques de vente' ? 'selected' : ''}>Techniques de vente</option>
                        <option value="Management" ${f.formation_name === 'Management' ? 'selected' : ''}>Management</option>
                        <option value="Manager commercial" ${f.formation_name === 'Manager commercial' ? 'selected' : ''}>Manager commercial</option>
                        <option value="__custom__" ${isCustomName ? 'selected' : ''}>Autre (saisie libre)</option>
                    </select>
                    <input type="text" id="formation_name_custom" value="${isCustomName ? (f.formation_name || '') : ''}" placeholder="Nom de la formation..." style="display: ${isCustomName ? 'block' : 'none'}; margin-top: 0.5rem;">
                </div>

                <div class="form-group">
                    <label>Type de formation *</label>
                    <select id="formation_type" required>
                        <option value="">S\u00E9lectionnez...</option>
                        <option value="ecoles" ${f.formation_type === 'ecoles' ? 'selected' : ''}>\u00C9coles</option>
                        <option value="entreprises" ${f.formation_type === 'entreprises' ? 'selected' : ''}>Entreprises</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Mode de collaboration *</label>
                    <select id="collaboration_mode" required onchange="FormationForm.onCollaborationModeChange(this.value)">
                        <option value="">S\u00E9lectionnez...</option>
                        <option value="direct" ${f.collaboration_mode === 'direct' ? 'selected' : ''}>Direct</option>
                        <option value="indirect" ${f.collaboration_mode === 'indirect' ? 'selected' : ''}>Indirect</option>
                        <option value="sous-traitant" ${f.collaboration_mode === 'sous-traitant' ? 'selected' : ''}>Sous-traitant</option>
                    </select>
                </div>

                <div class="form-group form-group-full" style="background: #dbeafe; padding: 1rem; border-radius: 8px; border: 1px solid #93c5fd;">
                    <label style="color: #1e40af; font-weight: 600;">Client *</label>
                    <select id="client_id" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 8px; font-family: inherit; margin-top: 0.5rem;" onchange="FormationForm.onClientChange(this.value)">
                        <option value="">S\u00E9lectionnez un client...</option>
                        ${clientOpts}
                    </select>
                    <p style="font-size: 0.75rem; color: #1e40af; margin-top: 0.5rem;">Les infos client seront auto-remplies dans l'onglet "Client & Apprenants"</p>
                </div>

                <div id="subcontractor-section" class="form-group form-group-full" style="display: ${showSub ? 'block' : 'none'}; background: #fef3c7; padding: 1rem; border-radius: 8px; border: 1px solid #fcd34d;">
                    <label style="color: #92400e; font-weight: 600;">Sous-traitant *</label>
                    <select id="subcontractor_id" style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 8px; font-family: inherit; margin-top: 0.5rem;" onchange="FormationForm.onSubcontractorChange(this.value)">
                        <option value="">S\u00E9lectionnez un sous-traitant...</option>
                        ${subOpts}
                    </select>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.75rem;">
                        <div>
                            <label style="font-size: 0.8rem; color: #92400e;">Adresse</label>
                            <input type="text" id="subcontractor_address" value="${f.subcontractor_address || ''}" style="width:100%;padding:0.5rem;border:1px solid var(--gray-300);border-radius:6px;font-size:0.85rem;">
                        </div>
                        <div>
                            <label style="font-size: 0.8rem; color: #92400e;">SIRET</label>
                            <input type="text" id="subcontractor_siret" value="${f.subcontractor_siret || ''}" style="width:100%;padding:0.5rem;border:1px solid var(--gray-300);border-radius:6px;font-size:0.85rem;">
                        </div>
                        <div>
                            <label style="font-size: 0.8rem; color: #92400e;">N\u00B0 activit\u00E9 (NDA)</label>
                            <input type="text" id="subcontractor_nda" value="${f.subcontractor_nda || ''}" style="width:100%;padding:0.5rem;border:1px solid var(--gray-300);border-radius:6px;font-size:0.85rem;">
                        </div>
                        <div>
                            <label style="font-size: 0.8rem; color: #92400e;">Prix/jour (\u20AC)</label>
                            <input type="number" id="subcontractor_price" value="${f.subcontractor_price || '600'}" step="1" min="0" style="width:100%;padding:0.5rem;border:1px solid var(--gray-300);border-radius:6px;font-size:0.85rem;">
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Date de d\u00E9but *</label>
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
                    <label>Heures par apprenant *</label>
                    <input type="number" id="hours_per_learner" value="${f.hours_per_learner || ''}" min="0" step="0.5" placeholder="ex: 14">
                </div>
                <div class="form-group">
                    <label>Montant de la formation (\u20AC)</label>
                    <input type="number" id="total_amount" value="${f.total_amount || ''}" step="0.01" min="0">
                </div>
                <div class="form-group">
                    <label>Statut</label>
                    <select id="status">
                        <option value="awaiting_prealable" ${f.status === 'awaiting_prealable' ? 'selected' : ''}>⏳ Pr\u00E9alable en attente</option>
                        <option value="planned" ${f.status === 'planned' ? 'selected' : ''}>Planifi\u00E9e</option>
                        <option value="in_progress" ${f.status === 'in_progress' ? 'selected' : ''}>En cours</option>
                        <option value="completed" ${f.status === 'completed' ? 'selected' : ''}>Termin\u00E9e</option>
                        <option value="cancelled" ${f.status === 'cancelled' ? 'selected' : ''}>Annul\u00E9e</option>
                    </select>
                </div>
            </div>
        `;
    },

    // ==================== TAB 2 : CLIENT & APPRENANTS ====================
    renderClientTab() {
        const f = this.currentFormation || {};
        return `
            <div class="form-section">
                <h3>Informations client</h3>
                <p style="font-size: 0.8rem; color: var(--gray-500); margin-bottom: 1rem;">Ces champs sont auto-remplis quand vous s\u00E9lectionnez un client. Vous pouvez les modifier si besoin.</p>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Raison sociale</label>
                        <input type="text" id="company_name" value="${f.company_name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Adresse</label>
                        <input type="text" id="company_address" value="${f.company_address || ''}">
                    </div>
                    <div class="form-group">
                        <label>Code postal / Ville</label>
                        <input type="text" id="company_postal_code" value="${f.company_postal_code || ''}">
                    </div>
                    <div class="form-group">
                        <label>Nom du dirigeant</label>
                        <input type="text" id="company_director_name" value="${f.company_director_name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Civilit\u00E9</label>
                        <select id="company_director_title">
                            <option value="M." ${(f.company_director_title || '') === 'M.' ? 'selected' : ''}>M.</option>
                            <option value="Mme" ${f.company_director_title === 'Mme' ? 'selected' : ''}>Mme</option>
                            <option value="dirigeant" ${f.company_director_title === 'dirigeant' ? 'selected' : ''}>Dirigeant</option>
                            <option value="dirigeante" ${f.company_director_title === 'dirigeante' ? 'selected' : ''}>Dirigeante</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Fonction</label>
                        <input type="text" id="contact_role" value="${f.contact_role || 'dirigeant'}" placeholder="dirigeant, g\u00E9rant, directeur...">
                    </div>
                    <div class="form-group">
                        <label>E-mail client</label>
                        <input type="email" id="client_email" value="${f.client_email || ''}" placeholder="email@entreprise.com">
                    </div>
                </div>
            </div>

            <div class="form-section" style="margin-top: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3>Apprenants</h3>
                    <button type="button" onclick="FormationForm.addLearner()" class="btn-add">+ Ajouter apprenant</button>
                </div>
                <div id="learners-list-container">${this.renderLearnersList()}</div>
            </div>
        `;
    },

    renderLearnersList() {
        if (this.learnersData.length === 0) {
            return '<p style="color: var(--gray-500); text-align: center; padding: 2rem;">Aucun apprenant. Cliquez sur "+ Ajouter apprenant".</p>';
        }
        return `<div class="learners-list">${this.learnersData.map((l, i) => `
            <div class="learner-card">
                <div class="learner-number">Apprenant ${i + 1}</div>
                <div class="learner-inputs">
                    <input type="text" placeholder="Pr\u00E9nom" value="${l.first_name || ''}" onchange="FormationForm.updateLearnerField(${i}, 'first_name', this.value)">
                    <input type="text" placeholder="Nom" value="${l.last_name || ''}" onchange="FormationForm.updateLearnerField(${i}, 'last_name', this.value)">
                    <input type="text" placeholder="Année naissance" value="${l.birth_year || ''}" maxlength="4" onchange="FormationForm.updateLearnerField(${i}, 'birth_year', this.value)" style="max-width:100px;">
                    <input type="text" placeholder="Poste" value="${l.position_title || ''}" onchange="FormationForm.updateLearnerField(${i}, 'position_title', this.value)">
                    <input type="tel" placeholder="Téléphone" value="${l.phone || ''}" onchange="FormationForm.updateLearnerField(${i}, 'phone', this.value)" style="max-width:130px;">
                    <input type="email" placeholder="Email" value="${l.email || ''}" onchange="FormationForm.updateLearnerField(${i}, 'email', this.value)">
                    <input type="text" placeholder="Entité (raison sociale, SIRET, adresse)" value="${l.entity || ''}" onchange="FormationForm.updateLearnerField(${i}, 'entity', this.value)">
                </div>
                <button type="button" onclick="FormationForm.removeLearner(${i})" class="btn-delete-small">\uD83D\uDDD1\uFE0F</button>
            </div>
        `).join('')}</div>`;
    },

    // ==================== TAB 3 : CONTENU PEDAGOGIQUE ====================
    renderContentTab() {
        const f = this.currentFormation || {};
        return `
            <div class="form-grid">
                <div class="form-group form-group-full">
                    <label>Public cible</label>
                    <textarea id="target_audience" rows="2">${f.target_audience || ''}</textarea>
                </div>
                <div class="form-group form-group-full">
                    <label>Pr\u00E9-requis</label>
                    <textarea id="prerequisites" rows="2">${f.prerequisites || ''}</textarea>
                </div>
                <div class="form-group form-group-full">
                    <label>Objectifs</label>
                    <textarea id="objectives" rows="3">${f.objectives || ''}</textarea>
                </div>
                <div class="form-group form-group-full">
                    <label>Contenu d\u00E9taill\u00E9</label>
                    <textarea id="module_1" rows="4">${f.module_1 || ''}</textarea>
                </div>
                <div class="form-group form-group-full">
                    <label>Contenus (r\u00E9sum\u00E9 court)</label>
                    <input type="text" id="content_summary" value="${f.content_summary || ''}" placeholder="Ex: les outils, m\u00E9thodes, le savoir-\u00EAtre pour vendre">
                </div>
                <div class="form-group form-group-full">
                    <label>M\u00E9thodes et outils</label>
                    <textarea id="methods_tools" rows="3">${f.methods_tools || ''}</textarea>
                </div>
                <div class="form-group form-group-full">
                    <label>M\u00E9thodologie d'\u00E9valuation</label>
                    <textarea id="evaluation_methodology" rows="2">${f.evaluation_methodology || ''}</textarea>
                </div>
                <div class="form-group form-group-full">
                    <label>Le + apport\u00E9</label>
                    <textarea id="added_value" rows="2">${f.added_value || ''}</textarea>
                </div>
                <div class="form-group form-group-full">
                    <label>D\u00E9lais d'acc\u00E8s</label>
                    <textarea id="access_delays" rows="2">${f.access_delays || ''}</textarea>
                </div>
            </div>
        `;
    },

    // ==================== NAVIGATION ====================
    switchTab(tabName) {
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const tab = document.getElementById(`tab-${tabName}`);
        if (tab) tab.classList.add('active');
        this.currentTab = tabName;
    },

    // ==================== GESTION APPRENANTS ====================
    addLearner() {
        this.learnersData.push({ id: Date.now(), first_name: '', last_name: '', email: '', birth_year: '', position_title: '', phone: '', entity: '', hours: '', position: this.learnersData.length + 1 });
        this.refreshLearnersTab();
    },

    removeLearner(index) {
        this.learnersData.splice(index, 1);
        this.learnersData.forEach((l, i) => l.position = i + 1);
        this.refreshLearnersTab();
    },

    updateLearnerField(index, field, value) {
        this.learnersData[index][field] = value;
    },

    refreshLearnersTab() {
        const container = document.getElementById('learners-list-container');
        if (container) container.innerHTML = this.renderLearnersList();
    },

    // ==================== FILL FORM (edition) ====================
    fillForm() {
        if (!this.currentFormation) return;
        const f = this.currentFormation;
        const fields = [
            'formation_type', 'collaboration_mode', 'client_id', 'subcontractor_id',
            'start_date', 'end_date', 'custom_dates', 'training_location', 'number_of_days',
            'hours_per_learner', 'total_amount', 'status',
            'company_name', 'company_address', 'company_postal_code', 'company_director_name', 'contact_role', 'client_email',
            'subcontractor_address', 'subcontractor_siret', 'subcontractor_nda', 'subcontractor_price',
            'target_audience', 'prerequisites', 'objectives', 'module_1', 'content_summary',
            'methods_tools', 'access_delays', 'evaluation_methodology', 'added_value'
        ];
        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el && f[field]) el.value = f[field];
        });
        // Nom formation : select ou custom
        const nameSelect = document.getElementById('formation_name_select');
        const nameCustom = document.getElementById('formation_name_custom');
        if (nameSelect && f.formation_name) {
            if (this.FORMATION_TEMPLATES[f.formation_name]) {
                nameSelect.value = f.formation_name;
            } else {
                nameSelect.value = '__custom__';
                if (nameCustom) { nameCustom.value = f.formation_name; nameCustom.style.display = 'block'; }
            }
        }
        this.onCollaborationModeChange(f.collaboration_mode);

        // Si les champs pédagogiques sont vides et qu'un template existe, pré-remplir
        if (f.formation_name && this.FORMATION_TEMPLATES[f.formation_name]) {
            const template = this.FORMATION_TEMPLATES[f.formation_name];
            const pedaFields = ['target_audience', 'prerequisites', 'objectives', 'module_1', 'content_summary', 'methods_tools', 'evaluation_methodology', 'added_value', 'access_delays', 'hours_per_learner', 'number_of_days'];
            pedaFields.forEach(id => {
                const el = document.getElementById(id);
                if (el && !el.value.trim() && template[id] !== undefined) {
                    el.value = template[id];
                }
            });
        }
    },

    // ==================== SAVE ====================
    async save(event) {
        event.preventDefault();

        // Validation
        const required = [
            { id: 'formation_name_select', label: 'Nom de la formation', tab: 'general' },
            { id: 'formation_type', label: 'Type de formation', tab: 'general' },
            { id: 'collaboration_mode', label: 'Mode de collaboration', tab: 'general' },
            { id: 'client_id', label: 'Client', tab: 'general' },
            { id: 'start_date', label: 'Date de d\u00E9but', tab: 'general' },
            { id: 'end_date', label: 'Date de fin', tab: 'general' },
            { id: 'hours_per_learner', label: 'Heures par apprenant', tab: 'general' },
        ];
        for (const field of required) {
            const el = document.getElementById(field.id);
            if (!el || !el.value.trim() || el.value === '__custom__') {
                // Si "Autre" selectionne, verifier le champ libre
                if (field.id === 'formation_name_select' && el && el.value === '__custom__') {
                    const custom = document.getElementById('formation_name_custom');
                    if (custom && custom.value.trim()) continue;
                }
                if (this.currentTab !== field.tab) this.switchTab(field.tab);
                if (el) el.focus();
                showToast(`Le champ "${field.label}" est obligatoire`, 'error');
                return;
            }
        }

        // Nom formation
        const nameSelect = document.getElementById('formation_name_select').value;
        const formationName = nameSelect === '__custom__'
            ? (document.getElementById('formation_name_custom').value.trim())
            : nameSelect;

        const collaborationMode = document.getElementById('collaboration_mode').value;
        const clientId = parseInt(document.getElementById('client_id').value);
        const subcontractorId = collaborationMode === 'sous-traitant'
            ? (document.getElementById('subcontractor_id')?.value ? parseInt(document.getElementById('subcontractor_id').value) : null)
            : null;

        if (collaborationMode === 'sous-traitant' && !subcontractorId) {
            this.switchTab('general');
            showToast('Veuillez s\u00E9lectionner un sous-traitant', 'error');
            return;
        }

        // Filtrer les apprenants vides (sans nom ni prenom)
        this.learnersData = this.learnersData.filter(l => (l.first_name || '').trim() || (l.last_name || '').trim());

        const selectedClient = this.clientsData.find(c => c.id === clientId);
        const selectedSub = this.subcontractorsData.find(s => s.id === subcontractorId);

        const formData = {
            formation_name: formationName,
            formation_type: document.getElementById('formation_type').value,
            collaboration_mode: collaborationMode,
            client_id: clientId,
            subcontractor_id: subcontractorId,
            client_name: selectedClient ? selectedClient.company_name : '',
            subcontractor_first_name: selectedSub ? selectedSub.first_name : '',
            subcontractor_last_name: selectedSub ? selectedSub.last_name : '',
            subcontractor_address: document.getElementById('subcontractor_address')?.value || '',
            subcontractor_siret: document.getElementById('subcontractor_siret')?.value || '',
            subcontractor_nda: document.getElementById('subcontractor_nda')?.value || '',
            subcontractor_price: document.getElementById('subcontractor_price')?.value || '600',
            start_date: document.getElementById('start_date').value,
            end_date: document.getElementById('end_date').value,
            custom_dates: document.getElementById('custom_dates').value.trim() || null,
            training_location: document.getElementById('training_location').value,
            number_of_days: parseInt(document.getElementById('number_of_days').value) || null,
            hours_per_learner: parseFloat(document.getElementById('hours_per_learner').value) || 0,
            total_amount: parseFloat(document.getElementById('total_amount').value) || null,
            status: document.getElementById('status').value,
            company_name: document.getElementById('company_name').value,
            company_address: document.getElementById('company_address').value,
            company_postal_code: document.getElementById('company_postal_code').value,
            company_director_name: document.getElementById('company_director_name').value,
            company_director_title: document.getElementById('company_director_title').value,
            contact_role: document.getElementById('contact_role')?.value || 'dirigeant',
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
            learners_data: this.learnersData,
            title: formationName,
            description: document.getElementById('objectives').value
        };

        try {
            if (this.currentFormation) {
                const { error } = await supabaseClient.from('formations').update(formData).eq('id', this.currentFormation.id);
                if (error) throw error;
                showToast('Formation mise \u00E0 jour !', 'success');
            } else {
                const { data: created, error } = await supabaseClient.from('formations')
                    .insert([{ ...formData, created_by: (await supabaseClient.auth.getUser()).data.user.id }])
                    .select().single();
                if (error) throw error;

                // Auto-creation BPF
                try {
                    const startDate = new Date(formData.start_date);
                    const month = startDate.getMonth() + 1;
                    const year = startDate.getFullYear();
                    const fiscalYear = month >= 10 ? year + 1 : year;
                    const typeLabels = { ecoles: '\u00C9coles', entreprises: 'Entreprise' };
                    const modeLabels = { direct: 'Direct', indirect: 'Indirect', 'sous-traitant': 'Sous-traitance' };
                    await SupabaseData.addBPF({
                        formation_id: created.id,
                        formation_type: `${typeLabels[formData.formation_type] || formData.formation_type} - ${modeLabels[formData.collaboration_mode] || formData.collaboration_mode}`,
                        company_name: formData.client_name,
                        year: fiscalYear,
                        amount_ht: formData.total_amount || 0,
                        number_of_learners: this.learnersData.length,
                        total_hours: formData.hours_per_learner,
                        exported: false,
                        export_amount: 0
                    });
                } catch (e) { console.warn('BPF auto-creation:', e); }

                // Auto-attribution des questionnaires pertinents
                try {
                    const categories = ['amont', 'satisfaction', 'evaluation_acquis'];
                    for (const cat of categories) {
                        const q = await SupabaseData.getQuestionnaireForFormation(created.id, cat);
                        if (q) await SupabaseData.assignQuestionnaireToFormation(created.id, q.id);
                    }
                } catch (e) { console.warn('Auto-assign questionnaires:', e); }

                showToast('Formation cr\u00E9\u00E9e !', 'success');
                addNotification('formation', `Formation cr\u00E9\u00E9e \u2014 ${formData.formation_name}`);
            }
            this.close();
            if (typeof CRMApp !== 'undefined' && CRMApp.loadFormations) CRMApp.loadFormations();

            // Revenir a la modal document si on venait de "Modifier les infos"
            if (this._returnToDocPreview) {
                const { formationId, docType } = this._returnToDocPreview;
                this._returnToDocPreview = null;
                setTimeout(() => DocumentPreview.open(formationId, docType), 500);
            }
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            showToast('Erreur: ' + error.message, 'error');
        }
    },

    close() {
        const modal = document.getElementById('formation-modal');
        if (modal) { modal.classList.remove('show'); setTimeout(() => modal.remove(), 300); }
        this.reset();
    }
};
