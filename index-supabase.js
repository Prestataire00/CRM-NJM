// ==================== CRM App with Supabase Integration ====================
// Ce fichier remplace toute la logique localStorage par Supabase

// Diagnostic au chargement
console.log('=== DIAGNOSTIC ===');
console.log('SupabaseData disponible ?', typeof SupabaseData !== 'undefined');
if (typeof SupabaseData !== 'undefined') {
    console.log('deleteFormationDocument disponible ?', typeof SupabaseData.deleteFormationDocument === 'function');
    console.log('Méthodes disponibles:', Object.keys(SupabaseData).filter(k => typeof SupabaseData[k] === 'function'));

    // CORRECTIF TEMPORAIRE : Ajouter la fonction manquante directement
    if (typeof SupabaseData.deleteFormationDocument !== 'function') {
        console.warn('⚠️ Ajout de deleteFormationDocument manuellement (correctif temporaire)');
        SupabaseData.deleteFormationDocument = async function (docId) {
            try {
                const { error, count } = await supabaseClient
                    .from('formation_documents')
                    .delete({ count: 'exact' })
                    .eq('id', docId);

                if (error) throw error;

                if (count === 0) {
                    return {
                        success: false,
                        message: "Le document n'a pas pu être supprimé. Vérifiez qu'il existe et que vous avez les droits (RLS)."
                    };
                }

                return { success: true };
            } catch (error) {
                console.error('Error deleting formation document:', error);
                return { success: false, message: 'Erreur lors de la suppression du document.' };
            }
        };
    }
}
console.log('==================');

/**
 * Convertit une URL Google Docs/Drive en URL d'export PDF
 */
function toPdfUrl(url) {
    if (!url) return '';
    // Google Docs: https://docs.google.com/document/d/{ID}/edit... → export PDF
    const docsMatch = url.match(/docs\.google\.com\/document\/d\/([^/]+)/);
    if (docsMatch) {
        return `https://docs.google.com/document/d/${docsMatch[1]}/export?format=pdf`;
    }
    // Google Drive file: déjà un lien Drive, on le garde tel quel
    return url;
}

const CRMApp = {
    currentPage: 'dashboard',
    currentVeilleType: 'formation',

    async init() {
        this.setupNavigation();
        await this.updateDashboardStats();
        await this.loadFormations();
        await this.loadVeille();
        await this.loadBPF();
        await this.loadSupports();
        await this.loadTemplates();
        await this.loadUsers();
        await this.checkExpiringDocuments();
    },

    // ==================== FORMATEUR VIEW ====================

    async initFormateurView(user) {
        console.log('🎓 Initialisation vue formateur pour:', user.name);
        this.currentUser = user;
        this.setupFormateurNavigation();
        await this.loadMissions();
        this.showPage('missions');
    },

    setupFormateurNavigation() {
        const formateurNav = document.getElementById('formateur-nav');
        if (formateurNav) {
            formateurNav.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = item.getAttribute('data-page');
                    if (page) {
                        this.showPage(page);
                        formateurNav.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                        item.classList.add('active');
                    }
                });
            });
        }
    },

    async loadMissions() {
        console.log('📋 Chargement des missions...');
        const result = await SupabaseData.getFormationsByFormateur(this.currentUser.id);

        const noLinkMessage = document.getElementById('missions-no-link');
        const tableContainer = document.getElementById('missions-table-container');
        const emptyMessage = document.getElementById('missions-empty');
        const tbody = document.getElementById('missions-tbody');

        if (!result.success || result.message === 'Aucun sous-traitant lié à ce compte.') {
            // Formateur non lié à un sous-traitant
            if (noLinkMessage) noLinkMessage.style.display = 'block';
            if (tableContainer) tableContainer.style.display = 'none';
            return;
        }

        if (noLinkMessage) noLinkMessage.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';

        const formations = result.data;

        if (formations.length === 0) {
            if (tbody) tbody.innerHTML = '';
            if (emptyMessage) emptyMessage.style.display = 'block';
            return;
        }

        if (emptyMessage) emptyMessage.style.display = 'none';
        this.renderMissions(formations);
    },

    renderMissions(formations) {
        const tbody = document.getElementById('missions-tbody');
        if (!tbody) return;

        tbody.innerHTML = formations.map(f => {
            const startDate = f.start_date ? new Date(f.start_date).toLocaleDateString('fr-FR') : 'N/A';
            const endDate = f.end_date ? new Date(f.end_date).toLocaleDateString('fr-FR') : 'N/A';

            const statusColors = {
                'completed': { bg: '#d1fae5', color: '#065f46', text: 'Terminée' },
                'in_progress': { bg: '#fef3c7', color: '#92400e', text: 'En cours' },
                'planned': { bg: '#dbeafe', color: '#1e40af', text: 'Planifiée' }
            };
            const status = statusColors[f.status] || statusColors['planned'];

            return `
                <tr style="border-bottom: 1px solid var(--gray-200);">
                    <td style="padding: 1rem; font-weight: 500;">${f.client_name || 'N/A'}</td>
                    <td style="padding: 1rem;">${f.formation_name || f.title || 'N/A'}</td>
                    <td style="padding: 1rem;">${startDate} - ${endDate}</td>
                    <td style="padding: 1rem;">
                        <span style="padding: 0.25rem 0.75rem; background: ${status.bg}; color: ${status.color}; border-radius: 9999px; font-size: 0.875rem; font-weight: 500;">
                            ${status.text}
                        </span>
                    </td>
                    <td style="padding: 1rem; text-align: center;">
                        <button onclick="CRMApp.showMissionDetails(${f.id})"
                            style="padding: 0.5rem 1rem; background: var(--primary-purple); color: white; border: none; border-radius: var(--radius-md); font-weight: 500; cursor: pointer; font-size: 0.875rem;">
                            Détails
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async showMissionDetails(formationId) {
        // Trouver la formation
        const result = await SupabaseData.getFormationsByFormateur(this.currentUser.id);
        if (!result.success) return;

        const formation = result.data.find(f => f.id === formationId);
        if (!formation) {
            alert('Formation non trouvée');
            return;
        }

        const startDate = formation.start_date ? new Date(formation.start_date).toLocaleDateString('fr-FR') : 'N/A';
        const endDate = formation.end_date ? new Date(formation.end_date).toLocaleDateString('fr-FR') : 'N/A';

        // Parse learners data
        let learnersData = [];
        if (formation.learners) {
            try {
                learnersData = typeof formation.learners === 'string' ? JSON.parse(formation.learners) : formation.learners;
            } catch (e) {
                console.error('Erreur parsing learners:', e);
            }
        }

        // Construire la liste des documents
        let documentsHtml = '<p style="color: var(--gray-500); text-align: center; padding: 1rem;">Aucun document disponible</p>';
        if (formation.formation_documents && formation.formation_documents.length > 0) {
            documentsHtml = formation.formation_documents.map(doc => {
                const docTypes = {
                    'convention': { icon: '📄', label: 'Convention', color: '#7c3aed' },
                    'attendance_sheet': { icon: '📋', label: 'Feuille de présence', color: '#059669' },
                    'certificate': { icon: '🏅', label: 'Attestation', color: '#dc2626' },
                    'program': { icon: '📚', label: 'Programme', color: '#0284c7' },
                    'convocation': { icon: '📨', label: 'Convocation', color: '#ea580c' },
                    'contrat_sous_traitance': { icon: '📝', label: 'Contrat de prestation', color: '#b45309' }
                };
                const docType = docTypes[doc.type] || { icon: '📑', label: doc.type || 'Document', color: '#0284c7' };

                // Récupérer l'URL du document en PDF pour l'espace formateur
                const docUrl = toPdfUrl(doc.document_url || doc.url || doc.google_doc_url || '');

                return `
                    <a href="${docUrl || '#'}" target="_blank" rel="noopener noreferrer"
                       style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: var(--gray-50); border-radius: var(--radius-md); text-decoration: none; color: var(--gray-900); margin-bottom: 0.5rem; transition: background 0.2s; cursor: pointer;"
                       onmouseover="this.style.background='var(--gray-100)'" onmouseout="this.style.background='var(--gray-50)'"
                       onclick="if(!this.href || this.href.endsWith('#')) { event.preventDefault(); alert('URL du document non disponible'); }">
                        <span style="font-size: 1.5rem;">${docType.icon}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 500;">${doc.name || docType.label}</div>
                            <div style="font-size: 0.75rem; color: ${docType.color};">${docType.label}</div>
                        </div>
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="opacity: 0.5;">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                    </a>
                `;
            }).join('');
        }

        // Construire la liste des apprenants
        let learnersHtml = '<p style="color: var(--gray-500); text-align: center; padding: 1rem;">Aucun apprenant enregistré</p>';
        if (learnersData.length > 0) {
            const totalHours = learnersData.reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);
            learnersHtml = `
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--gray-50);">
                                <th style="padding: 0.75rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase;">#</th>
                                <th style="padding: 0.75rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase;">Prénom</th>
                                <th style="padding: 0.75rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase;">Nom</th>
                                <th style="padding: 0.75rem; text-align: right; font-size: 0.75rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase;">Heures</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${learnersData.map((l, i) => `
                                <tr style="border-bottom: 1px solid var(--gray-100);">
                                    <td style="padding: 0.75rem; color: var(--gray-500);">${i + 1}</td>
                                    <td style="padding: 0.75rem; font-weight: 500;">${l.first_name || '-'}</td>
                                    <td style="padding: 0.75rem;">${l.last_name || '-'}</td>
                                    <td style="padding: 0.75rem; text-align: right; font-weight: 500;">${l.hours || 0}h</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f8f9fa;">
                                <td colspan="3" style="padding: 0.75rem; font-weight: 600; text-align: right;">Total heures formation :</td>
                                <td style="padding: 0.75rem; text-align: right; font-weight: 700; color: #db2777;">${totalHours}h</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        }

        // Construire le contenu pédagogique
        const pedagogicalFields = [
            { key: 'target_audience', label: 'Public cible' },
            { key: 'prerequisites', label: 'Pré-requis' },
            { key: 'objectives', label: 'Objectifs' },
            { key: 'module_1', label: 'Module 1' },
            { key: 'methods_tools', label: 'Méthode, moyens, outils' },
            { key: 'evaluation_methodology', label: 'Méthodologie d\'évaluation' },
            { key: 'added_value', label: 'Le + apporté' },
            { key: 'access_delays', label: 'Délais d\'accès' }
        ];

        const hasPedagogicalContent = pedagogicalFields.some(f => formation[f.key]);
        let pedagogicalHtml = '<p style="color: var(--gray-500); text-align: center; padding: 1rem;">Aucun contenu pédagogique renseigné</p>';
        if (hasPedagogicalContent) {
            pedagogicalHtml = pedagogicalFields.map(field => {
                const value = formation[field.key];
                if (!value) return '';
                return `
                    <div style="margin-bottom: 1.25rem;">
                        <div style="font-size: 0.75rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 0.5rem;">${field.label}</div>
                        <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md); color: var(--gray-700); white-space: pre-wrap; line-height: 1.5;">${value}</div>
                    </div>
                `;
            }).filter(Boolean).join('');
        }

        // Créer la modal avec onglets
        const modal = document.createElement('div');
        modal.id = 'mission-details-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;';

        modal.innerHTML = `
            <div style="background: white; border-radius: var(--radius-xl); max-width: 800px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl);">
                <!-- Header -->
                <div style="padding: 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                    <div>
                        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--gray-900);">${formation.formation_name || 'Détails de la mission'}</h2>
                        <p style="font-size: 0.875rem; color: var(--gray-500); margin-top: 0.25rem;">${formation.client_name || ''} - ${startDate} au ${endDate}</p>
                    </div>
                    <button onclick="document.getElementById('mission-details-modal').remove()"
                        style="background: none; border: none; cursor: pointer; padding: 0.5rem;">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                <!-- Onglets -->
                <div style="display: flex; border-bottom: 1px solid var(--gray-200); padding: 0 1.5rem; flex-shrink: 0; overflow-x: auto;">
                    <button class="mission-tab-btn active" data-tab="general" onclick="CRMApp.switchMissionTab('general')"
                        style="padding: 1rem 1.25rem; background: none; border: none; cursor: pointer; font-weight: 500; color: var(--primary-purple); border-bottom: 2px solid var(--primary-purple); margin-bottom: -1px; white-space: nowrap;">
                        Informations
                    </button>
                    <button class="mission-tab-btn" data-tab="company" onclick="CRMApp.switchMissionTab('company')"
                        style="padding: 1rem 1.25rem; background: none; border: none; cursor: pointer; font-weight: 500; color: var(--gray-500); border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap;">
                        Entreprise & Apprenants
                    </button>
                    <button class="mission-tab-btn" data-tab="pedagogical" onclick="CRMApp.switchMissionTab('pedagogical')"
                        style="padding: 1rem 1.25rem; background: none; border: none; cursor: pointer; font-weight: 500; color: var(--gray-500); border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap;">
                        Contenu pédagogique
                    </button>
                    <button class="mission-tab-btn" data-tab="documents" onclick="CRMApp.switchMissionTab('documents')"
                        style="padding: 1rem 1.25rem; background: none; border: none; cursor: pointer; font-weight: 500; color: var(--gray-500); border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap;">
                        Documents (${formation.formation_documents?.length || 0})
                    </button>
                </div>

                <!-- Contenu des onglets -->
                <div style="padding: 1.5rem; overflow-y: auto; flex: 1;">
                    <!-- Onglet Informations générales -->
                    <div id="mission-tab-general" class="mission-tab-content" style="display: block;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                                <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Formation</div>
                                <div style="font-weight: 600; color: var(--gray-900);">${formation.formation_name || 'N/A'}</div>
                            </div>
                            <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                                <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Type</div>
                                <div style="font-weight: 500; color: var(--gray-700);">${formation.formation_type === 'ecoles' ? 'Écoles' : formation.formation_type === 'entreprises' ? 'Entreprises' : 'N/A'}</div>
                            </div>
                            <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                                <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Dates</div>
                                <div style="font-weight: 500; color: var(--gray-700);">${startDate} - ${endDate}</div>
                            </div>
                            <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                                <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Lieu de formation</div>
                                <div style="font-weight: 500; color: var(--gray-700);">${formation.training_location || 'Non précisé'}</div>
                            </div>
                            <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                                <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Nombre de jours</div>
                                <div style="font-weight: 500; color: var(--gray-700);">${formation.number_of_days || 'N/A'} jour(s)</div>
                            </div>
                            <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                                <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Total heures</div>
                                <div style="font-weight: 500; color: var(--gray-700);">${formation.hours_per_learner || 0}h</div>
                            </div>
                            <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                                <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Mode de collaboration</div>
                                <div style="font-weight: 500; color: var(--gray-700);">${formation.collaboration_mode === 'sous-traitant' ? 'Sous-traitant' : formation.collaboration_mode === 'direct' ? 'Direct' : formation.collaboration_mode === 'indirect' ? 'Indirect' : 'N/A'}</div>
                            </div>
                            <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                                <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Statut</div>
                                <div>
                                    <span style="padding: 0.25rem 0.75rem; background: ${formation.status === 'completed' ? '#d1fae5' : formation.status === 'in_progress' ? '#fef3c7' : '#dbeafe'}; color: ${formation.status === 'completed' ? '#065f46' : formation.status === 'in_progress' ? '#92400e' : '#1e40af'}; border-radius: 9999px; font-size: 0.875rem; font-weight: 500;">
                                        ${formation.status === 'completed' ? 'Terminée' : formation.status === 'in_progress' ? 'En cours' : 'Planifiée'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Onglet Entreprise & Apprenants -->
                    <div id="mission-tab-company" class="mission-tab-content" style="display: none;">
                        <div style="margin-bottom: 2rem;">
                            <h3 style="font-size: 0.875rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 1rem;">Informations entreprise</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                                    <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Raison sociale</div>
                                    <div style="font-weight: 600; color: var(--gray-900);">${formation.company_name || formation.client_name || 'N/A'}</div>
                                </div>
                                <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                                    <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Nom du dirigeant</div>
                                    <div style="font-weight: 500; color: var(--gray-700);">${formation.company_director_name || 'Non précisé'}</div>
                                </div>
                                <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md); grid-column: span 2;">
                                    <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Adresse</div>
                                    <div style="font-weight: 500; color: var(--gray-700);">${formation.company_address || 'Non précisée'} ${formation.company_postal_code ? `- ${formation.company_postal_code}` : ''}</div>
                                </div>
                                <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md); grid-column: span 2;">
                                    <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Email client</div>
                                    <div style="font-weight: 500; color: var(--gray-700);">${formation.client_email || 'Non précisé'}</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 style="font-size: 0.875rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 1rem;">Liste des apprenants (${learnersData.length})</h3>
                            ${learnersHtml}
                        </div>
                    </div>

                    <!-- Onglet Contenu pédagogique -->
                    <div id="mission-tab-pedagogical" class="mission-tab-content" style="display: none;">
                        ${pedagogicalHtml}
                    </div>

                    <!-- Onglet Documents -->
                    <div id="mission-tab-documents" class="mission-tab-content" style="display: none;">
                        <h3 style="font-size: 0.875rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 1rem;">Documents de la formation</h3>
                        ${documentsHtml}
                    </div>
                </div>

                <!-- Footer -->
                <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--gray-200); text-align: right; flex-shrink: 0;">
                    <button onclick="document.getElementById('mission-details-modal').remove()"
                        style="padding: 0.75rem 1.5rem; background: var(--gray-200); color: var(--gray-700); border: none; border-radius: var(--radius-md); font-weight: 500; cursor: pointer;">
                        Fermer
                    </button>
                </div>
            </div>
        `;

        // Fermer en cliquant à l'extérieur
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        document.body.appendChild(modal);
    },

    switchMissionTab(tabName) {
        // Mettre à jour les boutons
        document.querySelectorAll('.mission-tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.style.color = 'var(--primary-purple)';
                btn.style.borderBottomColor = 'var(--primary-purple)';
                btn.classList.add('active');
            } else {
                btn.style.color = 'var(--gray-500)';
                btn.style.borderBottomColor = 'transparent';
                btn.classList.remove('active');
            }
        });

        // Mettre à jour le contenu
        document.querySelectorAll('.mission-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        const targetTab = document.getElementById(`mission-tab-${tabName}`);
        if (targetTab) {
            targetTab.style.display = 'block';
        }
    },

    // ==================== END FORMATEUR VIEW ====================

    // ==================== CLIENT VIEW ====================

    async initClientView(user) {
        console.log('👤 Initialisation vue client pour:', user.name);
        this.currentUser = user;
        this.selectedClientId = null; // ID de l'entreprise sélectionnée
        this.setupClientNavigation();
        await this.loadClientCompanies();
        this.showPage('ma-formation');
    },

    async loadClientCompanies() {
        // Charger toutes les entreprises liées à ce compte
        const result = await SupabaseData.getClientsByUserId(this.currentUser.id);
        const selector = document.getElementById('client-company-selector');
        const select = document.getElementById('client-company-select');

        if (result.success && result.data.length > 1) {
            // Plusieurs entreprises : afficher le sélecteur
            if (selector) selector.style.display = 'block';
            if (select) {
                select.innerHTML = result.data.map(c =>
                    `<option value="${c.id}">${c.company_name}</option>`
                ).join('');
            }
            this.selectedClientId = result.data[0].id;
        } else if (result.success && result.data.length === 1) {
            // Une seule entreprise : pas besoin de sélecteur
            if (selector) selector.style.display = 'none';
            this.selectedClientId = result.data[0].id;
        } else {
            if (selector) selector.style.display = 'none';
            this.selectedClientId = null;
        }

        await this.loadClientFormation();
    },

    async onClientCompanyChange(clientId) {
        this.selectedClientId = parseInt(clientId);
        await this.loadClientFormation();
    },

    setupClientNavigation() {
        const clientNav = document.getElementById('client-nav');
        if (clientNav) {
            clientNav.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = item.getAttribute('data-page');
                    if (page) {
                        this.showPage(page);
                        clientNav.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                        item.classList.add('active');
                    }
                });
            });
        }
    },

    async loadClientFormation() {
        console.log('📚 Chargement de la formation client... (entreprise:', this.selectedClientId, ')');
        const result = await SupabaseData.getFormationsByClient(this.currentUser.id, this.selectedClientId);

        const noFormation = document.getElementById('client-no-formation');
        const formationContent = document.getElementById('client-formation-content');

        if (!result.success || result.message === 'Aucune entreprise liée à ce compte.' || result.data.length === 0) {
            // Client sans formation
            if (noFormation) noFormation.style.display = 'block';
            if (formationContent) formationContent.style.display = 'none';
            return;
        }

        if (noFormation) noFormation.style.display = 'none';
        if (formationContent) formationContent.style.display = 'block';

        // Prendre la formation la plus récente (ou en cours)
        const formations = result.data;
        const activeFormation = formations.find(f => f.status === 'in_progress') || formations[0];

        this.currentClientFormation = activeFormation;
        this.renderClientFormationSummary(activeFormation);
        this.renderClientFormationTabs(activeFormation);
    },

    renderClientFormationSummary(formation) {
        const startDate = formation.start_date ? new Date(formation.start_date).toLocaleDateString('fr-FR') : 'N/A';
        const endDate = formation.end_date ? new Date(formation.end_date).toLocaleDateString('fr-FR') : 'N/A';

        const statusMap = {
            'completed': 'Terminée',
            'in_progress': 'En cours',
            'planned': 'Planifiée',
            'cancelled': 'Annulée'
        };

        document.getElementById('client-formation-name').textContent = formation.formation_name || 'Formation';
        document.getElementById('client-formation-dates').textContent = `Du ${startDate} au ${endDate}`;
        document.getElementById('client-formation-status').textContent = statusMap[formation.status] || 'Planifiée';
        document.getElementById('client-formation-location').textContent = formation.training_location || 'Non précisé';
        document.getElementById('client-formation-duration').textContent = `${formation.number_of_days || '-'} jour(s)`;
        document.getElementById('client-formation-hours').textContent = `${formation.hours_per_learner || '-'} h`;
    },

    renderClientFormationTabs(formation) {
        // Onglet Informations
        const infosContainer = document.getElementById('client-formation-infos');
        if (infosContainer) {
            infosContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
                    <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                        <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Type de formation</div>
                        <div style="font-weight: 500; color: var(--gray-900);">${formation.formation_type === 'ecoles' ? 'Écoles' : formation.formation_type === 'entreprises' ? 'Entreprises' : 'N/A'}</div>
                    </div>
                    <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                        <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Mode de collaboration</div>
                        <div style="font-weight: 500; color: var(--gray-900);">${formation.collaboration_mode === 'sous-traitant' ? 'Sous-traitant' : formation.collaboration_mode === 'direct' ? 'Direct' : formation.collaboration_mode === 'indirect' ? 'Indirect' : 'N/A'}</div>
                    </div>
                    <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                        <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Entreprise</div>
                        <div style="font-weight: 500; color: var(--gray-900);">${formation.company_name || formation.client_name || 'N/A'}</div>
                    </div>
                    <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                        <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Adresse</div>
                        <div style="font-weight: 500; color: var(--gray-900);">${formation.company_address || 'Non précisée'} ${formation.company_postal_code ? `- ${formation.company_postal_code}` : ''}</div>
                    </div>
                    <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                        <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Dirigeant</div>
                        <div style="font-weight: 500; color: var(--gray-900);">${formation.company_director_name || 'Non précisé'}</div>
                    </div>
                    <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md);">
                        <div style="font-size: 0.75rem; color: var(--gray-500); margin-bottom: 0.25rem;">Email client</div>
                        <div style="font-weight: 500; color: var(--gray-900);">${formation.client_email || 'Non précisé'}</div>
                    </div>
                </div>

                ${this.renderClientLearnersList(formation)}
            `;
        }

        // Onglet Contenu pédagogique
        const pedagogieContainer = document.getElementById('client-formation-pedagogie');
        if (pedagogieContainer) {
            const fields = [
                { key: 'target_audience', label: 'Public cible' },
                { key: 'prerequisites', label: 'Pré-requis' },
                { key: 'objectives', label: 'Objectifs' },
                { key: 'module_1', label: 'Module 1' },
                { key: 'methods_tools', label: 'Méthode, moyens, outils' },
                { key: 'evaluation_methodology', label: 'Méthodologie d\'évaluation' },
                { key: 'added_value', label: 'Le + apporté' },
                { key: 'access_delays', label: 'Délais d\'accès' }
            ];

            const hasContent = fields.some(f => formation[f.key]);
            if (hasContent) {
                pedagogieContainer.innerHTML = fields.map(field => {
                    if (!formation[field.key]) return '';
                    return `
                        <div style="margin-bottom: 1.5rem;">
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 0.5rem;">${field.label}</div>
                            <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md); color: var(--gray-700); white-space: pre-wrap; line-height: 1.6;">${formation[field.key]}</div>
                        </div>
                    `;
                }).filter(Boolean).join('');
            } else {
                pedagogieContainer.innerHTML = '<p style="color: var(--gray-500); text-align: center; padding: 2rem;">Aucun contenu pédagogique renseigné pour cette formation.</p>';
            }
        }

        // Onglet Documents
        const documentsContainer = document.getElementById('client-formation-documents');
        if (documentsContainer) {
            const docs = formation.formation_documents || [];

            // Documents statiques toujours visibles pour le client
            const staticDocsList = [
                { name: 'Document préalable à la formation', type: 'doc_prealable', document_url: 'https://docs.google.com/document/d/1aMsZo2m7cycaLYoldhJeQ13is_5hHK2v/edit' },
                { name: 'Livret d\'accueil NJM Conseil', type: 'livret_accueil', document_url: 'https://drive.google.com/file/d/1p6qJTI0jan7h1JNtUZ_PkD0oTNyfrG-a/view' },
                { name: 'Fiche de réclamation', type: 'fiche_reclamation', document_url: 'https://drive.google.com/file/d/1HE_wGaYO4xLF4MvHATWMU_vBJXIjTL9c/view' }
            ];

            const allDocs = [...docs, ...staticDocsList];

            const docTypes = {
                'doc_prealable': { icon: '📋', label: 'Document préalable', color: '#2563eb' },
                'convention': { icon: '📄', label: 'Convention', color: '#7c3aed' },
                'attendance_sheet': { icon: '📋', label: 'Feuille de présence', color: '#059669' },
                'certificate': { icon: '🏅', label: 'Attestation', color: '#dc2626' },
                'program': { icon: '📚', label: 'Programme', color: '#0284c7' },
                'google_doc': { icon: '📝', label: 'Fiche pédagogique', color: '#ea580c' },
                'convocation': { icon: '📨', label: 'Convocation', color: '#0891b2' },
                'livret_accueil': { icon: '📖', label: 'Livret d\'accueil', color: '#7c3aed' },
                'fiche_reclamation': { icon: '📝', label: 'Fiche de réclamation', color: '#b45309' }
            };

            documentsContainer.innerHTML = `
                <div style="display: grid; gap: 1rem;">
                    ${allDocs.map(doc => {
                        const docType = docTypes[doc.type] || { icon: '📑', label: doc.type || 'Document', color: '#6b7280' };
                        const docUrl = toPdfUrl(doc.document_url || doc.url || doc.google_doc_url || '');

                        return `
                            <a href="${docUrl || '#'}" target="_blank" rel="noopener noreferrer"
                               style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md); text-decoration: none; color: var(--gray-900); transition: all 0.2s; border: 1px solid transparent;"
                               onmouseover="this.style.background='white'; this.style.borderColor='var(--gray-200)'; this.style.boxShadow='var(--shadow-sm)';"
                               onmouseout="this.style.background='var(--gray-50)'; this.style.borderColor='transparent'; this.style.boxShadow='none';"
                               onclick="if(!this.href || this.href.endsWith('#')) { event.preventDefault(); alert('URL du document non disponible'); }">
                                <span style="font-size: 2rem;">${docType.icon}</span>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: var(--gray-900);">${doc.name || docType.label}</div>
                                    <div style="font-size: 0.75rem; color: ${docType.color}; margin-top: 0.25rem;">${docType.label}</div>
                                </div>
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="opacity: 0.5;">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                </svg>
                            </a>
                        `;
                    }).join('')}
                </div>
            `;
        }
    },

    renderClientLearnersList(formation) {
        let learnersData = [];
        if (formation.learners) {
            try {
                learnersData = typeof formation.learners === 'string' ? JSON.parse(formation.learners) : formation.learners;
            } catch (e) {
                console.error('Erreur parsing learners:', e);
            }
        }

        if (learnersData.length === 0) {
            return '';
        }

        const totalHours = learnersData.reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);

        return `
            <div style="margin-top: 2rem;">
                <h4 style="font-size: 0.875rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 1rem;">Apprenants inscrits (${learnersData.length})</h4>
                <div style="background: white; border: 1px solid var(--gray-200); border-radius: var(--radius-md); overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--gray-50);">
                                <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--gray-500);">#</th>
                                <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--gray-500);">Prénom</th>
                                <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--gray-500);">Nom</th>
                                <th style="padding: 0.75rem 1rem; text-align: right; font-size: 0.75rem; font-weight: 600; color: var(--gray-500);">Heures</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${learnersData.map((l, i) => `
                                <tr style="border-top: 1px solid var(--gray-100);">
                                    <td style="padding: 0.75rem 1rem; color: var(--gray-500);">${i + 1}</td>
                                    <td style="padding: 0.75rem 1rem; font-weight: 500;">${l.first_name || '-'}</td>
                                    <td style="padding: 0.75rem 1rem;">${l.last_name || '-'}</td>
                                    <td style="padding: 0.75rem 1rem; text-align: right;">${l.hours || 0}h</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background: var(--gray-50); border-top: 2px solid var(--gray-200);">
                                <td colspan="3" style="padding: 0.75rem 1rem; font-weight: 600; text-align: right;">Total :</td>
                                <td style="padding: 0.75rem 1rem; text-align: right; font-weight: 700; color: var(--primary-pink);">${totalHours}h</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    },

    switchClientFormationTab(tabName) {
        // Mettre à jour les boutons
        document.querySelectorAll('.client-tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.style.color = 'var(--primary-purple)';
                btn.style.borderBottomColor = 'var(--primary-purple)';
            } else {
                btn.style.color = 'var(--gray-500)';
                btn.style.borderBottomColor = 'transparent';
            }
        });

        // Mettre à jour le contenu
        document.querySelectorAll('.client-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        const targetTab = document.getElementById(`client-tab-${tabName}`);
        if (targetTab) {
            targetTab.style.display = 'block';
        }
    },

    // ==================== END CLIENT VIEW ====================

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                if (page) {
                    this.showPage(page);
                    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');
                }
            });
        });
    },

    showPage(pageName) {
        document.querySelectorAll('.page-content').forEach(page => {
            page.style.display = 'none';
        });

        const targetPage = document.getElementById(`page-${pageName}`);
        if (targetPage) {
            targetPage.style.display = 'block';
            this.currentPage = pageName;
        }

        // Reload users when navigating to access management page
        if (pageName === 'acces') {
            setTimeout(() => UserManagement.loadUsers(), 100);
        }

        // Reload BPF when navigating to BPF page
        if (pageName === 'bpf') {
            setTimeout(() => this.loadBPF(), 100);
        }

        const pageTitles = {
            'dashboard': 'Tableau de bord',
            'formations': 'Formation 2026',
            'veille': 'Veille',
            'bpf': 'BPF',
            'biblio-supports': 'Bibliothèque Supports',
            'biblio-templates': 'Bibliothèque Templates',
            'acces': 'Gestion des Accès',
            'parametres': 'Paramètres',
            'missions': 'Mes missions',
            'mes-documents': 'Mes documents',
            'ma-formation': 'Ma formation',
            'catalogue': 'Catalogue de formations'
        };
        document.querySelector('.header-title').textContent = pageTitles[pageName] || 'CRM';
    },

    async updateDashboardStats() {
        const result = await SupabaseData.getDashboardStats();
        if (result.success) {
            const stats = result.stats;
            document.getElementById('kpi-learners').textContent = stats.learnersCount;
            document.getElementById('kpi-completed').textContent = stats.formationsCompleted;
            document.getElementById('kpi-in-progress').textContent = stats.formationsInProgress;
            document.getElementById('kpi-client-access').textContent = stats.clientAccesses;
        }
    },

    async addFormation() {
        // Utiliser le nouveau formulaire complet avec onglets
        if (typeof FormationForm !== 'undefined') {
            FormationForm.show();
        } else {
            console.error('FormationForm non chargé');
            alert('Erreur: Le formulaire de formation n\'est pas disponible');
        }
    },

    async loadFormations() {
        console.log('🔄 loadFormations() - Début du chargement...');
        const result = await SupabaseData.getFormations();

        console.log('📦 Résultat de SupabaseData.getFormations():', result);

        if (!result.success) {
            console.error('❌ Erreur lors du chargement des formations:', result.message);
            alert('❌ Erreur de chargement: ' + result.message);
            return;
        }

        const formations = result.data;
        console.log(`📋 Formations à afficher: ${formations.length}`);
        console.log('📁 Détails:', formations);

        const tbody = document.getElementById('formations-tbody');

        if (!tbody) {
            console.error('❌ Élément formations-tbody introuvable dans le DOM!');
            return;
        }

        console.log('✅ Élément tbody trouvé, génération du HTML...');

        tbody.innerHTML = formations.map(f => `
            <tr style="border-bottom: 1px solid var(--gray-200);">
                <td style="padding: 1rem;">${f.client_name || f.title || 'Sans nom'}</td>
                <td style="padding: 1rem;">${f.formation_name || f.description || 'N/A'}</td>
                <td style="padding: 1rem;">
                    <span style="padding: 0.25rem 0.75rem; background: ${f.status === 'completed' ? '#d1fae5' : '#fef3c7'}; color: ${f.status === 'completed' ? '#065f46' : '#92400e'}; border-radius: 9999px; font-size: 0.875rem; font-weight: 500;">
                        ${f.status === 'completed' ? 'Terminée' : f.status === 'in_progress' ? 'En cours' : 'Planifiée'}
                    </span>
                </td>
                <td style="padding: 1rem; text-align: center;">
                    ${f.convocation_logs && f.convocation_logs.length > 0
                ? `<button onclick="CRMApp.showConvocationDetails(${f.id})" style="background: none; border: none; cursor: pointer; padding: 0.5rem;" title="Convocation envoyée - Cliquez pour les détails">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: #d1fae5; border-radius: 50%;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            </span>
                           </button>`
                : `<span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: #f3f4f6; border-radius: 50%;" title="Convocation non envoyée">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                           </span>`
            }
                </td>
                <td style="padding: 1rem;">
                    ${f.formation_documents && f.formation_documents.length > 0
                ? f.formation_documents.map(doc => {
                    const isConvention = doc.type === 'convention';
                    const isAttendanceSheet = doc.type === 'attendance_sheet';
                    const isCertificate = doc.type === 'certificate';
                    const isContratSousTraitance = doc.type === 'contrat_sous_traitance';
                    let icon, color;

                    if (isContratSousTraitance) {
                        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15l2 2 4-4"></path></svg>';
                        color = '#b45309'; // Orange foncé
                    } else if (isCertificate) {
                        // Icône médaille/certificat
                        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"></circle><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"></path></svg>';
                        color = '#dc2626'; // Rouge
                    } else if (isAttendanceSheet) {
                        // Icône calendrier/liste pour feuille de présence
                        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><line x1="9" y1="14" x2="15" y2="14"></line><line x1="9" y1="18" x2="15" y2="18"></line></svg>';
                        color = '#059669'; // Vert
                    } else if (isConvention) {
                        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
                        color = '#7c3aed'; // Violet
                    } else {
                        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
                        color = '#0284c7'; // Bleu
                    }

                    return `
                            <div style="margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                                <a href="${doc.document_url || '#'}" target="_blank" style="color: ${color}; text-decoration: none; font-size: 0.875rem; display: flex; align-items: center; gap: 4px; flex: 1;">
                                    ${icon}
                                    <span style="flex: 1;">${doc.name || 'Document'}</span>
                                </a>
                                <button onclick="CRMApp.deleteDocument(${doc.id}, '${(f.formation_name || '').replace(/'/g, "\\'")}', '${doc.type}')" style="background: none; border: none; cursor: pointer; color: #991b1b; padding: 0 4px;" title="Supprimer le document">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        `;
                }).join('')
                : '<span style="color: #9ca3af; font-size: 0.875rem;">0 fichier(s)</span>'
            }
                </td>
                <td style="padding: 1rem; text-align: center;">
                    <div class="dropdown">
                        <button style="padding: 0.5rem 1rem; background: var(--gray-100); border: none; border-radius: var(--radius-md); cursor: pointer; color: var(--gray-700); font-weight: 500;">Actions ▼</button>
                        <div class="dropdown-content">
                            <button onclick="CRMApp.viewFormation(${f.id})">Détails</button>
                            <button onclick="CRMApp.sendConvocation(${f.id})" style="color: #7c3aed; font-weight: 500;">📧 Envoi de la convocation</button>
                            <button onclick="CRMApp.relanceConvention(${f.id})" style="color: #b45309; font-weight: 500;">📩 Relancer convention</button>
                            <button onclick="CRMApp.sendMailFinFormation(${f.id})" style="color: #059669; font-weight: 500;">📧 Mail fin de formation</button>
                            <button onclick="CRMApp.createPedagogicalSheet(${f.id})">Créer fiche pédagogique</button>
                            <button onclick="CRMApp.createConvention(${f.id})">Créer convention</button>
                            <button onclick="CRMApp.createContratSousTraitance(${f.id})" style="color: #7c3aed; font-weight: 500;">📝 Contrat sous-traitance</button>
                            <button onclick="CRMApp.createAttendanceSheet(${f.id})">Créer feuille de présence</button>
                            <button onclick="CRMApp.createCertificate(${f.id})">Créer certificat</button>
                            <button onclick="CRMApp.deleteFormation(${f.id})" style="color: #991b1b;">Supprimer</button>
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');

        console.log('✅ HTML généré et inséré dans le tbody');
    },

    viewFormation(id) {
        // Ouvrir le formulaire en mode édition
        if (typeof FormationForm !== 'undefined') {
            FormationForm.show(id);
        } else {
            alert(`Détails de la formation #${id} - FormationForm non disponible`);
        }
    },

    async createPedagogicalSheet(id) {
        try {
            const { data, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            if (typeof GoogleDocsService !== 'undefined') {
                const result = await GoogleDocsService.generatePedagogicalSheet(data);

                if (result && result.success) {
                    // Sauvegarder dans Supabase
                    const docData = {
                        name: result.name,
                        type: 'google_doc',
                        document_url: result.url,
                        external_id: result.fileId,
                        uploaded_at: new Date().toISOString()
                    };

                    const saveResult = await SupabaseData.addFormationDocument(id, docData);

                    if (saveResult.success) {
                        alert('Fiche pédagogique créée et liée à la formation !');
                        this.loadFormations(); // Recharger pour voir le compteur de documents
                    } else {
                        console.error('Erreur sauvegarde doc:', saveResult);
                        alert('Fiche créée mais erreur lors de la liaison au CRM: ' + saveResult.message);
                    }
                }
            } else {
                alert('Le service Google Docs n\'est pas disponible.');
            }
        } catch (error) {
            console.error('Erreur lors de la récupération de la formation:', error);
            alert('Erreur: Impossible de récupérer les données de la formation.');
        }
    },

    async createConvention(id) {
        try {
            const { data, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            if (typeof GoogleDocsService !== 'undefined') {
                const result = await GoogleDocsService.generateConvention(data);

                if (result && result.success) {
                    // Sauvegarder uniquement dans formation_documents
                    const docData = {
                        name: result.name,
                        type: 'convention',
                        document_url: result.url,
                        external_id: result.fileId,
                        uploaded_at: new Date().toISOString()
                    };

                    const saveResult = await SupabaseData.addFormationDocument(id, docData);

                    if (saveResult.success) {
                        alert('Convention créée et liée à la formation !');
                        this.loadFormations();
                    } else {
                        console.error('Erreur sauvegarde doc:', saveResult);
                        alert('Convention créée mais erreur lors de la liaison au CRM: ' + saveResult.message);
                    }
                }
            } else {
                alert('Le service Google Docs n\'est pas disponible.');
            }
        } catch (error) {
            console.error('Erreur lors de la récupération de la formation:', error);
            alert('Erreur: Impossible de récupérer les données de la formation.');
        }
    },

    async createContratSousTraitance(id) {
        try {
            const { data, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            if (!data.subcontractor_first_name) {
                alert('Aucun sous-traitant associé à cette formation.');
                return;
            }

            if (typeof GoogleDocsService !== 'undefined') {
                const result = await GoogleDocsService.generateContratSousTraitance(data);

                if (result && result.success) {
                    const docData = {
                        name: result.name,
                        type: 'contrat_sous_traitance',
                        document_url: result.url,
                        external_id: result.fileId,
                        uploaded_at: new Date().toISOString()
                    };

                    const saveResult = await SupabaseData.addFormationDocument(id, docData);

                    if (saveResult.success) {
                        alert('Contrat de sous-traitance créé et lié à la formation !');
                        this.loadFormations();
                    } else {
                        alert('Contrat créé mais erreur lors de la liaison au CRM: ' + saveResult.message);
                    }
                }
            } else {
                alert('Le service Google Docs n\'est pas disponible.');
            }
        } catch (error) {
            console.error('Erreur lors de la création du contrat de sous-traitance:', error);
            alert('Erreur: Impossible de créer le contrat de sous-traitance.');
        }
    },

    async createAttendanceSheet(id) {
        try {
            const { data, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            if (typeof GoogleDocsService !== 'undefined') {
                const result = await GoogleDocsService.generateAttendanceSheet(data);

                if (result && result.success) {
                    // Sauvegarder dans formation_documents
                    const docData = {
                        name: result.name,
                        type: 'attendance_sheet',
                        document_url: result.url,
                        external_id: result.fileId,
                        uploaded_at: new Date().toISOString()
                    };

                    const saveResult = await SupabaseData.addFormationDocument(id, docData);

                    if (saveResult.success) {
                        alert('Feuille de présence créée et liée à la formation !');
                        this.loadFormations();
                    } else {
                        console.error('Erreur sauvegarde doc:', saveResult);
                        alert('Feuille de présence créée mais erreur lors de la liaison au CRM: ' + saveResult.message);
                    }
                }
            } else {
                alert('Le service Google Docs n\'est pas disponible.');
            }
        } catch (error) {
            console.error('Erreur lors de la récupération de la formation:', error);
            alert('Erreur: Impossible de récupérer les données de la formation.');
        }
    },

    async createCertificate(id) {
        try {
            const { data, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            if (typeof GoogleDocsService !== 'undefined') {
                const result = await GoogleDocsService.generateCertificate(data);

                if (result && result.success) {
                    // Sauvegarder dans formation_documents
                    const docData = {
                        name: result.name,
                        type: 'certificate',
                        document_url: result.url,
                        external_id: result.fileId,
                        uploaded_at: new Date().toISOString()
                    };

                    const saveResult = await SupabaseData.addFormationDocument(id, docData);

                    if (saveResult.success) {
                        alert('Certificat créé et lié à la formation !');
                        this.loadFormations();
                    } else {
                        console.error('Erreur sauvegarde doc:', saveResult);
                        alert('Certificat créé mais erreur lors de la liaison au CRM: ' + saveResult.message);
                    }
                }
            } else {
                alert('Le service Google Docs n\'est pas disponible.');
            }
        } catch (error) {
            console.error('Erreur lors de la récupération de la formation:', error);
            alert('Erreur: Impossible de récupérer les données de la formation.');
        }
    },

    async deleteDocument(docId, formationName, docType = 'google_doc') {
        let docTypeName;
        switch (docType) {
            case 'convention': docTypeName = 'cette convention'; break;
            case 'attendance_sheet': docTypeName = 'cette feuille de présence'; break;
            case 'certificate': docTypeName = 'ce certificat'; break;
            default: docTypeName = 'ce document';
        }
        if (!confirm(`Êtes-vous sûr de vouloir supprimer ${docTypeName} de la formation "${formationName}" ?`)) {
            return;
        }

        try {
            // Vérification de sécurité
            if (typeof SupabaseData === 'undefined') {
                throw new Error('SupabaseData n\'est pas disponible');
            }
            if (typeof SupabaseData.deleteFormationDocument !== 'function') {
                console.error('SupabaseData existe mais deleteFormationDocument n\'est pas une fonction');
                throw new Error('La fonction deleteFormationDocument n\'existe pas');
            }

            // Supprimer de formation_documents
            const result = await SupabaseData.deleteFormationDocument(docId);

            if (result.success) {
                // Recharger l'affichage
                await this.loadFormations();
            } else {
                console.error('Erreur lors de la suppression:', result);
                alert('Erreur lors de la suppression : ' + result.message);
            }
        } catch (error) {
            console.error('Exception dans deleteDocument:', error);
            alert('Erreur inattendue lors de la suppression : ' + error.message);
        }
    },


    async deleteFormation(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette formation ? Cette action est irréversible.')) {
            const result = await SupabaseData.deleteFormation(id);
            if (result.success) {
                await this.loadFormations();
                await this.updateDashboardStats();
            } else {
                alert('Erreur lors de la suppression : ' + result.message);
            }
        }
    },

    async sendConvocation(formationId) {
        try {
            // Récupérer les données de la formation
            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*, formation_documents(*)')
                .eq('id', formationId)
                .single();

            if (error) throw error;

            // Ouvrir le modal de convocation
            ConvocationEmail.show(formation);
        } catch (error) {
            console.error('Erreur lors de la récupération de la formation:', error);
            alert('Erreur: Impossible de récupérer les données de la formation.');
        }
    },

    async relanceConvention(formationId) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', formationId)
                .single();

            if (error) throw error;

            const clientEmail = formation.client_email;
            if (!clientEmail) {
                alert('Aucun email client renseigné pour cette formation.\nVeuillez d\'abord renseigner l\'email dans la fiche formation.');
                return;
            }

            const directorName = formation.company_director_name || '';
            const companyName = formation.company_name || '';
            const subject = `Convention de formation - ${formation.formation_name || 'Formation'} - ${companyName}`;
            const body = `Bonjour${directorName ? ' ' + directorName : ''},

Vous allez bien ?

Je me permets de revenir vers vous au sujet de la formation à venir.
Sauf erreur de ma part, je n'ai pas reçu la convention signée. Pouvez-vous me la transmettre au plus tôt ?

Désolée pour ce côté administratif mais la démarche qualité Qualiopi exige ce document signé des deux parties.

En vous remerciant par avance.

Nathalie Joulie-Morand`;

            GenericEmail.show({
                title: '📩 Relance convention',
                to: clientEmail,
                subject,
                body
            });
        } catch (error) {
            console.error('Erreur relance convention:', error);
            alert('Erreur lors de la préparation de la relance.');
        }
    },

    async sendMailFinFormation(formationId) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', formationId)
                .single();

            if (error) throw error;

            const clientEmail = formation.client_email;
            if (!clientEmail) {
                alert('Aucun email client renseigné pour cette formation.');
                return;
            }

            // Récupérer les identifiants du compte client
            let clientPassword = '[mot de passe non disponible]';
            const profileResult = await SupabaseData.getProfileByEmail(clientEmail);
            if (profileResult.success && profileResult.data) {
                clientPassword = profileResult.data.initial_password || '[voir avec l\'administrateur]';
            }

            const siteUrl = window.location.origin;
            const subject = `Suite formation "${formation.formation_name || 'Formation'}" - Documents et questionnaires`;
            const body = `Bonjour,

Tout va bien pour vous? J'espère que l'équipe est satisfaite de la formation.

Je transmets ici plusieurs éléments relatifs à la démarche qualité de la formation.
C'est important que ce soit complété par chaque personne qui a suivi la formation :
-un questionnaire de satisfaction :

-un questionnaire d'évaluation des acquis :

Par ailleurs, je vous transmets à nouveau le lien et le mot de passe de votre espace confidentiel NJM Conseil.
Lien : ${siteUrl}
Mot de passe : ${clientPassword}
Vous y trouverez tous les documents pour l'OPCO : feuilles de présence, certificats de fin de formation.
Vous pourrez aussi y récupérer :
-pour vous : le bilan de la formation
-pour les apprenants : le support pédagogique, les grilles d'évaluation

Autre chose, ce serait sympa de prendre 1 minute pour déposer un avis sincère sur Google. Cela me donnera plus de visibilité sur le net. Merci d'aller sur:
https://g.page/r/CTDsPUbHjCnREB0/review

Désolée, cela fait de la paperasse mais c'est indispensable par rapport à la prise en charge de la formation.

Merci encore à vous et à toute l'équipe pour la gentillesse de votre accueil.

Cordialement

Nathalie JOULIÉ MORAND`;

            GenericEmail.show({
                title: '📧 Mail fin de formation',
                to: clientEmail,
                subject,
                body
            });
        } catch (error) {
            console.error('Erreur mail fin de formation:', error);
            alert('Erreur lors de la préparation du mail.');
        }
    },

    async showConvocationDetails(formationId) {
        try {
            const result = await SupabaseData.getConvocationLogs(formationId);
            if (!result.success) {
                alert('Erreur lors de la récupération des détails.');
                return;
            }

            const logs = result.data;
            if (logs.length === 0) {
                alert('Aucune convocation envoyée pour cette formation.');
                return;
            }

            // Créer le contenu du modal
            let html = '<div style="max-height: 400px; overflow-y: auto;">';
            logs.forEach((log, index) => {
                const date = new Date(log.sent_at);
                const formattedDate = date.toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                const formattedTime = date.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const attachmentsList = log.attachments && log.attachments.length > 0
                    ? log.attachments.map(a => `<li style="font-size: 0.875rem; color: var(--gray-600);">${a.name}</li>`).join('')
                    : '<li style="font-size: 0.875rem; color: var(--gray-400);">Aucune pièce jointe</li>';

                html += `
                    <div style="padding: 1rem; background: ${index % 2 === 0 ? '#f9fafb' : 'white'}; border-radius: var(--radius-md); margin-bottom: 0.5rem; border: 1px solid var(--gray-200);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                            <span style="font-weight: 600; color: var(--gray-900);">Envoi #${logs.length - index}</span>
                            <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: #d1fae5; color: #059669; border-radius: 9999px; font-size: 0.75rem;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Envoyé
                            </span>
                        </div>
                        <div style="display: grid; gap: 0.5rem;">
                            <div style="display: flex; gap: 0.5rem;">
                                <span style="font-weight: 500; color: var(--gray-700); min-width: 100px;">Date :</span>
                                <span style="color: var(--gray-900);">${formattedDate} à ${formattedTime}</span>
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <span style="font-weight: 500; color: var(--gray-700); min-width: 100px;">Destinataire :</span>
                                <span style="color: var(--gray-900);">${log.sent_to}</span>
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <span style="font-weight: 500; color: var(--gray-700); min-width: 100px;">Objet :</span>
                                <span style="color: var(--gray-900); font-size: 0.875rem;">${log.subject || 'N/A'}</span>
                            </div>
                            <div>
                                <span style="font-weight: 500; color: var(--gray-700);">Pièces jointes :</span>
                                <ul style="margin: 0.25rem 0 0 1rem; padding: 0;">${attachmentsList}</ul>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            // Afficher dans un modal simple
            const modal = document.createElement('div');
            modal.id = 'convocation-details-modal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
            modal.innerHTML = `
                <div style="background: white; border-radius: var(--radius-xl); padding: 1.5rem; max-width: 500px; width: 90%; max-height: 90vh; overflow: hidden;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0; font-size: 1.25rem; color: var(--gray-900);">Historique des convocations</h3>
                        <button onclick="document.getElementById('convocation-details-modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-500);">&times;</button>
                    </div>
                    ${html}
                    <div style="margin-top: 1rem; text-align: right;">
                        <button onclick="document.getElementById('convocation-details-modal').remove()" style="padding: 0.5rem 1rem; background: var(--gray-200); border: none; border-radius: var(--radius-md); cursor: pointer;">Fermer</button>
                    </div>
                </div>
            `;
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
            document.body.appendChild(modal);

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la récupération des détails.');
        }
    },

    filterVeille(type) {
        this.currentVeilleType = type;
        document.querySelectorAll('.veille-filter-btn').forEach(btn => {
            if (btn.getAttribute('data-type') === type) {
                btn.style.background = 'var(--primary-pink)';
                btn.style.color = 'white';
            } else {
                btn.style.background = 'var(--gray-200)';
                btn.style.color = 'var(--gray-700)';
            }
        });
        this.loadVeille();
    },

    async loadVeille() {
        const result = await SupabaseData.getVeille(this.currentVeilleType);
        if (!result.success) {
            console.error('Erreur lors du chargement de la veille:', result.message);
            return;
        }

        const items = result.data;
        const container = document.getElementById('veille-container');

        container.innerHTML = items.length ? items.map(item => `
            <div style="background: white; padding: 1.5rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); border-left: 4px solid var(--primary-pink);">
                <h4 style="font-weight: 600; color: var(--gray-900); margin-bottom: 0.5rem;">${item.title}</h4>
                <p style="color: var(--gray-600); font-size: 0.875rem; margin-bottom: 0.75rem;">${item.content || ''}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; color: var(--gray-500);">
                    <span>${new Date(item.created_at).toLocaleDateString('fr-FR')}</span>
                    <button onclick="CRMApp.toggleVeilleRead(${item.id})" style="padding: 0.25rem 0.75rem; background: ${item.read ? 'var(--gray-200)' : 'var(--primary-green)'}; color: ${item.read ? 'var(--gray-700)' : 'white'}; border: none; border-radius: var(--radius-sm); cursor: pointer;">
                        ${item.read ? 'Lu' : 'Marquer lu'}
                    </button>
                </div>
            </div>
        `).join('') : '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">Aucune veille pour cette catégorie</p>';
    },

    async toggleVeilleRead(id) {
        await SupabaseData.toggleVeilleRead(id);
        await this.loadVeille();
    },

    async addVeille() {
        const title = prompt('Titre de la veille:');
        if (title) {
            const content = prompt('Description:');
            const result = await SupabaseData.addVeille(this.currentVeilleType, {
                title,
                content: content || ''
            });

            if (result.success) {
                await this.loadVeille();
                alert('Veille ajoutée avec succès !');
            } else {
                alert('Erreur : ' + result.message);
            }
        }
    },

    // ==================== BPF ====================

    bpfData: [], // Store BPF data for filtering
    bpfCurrentYearFilter: '',

    async loadBPF() {
        const result = await SupabaseData.getBPF();
        if (!result.success) {
            console.error('Erreur lors du chargement des BPF:', result.message);
            return;
        }

        this.bpfData = result.data;
        this.updateBPFYearFilter();
        this.renderBPFTable(this.bpfData);
        this.updateBPFStats(this.bpfData);
    },

    updateBPFYearFilter() {
        const select = document.getElementById('bpf-year-filter');
        if (!select) return;

        // Get unique years
        const years = [...new Set(this.bpfData.map(b => b.year))].sort((a, b) => b - a);

        select.innerHTML = '<option value="">Toutes les années</option>' +
            years.map(y => `<option value="${y}" ${this.bpfCurrentYearFilter == y ? 'selected' : ''}>${y}</option>`).join('');
    },

    filterBPFByYear(year) {
        this.bpfCurrentYearFilter = year;
        const filtered = year ? this.bpfData.filter(b => b.year == year) : this.bpfData;
        this.renderBPFTable(filtered);
        this.updateBPFStats(filtered);
    },

    updateBPFStats(data) {
        const totalFormations = data.length;
        const totalLearners = data.reduce((sum, b) => sum + (b.number_of_learners || 0), 0);
        const totalHours = data.reduce((sum, b) => sum + (parseFloat(b.total_hours) || 0), 0);
        const totalRevenue = data.reduce((sum, b) => sum + (parseFloat(b.amount_ht) || 0), 0);

        document.getElementById('bpf-stat-formations').textContent = totalFormations;
        document.getElementById('bpf-stat-learners').textContent = totalLearners;
        document.getElementById('bpf-stat-hours').textContent = totalHours.toFixed(1);
        document.getElementById('bpf-stat-revenue').textContent = totalRevenue.toLocaleString('fr-FR') + ' €';
    },

    renderBPFTable(data) {
        const tbody = document.getElementById('bpf-tbody');
        const emptyDiv = document.getElementById('bpf-empty');
        const table = document.getElementById('bpf-table');

        if (!data.length) {
            tbody.innerHTML = '';
            table.style.display = 'none';
            emptyDiv.style.display = 'block';
            return;
        }

        table.style.display = 'table';
        emptyDiv.style.display = 'none';

        tbody.innerHTML = data.map(bpf => `
            <tr style="border-bottom: 1px solid var(--gray-100);" data-bpf-id="${bpf.id}">
                <td style="padding: 1rem; color: var(--gray-900);">${bpf.formation_type || '-'}</td>
                <td style="padding: 1rem; color: var(--gray-700);">${bpf.company_name || '-'}</td>
                <td style="padding: 1rem; text-align: center;">
                    <span style="background: var(--primary-purple); color: white; padding: 0.25rem 0.75rem; border-radius: var(--radius-full); font-size: 0.875rem; font-weight: 500;">${bpf.year}</span>
                </td>
                <td style="padding: 1rem; text-align: right; font-weight: 600; color: var(--gray-900);">${(parseFloat(bpf.amount_ht) || 0).toLocaleString('fr-FR')} €</td>
                <td style="padding: 1rem; text-align: center; color: var(--gray-700);">${bpf.number_of_learners || 0}</td>
                <td style="padding: 1rem; text-align: right; color: var(--gray-700);">${(parseFloat(bpf.total_hours) || 0).toFixed(1)}</td>
                <td style="padding: 1rem; text-align: center;">
                    <div style="display: flex; gap: 0.5rem; justify-content: center;">
                        <button onclick="CRMApp.editBPF(${bpf.id})" title="Modifier"
                            style="padding: 0.5rem; background: var(--gray-100); border: none; border-radius: var(--radius-md); cursor: pointer; color: var(--gray-600);">
                            ✏️
                        </button>
                        <button onclick="CRMApp.exportBPFToPDF(${bpf.id})" title="Exporter en PDF"
                            style="padding: 0.5rem; background: var(--primary-purple); border: none; border-radius: var(--radius-md); cursor: pointer; color: white;">
                            📄
                        </button>
                        <button onclick="CRMApp.deleteBPF(${bpf.id})" title="Supprimer"
                            style="padding: 0.5rem; background: var(--red-100); border: none; border-radius: var(--radius-md); cursor: pointer; color: var(--red-600);">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    async editBPF(id) {
        const bpf = this.bpfData.find(b => b.id === id);
        if (!bpf) return;

        // Create edit modal
        const modal = document.createElement('div');
        modal.id = 'bpf-edit-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';
        modal.innerHTML = `
            <div style="background: white; border-radius: var(--radius-xl); padding: 2rem; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto;">
                <h3 style="font-size: 1.25rem; font-weight: 600; color: var(--gray-900); margin-bottom: 1.5rem;">Modifier l'entrée BPF</h3>
                <form id="bpf-edit-form">
                    <div style="display: grid; gap: 1rem;">
                        <div>
                            <label style="display: block; font-weight: 500; color: var(--gray-700); margin-bottom: 0.5rem;">Type de formation</label>
                            <input type="text" id="bpf-edit-type" value="${bpf.formation_type || ''}"
                                style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-family: inherit;">
                        </div>
                        <div>
                            <label style="display: block; font-weight: 500; color: var(--gray-700); margin-bottom: 0.5rem;">Raison sociale</label>
                            <input type="text" id="bpf-edit-company" value="${bpf.company_name || ''}"
                                style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-family: inherit;">
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div>
                                <label style="display: block; font-weight: 500; color: var(--gray-700); margin-bottom: 0.5rem;">Année fiscale</label>
                                <input type="number" id="bpf-edit-year" value="${bpf.year || ''}"
                                    style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-family: inherit;">
                            </div>
                            <div>
                                <label style="display: block; font-weight: 500; color: var(--gray-700); margin-bottom: 0.5rem;">Montant HT (€)</label>
                                <input type="number" step="0.01" id="bpf-edit-amount" value="${bpf.amount_ht || 0}"
                                    style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-family: inherit;">
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div>
                                <label style="display: block; font-weight: 500; color: var(--gray-700); margin-bottom: 0.5rem;">Nombre de stagiaires</label>
                                <input type="number" id="bpf-edit-learners" value="${bpf.number_of_learners || 0}"
                                    style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-family: inherit;">
                            </div>
                            <div>
                                <label style="display: block; font-weight: 500; color: var(--gray-700); margin-bottom: 0.5rem;">Total heures</label>
                                <input type="number" step="0.1" id="bpf-edit-hours" value="${bpf.total_hours || 0}"
                                    style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-family: inherit;">
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                        <button type="button" onclick="document.getElementById('bpf-edit-modal').remove()"
                            style="padding: 0.75rem 1.5rem; background: var(--gray-200); color: var(--gray-700); border: none; border-radius: var(--radius-md); font-weight: 600; cursor: pointer;">
                            Annuler
                        </button>
                        <button type="submit"
                            style="padding: 0.75rem 1.5rem; background: var(--primary-purple); color: white; border: none; border-radius: var(--radius-md); font-weight: 600; cursor: pointer;">
                            Enregistrer
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Handle form submission
        document.getElementById('bpf-edit-form').onsubmit = async (e) => {
            e.preventDefault();

            const updates = {
                formation_type: document.getElementById('bpf-edit-type').value,
                company_name: document.getElementById('bpf-edit-company').value,
                year: parseInt(document.getElementById('bpf-edit-year').value) || bpf.year,
                amount_ht: parseFloat(document.getElementById('bpf-edit-amount').value) || 0,
                number_of_learners: parseInt(document.getElementById('bpf-edit-learners').value) || 0,
                total_hours: parseFloat(document.getElementById('bpf-edit-hours').value) || 0
            };

            const result = await SupabaseData.updateBPF(id, updates);
            if (result.success) {
                modal.remove();
                await this.loadBPF();
                alert('BPF mis à jour avec succès !');
            } else {
                alert('Erreur : ' + result.message);
            }
        };

        // Close on backdrop click
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    },

    async deleteBPF(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette entrée BPF ?')) return;

        const result = await SupabaseData.deleteBPF(id);
        if (result.success) {
            await this.loadBPF();
            alert('BPF supprimé avec succès !');
        } else {
            alert('Erreur : ' + result.message);
        }
    },

    exportBPFToPDF(id) {
        const bpf = this.bpfData.find(b => b.id === id);
        if (!bpf) return;

        this.generateBPFPDF([bpf], `BPF_${bpf.company_name || 'Export'}_${bpf.year}.pdf`);
    },

    exportAllBPFToPDF() {
        const dataToExport = this.bpfCurrentYearFilter
            ? this.bpfData.filter(b => b.year == this.bpfCurrentYearFilter)
            : this.bpfData;

        if (!dataToExport.length) {
            alert('Aucune donnée à exporter');
            return;
        }

        const yearLabel = this.bpfCurrentYearFilter || 'Toutes_Annees';
        this.generateBPFPDF(dataToExport, `BPF_${yearLabel}.pdf`);
    },

    generateBPFPDF(data, filename) {
        // Calculate totals
        const totalLearners = data.reduce((sum, b) => sum + (b.number_of_learners || 0), 0);
        const totalHours = data.reduce((sum, b) => sum + (parseFloat(b.total_hours) || 0), 0);
        const totalRevenue = data.reduce((sum, b) => sum + (parseFloat(b.amount_ht) || 0), 0);

        // Create printable content
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Bilan Pédagogique et Financier</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                    h1 { color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px; }
                    .stats { display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
                    .stat-box { background: #f3f4f6; padding: 15px 20px; border-radius: 8px; min-width: 150px; }
                    .stat-label { color: #6b7280; font-size: 12px; }
                    .stat-value { font-size: 24px; font-weight: bold; color: #7c3aed; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #7c3aed; color: white; padding: 12px; text-align: left; }
                    td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
                    tr:nth-child(even) { background: #f9fafb; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .footer { margin-top: 30px; text-align: center; color: #9ca3af; font-size: 12px; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <h1>Bilan Pédagogique et Financier</h1>
                <p style="color: #6b7280;">NJM Conseil - Exporté le ${new Date().toLocaleDateString('fr-FR')}</p>

                <div class="stats">
                    <div class="stat-box">
                        <div class="stat-label">Total formations</div>
                        <div class="stat-value">${data.length}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Total stagiaires</div>
                        <div class="stat-value">${totalLearners}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Total heures</div>
                        <div class="stat-value">${totalHours.toFixed(1)}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Chiffre d'affaires HT</div>
                        <div class="stat-value">${totalRevenue.toLocaleString('fr-FR')} €</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Type de formation</th>
                            <th>Raison sociale</th>
                            <th class="text-center">Année</th>
                            <th class="text-right">Montant HT</th>
                            <th class="text-center">Stagiaires</th>
                            <th class="text-right">Heures</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(bpf => `
                            <tr>
                                <td>${bpf.formation_type || '-'}</td>
                                <td>${bpf.company_name || '-'}</td>
                                <td class="text-center">${bpf.year}</td>
                                <td class="text-right">${(parseFloat(bpf.amount_ht) || 0).toLocaleString('fr-FR')} €</td>
                                <td class="text-center">${bpf.number_of_learners || 0}</td>
                                <td class="text-right">${(parseFloat(bpf.total_hours) || 0).toFixed(1)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    <p>Document généré automatiquement par CRM NJM Conseil</p>
                </div>
            </body>
            </html>
        `;

        // Open print dialog
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.onload = function() {
            printWindow.print();
        };
    },

    supportCategories: ['aec_disc', 'commercial', 'communication', 'internet_et_rs', 'management', 'manager_commercial', 'marketing', 'methode_aec', 'strategie', 'vente'],

    supportCategoryLabels: {
        'aec_disc': 'AEC Disc',
        'commercial': 'Commercial',
        'communication': 'Communication',
        'internet_et_rs': 'Internet et RS',
        'management': 'Management',
        'manager_commercial': 'Manager commercial',
        'marketing': 'Marketing',
        'methode_aec': 'Méthode AEC',
        'strategie': 'Stratégie',
        'vente': 'Vente'
    },

    async loadSupports() {
        for (const category of this.supportCategories) {
            const result = await SupabaseData.getPedagogicalLibrary(category);
            if (result.success) {
                const supports = result.data;
                const container = document.getElementById(`supports-${category}`);
                if (container) {
                    container.innerHTML = supports.length ? supports.map(s => `
                        <div style="padding: 0.75rem; background: var(--gray-50); border-radius: var(--radius-md); font-size: 0.875rem; display: flex; align-items: center; justify-content: space-between;">
                            <span>${s.file_url ? '🔗' : '📄'} ${s.title}</span>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                ${s.file_url ? `<a href="${s.file_url}" target="_blank" rel="noopener noreferrer" style="color: var(--primary-purple); font-weight: 600; text-decoration: none; font-size: 0.8rem;">Ouvrir ↗</a>` : ''}
                                <button onclick="CRMApp.deleteSupport('${s.id}')" style="background:none;border:none;color:var(--gray-400);cursor:pointer;font-size:1rem;padding:0.25rem;" title="Supprimer">✕</button>
                            </div>
                        </div>
                    `).join('') : '<p style="color: var(--gray-400); font-size: 0.875rem;">Aucun support</p>';
                }
            }
        }
    },

    uploadSupport() {
        const categoryOptionsHtml = this.supportCategories.map(c =>
            `<option value="${c}">${this.supportCategoryLabels[c]}</option>`
        ).join('');

        const modal = document.createElement('div');
        modal.id = 'upload-support-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        modal.innerHTML = `
            <div style="background:white;border-radius:var(--radius-xl);padding:2rem;width:500px;max-width:90%;box-shadow:var(--shadow-lg);">
                <h3 style="font-size:1.25rem;font-weight:700;color:var(--gray-900);margin-bottom:1.5rem;">Ajouter un support</h3>
                <div style="display:grid;gap:1rem;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:var(--gray-700);">Catégorie</label>
                        <select id="support-category" style="width:100%;padding:0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.95rem;">
                            ${categoryOptionsHtml}
                        </select>
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:var(--gray-700);">Nom du support</label>
                        <input type="text" id="support-title" placeholder="Ex: Formation_prescripteurs_paysage" style="width:100%;padding:0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.95rem;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:var(--gray-700);">Lien Google Drive</label>
                        <input type="url" id="support-url" placeholder="https://docs.google.com/..." style="width:100%;padding:0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.95rem;box-sizing:border-box;">
                    </div>
                </div>
                <div style="display:flex;gap:1rem;margin-top:1.5rem;justify-content:flex-end;">
                    <button onclick="document.getElementById('upload-support-modal').remove()" style="padding:0.75rem 1.5rem;background:var(--gray-200);color:var(--gray-700);border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">Annuler</button>
                    <button onclick="CRMApp.submitSupport()" style="padding:0.75rem 1.5rem;background:var(--primary-orange);color:white;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">Ajouter</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async submitSupport() {
        const category = document.getElementById('support-category').value;
        const title = document.getElementById('support-title').value.trim();
        const file_url = document.getElementById('support-url').value.trim();

        if (!title) {
            alert('Veuillez saisir un nom pour le support.');
            return;
        }

        const result = await SupabaseData.addToPedagogicalLibrary(category, {
            title,
            description: '',
            file_url: file_url || null
        });

        document.getElementById('upload-support-modal').remove();

        if (result.success) {
            await this.loadSupports();
            alert('Support ajouté avec succès !');
        } else {
            alert('Erreur : ' + result.message);
        }
    },

    async deleteSupport(id) {
        if (!confirm('Voulez-vous vraiment supprimer ce support ?')) return;

        const result = await SupabaseData.deleteFromPedagogicalLibrary(id);
        if (result.success) {
            await this.loadSupports();
        } else {
            alert('Erreur : ' + result.message);
        }
    },

    async loadTemplates() {
        const result = await SupabaseData.getTemplatesLibrary('formateurs');
        if (result.success) {
            const formateurs = result.data;
            const container = document.getElementById('templates-formateurs');
            if (container) {
                container.innerHTML = formateurs.map(t => `
                    <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md); margin-top: 0.5rem;">
                        <strong>${t.title}</strong><br>
                        <span style="font-size: 0.875rem; color: var(--gray-600);">Expire: ${t.expiry_date ? new Date(t.expiry_date).toLocaleDateString('fr-FR') : 'N/A'}</span>
                    </div>
                `).join('') || '<p>Aucun document</p>';
            }
        }
    },

    async uploadTemplate(category) {
        const title = prompt('Nom du document:');
        if (title) {
            const expiry_date = category === 'formateurs' ? prompt('Date d\'expiration (YYYY-MM-DD):') : null;
            const result = await SupabaseData.addTemplate(category, {
                title,
                expiry_date,
                description: ''
            });

            if (result.success) {
                await this.loadTemplates();
                await this.checkExpiringDocuments();
                alert('Template ajouté avec succès !');
            } else {
                alert('Erreur : ' + result.message);
            }
        }
    },

    async checkExpiringDocuments() {
        const result = await SupabaseData.getExpiringDocuments();
        if (result.success) {
            const expiring = result.data;
            const alertBox = document.getElementById('expiring-docs');
            const list = document.getElementById('expiring-list');

            if (alertBox && list) {
                if (expiring.length > 0) {
                    alertBox.style.display = 'block';
                    list.innerHTML = expiring.map(d => `<li>${d.title} - Expire le ${new Date(d.expiry_date).toLocaleDateString('fr-FR')}</li>`).join('');
                } else {
                    alertBox.style.display = 'none';
                }
            }
        }
    },

    async loadUsers() {
        const currentUser = await SupabaseAuth.checkSession();
        if (!currentUser) return;

        const result = await SupabaseAuth.getAllUsers(currentUser.id);
        if (!result.success) {
            console.error('Erreur lors du chargement des utilisateurs:', result.message);
            return;
        }

        const users = result.users;
        const tbody = document.getElementById('users-tbody');
        if (tbody) {
            tbody.innerHTML = users.map(u => `
                <tr style="border-bottom: 1px solid var(--gray-200);">
                    <td style="padding: 1rem;">${u.name}</td>
                    <td style="padding: 1rem;">${u.email}</td>
                    <td style="padding: 1rem;">
                        <span style="padding: 0.25rem 0.75rem; background: ${u.role === 'admin' ? '#dbeafe' : u.role === 'formateur' ? '#fef3c7' : '#d1fae5'}; color: ${u.role === 'admin' ? '#1e40af' : u.role === 'formateur' ? '#92400e' : '#065f46'}; border-radius: 9999px; font-size: 0.875rem; font-weight: 500;">
                            ${u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                    </td>
                    <td style="padding: 1rem;">${new Date(u.created).toLocaleDateString('fr-FR')}</td>
                    <td style="padding: 1rem; text-align: center;">
                        <button style="padding: 0.5rem 1rem; background: var(--gray-100); border: none; border-radius: var(--radius-md); cursor: pointer;">Éditer</button>
                    </td>
                </tr>
            `).join('');
        }
    },

    async addUser() {
        const name = prompt('Nom:');
        const email = prompt('Email:');
        const role = prompt('Rôle (admin/formateur/client):');
        const password = prompt('Mot de passe:');

        if (name && email && role && password) {
            const currentUser = await SupabaseAuth.checkSession();
            if (!currentUser) {
                alert('Vous devez être connecté');
                return;
            }

            const result = await SupabaseAuth.registerUser(currentUser.id, {
                name,
                email,
                role,
                password
            });

            if (result.success) {
                await this.loadUsers();
                alert('Utilisateur créé avec succès !');
            } else {
                alert('Erreur : ' + result.message);
            }
        }
    }
};

// ==================== User Management Logic ====================
const UserManagement = {
    currentUser: null,

    init() {
        this.loadUsers();
        this.setupSearch();
        this.loadLogs();
    },

    async loadUsers() {
        const currentUser = await SupabaseAuth.checkSession();
        if (!currentUser) return;

        const result = await SupabaseAuth.getAllUsers(currentUser.id);
        if (!result.success) {
            alert(result.message);
            return;
        }

        const users = result.users;
        this.renderUsers(users);
        this.updateStats(users);
    },

    updateStats(users) {
        const totalUsersEl = document.getElementById('total-users');
        const totalAdminsEl = document.getElementById('total-admins');
        const totalFormateursEl = document.getElementById('total-formateurs');
        const totalClientsEl = document.getElementById('total-clients');

        if (totalUsersEl) totalUsersEl.textContent = users.length;
        if (totalAdminsEl) totalAdminsEl.textContent = users.filter(u => u.role === 'admin').length;
        if (totalFormateursEl) totalFormateursEl.textContent = users.filter(u => u.role === 'formateur').length;
        if (totalClientsEl) totalClientsEl.textContent = users.filter(u => u.role === 'client').length;
    },

    renderUsers(users) {
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;

        tbody.innerHTML = users.map(user => `
            <tr style="border-bottom: 1px solid var(--gray-200); transition: background 150ms;">
                <td style="padding: 1rem; font-weight: 500; color: var(--gray-900);">${user.name}</td>
                <td style="padding: 1rem; color: var(--gray-700);">${user.email}</td>
                <td style="padding: 1rem;">
                    <span style="padding: 0.25rem 0.75rem; background: ${user.role === 'admin' ? '#dbeafe' :
                user.role === 'formateur' ? '#fef3c7' : '#d1fae5'
            }; color: ${user.role === 'admin' ? '#1e40af' :
                user.role === 'formateur' ? '#92400e' : '#065f46'
            }; border-radius: 9999px; font-size: 0.875rem; font-weight: 500;">
                        ${user.role === 'admin' ? 'Admin' : user.role === 'formateur' ? 'Formateur' : 'Client'}
                    </span>
                </td>
                <td style="padding: 1rem;">
                    <span style="padding: 0.25rem 0.75rem; background: ${user.active ? '#d1fae5' : '#fee2e2'}; color: ${user.active ? '#065f46' : '#991b1b'}; border-radius: 9999px; font-size: 0.875rem; font-weight: 500;">
                        ${user.active ? '✓ Actif' : '✗ Inactif'}
                    </span>
                </td>
                <td style="padding: 1rem; color: var(--gray-600); font-size: 0.875rem;">
                    ${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Jamais'}
                </td>
                <td style="padding: 1rem;">
                    ${user.initial_password ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <code style="background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: #374151;">${user.initial_password}</code>
                            <button onclick="UserManagement.copyToClipboard('${user.initial_password}')"
                                style="padding: 0.25rem 0.5rem; background: #e5e7eb; border: none; border-radius: 4px; cursor: pointer; font-size: 0.65rem;">
                                Copier
                            </button>
                        </div>
                    ` : '<span style="color: #9ca3af; font-size: 0.75rem;">Modifié</span>'}
                </td>
                <td style="padding: 1rem; text-align: center;">
                    <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                        ${user.role === 'client' ? `
                        <button onclick="UserManagement.sendWelcomeEmail('${user.id}')"
                            style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem; font-weight: 500;">
                            Envoyer accès
                        </button>
                        ` : ''}
                        <button onclick="UserManagement.editUser('${user.id}')"
                            style="padding: 0.5rem 1rem; background: var(--gray-100); border: none; border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem; color: var(--gray-700); font-weight: 500;">
                            Éditer
                        </button>
                        <button onclick="UserManagement.showResetPasswordModal('${user.id}')"
                            style="padding: 0.5rem 1rem; background: var(--primary-orange); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem; font-weight: 500;">
                            Mot de passe
                        </button>
                        <button onclick="UserManagement.deleteUser('${user.id}')"
                            style="padding: 0.5rem 1rem; background: #fee2e2; color: #991b1b; border: none; border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem; font-weight: 500;">
                            Supprimer
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    // Copier dans le presse-papiers
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Mot de passe copié !');
        }).catch(err => {
            console.error('Erreur copie:', err);
            // Fallback pour les navigateurs plus anciens
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('Mot de passe copié !');
        });
    },

    setupSearch() {
        const searchInput = document.getElementById('user-search');
        if (searchInput) {
            searchInput.addEventListener('input', async (e) => {
                const query = e.target.value.toLowerCase();
                const currentUser = await SupabaseAuth.checkSession();
                const result = await SupabaseAuth.getAllUsers(currentUser.id);

                if (result.success) {
                    const filtered = result.users.filter(user =>
                        user.name.toLowerCase().includes(query) ||
                        user.email.toLowerCase().includes(query)
                    );
                    this.renderUsers(filtered);
                }
            });
        }
    },

    async showAddUserModal() {
        const modalTitle = document.getElementById('modal-title');
        const userForm = document.getElementById('userForm');
        const userId = document.getElementById('user-id');
        const passwordSection = document.getElementById('password-section');
        const userPassword = document.getElementById('user-password');
        const userModal = document.getElementById('userModal');
        const subcontractorSection = document.getElementById('subcontractor-link-section');
        const clientSection = document.getElementById('client-link-section');

        if (modalTitle) modalTitle.textContent = 'Nouvel Utilisateur';
        if (userForm) userForm.reset();
        if (userId) userId.value = '';
        if (passwordSection) passwordSection.style.display = 'block';
        if (userPassword) userPassword.required = true;
        if (subcontractorSection) subcontractorSection.style.display = 'none';
        if (clientSection) clientSection.style.display = 'none';

        // Réinitialiser les radio buttons en mode "Créer nouveau"
        const subcontractorModeNew = document.querySelector('input[name="subcontractor-mode"][value="new"]');
        const clientModeNew = document.querySelector('input[name="client-mode"][value="new"]');
        if (subcontractorModeNew) subcontractorModeNew.checked = true;
        if (clientModeNew) clientModeNew.checked = true;

        // Afficher les formulaires de création, masquer les selects
        const newSubForm = document.getElementById('new-subcontractor-form');
        const existingSubSelect = document.getElementById('existing-subcontractor-select');
        const newClientForm = document.getElementById('new-client-form');
        const existingClientSelect = document.getElementById('existing-client-select');

        if (newSubForm) newSubForm.style.display = 'grid';
        if (existingSubSelect) existingSubSelect.style.display = 'none';
        if (newClientForm) newClientForm.style.display = 'grid';
        if (existingClientSelect) existingClientSelect.style.display = 'none';

        // Vider les champs de création
        const fieldsToReset = [
            'new-subcontractor-first-name', 'new-subcontractor-last-name', 'new-subcontractor-email',
            'new-client-company-name', 'new-client-contact-name', 'new-client-email', 'new-client-address'
        ];
        fieldsToReset.forEach(id => {
            const field = document.getElementById(id);
            if (field) field.value = '';
        });

        // Masquer l'affichage du mot de passe créé
        const createdPasswordDisplay = document.getElementById('created-password-display');
        if (createdPasswordDisplay) createdPasswordDisplay.style.display = 'none';

        // Masquer la liste des clients liés
        const linkedClientsList = document.getElementById('linked-clients-list');
        if (linkedClientsList) linkedClientsList.style.display = 'none';

        if (userModal) userModal.style.display = 'flex';
    },

    // Charger les sous-traitants disponibles dans le dropdown
    async loadSubcontractors() {
        const select = document.getElementById('user-subcontractor');
        if (!select) return;

        const result = await SupabaseData.getAvailableSubcontractors();
        if (result.success) {
            select.innerHTML = '<option value="">Aucun sous-traitant</option>';
            result.data.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.id;
                option.textContent = `${sub.first_name} ${sub.last_name}`;
                select.appendChild(option);
            });
        }
    },

    // Gère le changement de rôle
    async onRoleChange(role) {
        const subcontractorSection = document.getElementById('subcontractor-link-section');
        const clientSection = document.getElementById('client-link-section');

        // Masquer toutes les sections par défaut
        if (subcontractorSection) subcontractorSection.style.display = 'none';
        if (clientSection) clientSection.style.display = 'none';

        // Afficher la section appropriée selon le rôle
        if (role === 'formateur') {
            if (subcontractorSection) subcontractorSection.style.display = 'block';
            await this.loadSubcontractors();
        } else if (role === 'client') {
            if (clientSection) clientSection.style.display = 'block';
            await this.loadClients();
        }
    },

    // Charger les clients disponibles dans le dropdown multi-select
    async loadClients() {
        const select = document.getElementById('user-client');
        if (!select) return;

        const result = await SupabaseData.getAvailableClients();
        if (result.success) {
            select.innerHTML = '';
            result.data.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.company_name;
                select.appendChild(option);
            });
        }
    },

    // Toggle mode sous-traitant (créer nouveau / sélectionner existant)
    onSubcontractorModeChange(mode) {
        const newForm = document.getElementById('new-subcontractor-form');
        const existingSelect = document.getElementById('existing-subcontractor-select');

        if (mode === 'new') {
            if (newForm) newForm.style.display = 'grid';
            if (existingSelect) existingSelect.style.display = 'none';
        } else {
            if (newForm) newForm.style.display = 'none';
            if (existingSelect) existingSelect.style.display = 'block';
            this.loadAllSubcontractors();
        }
    },

    // Toggle mode client (créer nouveau / sélectionner existant)
    onClientModeChange(mode) {
        const newForm = document.getElementById('new-client-form');
        const existingSelect = document.getElementById('existing-client-select');

        if (mode === 'new') {
            if (newForm) newForm.style.display = 'grid';
            if (existingSelect) existingSelect.style.display = 'none';
        } else {
            if (newForm) newForm.style.display = 'none';
            if (existingSelect) existingSelect.style.display = 'block';
            this.loadAllClients();
        }
    },

    // Charger TOUS les sous-traitants (pour la sélection)
    async loadAllSubcontractors() {
        const select = document.getElementById('user-subcontractor');
        if (!select) return;

        const result = await SupabaseData.getSubcontractors();
        if (result.success) {
            select.innerHTML = '<option value="">Sélectionner un sous-traitant</option>';
            result.data.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.id;
                option.textContent = `${sub.first_name} ${sub.last_name}`;
                select.appendChild(option);
            });
        }
    },

    // Charger TOUS les clients (pour la sélection multi)
    async loadAllClients() {
        const select = document.getElementById('user-client');
        if (!select) return;

        const result = await SupabaseData.getClients();
        if (result.success) {
            select.innerHTML = '';
            result.data.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.company_name;
                select.appendChild(option);
            });
        }
    },

    // Afficher les tags des entreprises liées
    displayLinkedClients(clientIds, selectElement) {
        const listDiv = document.getElementById('linked-clients-list');
        const tagsDiv = document.getElementById('linked-clients-tags');
        if (!listDiv || !tagsDiv) return;

        if (clientIds.length === 0) {
            listDiv.style.display = 'none';
            return;
        }

        listDiv.style.display = 'block';
        tagsDiv.innerHTML = '';
        if (selectElement) {
            Array.from(selectElement.options).forEach(opt => {
                if (clientIds.includes(parseInt(opt.value))) {
                    const tag = document.createElement('span');
                    tag.style.cssText = 'background: #3b82f6; color: white; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem;';
                    tag.textContent = opt.textContent;
                    tagsDiv.appendChild(tag);
                }
            });
        }
    },

    // Basculer la visibilité du mot de passe
    togglePasswordVisibility() {
        const passwordInput = document.getElementById('user-password');
        const eyeIcon = document.getElementById('password-eye-icon');

        if (passwordInput && eyeIcon) {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                `;
            } else {
                passwordInput.type = 'password';
                eyeIcon.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                `;
            }
        }
    },

    // Copier le mot de passe dans le presse-papiers
    copyPassword() {
        const passwordValue = document.getElementById('created-password-value');
        if (passwordValue) {
            navigator.clipboard.writeText(passwordValue.textContent).then(() => {
                alert('Mot de passe copié !');
            }).catch(err => {
                console.error('Erreur copie:', err);
            });
        }
    },

    async editUser(userId) {
        const currentUser = await SupabaseAuth.checkSession();
        const result = await SupabaseAuth.getAllUsers(currentUser.id);

        if (result.success) {
            const user = result.users.find(u => u.id === userId);
            if (user) {
                const modalTitle = document.getElementById('modal-title');
                const userIdInput = document.getElementById('user-id');
                const userName = document.getElementById('user-name');
                const userEmail = document.getElementById('user-email');
                const userRole = document.getElementById('user-role');
                const userActive = document.getElementById('user-active');
                const passwordSection = document.getElementById('password-section');
                const userPassword = document.getElementById('user-password');
                const userModal = document.getElementById('userModal');
                const subcontractorSection = document.getElementById('subcontractor-link-section');
                const clientSection = document.getElementById('client-link-section');
                const userSubcontractor = document.getElementById('user-subcontractor');
                const userClient = document.getElementById('user-client');
                const createdPasswordDisplay = document.getElementById('created-password-display');

                if (modalTitle) modalTitle.textContent = 'Modifier l\'utilisateur';
                if (userIdInput) userIdInput.value = user.id;
                if (userName) userName.value = user.name;
                if (userEmail) userEmail.value = user.email;
                if (userRole) userRole.value = user.role;
                if (userActive) userActive.checked = user.active;
                if (passwordSection) passwordSection.style.display = 'none';
                if (userPassword) userPassword.required = false;
                if (createdPasswordDisplay) createdPasswordDisplay.style.display = 'none';

                // Masquer les deux sections par défaut
                if (subcontractorSection) subcontractorSection.style.display = 'none';
                if (clientSection) clientSection.style.display = 'none';

                // Gérer le sous-traitant pour les formateurs
                if (user.role === 'formateur') {
                    if (subcontractorSection) subcontractorSection.style.display = 'block';
                    await this.loadSubcontractors();
                    if (userSubcontractor && user.subcontractor_id) {
                        userSubcontractor.value = user.subcontractor_id;
                    }
                }
                // Gérer le client pour les clients (multi-clients)
                else if (user.role === 'client') {
                    if (clientSection) clientSection.style.display = 'block';

                    // En mode edition, basculer vers "Selectionner existante"
                    const clientModeExisting = document.querySelector('input[name="client-mode"][value="existing"]');
                    if (clientModeExisting) clientModeExisting.checked = true;
                    this.onClientModeChange('existing');

                    await this.loadAllClients();

                    // Sélectionner les clients liés dans le multi-select
                    const clientIds = user.client_ids || (user.client_id ? [user.client_id] : []);
                    if (userClient && clientIds.length > 0) {
                        Array.from(userClient.options).forEach(opt => {
                            opt.selected = clientIds.includes(parseInt(opt.value));
                        });
                    }

                    // Afficher les tags des entreprises liées
                    this.displayLinkedClients(clientIds, userClient);
                }

                if (userModal) userModal.style.display = 'flex';
            }
        }
    },

    async sendWelcomeEmail(userId) {
        const currentUser = await SupabaseAuth.checkSession();
        const result = await SupabaseAuth.getAllUsers(currentUser.id);

        if (!result.success) {
            alert('Erreur lors de la récupération des utilisateurs.');
            return;
        }

        const user = result.users.find(u => u.id === userId);
        if (!user) {
            alert('Utilisateur non trouvé.');
            return;
        }

        const password = user.initial_password || '[mot de passe modifié - veuillez le réinitialiser]';
        const siteUrl = window.location.origin;
        const docPrealableUrl = 'https://docs.google.com/document/d/1aMsZo2m7cycaLYoldhJeQ13is_5hHK2v/edit';

        const subject = 'Vos accès à votre espace formation';
        const body = `Bonjour,

Nous avons le plaisir de vous informer que votre espace formation a été créé.

Vous pouvez y accéder à l'adresse suivante : ${siteUrl}

Vos identifiants de connexion :
- Email : ${user.email}
- Mot de passe : ${password}

Nous vous remercions de bien vouloir remplir le document préalable à la formation accessible depuis votre espace client ou via le lien ci-dessous :
${docPrealableUrl}

Ce document nous permettra de préparer au mieux votre formation.

Cordialement,
Nathalie Joulie-Morand`;

        GenericEmail.show({
            title: `Envoi des accès - ${user.name}`,
            to: user.email,
            subject: subject,
            body: body
        });
    },

    closeModal() {
        const userModal = document.getElementById('userModal');
        if (userModal) userModal.style.display = 'none';
    },

    async saveUser(event) {
        event.preventDefault();

        const currentUser = await SupabaseAuth.checkSession();
        if (!currentUser) return;

        const userId = document.getElementById('user-id').value;
        const name = document.getElementById('user-name').value;
        const email = document.getElementById('user-email').value;
        const role = document.getElementById('user-role').value;
        const password = document.getElementById('user-password').value;
        const active = document.getElementById('user-active').checked;

        let subcontractorId = null;
        let clientId = null;

        // === ÉTAPE 1 : Créer ou sélectionner l'entité AVANT l'utilisateur ===

        // Pour un formateur : créer ou sélectionner le sous-traitant D'ABORD
        if (role === 'formateur') {
            const subMode = document.querySelector('input[name="subcontractor-mode"]:checked')?.value || 'new';

            if (subMode === 'new') {
                // Créer un nouveau sous-traitant
                const firstName = document.getElementById('new-subcontractor-first-name')?.value?.trim();
                const lastName = document.getElementById('new-subcontractor-last-name')?.value?.trim();
                const subEmail = document.getElementById('new-subcontractor-email')?.value?.trim();

                if (!firstName || !lastName) {
                    alert('Le prénom et le nom du sous-traitant sont obligatoires pour un compte formateur.');
                    return;
                }

                const subResult = await SupabaseData.addSubcontractor({
                    first_name: firstName,
                    last_name: lastName,
                    email: subEmail || null
                });

                if (!subResult.success) {
                    alert('Erreur lors de la création du sous-traitant: ' + subResult.message);
                    return;
                }

                subcontractorId = subResult.data.id;
                console.log('✅ Sous-traitant créé:', subResult.data);
            } else {
                // Sélectionner un sous-traitant existant
                subcontractorId = document.getElementById('user-subcontractor')?.value || null;
                if (subcontractorId) subcontractorId = parseInt(subcontractorId);
            }
        }

        // Pour un client : créer ou sélectionner le(s) client(s) D'ABORD
        let clientIds = [];
        if (role === 'client') {
            const clientMode = document.querySelector('input[name="client-mode"]:checked')?.value || 'new';

            if (clientMode === 'new') {
                // Créer une nouvelle entreprise cliente
                const companyName = document.getElementById('new-client-company-name')?.value?.trim();
                const contactName = document.getElementById('new-client-contact-name')?.value?.trim();
                const clientEmail = document.getElementById('new-client-email')?.value?.trim();
                const address = document.getElementById('new-client-address')?.value?.trim();

                if (!companyName) {
                    alert('La raison sociale est obligatoire pour un compte client.');
                    return;
                }

                const clientResult = await SupabaseData.addClient({
                    company_name: companyName,
                    contact_name: contactName || null,
                    email: clientEmail || null,
                    address: address || null
                });

                if (!clientResult.success) {
                    alert('Erreur lors de la création du client: ' + clientResult.message);
                    return;
                }

                clientId = clientResult.data.id;
                clientIds = [clientId];
                console.log('✅ Client créé:', clientResult.data);
            } else {
                // Sélectionner un ou plusieurs clients existants (multi-select)
                const select = document.getElementById('user-client');
                if (select) {
                    clientIds = Array.from(select.selectedOptions).map(opt => parseInt(opt.value));
                }
                clientId = clientIds.length > 0 ? clientIds[0] : null;
            }
        }

        // === ÉTAPE 2 : Créer ou mettre à jour l'utilisateur ===

        let result;
        const isNewUser = !userId;

        if (userId) {
            // Update existing user
            result = await SupabaseAuth.updateUser(currentUser.id, userId, { name, email, role, active });

            // Lier au sous-traitant si formateur
            if (result.success && role === 'formateur') {
                await SupabaseData.linkUserToSubcontractor(userId, subcontractorId);
            }
            // Lier au(x) client(s) si client
            if (result.success && role === 'client') {
                await SupabaseData.linkUserToClients(userId, clientIds);
            }
        } else {
            // Add new user
            result = await SupabaseAuth.registerUser(currentUser.id, { name, email, role, password });

            // Si l'email existe déjà et qu'on crée un client, rattacher automatiquement l'entreprise au compte existant
            const isEmailDuplicate = !result.success && result.message && (
                result.message.includes('already registered') ||
                result.message.includes('already exists') ||
                result.message.includes('already been registered') ||
                result.message.includes('User already registered') ||
                result.message.toLowerCase().includes('duplicate') ||
                result.message.toLowerCase().includes('already')
            );
            if (isEmailDuplicate && role === 'client' && clientIds.length > 0) {
                const existingProfile = await SupabaseData.getProfileByEmail(email);
                if (existingProfile.success && existingProfile.data) {
                    // Récupérer les clients déjà liés
                    const existingLinks = await SupabaseData.getUserClientIds(existingProfile.data.id);
                    const existingClientIds = existingLinks.clientIds || [];
                    // Fusionner les anciens et nouveaux client IDs (sans doublons)
                    const mergedIds = [...new Set([...existingClientIds, ...clientIds])];
                    await SupabaseData.linkUserToClients(existingProfile.data.id, mergedIds);

                    // Récupérer le nom de l'entreprise (champ de saisie ou select)
                    const newCompanyName = document.getElementById('new-client-company-name')?.value?.trim();
                    const clientNames = newCompanyName || clientIds.map(cid => {
                        const opt = document.querySelector(`#user-client option[value="${cid}"]`);
                        return opt ? opt.textContent : `Client #${cid}`;
                    }).join(', ');

                    alert(
                        `Le compte "${existingProfile.data.name}" (${email}) existe déjà.\n\n` +
                        `L'entreprise "${clientNames}" a été ajoutée à ce compte.\n` +
                        `L'utilisateur pourra voir les formations de toutes ses entreprises.`
                    );
                    this.closeModal();
                    await this.loadUsers();
                    return;
                }
            }

            // Lier au sous-traitant si formateur et création réussie
            if (result.success && result.user && role === 'formateur' && subcontractorId) {
                await SupabaseData.linkUserToSubcontractor(result.user.id, subcontractorId);
            }
            // Lier au(x) client(s) si client et création réussie
            if (result.success && result.user && role === 'client' && clientIds.length > 0) {
                await SupabaseData.linkUserToClients(result.user.id, clientIds);
            }
        }

        if (result.success) {
            // Afficher le mot de passe si c'est une nouvelle création
            if (isNewUser && password) {
                const createdPasswordDisplay = document.getElementById('created-password-display');
                const createdPasswordValue = document.getElementById('created-password-value');
                if (createdPasswordDisplay && createdPasswordValue) {
                    createdPasswordValue.textContent = password;
                    createdPasswordDisplay.style.display = 'block';
                    // Ne pas fermer le modal pour permettre de voir/copier le mot de passe
                    alert(result.message + '\n\nLe mot de passe est affiché ci-dessous. Pensez à le copier !');
                    await this.loadUsers();
                    return;
                }
            }

            alert(result.message);
            this.closeModal();
            await this.loadUsers();
        } else {
            alert(result.message);
        }
    },

    async deleteUser(userId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.')) {
            return;
        }

        const currentUser = await SupabaseAuth.checkSession();
        if (!currentUser) return;

        const result = await SupabaseAuth.deleteUser(currentUser.id, userId);

        if (result.success) {
            alert(result.message);
            await this.loadUsers();
        } else {
            alert(result.message);
        }
    },

    showResetPasswordModal(userId) {
        const resetUserId = document.getElementById('reset-user-id');
        const resetPasswordModal = document.getElementById('resetPasswordModal');

        if (resetUserId) resetUserId.value = userId;
        if (resetPasswordModal) resetPasswordModal.style.display = 'flex';
    },

    closeResetPasswordModal() {
        const resetPasswordModal = document.getElementById('resetPasswordModal');
        if (resetPasswordModal) resetPasswordModal.style.display = 'none';
    },

    async resetPassword(event) {
        event.preventDefault();

        const currentUser = await SupabaseAuth.checkSession();
        if (!currentUser) return;

        const userId = document.getElementById('reset-user-id').value;
        const newPassword = document.getElementById('reset-password').value;

        const result = await SupabaseAuth.resetPassword(currentUser.id, userId, newPassword);

        if (result.success) {
            alert(result.message);
            this.closeResetPasswordModal();
            await this.loadUsers(); // Rafraîchir pour voir le nouveau mot de passe
        } else {
            alert(result.message);
        }
    },

    // ==================== ADMIN LOGS ====================

    logsData: [],
    logsFilterType: '',

    async loadLogs() {
        const emptyDiv = document.getElementById('admin-logs-empty');
        const listDiv = document.getElementById('admin-logs-list');

        if (emptyDiv) {
            emptyDiv.style.display = 'block';
            emptyDiv.innerHTML = '<p>Chargement de l\'historique...</p>';
        }
        if (listDiv) listDiv.style.display = 'none';

        const filters = {};
        if (this.logsFilterType) {
            filters.action_type = this.logsFilterType;
        }
        filters.limit = 50;

        const result = await SupabaseData.getAdminLogs(filters);

        if (!result.success) {
            if (emptyDiv) {
                emptyDiv.innerHTML = '<p>Erreur lors du chargement de l\'historique</p>';
            }
            return;
        }

        this.logsData = result.data;
        this.renderLogs(this.logsData);
    },

    filterLogs() {
        const filterSelect = document.getElementById('logs-filter-type');
        this.logsFilterType = filterSelect ? filterSelect.value : '';
        this.loadLogs();
    },

    renderLogs(logs) {
        const emptyDiv = document.getElementById('admin-logs-empty');
        const listDiv = document.getElementById('admin-logs-list');

        if (!logs.length) {
            if (emptyDiv) {
                emptyDiv.style.display = 'block';
                emptyDiv.innerHTML = '<p>Aucune action enregistrée</p>';
            }
            if (listDiv) listDiv.style.display = 'none';
            return;
        }

        if (emptyDiv) emptyDiv.style.display = 'none';
        if (listDiv) {
            listDiv.style.display = 'block';
            listDiv.innerHTML = logs.map(log => `
                <div style="padding: 1rem; border-bottom: 1px solid var(--gray-100); display: flex; gap: 1rem; align-items: flex-start;">
                    <div style="flex-shrink: 0; width: 40px; height: 40px; background: ${this.getActionColor(log.action_type)}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1rem;">
                        ${this.getActionIcon(log.action_type)}
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <p style="font-weight: 600; color: var(--gray-900); margin-bottom: 0.25rem;">${log.action_description}</p>
                                <p style="font-size: 0.875rem; color: var(--gray-600);">
                                    Par <strong>${log.admin_name || 'Système'}</strong> ${log.admin_email ? `(${log.admin_email})` : ''}
                                </p>
                            </div>
                            <span style="font-size: 0.75rem; color: var(--gray-500); white-space: nowrap;">
                                ${new Date(log.created_at).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>
                        ${log.target_name ? `<p style="font-size: 0.75rem; color: var(--gray-500); margin-top: 0.25rem;">Cible: ${log.target_name}</p>` : ''}
                    </div>
                </div>
            `).join('');
        }
    },

    getActionColor(actionType) {
        const colors = {
            'user_created': 'var(--primary-green)',
            'user_updated': 'var(--primary-orange)',
            'user_deleted': '#ef4444',
            'role_changed': 'var(--primary-purple)',
            'user_activated': 'var(--primary-green)',
            'user_deactivated': '#ef4444',
            'formation_created': 'var(--primary-pink)',
            'formation_updated': 'var(--primary-orange)',
            'formation_deleted': '#ef4444',
            'login_success': 'var(--primary-green)',
            'login_failed': '#ef4444'
        };
        return colors[actionType] || 'var(--gray-500)';
    },

    getActionIcon(actionType) {
        const icons = {
            'user_created': '+',
            'user_updated': '✏️',
            'user_deleted': '🗑️',
            'role_changed': '👤',
            'user_activated': '✓',
            'user_deactivated': '✗',
            'formation_created': '📚',
            'formation_updated': '✏️',
            'formation_deleted': '🗑️',
            'login_success': '🔓',
            'login_failed': '🔒'
        };
        return icons[actionType] || '📝';
    }
};

// ==================== Authentication Logic ====================
const authPage = document.getElementById('authPage');
const dashboardPage = document.getElementById('dashboardPage');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', async () => {
    const currentUser = await SupabaseAuth.checkSession();
    if (currentUser) {
        await showDashboard(currentUser);
    }
});

// Login form submission
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const result = await SupabaseAuth.login(email, password);

        if (result.success) {
            await showDashboard(result.user);
        } else {
            alert(result.message);
        }
    });
}

// Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await SupabaseAuth.logout();
        showAuth();
    });
}

// Show dashboard
async function showDashboard(user) {
    if (authPage) authPage.classList.add('hidden');
    if (dashboardPage) dashboardPage.classList.add('active');

    // Update user display
    const userName = user.name || user.email.split('@')[0];
    const userNameElement = document.querySelector('.user-name');
    const userAvatarElement = document.querySelector('.user-avatar');

    if (userNameElement) {
        userNameElement.textContent = userName;
    }
    if (userAvatarElement) {
        userAvatarElement.textContent = userName.charAt(0).toUpperCase();
    }

    // Store current user globally
    CRMApp.currentUser = user;

    // Route based on role
    const adminNav = document.getElementById('admin-nav');
    const formateurNav = document.getElementById('formateur-nav');
    const clientNav = document.getElementById('client-nav');

    // Hide all navigations first
    if (adminNav) adminNav.style.display = 'none';
    if (formateurNav) formateurNav.style.display = 'none';
    if (clientNav) clientNav.style.display = 'none';

    if (user.role === 'formateur') {
        // Show formateur navigation
        if (formateurNav) formateurNav.style.display = 'block';

        // Initialize formateur view
        await CRMApp.initFormateurView(user);
    } else if (user.role === 'client') {
        // Show client navigation
        if (clientNav) clientNav.style.display = 'block';

        // Initialize client view
        await CRMApp.initClientView(user);
    } else {
        // Admin - show admin navigation
        if (adminNav) adminNav.style.display = 'block';

        // Initialize regular CRM App
        await CRMApp.init();
        UserManagement.init();
    }
}

// Show auth page
function showAuth() {
    if (authPage) authPage.classList.remove('hidden');
    if (dashboardPage) dashboardPage.classList.remove('active');
}

// Toggle password visibility
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');

    if (passwordInput && eyeIcon) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
            `;
        } else {
            passwordInput.type = 'password';
            eyeIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            `;
        }
    }
}

// Navigation handler
document.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (navItem) {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        navItem.classList.add('active');
    }
});

// ==================== Convocation Email Module ====================
const ConvocationEmail = {
    currentFormation: null,
    originalBodyTemplate: '',

    // URLs des documents statiques
    STATIC_DOCUMENTS: {
        livret_accueil: {
            name: 'Livret d\'accueil NJM Conseil',
            googleDriveId: '1p6qJTI0jan7h1JNtUZ_PkD0oTNyfrG-a',
            pdfUrl: 'https://drive.google.com/file/d/1p6qJTI0jan7h1JNtUZ_PkD0oTNyfrG-a/view'
        },
        fiche_reclamation: {
            name: 'Fiche de réclamation',
            googleDriveId: '1HE_wGaYO4xLF4MvHATWMU_vBJXIjTL9c',
            pdfUrl: 'https://drive.google.com/file/d/1HE_wGaYO4xLF4MvHATWMU_vBJXIjTL9c/view'
        }
    },

    // Template du mail de convocation
    getEmailTemplate() {
        return `Bonjour {{Nom_du_dirigeant}},

Comment allez-vous ?

Comme convenu, je vous transmets un complément d'information relatif à la formation qui se tiendra :
En vos locaux
Dates : {{dates_de_début}}, {{dates_de_fin}}

Nous commencerons à 8h30 et nous terminerons à 17h00.
Le repas de midi se déroulera au plus rapide, sur place.

Je vous laisse le soin d'informer vos collaborateurs de la tenue de cette formation, et de ses objectifs pédagogiques.

Merci de bien vouloir trouver ici un questionnaire amont à leur intention. Celui-ci a pour but de bien identifier leurs attentes et leur niveau. Il est très important que tous me le renvoient, avant le {{dates_de_début}}.
{{Questionnaire}}

Je vous remercie de veiller en particulier :
-aux conditions de confort pour travailler en salle, dans vos locaux (chauffage, climatisation, table et chaises en nombre suffisant, bouteilles d'eau )
-aux facilités d'accès pour les personnes handicapées. Merci de me prévenir si un des apprenants a un handicap (mobilité réduite, malentendant, malvoyant, « dys » ).
-à la mise en place d'un paperboard ou tableau blanc
-à la mise en place d'un vidéoprojecteur. Dans le cas où vous n'en auriez pas, veuillez me le signaler. J'amènerai le mien.

IMPORTANT- J'ai créé pour vous un espace confidentiel où vous retrouverez tous les documents relatifs à la formation. En voici l'accès : {{client_login}} et votre mot de passe : {{client_password}} Conservez-les précieusement.
Vous y trouverez :
-la convention de formation. Merci de me la retourner signée.
-la fiche pédagogique, telle que nous l'avons réfléchie ensemble
-le livret d'accueil d'NJM Conseil (pour les apprenants)
-la fiche de réclamation (pour les apprenants)

Je vous rappelle qu'une évaluation des acquis aura lieu en cours ou en fin de formation. (modalité indiquée sur la fiche pédagogique)
Je vous transmettrai, via votre espace, un bilan de formation, un exemplaire de l'attestation et du certificat de fin de formation. Un second exemplaire vous sera transmis.
Plusieurs mois après la formation, je reviendrai vers vous pour évaluer les acquis dans le cadre professionnel.

En vous remerciant pour votre confiance.

Cordialement

Nathalie JOULIÉ MORAND`;
    },

    formatDate(dateString) {
        if (!dateString) return '[Date à définir]';
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    },

    async show(formation) {
        this.currentFormation = formation;

        // Remplir les champs du modal
        const toInput = document.getElementById('convocation-to');
        const subjectInput = document.getElementById('convocation-subject');
        const bodyTextarea = document.getElementById('convocation-body');
        const questionnaireSelect = document.getElementById('convocation-questionnaire');

        // Email du client (depuis le champ client_email du formulaire)
        toInput.value = formation.client_email || '';

        // Objet du mail
        const formationName = formation.formation_name || formation.title || 'Formation';
        const clientName = formation.client_name || formation.company_name || '';
        subjectInput.value = `Convocation à la formation "${formationName}" - ${clientName}`;

        // Réinitialiser le questionnaire
        questionnaireSelect.value = '';

        // Récupérer les identifiants du compte client
        let clientLogin = '[accès non créé]';
        let clientPassword = '[mot de passe non disponible]';
        if (formation.client_email) {
            const profileResult = await SupabaseData.getProfileByEmail(formation.client_email);
            if (profileResult.success && profileResult.data) {
                clientLogin = profileResult.data.email;
                clientPassword = profileResult.data.initial_password || '[voir avec l\'administrateur]';
            }
        }

        // Corps du mail avec les placeholders remplacés
        let body = this.getEmailTemplate();

        // Remplacer les placeholders
        const dirigeantName = formation.company_director_name || '[Nom du dirigeant]';
        const startDate = this.formatDate(formation.start_date);
        const endDate = this.formatDate(formation.end_date);

        body = body.replace(/\{\{Nom_du_dirigeant\}\}/g, dirigeantName);
        body = body.replace(/\{\{dates_de_début\}\}/g, startDate);
        body = body.replace(/\{\{dates_de_fin\}\}/g, endDate);
        body = body.replace(/\{\{Questionnaire\}\}/g, '[Lien du questionnaire à sélectionner ci-dessus]');
        body = body.replace(/\{\{client_login\}\}/g, clientLogin);
        body = body.replace(/\{\{client_password\}\}/g, clientPassword);

        this.originalBodyTemplate = body;
        bodyTextarea.value = body;

        // Afficher le modal
        const modal = document.getElementById('convocationModal');
        modal.style.display = 'flex';
    },

    displayAttachments(formation) {
        const attachmentsContainer = document.getElementById('convocation-attachments');

        // Liste des pièces jointes requises
        const requiredAttachments = [
            { name: 'Fiche pédagogique', type: 'google_doc', icon: '📄', color: '#0284c7' },
            { name: 'Convention', type: 'convention', icon: '📋', color: '#7c3aed' },
            { name: 'Livret d\'accueil', type: 'livret_accueil', icon: '📖', color: '#059669', static: true },
            { name: 'Fiche de réclamation', type: 'fiche_reclamation', icon: '📝', color: '#dc2626', static: true }
        ];

        // Documents de la formation
        const formationDocs = formation.formation_documents || [];

        let html = '';

        requiredAttachments.forEach(attachment => {
            // Chercher si le document existe dans la formation
            let doc = null;
            let pdfUrl = null;

            if (attachment.static) {
                // Documents statiques
                const staticDoc = this.STATIC_DOCUMENTS[attachment.type];
                if (staticDoc) {
                    pdfUrl = staticDoc.pdfUrl;
                }
            } else {
                // Documents de la formation
                doc = formationDocs.find(d => {
                    if (attachment.type === 'google_doc') {
                        return d.type === 'google_doc' && d.name && d.name.toLowerCase().includes('pédagogique');
                    }
                    return d.type === attachment.type;
                });

                if (doc) {
                    // Générer l'URL PDF à partir de l'ID Google Doc
                    if (doc.external_id) {
                        pdfUrl = `https://docs.google.com/document/d/${doc.external_id}/export?format=pdf`;
                    } else if (doc.document_url && doc.document_url.includes('/d/')) {
                        // Extraire l'ID du document depuis l'URL
                        const match = doc.document_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                        if (match) {
                            pdfUrl = `https://docs.google.com/document/d/${match[1]}/export?format=pdf`;
                        }
                    }
                }
            }

            const hasDoc = doc || attachment.static;
            const statusIcon = hasDoc ? '✓' : '⚠';
            const statusColor = hasDoc ? '#059669' : '#f59e0b';
            const statusText = hasDoc ? (attachment.static ? 'PDF standard' : 'PDF disponible') : 'À créer';

            // Liens d'action - uniquement PDF
            let actionLinks = '';
            if (hasDoc && pdfUrl) {
                actionLinks = `
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
                        <a href="${pdfUrl}" target="_blank" style="font-size: 0.75rem; color: ${attachment.color}; text-decoration: none; display: flex; align-items: center; gap: 0.25rem;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            Télécharger PDF
                        </a>
                    </div>
                `;
            } else if (!hasDoc) {
                actionLinks = `<span style="font-size: 0.75rem; color: #f59e0b;">Créez d'abord ce document</span>`;
            }

            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: white; border-radius: var(--radius-sm); border: 1px solid var(--gray-200);">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 1.25rem;">${attachment.icon}</span>
                        <div>
                            <span style="font-weight: 500; color: var(--gray-900);">${attachment.name}</span>
                            ${actionLinks}
                        </div>
                    </div>
                    <span style="font-size: 0.75rem; color: ${statusColor}; display: flex; align-items: center; gap: 0.25rem;">
                        ${statusIcon} ${statusText}
                    </span>
                </div>
            `;
        });

        attachmentsContainer.innerHTML = html;
    },

    updateQuestionnaireInBody() {
        const questionnaireSelect = document.getElementById('convocation-questionnaire');
        const bodyTextarea = document.getElementById('convocation-body');
        const selectedUrl = questionnaireSelect.value;

        let body = bodyTextarea.value;

        // Remplacer le placeholder ou l'ancien lien du questionnaire (Google Forms)
        const questionnaireRegex = /\[Lien du questionnaire[^\]]*\]|https:\/\/docs\.google\.com\/forms\/d\/[^\s\n]*/g;

        if (selectedUrl) {
            body = body.replace(questionnaireRegex, selectedUrl);
            // Si le placeholder n'existait pas, on ne fait rien de plus
        } else {
            body = body.replace(questionnaireRegex, '[Lien du questionnaire à sélectionner ci-dessus]');
        }

        bodyTextarea.value = body;
    },

    closeModal() {
        const modal = document.getElementById('convocationModal');
        modal.style.display = 'none';
        this.currentFormation = null;
    },

    async copyToClipboard() {
        const bodyTextarea = document.getElementById('convocation-body');

        try {
            await navigator.clipboard.writeText(bodyTextarea.value);
            alert('Le contenu du mail a été copié dans le presse-papiers !');
        } catch (err) {
            // Fallback pour les navigateurs plus anciens
            bodyTextarea.select();
            document.execCommand('copy');
            alert('Le contenu du mail a été copié dans le presse-papiers !');
        }
    },

    async sendEmail() {
        const toInput = document.getElementById('convocation-to');
        const subjectInput = document.getElementById('convocation-subject');
        const bodyTextarea = document.getElementById('convocation-body');
        const questionnaireSelect = document.getElementById('convocation-questionnaire');
        const sendButton = document.getElementById('convocation-send-btn');

        if (!toInput.value) {
            alert('Veuillez renseigner l\'adresse email du destinataire.');
            toInput.focus();
            return;
        }

        // Vérifier que le format email est valide
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(toInput.value)) {
            alert('Veuillez entrer une adresse email valide.');
            toInput.focus();
            return;
        }

        // Désactiver le bouton pendant l'envoi
        const originalButtonText = sendButton.innerHTML;
        sendButton.disabled = true;
        sendButton.innerHTML = '⏳ Envoi en cours...';

        try {
            // Plus de pièces jointes - les documents sont sur l'espace client
            const attachments = [];

            // Envoyer via Gmail API avec pièces jointes
            const result = await GoogleDocsService.sendEmail(
                toInput.value,
                subjectInput.value,
                bodyTextarea.value,
                attachments
            );

            if (result.success) {
                // Enregistrer l'envoi dans la base de données
                const logData = {
                    sent_to: toInput.value,
                    subject: subjectInput.value,
                    questionnaire_url: questionnaireSelect.value || null,
                    attachments: attachments.map(a => ({ name: a.name, mimeType: a.mimeType })),
                    gmail_message_id: result.messageId,
                    sent_by: gapi.client.getToken()?.access_token ? 'gmail_api' : 'unknown'
                };

                await SupabaseData.logConvocationSent(this.currentFormation.id, logData);

                alert('✅ Email envoyé avec succès !\n\nLe mail a été envoyé depuis votre compte Gmail avec ' + attachments.length + ' pièce(s) jointe(s).');
                this.closeModal();

                // Recharger les formations pour mettre à jour l'icône
                await CRMApp.loadFormations();
            } else {
                // En cas d'erreur, proposer l'alternative mailto
                const useMailto = confirm(
                    `❌ Erreur lors de l'envoi via Gmail:\n${result.error}\n\nVoulez-vous ouvrir votre client mail par défaut à la place ?`
                );
                if (useMailto) {
                    const mailtoLink = `mailto:${encodeURIComponent(toInput.value)}?subject=${encodeURIComponent(subjectInput.value)}&body=${encodeURIComponent(bodyTextarea.value)}`;
                    window.open(mailtoLink, '_blank');
                }
            }
        } catch (error) {
            console.error('Erreur envoi email:', error);
            // Fallback vers mailto
            const useMailto = confirm(
                `❌ Erreur lors de l'envoi:\n${error.message || error}\n\nVoulez-vous ouvrir votre client mail par défaut à la place ?`
            );
            if (useMailto) {
                const mailtoLink = `mailto:${encodeURIComponent(toInput.value)}?subject=${encodeURIComponent(subjectInput.value)}&body=${encodeURIComponent(bodyTextarea.value)}`;
                window.open(mailtoLink, '_blank');
            }
        } finally {
            // Réactiver le bouton
            sendButton.disabled = false;
            sendButton.innerHTML = originalButtonText;
        }
    },

    /**
     * Prépare les pièces jointes PDF à partir des documents Google Docs
     */
    async prepareAttachments() {
        const attachments = [];
        const formation = this.currentFormation;
        const formationDocs = formation.formation_documents || [];

        // 1. Documents dynamiques (Fiche pédagogique et Convention)
        const docsToAttach = [
            { type: 'google_doc', name: 'Fiche pédagogique', searchName: 'pédagogique' },
            { type: 'convention', name: 'Convention', searchName: null }
        ];

        for (const docConfig of docsToAttach) {
            let doc = formationDocs.find(d => {
                if (docConfig.searchName) {
                    return d.type === docConfig.type && d.name && d.name.toLowerCase().includes(docConfig.searchName);
                }
                return d.type === docConfig.type;
            });

            if (doc) {
                let docId = doc.external_id;
                if (!docId && doc.document_url && doc.document_url.includes('/d/')) {
                    const match = doc.document_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (match) docId = match[1];
                }

                if (docId) {
                    try {
                        console.log(`⏳ Téléchargement du document dynamique: ${docConfig.name}...`);
                        const pdfData = await this.downloadPdfFromGoogleDoc(docId, true); // true = export car c'est un Google Doc
                        if (pdfData) {
                            attachments.push({
                                name: `${docConfig.name} - ${formation.formation_name || 'Formation'}.pdf`,
                                mimeType: 'application/pdf',
                                data: pdfData
                            });
                        }
                    } catch (error) {
                        console.warn(`Impossible de télécharger ${docConfig.name}:`, error);
                    }
                }
            }
        }

        // 2. Documents statiques (Livret d'accueil and Fiche de réclamation)
        for (const key in this.STATIC_DOCUMENTS) {
            const staticDoc = this.STATIC_DOCUMENTS[key];
            if (staticDoc.googleDriveId) {
                try {
                    console.log(`⏳ Téléchargement du document statique: ${staticDoc.name}...`);
                    const pdfData = await this.downloadPdfFromGoogleDoc(staticDoc.googleDriveId, false); // false = direct car c'est déjà un PDF
                    if (pdfData) {
                        attachments.push({
                            name: `${staticDoc.name}.pdf`,
                            mimeType: 'application/pdf',
                            data: pdfData
                        });
                        console.log(`✅ Document statique ${staticDoc.name} ajouté.`);
                    }
                } catch (error) {
                    console.error(`Erreur téléchargement document statique ${staticDoc.name}:`, error);
                }
            }
        }

        return attachments;
    },

    /**
     * Télécharge un Google Doc en format PDF et retourne le contenu en base64
     */
    async downloadPdfFromGoogleDoc(docId, isGoogleDoc = true) {
        try {
            // S'assurer que l'utilisateur est authentifié
            await GoogleDocsService.authenticate();

            const accessToken = gapi.client.getToken().access_token;

            // Si c'est un Google Doc, on utilise /export
            // Si c'est déjà un PDF (statique), on utilise ?alt=media
            const url = isGoogleDoc
                ? `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=application/pdf`
                : `https://www.googleapis.com/drive/v3/files/${docId}?alt=media`;

            // Télécharger le contenu
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
            }

            // Convertir la réponse en blob
            const blob = await response.blob();

            // Convertir le blob en base64
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    // Extraire uniquement la partie base64
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Erreur téléchargement fichier Drive:', error);
            return null;
        }
    }
};

// ==================== Generic Email Module ====================
const GenericEmail = {
    closeModal() {
        const modal = document.getElementById('genericEmailModal');
        if (modal) modal.style.display = 'none';
    },

    show({ title, to, subject, body }) {
        document.getElementById('generic-email-title').textContent = title || 'Envoi de mail';
        document.getElementById('generic-email-to').value = to || '';
        document.getElementById('generic-email-subject').value = subject || '';
        document.getElementById('generic-email-body').value = body || '';

        const sendBtn = document.getElementById('generic-email-send-btn');
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Envoyer le mail';

        document.getElementById('genericEmailModal').style.display = 'flex';
    },

    copyToClipboard() {
        const body = document.getElementById('generic-email-body').value;
        navigator.clipboard.writeText(body).then(() => {
            alert('Contenu copié dans le presse-papiers !');
        }).catch(() => {
            // Fallback
            const textarea = document.getElementById('generic-email-body');
            textarea.select();
            document.execCommand('copy');
            alert('Contenu copié !');
        });
    },

    async sendEmail() {
        const to = document.getElementById('generic-email-to').value;
        const subject = document.getElementById('generic-email-subject').value;
        const body = document.getElementById('generic-email-body').value;
        const sendBtn = document.getElementById('generic-email-send-btn');

        if (!to) {
            alert('Veuillez renseigner l\'adresse email du destinataire.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            alert('Veuillez entrer une adresse email valide.');
            return;
        }

        sendBtn.disabled = true;
        sendBtn.innerHTML = '⏳ Envoi en cours...';

        try {
            await GoogleDocsService.authenticate();
            const result = await GoogleDocsService.sendEmail(to, subject, body);

            if (result.success) {
                alert('Email envoyé avec succès !');
                this.closeModal();
            } else {
                const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                window.open(mailtoUrl, '_blank');
                alert('L\'envoi automatique a échoué. Un brouillon a été ouvert dans votre client mail.');
            }
        } catch (error) {
            console.error('Erreur envoi email:', error);
            alert('Erreur lors de l\'envoi.');
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Envoyer le mail';
        }
    }
};

// Expose globally for HTML event handlers
window.CRMApp = CRMApp;
window.UserManagement = UserManagement;
window.ConvocationEmail = ConvocationEmail;
window.GenericEmail = GenericEmail;
