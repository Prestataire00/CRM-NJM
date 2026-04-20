// ==================== CRM App with Supabase Integration ====================
// Ce fichier remplace toute la logique localStorage par Supabase

// Fallback showToast si non défini (défini dans index.html)
if (typeof showToast === 'undefined') {
    window.showToast = function(message, type, duration) {
        console.log(`[TOAST ${type}] ${message}`);
        // Créer un toast basique si le conteneur existe
        const container = document.getElementById('toast-container');
        if (container) {
            const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
            const colors = { success: '#059669', error: '#dc2626', info: '#2563eb', warning: '#d97706' };
            const toast = document.createElement('div');
            toast.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;background:${colors[type]||'#333'};color:white;padding:0.875rem 1.25rem;border-radius:10px;font-size:0.9rem;z-index:99999;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,0.15);`;
            toast.textContent = `${icons[type]||''} ${message}`;
            toast.onclick = () => toast.remove();
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), duration || 3500);
        }
    };
}

// Fallback showConfirmDialog si non défini
if (typeof showConfirmDialog === 'undefined') {
    window.showConfirmDialog = function({ title, message, confirmText, isDangerous }) {
        return Promise.resolve(confirm(`${title}\n\n${message}`));
    };
}

// Normalise les URLs d'assets pour gérer les accents Mac (NFD) vs fichiers Git (NFC)
// Les noms de fichiers avec accents créés sur Mac utilisent souvent NFD, alors que
// Netlify/Git/browsers attendent NFC. Cette fonction décode + normalise + ré-encode.
window.normalizeAssetUrl = function(url) {
    if (!url) return '#';
    // URLs absolues (Supabase Storage, Drive, etc.) → ne pas toucher
    if (/^https?:\/\//i.test(url)) return url;
    // URLs relatives : décode + normalise NFC + ré-encode proprement
    try {
        const decoded = decodeURIComponent(url);
        const normalized = decoded.normalize('NFC');
        return encodeURI(normalized);
    } catch (e) {
        console.warn('normalizeAssetUrl failed for', url, e);
        return url;
    }
};

// Diagnostic au chargement
if (typeof SupabaseData !== 'undefined') {

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

/**
 * Retourne l'URL du document (compatible avec les anciens docs Google et les nouveaux PDF locaux)
 */
function toPdfUrl(url) {
    if (!url) return '';
    return url;
}

const CRMApp = {
    currentPage: 'dashboard',
    currentVeilleType: 'formation',
    allFormations: [], // Stockage pour le filtrage

    async init() {
        this.setupNavigation();
        this.showPage('dashboard');
        await this.updateDashboardStats();
        await this.loadFormations();
        await this.loadVeille();
        await this.loadBPF();
        await this.loadSupports();
        await this.loadTemplates();
        await this.loadUsers();
        this.loadParametres();
        await this.checkExpiringDocuments();
        await this.checkQuestionnairesFroid();
        loadNotifications();
        await this.loadRecentActivity();
    },

    // ==================== ACTIVITÉ RÉCENTE ====================

    async loadRecentActivity() {
        try {
        const { data } = await supabaseClient
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        const list = document.getElementById('recent-activity-list');
        if (!list) return;

        if (!data || data.length === 0) {
            list.innerHTML = '<li style="color:#999;text-align:center;padding:20px;">Aucune activité récente</li>';
            return;
        }

        const colors = {
            mail: 'var(--primary-pink)',
            formation: 'var(--primary-green)',
            convention: 'var(--primary-orange)',
            certificat: 'var(--primary-purple)',
            client: 'var(--primary-pink)'
        };

        list.innerHTML = data.map(n => {
            const ago = this.timeAgo(new Date(n.created_at));
            const color = colors[n.type] || 'var(--primary-orange)';
            return `<li class="activity-item">
                <div class="activity-dot" style="background:${color};"></div>
                <div class="activity-content">
                    <div class="activity-text">${n.message}</div>
                    <div class="activity-time">${ago}</div>
                </div>
            </li>`;
        }).join('');
        } catch (e) { console.warn('Activit\u00E9 r\u00E9cente non disponible:', e); }
    },

    timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'À l\'instant';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
        const days = Math.floor(hours / 24);
        return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
    },

    // ==================== CLIENTS CRUD ====================

    clientsAllData: [],

    async loadClientsList() {
        const result = await SupabaseData.getClients();
        if (result.success) {
            this.clientsAllData = result.data;
            this.renderClientsTable(result.data);
        }
    },

    filterClients() {
        const search = (document.getElementById('clients-search')?.value || '').toLowerCase();
        const filtered = this.clientsAllData.filter(c =>
            (c.company_name || '').toLowerCase().includes(search) ||
            (c.contact_name || '').toLowerCase().includes(search) ||
            (c.email || '').toLowerCase().includes(search) ||
            (c.city || '').toLowerCase().includes(search)
        );
        this.renderClientsTable(filtered);
    },

    renderClientsTable(clients) {
        const tbody = document.getElementById('clients-table-body');
        if (!tbody) return;
        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding:40px;text-align:center;color:#999;">Aucun client trouvé</td></tr>';
            return;
        }
        tbody.innerHTML = clients.map(c => `<tr style="border-bottom:1px solid var(--gray-100);">
            <td style="padding:12px 16px;font-weight:600;">${c.company_name || ''}</td>
            <td style="padding:12px 16px;">${c.contact_name || ''}</td>
            <td style="padding:12px 16px;">${c.email || ''}</td>
            <td style="padding:12px 16px;">${c.phone || ''}</td>
            <td style="padding:12px 16px;">${c.city || ''}</td>
            <td style="padding:12px 16px;text-align:center;">
                <button onclick="CRMApp.showEditClientModal(${c.id})" style="background:none;border:none;cursor:pointer;font-size:1rem;" title="Modifier">✏️</button>
                <button onclick="CRMApp.confirmDeleteClient(${c.id})" style="background:none;border:none;cursor:pointer;font-size:1rem;margin-left:8px;" title="Supprimer">🗑️</button>
            </td>
        </tr>`).join('');
    },

    showAddClientModal() { this._showClientModal(); },

    showEditClientModal(id) {
        const client = this.clientsAllData.find(c => c.id === id);
        if (client) this._showClientModal(client);
    },

    _showClientModal(client = null) {
        const isEdit = !!client;
        const c = client || {};
        const existing = document.getElementById('client-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'client-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:white;border-radius:16px;padding:2rem;width:90%;max-width:550px;max-height:90vh;overflow-y:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                    <h3 style="margin:0;font-size:1.25rem;">${isEdit ? 'Modifier le client' : 'Nouveau client'}</h3>
                    <button onclick="document.getElementById('client-modal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>
                </div>
                <div style="display:grid;gap:1rem;">
                    <div>
                        <label style="display:block;font-weight:600;font-size:0.85rem;margin-bottom:4px;">Raison sociale *</label>
                        <input type="text" id="client-company-name" value="${c.company_name || ''}" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-family:inherit;">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <label style="display:block;font-weight:600;font-size:0.85rem;margin-bottom:4px;">Nom du contact</label>
                            <input type="text" id="client-contact-name" value="${c.contact_name || ''}" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-family:inherit;">
                        </div>
                        <div>
                            <label style="display:block;font-weight:600;font-size:0.85rem;margin-bottom:4px;">Email</label>
                            <input type="email" id="client-email" value="${c.email || ''}" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-family:inherit;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <label style="display:block;font-weight:600;font-size:0.85rem;margin-bottom:4px;">Téléphone</label>
                            <input type="text" id="client-phone" value="${c.phone || ''}" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-family:inherit;">
                        </div>
                        <div>
                            <label style="display:block;font-weight:600;font-size:0.85rem;margin-bottom:4px;">Ville</label>
                            <input type="text" id="client-city" value="${c.city || ''}" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-family:inherit;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:2fr 1fr;gap:1rem;">
                        <div>
                            <label style="display:block;font-weight:600;font-size:0.85rem;margin-bottom:4px;">Adresse</label>
                            <input type="text" id="client-address" value="${c.address || ''}" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-family:inherit;">
                        </div>
                        <div>
                            <label style="display:block;font-weight:600;font-size:0.85rem;margin-bottom:4px;">Code postal</label>
                            <input type="text" id="client-postal-code" value="${c.postal_code || ''}" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-family:inherit;">
                        </div>
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;font-size:0.85rem;margin-bottom:4px;">Notes</label>
                        <textarea id="client-notes" rows="3" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-family:inherit;resize:vertical;">${c.notes || ''}</textarea>
                    </div>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:1rem;margin-top:1.5rem;">
                    <button onclick="document.getElementById('client-modal').remove()" style="padding:0.65rem 1.25rem;background:var(--gray-200);border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:600;">Annuler</button>
                    <button onclick="CRMApp.saveClient(${isEdit ? c.id : 'null'})" style="padding:0.65rem 1.25rem;background:var(--primary-green);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:600;">${isEdit ? 'Enregistrer' : 'Créer'}</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    async saveClient(id) {
        const data = {
            company_name: document.getElementById('client-company-name').value.trim(),
            contact_name: document.getElementById('client-contact-name').value.trim(),
            email: document.getElementById('client-email').value.trim(),
            phone: document.getElementById('client-phone').value.trim(),
            address: document.getElementById('client-address').value.trim(),
            postal_code: document.getElementById('client-postal-code').value.trim(),
            city: document.getElementById('client-city').value.trim(),
            notes: document.getElementById('client-notes').value.trim()
        };
        if (!data.company_name) {
            showToast('La raison sociale est obligatoire', 'error');
            return;
        }
        let result;
        if (id) {
            result = await SupabaseData.updateClient(id, data);
        } else {
            result = await SupabaseData.addClient(data);
        }
        if (result.success) {
            // Cascade : mettre a jour les formations liees
            if (id) {
                try {
                    const { data: formations } = await supabaseClient.from('formations').select('id').eq('client_id', id);
                    if (formations && formations.length > 0) {
                        for (const f of formations) {
                            await supabaseClient.from('formations').update({
                                company_name: data.company_name,
                                client_name: data.company_name,
                                company_address: data.address,
                                company_postal_code: [data.postal_code, data.city].filter(Boolean).join(' '),
                                company_director_name: data.contact_name,
                                client_email: data.email,
                            }).eq('id', f.id);
                        }
                    }
                } catch (e) { console.warn('Cascade client:', e); }
            }
            showToast(id ? 'Client mis \u00E0 jour !' : 'Client cr\u00E9\u00E9 !', 'success');
            addNotification('client', id ? `Client modifi\u00E9 \u2014 ${data.company_name}` : `Client cr\u00E9\u00E9 \u2014 ${data.company_name}`);
            document.getElementById('client-modal').remove();
            this.loadClientsList();
        } else {
            showToast('Erreur : ' + result.message, 'error');
        }
    },

    async confirmDeleteClient(id) {
        // Verifier si des formations sont liees
        const { data: linkedFormations } = await supabaseClient.from('formations').select('id').eq('client_id', id);
        if (linkedFormations && linkedFormations.length > 0) {
            showToast(`Impossible de supprimer : ${linkedFormations.length} formation(s) li\u00E9e(s) \u00E0 ce client.`, 'error');
            return;
        }
        const client = this.clientsAllData.find(c => c.id === id);
        const confirmed = await showConfirmDialog({
            title: 'Supprimer le client',
            message: `Voulez-vous vraiment supprimer "${client?.company_name || ''}" ?`,
            confirmText: 'Supprimer',
            isDangerous: true
        });
        if (confirmed) {
            const result = await SupabaseData.deleteClient(id);
            if (result.success) {
                showToast('Client supprimé', 'success');
                this.loadClientsList();
            } else {
                showToast('Erreur suppression : ' + result.message, 'error');
            }
        }
    },

    // ==================== SOUS-TRAITANTS ====================

    subcontractorsAllData: [],

    async loadSubcontractorsList() {
        const result = await SupabaseData.getSubcontractors();
        if (result.success) {
            this.subcontractorsAllData = result.data;
            this.renderSubcontractorsTable(result.data);
        }
    },

    filterSubcontractors() {
        const search = (document.getElementById('subcontractors-search')?.value || '').toLowerCase();
        const filtered = this.subcontractorsAllData.filter(s =>
            (s.first_name || '').toLowerCase().includes(search) ||
            (s.last_name || '').toLowerCase().includes(search) ||
            (s.email || '').toLowerCase().includes(search) ||
            (s.company || '').toLowerCase().includes(search)
        );
        this.renderSubcontractorsTable(filtered);
    },

    renderSubcontractorsTable(subs) {
        const tbody = document.getElementById('subcontractors-table-body');
        if (!tbody) return;
        if (subs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding:40px;text-align:center;color:#999;">Aucun sous-traitant</td></tr>';
            return;
        }
        tbody.innerHTML = subs.map(s => '<tr style="border-bottom:1px solid var(--gray-100);">' +
            '<td style="padding:12px 16px;font-weight:600;">' + (s.first_name || '') + ' ' + (s.last_name || '') + '</td>' +
            '<td style="padding:12px 16px;">' + (s.email || '') + '</td>' +
            '<td style="padding:12px 16px;">' + (s.phone || '') + '</td>' +
            '<td style="padding:12px 16px;">' + (s.address || '') + '</td>' +
            '<td style="padding:12px 16px;">' + (s.siret || '') + '</td>' +
            '<td style="padding:12px 16px;text-align:center;">' +
                '<button onclick="CRMApp.showEditSubcontractorModal(' + s.id + ')" style="background:none;border:none;cursor:pointer;font-size:1rem;" title="Modifier">\u270F\uFE0F</button>' +
                '<button onclick="CRMApp.confirmDeleteSubcontractor(' + s.id + ')" style="background:none;border:none;cursor:pointer;font-size:1rem;margin-left:8px;" title="Supprimer">\uD83D\uDDD1\uFE0F</button>' +
            '</td>' +
        '</tr>').join('');
    },

    showAddSubcontractorModal() { this._showSubcontractorModal(); },

    showEditSubcontractorModal(id) {
        const sub = this.subcontractorsAllData.find(s => s.id === id);
        if (sub) this._showSubcontractorModal(sub);
    },

    _showSubcontractorModal(sub) {
        const existing = document.getElementById('subcontractor-modal');
        if (existing) existing.remove();

        const isEdit = !!sub;
        const s = sub || {};
        const modal = document.createElement('div');
        modal.id = 'subcontractor-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:50000;';
        modal.innerHTML = '<div style="background:white;padding:2rem;border-radius:var(--radius-xl);max-width:600px;width:95%;max-height:90vh;overflow-y:auto;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;border-bottom:1px solid var(--gray-200);padding-bottom:1rem;">' +
                '<h3 style="font-size:1.25rem;font-weight:700;">' + (isEdit ? 'Modifier le sous-traitant' : 'Nouveau sous-traitant') + '</h3>' +
                '<button onclick="document.getElementById(\'subcontractor-modal\').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">' +
                '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">Pr\u00E9nom *</label><input type="text" id="sub-first-name" value="' + (s.first_name || '') + '" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);"></div>' +
                '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">Nom *</label><input type="text" id="sub-last-name" value="' + (s.last_name || '') + '" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);"></div>' +
                '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">Email</label><input type="email" id="sub-email" value="' + (s.email || '') + '" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);"></div>' +
                '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">T\u00E9l\u00E9phone</label><input type="text" id="sub-phone" value="' + (s.phone || '') + '" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);"></div>' +
                '<div style="grid-column:span 2;"><label style="display:block;font-weight:500;margin-bottom:0.25rem;">Adresse</label><input type="text" id="sub-address" value="' + (s.address || '') + '" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);"></div>' +
                '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">SIRET</label><input type="text" id="sub-siret" value="' + (s.siret || '') + '" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);"></div>' +
                '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">N\u00B0 activit\u00E9 (NDA)</label><input type="text" id="sub-nda" value="' + (s.nda || '') + '" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);"></div>' +
                '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">Entreprise</label><input type="text" id="sub-company" value="' + (s.company || '') + '" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);"></div>' +
                '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">Notes</label><input type="text" id="sub-notes" value="' + (s.notes || '') + '" style="width:100%;padding:0.65rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);"></div>' +
            '</div>' +
            '<div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">' +
                '<button onclick="document.getElementById(\'subcontractor-modal\').remove()" style="padding:0.75rem 1.5rem;background:var(--gray-200);color:var(--gray-700);border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">Annuler</button>' +
                '<button onclick="CRMApp.saveSubcontractor(' + (s.id || 'null') + ')" style="padding:0.75rem 1.5rem;background:var(--primary-orange);color:white;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">' + (isEdit ? 'Mettre \u00E0 jour' : 'Cr\u00E9er') + '</button>' +
            '</div>' +
        '</div>';
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    },

    async saveSubcontractor(id) {
        const data = {
            first_name: document.getElementById('sub-first-name').value.trim(),
            last_name: document.getElementById('sub-last-name').value.trim(),
            email: document.getElementById('sub-email').value.trim(),
            phone: document.getElementById('sub-phone').value.trim(),
            address: document.getElementById('sub-address').value.trim(),
            siret: document.getElementById('sub-siret').value.trim(),
            nda: document.getElementById('sub-nda').value.trim(),
            company: document.getElementById('sub-company').value.trim(),
            notes: document.getElementById('sub-notes').value.trim(),
        };
        if (!data.first_name || !data.last_name) {
            showToast('Pr\u00E9nom et nom sont obligatoires', 'error');
            return;
        }
        let result;
        if (id) {
            result = await SupabaseData.updateSubcontractor(id, data);
        } else {
            result = await SupabaseData.addSubcontractor(data);
        }
        if (result.success) {
            // Cascade : mettre a jour les formations liees
            if (id) {
                try {
                    const { data: formations } = await supabaseClient.from('formations').select('id').eq('subcontractor_id', id);
                    if (formations && formations.length > 0) {
                        for (const f of formations) {
                            await supabaseClient.from('formations').update({
                                subcontractor_first_name: data.first_name,
                                subcontractor_last_name: data.last_name,
                                subcontractor_address: data.address,
                                subcontractor_siret: data.siret,
                                subcontractor_nda: data.nda,
                            }).eq('id', f.id);
                        }
                    }
                } catch (e) { console.warn('Cascade sous-traitant:', e); }
            }
            showToast(id ? 'Sous-traitant mis \u00E0 jour' : 'Sous-traitant cr\u00E9\u00E9', 'success');
            document.getElementById('subcontractor-modal')?.remove();
            this.loadSubcontractorsList();
        } else {
            showToast('Erreur: ' + result.message, 'error');
        }
    },

    async confirmDeleteSubcontractor(id) {
        // Verifier si des formations sont liees
        const { data: linkedFormations } = await supabaseClient.from('formations').select('id').eq('subcontractor_id', id);
        if (linkedFormations && linkedFormations.length > 0) {
            showToast(`Impossible de supprimer : ${linkedFormations.length} formation(s) li\u00E9e(s) \u00E0 ce sous-traitant.`, 'error');
            return;
        }
        const sub = this.subcontractorsAllData.find(s => s.id === id);
        const name = sub ? (sub.first_name + ' ' + sub.last_name) : '';
        const confirmed = await showConfirmDialog({
            title: 'Supprimer le sous-traitant',
            message: 'Voulez-vous vraiment supprimer "' + name + '" ?',
            confirmText: 'Supprimer',
            isDangerous: true
        });
        if (confirmed) {
            const result = await SupabaseData.deleteSubcontractor(id);
            if (result.success) {
                showToast('Sous-traitant supprim\u00E9', 'success');
                this.loadSubcontractorsList();
            } else {
                showToast('Erreur: ' + result.message, 'error');
            }
        }
    },

    // ==================== FORMATEUR VIEW ====================

    async initFormateurView(user) {
        this.currentUser = user;
        window.currentUserRole = 'formateur';
        this.setupFormateurNavigation();
        await this.loadMissions();
        this.showPage('missions');
    },

    async loadFormateurContracts() {
        const container = document.getElementById('formateur-contracts-list');
        if (!container) return;

        const result = await SupabaseData.getFormationsByFormateur(this.currentUser.id);
        if (!result.success) {
            container.innerHTML = '<p style="color:var(--danger);padding:1rem;">Erreur de chargement</p>';
            return;
        }

        const formations = result.data || [];
        if (formations.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:2rem;">Aucun contrat pour le moment.</p>';
            return;
        }

        container.innerHTML = formations.map(f => {
            const isSigned = !!f.subcontractor_signed_at;
            const signedDate = isSigned ? new Date(f.subcontractor_signed_at).toLocaleDateString('fr-FR') : null;
            const docs = f.formation_documents || [];
            const hasContract = docs.some(d => d.type === 'contrat_sous_traitance');
            const dates = f.start_date ? new Date(f.start_date).toLocaleDateString('fr-FR') : '';

            return `
                <div style="background:white;border-radius:var(--radius-xl);padding:1.5rem;box-shadow:var(--shadow-sm);margin-bottom:1rem;border:2px solid ${isSigned ? '#6ee7b7' : 'var(--gray-200)'};">
                    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;">
                        <div style="flex:1;min-width:220px;">
                            <h3 style="font-size:1.1rem;font-weight:700;color:var(--gray-900);margin:0 0 0.35rem 0;">${f.formation_name || 'Formation'}</h3>
                            <p style="color:var(--gray-600);margin:0;font-size:0.85rem;">${f.company_name || f.client_name || ''} ${dates ? ' • ' + dates : ''}</p>
                        </div>
                        ${isSigned ? `
                            <span style="padding:0.35rem 0.8rem;background:#d1fae5;color:#065f46;border-radius:9999px;font-size:0.8rem;font-weight:600;">✅ Signé le ${signedDate}</span>
                        ` : `
                            <span style="padding:0.35rem 0.8rem;background:#fef3c7;color:#92400e;border-radius:9999px;font-size:0.8rem;font-weight:600;">⏳ En attente de signature</span>
                        `}
                    </div>
                    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                        ${hasContract ? `
                            <button onclick="CRMApp.openDocument(${f.id}, 'contrat_sous_traitance')" style="padding:0.6rem 1.25rem;background:white;color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);font-weight:500;cursor:pointer;">
                                📄 Voir le contrat
                            </button>
                        ` : `
                            <p style="color:var(--gray-500);font-size:0.85rem;font-style:italic;margin:0;padding:0.6rem 0;">Le contrat sera disponible prochainement.</p>
                        `}
                        ${hasContract && !isSigned ? `
                            <button onclick="CRMApp.openSignatureModal('subcontractor', ${f.id})" style="padding:0.6rem 1.5rem;background:var(--primary-pink);color:white;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">
                                ✍️ Signer le contrat
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
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
                'planned': { bg: '#dbeafe', color: '#1e40af', text: 'Planifiée' },
                'awaiting_prealable': { bg: '#f3e8ff', color: '#6b21a8', text: '⏳ Préalable en attente' }
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
                        <button onclick="CRMApp.openFormateurFormation(${f.id})"
                            style="padding: 0.5rem 1rem; background: var(--primary-purple); color: white; border: none; border-radius: var(--radius-md); font-weight: 500; cursor: pointer; font-size: 0.875rem;">
                            Ouvrir
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
            showToast('Formation non trouvée', 'error');
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
                    'fiche_pedagogique': { icon: '📝', label: 'Fiche pédagogique', color: '#ea580c' },
                    'google_doc': { icon: '📝', label: 'Fiche pédagogique', color: '#ea580c' },
                    'convention': { icon: '📄', label: 'Convention', color: '#7c3aed' },
                    'attendance_sheet': { icon: '📋', label: 'Feuille de présence', color: '#059669' },
                    'certificate': { icon: '🏅', label: 'Certificat / Attestation', color: '#dc2626' },
                    'program': { icon: '📚', label: 'Programme', color: '#0284c7' },
                    'convocation': { icon: '📨', label: 'Convocation', color: '#ea580c' },
                    'contrat_sous_traitance': { icon: '📝', label: 'Contrat sous-traitance', color: '#b45309' }
                };
                const docType = docTypes[doc.type] || { icon: '📑', label: doc.type || 'Document', color: '#0284c7' };

                // Types de documents régénérables localement (pas besoin d'URL externe)
                const regenerableTypes = ['fiche_pedagogique', 'google_doc', 'convention', 'contrat_sous_traitance', 'attendance_sheet', 'certificate'];
                const canRegenerate = regenerableTypes.includes(doc.type);

                // Tous les documents de type connu sont régénérés à la volée
                let onClickAttr = '';
                if (canRegenerate) {
                    onClickAttr = `event.preventDefault(); CRMApp.openDocument(${formation.id}, '${doc.type}')`;
                } else {
                    const docUrl = doc.document_url || doc.url || '';
                    if (!docUrl || docUrl === '#' || docUrl.startsWith('generate://')) {
                        onClickAttr = `event.preventDefault(); showToast('Document non disponible', 'warning')`;
                    }
                }

                const displayUrl = canRegenerate ? '#' : (toPdfUrl(doc.document_url || doc.url || '') || '#');

                return `
                    <a href="${displayUrl}" ${canRegenerate ? '' : 'target="_blank" rel="noopener noreferrer"'}
                       style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: var(--gray-50); border-radius: var(--radius-md); text-decoration: none; color: var(--gray-900); margin-bottom: 0.5rem; transition: background 0.2s; cursor: pointer;"
                       onmouseover="this.style.background='var(--gray-100)'" onmouseout="this.style.background='var(--gray-50)'"
                       ${onClickAttr ? `onclick="${onClickAttr}"` : ''}>
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
                                    <span style="padding: 0.25rem 0.75rem; background: ${formation.status === 'completed' ? '#d1fae5' : formation.status === 'in_progress' ? '#fef3c7' : formation.status === 'awaiting_prealable' ? '#f3e8ff' : '#dbeafe'}; color: ${formation.status === 'completed' ? '#065f46' : formation.status === 'in_progress' ? '#92400e' : formation.status === 'awaiting_prealable' ? '#6b21a8' : '#1e40af'}; border-radius: 9999px; font-size: 0.875rem; font-weight: 500;">
                                        ${formation.status === 'completed' ? 'Terminée' : formation.status === 'in_progress' ? 'En cours' : formation.status === 'awaiting_prealable' ? '⏳ Préalable en attente' : 'Planifiée'}
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
                        <div id="formateur-docs-list"></div>
                        <div style="margin-top: 1rem; border-top: 1px solid var(--gray-200); padding-top: 1rem;">
                            <h3 style="font-size: 0.875rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 0.75rem;">Documents permanents</h3>
                            <a href="assets/static/livret-accueil.pdf" target="_blank" style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 1rem;background:var(--gray-50);border-radius:var(--radius-md);text-decoration:none;color:var(--gray-900);margin-bottom:0.4rem;cursor:pointer;">
                                <span style="font-size:1.25rem;">📖</span><div style="font-weight:500;font-size:0.9rem;">Livret d'accueil NJM Conseil</div>
                            </a>
                            <a href="assets/static/fiche-reclamation.pdf" target="_blank" style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 1rem;background:var(--gray-50);border-radius:var(--radius-md);text-decoration:none;color:var(--gray-900);margin-bottom:0.4rem;cursor:pointer;">
                                <span style="font-size:1.25rem;">📋</span><div style="font-weight:500;font-size:0.9rem;">Fiche de réclamation</div>
                            </a>
                        </div>
                        <div id="formateur-contrat-section" style="margin-top: 1rem; border-top: 1px solid var(--gray-200); padding-top: 1rem;">
                            <h3 style="font-size: 0.875rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 0.75rem;">Contrat de sous-traitance</h3>
                            <div id="formateur-contrat-content"></div>
                        </div>
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

        // Remplir les documents formateur dynamiquement
        const docsListEl = document.getElementById('formateur-docs-list');
        if (docsListEl) {
            const formDocs = (formation.formation_documents || []).filter(d => d.type !== 'contrat_sous_traitance');
            if (formDocs.length === 0) {
                docsListEl.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:1rem;">Aucun document disponible</p>';
            } else {
                const docTypeMap = {
                    fiche_pedagogique: { icon: '\uD83D\uDCDD', label: 'Fiche p\u00E9dagogique', color: '#ea580c' },
                    google_doc: { icon: '\uD83D\uDCDD', label: 'Fiche p\u00E9dagogique', color: '#ea580c' },
                    convention: { icon: '\uD83D\uDCC4', label: 'Convention', color: '#7c3aed' },
                    attendance_sheet: { icon: '\uD83D\uDCCB', label: 'Feuille de pr\u00E9sence', color: '#059669' },
                    certificate: { icon: '\uD83C\uDFC5', label: 'Certificat / Attestation', color: '#dc2626' },
                };
                docsListEl.innerHTML = formDocs.map(doc => {
                    const dt = docTypeMap[doc.type] || { icon: '\uD83D\uDCD1', label: doc.type, color: '#0284c7' };
                    return '<a href="#" onclick="event.preventDefault(); CRMApp.openDocument(' + formation.id + ', \'' + doc.type + '\')" style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:var(--gray-50);border-radius:var(--radius-md);text-decoration:none;color:var(--gray-900);margin-bottom:0.5rem;cursor:pointer;"><span style="font-size:1.5rem;">' + dt.icon + '</span><div style="flex:1;"><div style="font-weight:500;">' + (doc.name || dt.label) + '</div><div style="font-size:0.75rem;color:' + dt.color + ';">' + dt.label + '</div></div></a>';
                }).join('');
            }
        }

        // Remplir la section contrat
        const contratEl = document.getElementById('formateur-contrat-content');
        if (contratEl) {
            const contrat = (formation.formation_documents || []).find(d => d.type === 'contrat_sous_traitance');
            if (contrat) {
                contratEl.innerHTML = '<a href="#" onclick="event.preventDefault(); CRMApp.openDocument(' + formation.id + ', \'contrat_sous_traitance\')" style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:var(--gray-50);border-radius:var(--radius-md);text-decoration:none;color:var(--gray-900);cursor:pointer;"><span style="font-size:1.5rem;">\uD83D\uDCDD</span><div style="flex:1;"><div style="font-weight:500;">' + (contrat.name || 'Contrat sous-traitance') + '</div><div style="font-size:0.75rem;color:#b45309;">Contrat sous-traitance</div></div></a>';
            } else {
                contratEl.innerHTML = '<p style="color:var(--gray-400);font-size:0.85rem;padding:0.5rem;">Contrat non encore g\u00E9n\u00E9r\u00E9 par l\'administratrice.</p>';
            }
        }
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

    // ==================== FORMATEUR — FICHE FORMATION DÉDIÉE ====================

    openFormateurFormation(formationId) {
        this.showPage('formation-detail-formateur');
        // Deselect sidebar items
        const formateurNav = document.getElementById('formateur-nav');
        if (formateurNav) formateurNav.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        this.showFormateurFormationDetail(formationId);
    },

    async showFormateurFormationDetail(formationId) {
        const container = document.getElementById('formateur-formation-detail-content');
        if (!container) return;
        container.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:3rem;">Chargement...</p>';

        try {
            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*, formation_documents(*)')
                .eq('id', formationId)
                .single();
            if (error) throw error;

            // Logs de communication
            const convocResult = await SupabaseData.getConvocationLogs(formationId);
            const convocLogs = convocResult.success ? convocResult.data : [];

            // Questionnaires attribués
            const questResult = await SupabaseData.getFormationQuestionnaires(formationId);
            const formationQuests = questResult.success ? questResult.data : [];

            const docs = formation.formation_documents || [];
            const hasDoc = (type) => docs.some(d => d.type === type || (type === 'fiche_pedagogique' && d.type === 'google_doc'));

            const startDate = formation.start_date ? new Date(formation.start_date).toLocaleDateString('fr-FR') : 'N/A';
            const endDate = formation.end_date ? new Date(formation.end_date).toLocaleDateString('fr-FR') : 'N/A';
            const learnersData = typeof formation.learners_data === 'string' ? JSON.parse(formation.learners_data || '[]') : (formation.learners_data || []);

            const hasPrealable = formation.prealable_recu === true;
            const hasFichePeda = hasDoc('fiche_pedagogique');
            const hasConvention = hasDoc('convention');
            const hasContratST = hasDoc('contrat_sous_traitance');
            const hasAttendance = hasDoc('attendance_sheet');
            const hasCertificate = hasDoc('certificate');
            const hasConvocation = convocLogs.length > 0;
            const learnersCount = learnersData.length;

            let hasClientAccount = false;
            if (formation.client_email) {
                const profileCheck = await SupabaseData.getProfileByEmail(formation.client_email);
                hasClientAccount = profileCheck.success && profileCheck.data;
            }

            const statusLabels = {
                'planned': { text: 'Planifiée', bg: '#dbeafe', color: '#1e40af' },
                'in_progress': { text: 'En cours', bg: '#fef3c7', color: '#92400e' },
                'completed': { text: 'Terminée', bg: '#d1fae5', color: '#065f46' },
                'cancelled': { text: 'Annulée', bg: '#fee2e2', color: '#dc2626' },
                'awaiting_prealable': { text: 'Préalable en attente', bg: '#f3e8ff', color: '#6b21a8' }
            };
            const st = statusLabels[formation.status] || statusLabels['planned'];

            // Phase item helper — version formateur (lecture seule ou action)
            const phaseItem = (done, label, primary, secondary) => {
                const checkIcon = done ? '✅' : '□';
                const checkColor = done ? '#059669' : 'var(--gray-400)';
                const labelColor = done ? 'var(--gray-600)' : 'var(--gray-900)';
                const textDecor = done ? 'text-decoration:line-through;' : '';
                return `
                    <div style="padding:0.75rem 0;border-bottom:1px solid var(--gray-100);">
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:${primary || secondary ? '0.5rem' : '0'};">
                            <span style="font-size:1rem;color:${checkColor};">${checkIcon}</span>
                            <span style="font-size:0.9rem;font-weight:500;color:${labelColor};${textDecor}">${label}</span>
                        </div>
                        ${(primary || secondary) ? `<div style="display:flex;gap:0.4rem;flex-wrap:wrap;padding-left:1.5rem;">
                            ${primary ? `<button onclick="${primary.action}" style="padding:0.35rem 0.75rem;background:${primary.bg || 'var(--primary-pink)'};color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-size:0.8rem;font-weight:500;">${primary.label}</button>` : ''}
                            ${secondary ? `<button onclick="${secondary.action}" style="padding:0.35rem 0.75rem;background:var(--gray-100);color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);cursor:pointer;font-size:0.8rem;">${secondary.label}</button>` : ''}
                        </div>` : ''}
                    </div>`;
            };

            // Questionnaires envoyables (satisfaction + evaluation_acquis)
            const sendableQuests = formationQuests.filter(fq => {
                const q = fq.questionnaires;
                return q && (q.category === 'satisfaction' || q.category === 'evaluation_acquis');
            });

            const questItemsHtml = sendableQuests.length > 0 ? sendableQuests.map(fq => {
                const q = fq.questionnaires;
                const catLabel = this._categoryLabels[q.category] || q.category;
                const catColor = this._categoryColors[q.category] || '#6b7280';
                const sentInfo = fq.sent_at
                    ? `<span style="color:#059669;font-weight:500;font-size:0.75rem;">Envoyé le ${new Date(fq.sent_at).toLocaleDateString('fr-FR')}</span>`
                    : `<button onclick="CRMApp.sendQuestionnaireToLearners(${formationId}, ${q.id})" style="padding:0.3rem 0.6rem;background:var(--primary-pink);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-size:0.75rem;font-weight:500;">Envoyer</button>`;
                return `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;">
                    <span style="padding:0.1rem 0.4rem;border-radius:8px;font-size:0.7rem;background:${catColor}15;color:${catColor};">${catLabel}</span>
                    <span style="font-size:0.85rem;color:var(--gray-800);flex:1;">${q.title}</span>
                    ${sentInfo}
                </div>`;
            }).join('') : '<p style="font-size:0.8rem;color:var(--gray-400);margin:0;padding-left:1.5rem;">Aucun questionnaire attribué — <a href="#" onclick="event.preventDefault();CRMApp.showAssignQuestionnaireModal('+formationId+')" style="color:var(--primary-pink);">attribuer</a></p>';

            // Documents client visibles (lecture seule)
            const clientDocTypes = {
                'fiche_pedagogique': '📝', 'google_doc': '📝',
                'convention': '📄', 'attendance_sheet': '📋',
                'certificate': '🏅', 'manual': '📎'
            };
            const clientVisibleDocs = docs.filter(d => d.type !== 'contrat_sous_traitance');

            container.innerHTML = `
                <!-- HEADER -->
                <div style="margin-bottom:1.5rem;">
                    <button onclick="CRMApp.showPage('missions'); document.querySelector('#formateur-nav .nav-item[data-page=missions]')?.classList.add('active');" style="background:none;border:none;cursor:pointer;color:var(--primary-purple);font-weight:500;margin-bottom:0.5rem;padding:0;font-size:0.9rem;">← Retour aux missions</button>
                    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
                        <div>
                            <h2 style="font-size:1.4rem;font-weight:700;color:var(--gray-900);margin:0;">${formation.formation_name || 'Formation'}</h2>
                            <p style="color:var(--gray-500);font-size:0.9rem;margin:0.25rem 0 0 0;">
                                ${formation.company_name || formation.client_name || 'Client'} &bull;
                                ${formation.custom_dates || (startDate + (startDate !== endDate ? ' - ' + endDate : ''))} &bull;
                                ${formation.training_location || ''} &bull;
                                ${learnersCount} apprenant(s) &bull;
                                ${formation.hours_per_learner || 0}h
                            </p>
                        </div>
                        <span style="padding:0.35rem 0.8rem;background:${st.bg};color:${st.color};border-radius:9999px;font-size:0.85rem;font-weight:600;">${st.text}</span>
                    </div>
                </div>

                <!-- 3 PHASES -->
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:1rem;margin-bottom:1.5rem;">
                    <!-- ① Préparer (lecture seule) -->
                    <div style="background:white;border-radius:var(--radius-xl);padding:1.25rem;box-shadow:var(--shadow-sm);border-top:3px solid #3b82f6;">
                        <h3 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">① Préparer</h3>
                        ${phaseItem(
                            hasPrealable,
                            hasPrealable ? 'Préalable reçu (' + learnersCount + ' apprenant' + (learnersCount > 1 ? 's' : '') + ')' : 'Préalable — en attente'
                        )}
                        ${phaseItem(
                            hasFichePeda,
                            'Fiche pédagogique',
                            hasFichePeda ? { label: 'Ouvrir', action: "CRMApp.openDocument(" + formationId + ", 'fiche_pedagogique')", bg: 'var(--gray-500)' } : null
                        )}
                        ${phaseItem(
                            hasConvention && !!formation.client_signed_at,
                            hasConvention
                                ? (formation.client_signed_at
                                    ? 'Convention — <span style="color:#059669;font-weight:600;">Signée le ' + new Date(formation.client_signed_at).toLocaleDateString('fr-FR') + '</span>'
                                    : 'Convention — <span style="color:#d97706;font-weight:600;">En attente signature client</span>')
                                : 'Convention — non créée',
                            hasConvention ? { label: 'Ouvrir', action: "CRMApp.openDocument(" + formationId + ", 'convention')", bg: 'var(--gray-500)' } : null
                        )}
                        ${phaseItem(hasConvocation, hasConvocation ? 'Convocation envoyée' : 'Convocation — non envoyée')}
                        ${phaseItem(
                            hasContratST && !!formation.subcontractor_signed_at,
                            hasContratST
                                ? (formation.subcontractor_signed_at
                                    ? 'Contrat sous-traitance — <span style="color:#059669;font-weight:600;">Signé le ' + new Date(formation.subcontractor_signed_at).toLocaleDateString('fr-FR') + '</span>'
                                    : 'Contrat sous-traitance — <span style="color:#d97706;font-weight:600;">En attente signature</span>')
                                : 'Contrat sous-traitance — non créé',
                            hasContratST ? { label: 'Ouvrir', action: "CRMApp.openDocument(" + formationId + ", 'contrat_sous_traitance')", bg: 'var(--gray-500)' } : null,
                            hasContratST && !formation.subcontractor_signed_at ? { label: 'Signer', action: "CRMApp.openSignatureModal('subcontractor', " + formationId + ")" } : null
                        )}
                    </div>

                    <!-- ② Pendant -->
                    <div style="background:white;border-radius:var(--radius-xl);padding:1.25rem;box-shadow:var(--shadow-sm);border-top:3px solid #f59e0b;">
                        <h3 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">② Pendant</h3>
                        ${phaseItem(
                            hasAttendance,
                            'Feuille de présence',
                            { label: hasAttendance ? 'Ouvrir' : 'Créer', action: hasAttendance ? "CRMApp.openDocument(" + formationId + ", 'attendance_sheet')" : "CRMApp.createAttendanceSheet(" + formationId + ")" }
                        )}
                        ${phaseItem(
                            hasClientAccount,
                            hasClientAccount ? 'Accès client — actif' : 'Accès client — non créé'
                        )}
                    </div>

                    <!-- ③ Clôturer -->
                    <div style="background:white;border-radius:var(--radius-xl);padding:1.25rem;box-shadow:var(--shadow-sm);border-top:3px solid #059669;">
                        <h3 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">③ Clôturer</h3>

                        <div style="padding:0.75rem 0;border-bottom:1px solid var(--gray-100);">
                            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
                                <span style="font-size:1rem;color:${sendableQuests.every(fq => fq.sent_at) && sendableQuests.length > 0 ? '#059669' : 'var(--gray-400)'};">${sendableQuests.every(fq => fq.sent_at) && sendableQuests.length > 0 ? '✅' : '□'}</span>
                                <span style="font-size:0.9rem;font-weight:500;color:var(--gray-900);">Questionnaires évaluation + satisfaction</span>
                            </div>
                            <div style="padding-left:1.5rem;">
                                ${questItemsHtml}
                            </div>
                        </div>

                        ${phaseItem(
                            hasCertificate,
                            'Certificat + Attestation',
                            { label: hasCertificate ? 'Ouvrir' : 'Créer', action: hasCertificate ? "CRMApp.openDocument(" + formationId + ", 'certificate')" : "CRMApp.createCertificate(" + formationId + ")" }
                        )}
                        ${phaseItem(
                            false,
                            'Bilan de formation',
                            { label: 'Télécharger', action: "window.open('assets/static/bilan-formation.docx', '_blank')", bg: 'var(--gray-500)' }
                        )}
                        ${phaseItem(
                            false,
                            'Mail fin de formation',
                            { label: 'Envoyer', action: "CRMApp.sendMailFinFormation(" + formationId + ")" }
                        )}
                    </div>
                </div>

                <!-- ESPACE CLIENT (lecture seule) -->
                <div style="background:white;border-radius:var(--radius-xl);padding:1.5rem;box-shadow:var(--shadow-sm);margin-bottom:1.5rem;">
                    <h3 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">👁 Espace client — Ce que voit le client</h3>
                    <div style="display:grid;gap:0.5rem;">
                        ${clientVisibleDocs.length === 0 ? '<p style="color:var(--gray-500);font-size:0.9rem;">Aucun document visible</p>' :
                            clientVisibleDocs.map(doc => {
                                const typeLabels = { 'fiche_pedagogique': 'Fiche pédagogique', 'google_doc': 'Fiche pédagogique', 'convention': 'Convention', 'attendance_sheet': 'Feuille de présence', 'certificate': 'Certificat', 'manual': 'Document' };
                                const icon = clientDocTypes[doc.type] || '📄';
                                const visible = doc.visible_client !== false;
                                return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;background:var(--gray-50);border-radius:var(--radius-md);border:1px solid var(--gray-200);">' +
                                    '<span style="font-size:0.9rem;color:var(--gray-800);display:flex;align-items:center;gap:0.5rem;">' +
                                        '<span style="font-size:1.1rem;">' + icon + '</span> ' +
                                        (doc.name || typeLabels[doc.type] || doc.type) +
                                    '</span>' +
                                    '<span style="font-size:0.75rem;color:' + (visible ? '#059669' : '#dc2626') + ';font-weight:500;">' + (visible ? '👁 Visible' : '🔒 Masqué') + '</span>' +
                                '</div>';
                            }).join('')
                        }
                    </div>
                </div>

                <!-- COMMUNICATIONS -->
                <div style="background:white;border-radius:var(--radius-xl);padding:1.5rem;box-shadow:var(--shadow-sm);margin-bottom:1.5rem;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
                        <h3 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0;">✉️ Communications (${convocLogs.length})</h3>
                        <button onclick="CRMApp.sendMailLibre(${formationId})" style="padding:0.45rem 1rem;background:var(--primary-pink);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:600;font-size:0.85rem;">
                            ✉️ Envoyer un mail
                        </button>
                    </div>
                    ${convocLogs.length === 0 ? '<p style="color:var(--gray-500);font-size:0.9rem;">Aucun email envoyé</p>' :
                        '<div style="display:grid;gap:0.5rem;">' +
                            convocLogs.map(log =>
                                '<div style="padding:0.65rem 0.85rem;background:var(--gray-50);border-radius:var(--radius-md);border-left:3px solid var(--primary-pink);">' +
                                    '<div style="font-size:0.85rem;font-weight:500;color:var(--gray-900);">' + (log.subject || 'Mail') + '</div>' +
                                    '<div style="font-size:0.75rem;color:var(--gray-500);margin-top:0.15rem;">' + new Date(log.sent_at || log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' — ' + log.sent_to + '</div>' +
                                '</div>'
                            ).join('') +
                        '</div>'
                    }
                </div>

                <!-- QUESTIONNAIRES ATTRIBUÉS -->
                <div style="background:white;border-radius:var(--radius-xl);padding:1.5rem;box-shadow:var(--shadow-sm);margin-bottom:1.5rem;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
                        <h3 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0;">📝 Questionnaires attribués</h3>
                        <button onclick="CRMApp.showAssignQuestionnaireModal(${formationId})" style="padding:0.35rem 0.85rem;background:var(--primary-orange);color:white;border:none;border-radius:var(--radius-md);font-size:0.8rem;font-weight:600;cursor:pointer;">+ Attribuer</button>
                    </div>
                    <div id="formateur-formation-questionnaires-list" style="display:grid;gap:0.5rem;">
                        <p style="color:var(--gray-400);font-size:0.85rem;">Chargement...</p>
                    </div>
                </div>

                <!-- SUPPORTS PÉDAGOGIQUES -->
                <div style="background:white;border-radius:var(--radius-xl);padding:1.5rem;box-shadow:var(--shadow-sm);">
                    <h3 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">📚 Supports pédagogiques</h3>
                    <div id="formateur-formation-supports-list" style="margin-top:0.5rem;">
                        <p style="color:var(--gray-400);font-size:0.85rem;">Chargement...</p>
                    </div>
                </div>
            `;

            // Charger questionnaires attribués
            this._loadFormateurFormationQuestionnaires(formationId);

            // Charger supports
            this.loadFormationSupports(formationId, 'formateur-formation-supports-list');

        } catch (err) {
            console.error('Erreur showFormateurFormationDetail:', err);
            container.innerHTML = '<p style="color:#dc2626;text-align:center;padding:2rem;">Erreur de chargement: ' + err.message + '</p>';
        }
    },

    async _loadFormateurFormationQuestionnaires(formationId) {
        const container = document.getElementById('formateur-formation-questionnaires-list');
        if (!container) return;

        const result = await SupabaseData.getFormationQuestionnaires(formationId);
        if (!result.success || result.data.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-400);font-size:0.85rem;">Aucun questionnaire attribué</p>';
            return;
        }

        container.innerHTML = result.data.map(fq => {
            const q = fq.questionnaires;
            if (!q) return '';
            const color = this._categoryColors[q.category] || '#6b7280';
            const label = this._categoryLabels[q.category] || q.category;
            const sentInfo = fq.sent_at
                ? '<span style="font-size:0.75rem;color:#059669;font-weight:500;">Envoyé le ' + new Date(fq.sent_at).toLocaleDateString('fr-FR') + '</span>'
                : '<span style="font-size:0.75rem;color:var(--gray-500);">Non envoyé</span>';

            return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;background:var(--gray-50);border-radius:var(--radius-md);border:1px solid var(--gray-200);">' +
                '<div style="display:flex;align-items:center;gap:0.75rem;flex:1;">' +
                    '<span style="display:inline-block;padding:0.15rem 0.5rem;border-radius:12px;font-size:0.7rem;font-weight:500;background:' + color + '15;color:' + color + ';">' + label + '</span>' +
                    '<span style="font-size:0.9rem;color:var(--gray-800);">' + q.title + '</span>' +
                    sentInfo +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:0.5rem;">' +
                    '<a href="' + q.url + '" target="_blank" rel="noopener" style="padding:0.3rem 0.6rem;background:' + color + ';color:white;border:none;border-radius:var(--radius-md);font-size:0.75rem;cursor:pointer;text-decoration:none;">Ouvrir</a>' +
                    (!fq.sent_at && (q.category === 'satisfaction' || q.category === 'evaluation_acquis') ? '<button onclick="CRMApp.sendQuestionnaireToLearners(' + formationId + ', ' + q.id + ')" style="padding:0.3rem 0.6rem;background:var(--primary-pink);color:white;border:none;border-radius:var(--radius-md);font-size:0.75rem;cursor:pointer;">Envoyer</button>' : '') +
                    '<button onclick="CRMApp.removeFormationQuestionnaire(' + formationId + ', ' + q.id + ')" style="padding:0.3rem 0.55rem;background:white;color:#dc2626;border:1px solid #fca5a5;border-radius:var(--radius-md);cursor:pointer;font-size:0.8rem;">Retirer</button>' +
                '</div>' +
            '</div>';
        }).join('');
    },

    // ==================== END FORMATEUR VIEW ====================

    // ==================== CLIENT VIEW ====================

    async initClientView(user) {
        this.currentUser = user;
        this.selectedClientId = null; // ID de l'entreprise sélectionnée
        this.setupClientNavigation();
        await this.loadClientCompanies();
        this.showPage('ma-formation');
        window.scrollTo({ top: 0, behavior: 'instant' });
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
        const result = await SupabaseData.getFormationsByClient(this.currentUser.id, this.selectedClientId);

        const noFormation = document.getElementById('client-no-formation');
        const formationContent = document.getElementById('client-formation-content');

        if (!result.success || result.message === 'Aucune entreprise liée à ce compte.' || result.data.length === 0) {
            if (noFormation) noFormation.style.display = 'block';
            if (formationContent) formationContent.style.display = 'none';
            return;
        }

        if (noFormation) noFormation.style.display = 'none';
        if (formationContent) formationContent.style.display = 'block';

        this.clientFormations = result.data;
        // Formation active : en cours, ou en attente préalable, ou la première
        const active = this.clientFormations.find(f => f.status === 'in_progress')
            || this.clientFormations.find(f => f.status === 'awaiting_prealable')
            || this.clientFormations[0];

        this.currentClientFormation = active;
        this.renderClientSpace();
    },

    selectClientFormation(formationId) {
        const f = (this.clientFormations || []).find(x => x.id === formationId);
        if (!f) return;
        this.currentClientFormation = f;
        // Reset préalable form state (au cas où édition en cours sur l'ancienne)
        this.clientPrealableLearners = null;
        this.clientPrealableFormationType = undefined;
        this.clientPrealableFormationTypeAutre = undefined;
        this.clientPrealableOpcoName = undefined;
        this.clientPrealableOpcoSubrogation = undefined;
        this.clientPrealableEditing = false;
        this.renderClientSpace();
    },

    renderClientSpace() {
        const f = this.currentClientFormation;
        if (!f) return;

        this.renderClientFormationList();
        this.renderClientFormationHeader(f);
        this.renderClientStepper(f);
        this.renderClientActionZone(f);
        this.renderClientDocsList(f);
        // Charger les supports pédagogiques (affichés dans la section docs)
        this.loadClientFormationSupports(f);
    },

    renderClientFormationList() {
        const container = document.getElementById('client-formation-list');
        if (!container) return;
        const formations = this.clientFormations || [];
        if (formations.length <= 1) { container.style.display = 'none'; return; }

        container.style.display = 'block';
        const statusMap = {
            'completed': { label: 'Terminée', bg: '#d1fae5', color: '#065f46' },
            'in_progress': { label: 'En cours', bg: '#fef3c7', color: '#92400e' },
            'planned': { label: 'Planifiée', bg: '#dbeafe', color: '#1e40af' },
            'awaiting_prealable': { label: 'À compléter', bg: '#f3e8ff', color: '#6b21a8' },
            'cancelled': { label: 'Annulée', bg: '#fee2e2', color: '#991b1b' }
        };

        container.innerHTML = `
            <div style="font-size:0.85rem;font-weight:600;color:var(--gray-600);margin-bottom:0.5rem;">Mes formations</div>
            <div style="display:flex;gap:0.75rem;overflow-x:auto;padding-bottom:0.5rem;">
                ${formations.map(form => {
                    const isActive = form.id === this.currentClientFormation.id;
                    const st = statusMap[form.status] || statusMap['planned'];
                    const dates = form.start_date ? new Date(form.start_date).toLocaleDateString('fr-FR') : '';
                    return `
                        <div onclick="CRMApp.selectClientFormation(${form.id})"
                            style="min-width:220px;background:white;border:2px solid ${isActive ? 'var(--primary-pink)' : 'var(--gray-200)'};border-radius:var(--radius-xl);padding:1rem;cursor:pointer;transition:all 0.2s;">
                            <div style="font-weight:600;color:var(--gray-900);font-size:0.9rem;margin-bottom:0.35rem;line-height:1.3;">${form.formation_name || 'Formation'}</div>
                            <div style="font-size:0.75rem;color:var(--gray-500);margin-bottom:0.5rem;">${dates}</div>
                            <span style="display:inline-block;padding:0.2rem 0.55rem;background:${st.bg};color:${st.color};border-radius:9999px;font-size:0.7rem;font-weight:500;">${st.label}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    renderClientFormationHeader(formation) {
        const container = document.getElementById('client-formation-header');
        if (!container) return;
        const startDate = formation.start_date ? new Date(formation.start_date).toLocaleDateString('fr-FR') : 'N/A';
        const endDate = formation.end_date ? new Date(formation.end_date).toLocaleDateString('fr-FR') : 'N/A';
        const statusMap = {
            'completed': 'Terminée', 'in_progress': 'En cours',
            'planned': 'Planifiée', 'awaiting_prealable': 'À compléter',
            'cancelled': 'Annulée'
        };

        container.innerHTML = `
            <div style="background:linear-gradient(135deg, var(--primary-purple) 0%, var(--primary-pink) 100%);border-radius:var(--radius-xl);padding:2rem;color:white;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;">
                    <div style="flex:1;min-width:250px;">
                        <h2 style="font-size:1.6rem;font-weight:700;margin:0 0 0.5rem 0;">${formation.formation_name || 'Formation'}</h2>
                        <div style="font-size:0.9rem;opacity:0.95;">
                            ${formation.company_name || formation.client_name || ''} &bull;
                            ${formation.custom_dates || `Du ${startDate} au ${endDate}`} &bull;
                            ${formation.training_location || 'Lieu à définir'} &bull;
                            ${formation.hours_per_learner || 0}h
                        </div>
                    </div>
                    <div style="padding:0.5rem 1rem;background:rgba(255,255,255,0.2);border-radius:9999px;font-weight:600;font-size:0.85rem;">
                        ${statusMap[formation.status] || 'Planifiée'}
                    </div>
                </div>
            </div>
        `;
    },

    renderClientStepper(formation) {
        const container = document.getElementById('client-formation-stepper');
        if (!container) return;

        const docs = formation.formation_documents || [];
        const hasConvention = docs.some(d => d.type === 'convention');
        const hasCertificate = docs.some(d => d.type === 'certificate');
        const hasPrealable = formation.prealable_recu === true;

        // Déterminer l'état de chaque étape
        const steps = [
            {
                num: 1, label: 'Préalable',
                status: hasPrealable ? 'done' : 'active'
            },
            {
                num: 2, label: 'Convention',
                status: formation.client_signed_at ? 'done' : (hasPrealable ? 'active' : 'pending')
            },
            {
                num: 3, label: 'Formation',
                status: formation.status === 'completed' ? 'done'
                    : formation.status === 'in_progress' ? 'active'
                    : (formation.client_signed_at ? 'active' : 'pending')
            },
            {
                num: 4, label: 'Mes documents',
                status: hasCertificate ? 'done' : (formation.status === 'completed' ? 'active' : 'pending')
            }
        ];

        // Une seule étape active à la fois : la première "active"
        let foundActive = false;
        this._currentClientStep = null;
        steps.forEach(s => {
            if (s.status === 'active') {
                if (foundActive) s.status = 'pending';
                else { foundActive = true; this._currentClientStep = s.num; }
            }
        });

        const colors = {
            done: { bg: '#059669', ring: '#6ee7b7', label: 'var(--gray-600)' },
            active: { bg: 'var(--primary-pink)', ring: '#fbcfe8', label: 'var(--gray-900)' },
            pending: { bg: 'var(--gray-300)', ring: 'transparent', label: 'var(--gray-400)' }
        };

        container.innerHTML = `
            <div style="background:white;border-radius:var(--radius-xl);padding:1.5rem 1rem;box-shadow:var(--shadow-sm);">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
                    ${steps.map((s, i) => {
                        const c = colors[s.status];
                        const icon = s.status === 'done' ? '✓' : s.num;
                        return `
                            ${i > 0 ? `<div style="flex:1;height:2px;background:${steps[i-1].status === 'done' ? '#059669' : 'var(--gray-200)'};min-width:20px;"></div>` : ''}
                            <div style="display:flex;flex-direction:column;align-items:center;gap:0.4rem;min-width:80px;">
                                <div style="width:42px;height:42px;border-radius:50%;background:${c.bg};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;box-shadow:${s.status === 'active' ? `0 0 0 4px ${c.ring}` : 'none'};transition:all 0.2s;">
                                    ${icon}
                                </div>
                                <div style="font-size:0.8rem;font-weight:${s.status === 'active' ? '600' : '500'};color:${c.label};text-align:center;">${s.label}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    renderClientActionZone(formation) {
        const container = document.getElementById('client-formation-action');
        if (!container) return;

        const step = this._currentClientStep;
        const docs = formation.formation_documents || [];

        if (step === 1) {
            // Préalable à remplir — on rend directement le formulaire préalable ici
            container.innerHTML = `
                <div style="background:#fdf2f8;border:2px solid var(--primary-pink);border-radius:var(--radius-xl);padding:1.5rem;">
                    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
                        <span style="font-size:1.75rem;">📋</span>
                        <h3 style="font-size:1.15rem;font-weight:700;color:var(--gray-900);margin:0;">Renseignez vos apprenants</h3>
                    </div>
                    <p style="color:var(--gray-600);margin:0 0 1.25rem 0;font-size:0.9rem;">Nathalie a besoin de ces informations pour préparer votre formation. Veuillez compléter le questionnaire ci-dessous.</p>
                    <div id="client-formation-questionnaires"></div>
                </div>
            `;
            // Le renderClientPrealableTab cible #client-formation-questionnaires
            this.renderClientPrealableTab(formation);
        } else if (step === 2) {
            const convDoc = docs.find(d => d.type === 'convention' && d.visible_client !== false);
            const isSigned = !!formation.client_signed_at;
            const signedDate = isSigned ? new Date(formation.client_signed_at).toLocaleDateString('fr-FR') : null;

            container.innerHTML = `
                <div style="background:${isSigned ? '#d1fae5' : '#eff6ff'};border:2px solid ${isSigned ? '#059669' : '#3b82f6'};border-radius:var(--radius-xl);padding:1.5rem;">
                    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
                        <span style="font-size:1.75rem;">${isSigned ? '✅' : '✍️'}</span>
                        <h3 style="font-size:1.15rem;font-weight:700;color:var(--gray-900);margin:0;">${isSigned ? 'Convention signée' : 'Signez votre convention'}</h3>
                    </div>
                    ${isSigned ? `
                        <p style="color:#065f46;margin:0 0 1.25rem 0;font-size:0.9rem;font-weight:500;">Signée le ${signedDate}. Vous pouvez retélécharger le document signé à tout moment.</p>
                        ${convDoc ? `
                            <button onclick="CRMApp.openDocument(${formation.id}, 'convention')" style="padding:0.75rem 1.5rem;background:#059669;color:white;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">
                                📄 Voir le document signé
                            </button>
                        ` : ''}
                    ` : `
                        <p style="color:var(--gray-600);margin:0 0 1.25rem 0;font-size:0.9rem;">La convention doit être signée avant le début de la formation.</p>
                        ${convDoc ? `
                            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                                <button onclick="CRMApp.openDocument(${formation.id}, 'convention')" style="padding:0.75rem 1.25rem;background:white;color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);font-weight:500;cursor:pointer;">
                                    📄 Lire la convention
                                </button>
                                <button onclick="CRMApp.openSignatureModal('client', ${formation.id})" style="padding:0.75rem 1.5rem;background:var(--primary-pink);color:white;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">
                                    ✍️ Signer la convention
                                </button>
                            </div>
                        ` : `
                            <p style="color:var(--gray-500);font-size:0.85rem;font-style:italic;">La convention sera disponible prochainement.</p>
                        `}
                    `}
                </div>
            `;
        } else if (step === 3) {
            const now = new Date();
            const start = formation.start_date ? new Date(formation.start_date) : null;
            let countdown = '';
            if (formation.status === 'in_progress') {
                countdown = `<p style="font-size:1.05rem;font-weight:600;color:#92400e;margin:0.5rem 0 0;">🎓 Votre formation est en cours</p>`;
            } else if (start && start > now) {
                const days = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
                countdown = `<p style="font-size:1.05rem;font-weight:600;color:#92400e;margin:0.5rem 0 0;">⏰ Dans ${days} jour${days > 1 ? 's' : ''}</p>`;
            }
            container.innerHTML = `
                <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:var(--radius-xl);padding:1.5rem;">
                    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
                        <span style="font-size:1.75rem;">🎓</span>
                        <h3 style="font-size:1.15rem;font-weight:700;color:var(--gray-900);margin:0;">Votre formation</h3>
                    </div>
                    <div style="color:var(--gray-700);font-size:0.9rem;">
                        <div><strong>Dates :</strong> ${formation.custom_dates || (formation.start_date ? new Date(formation.start_date).toLocaleDateString('fr-FR') + ' → ' + new Date(formation.end_date).toLocaleDateString('fr-FR') : 'À définir')}</div>
                        <div style="margin-top:0.25rem;"><strong>Lieu :</strong> ${formation.training_location || 'À définir'}</div>
                        ${countdown}
                    </div>
                </div>
            `;
        } else if (step === 4) {
            container.innerHTML = `
                <div style="background:#d1fae5;border:2px solid #059669;border-radius:var(--radius-xl);padding:1.5rem;">
                    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
                        <span style="font-size:1.75rem;">🎉</span>
                        <h3 style="font-size:1.15rem;font-weight:700;color:var(--gray-900);margin:0;">Formation terminée ✅</h3>
                    </div>
                    <p style="color:var(--gray-600);margin:0 0 1rem 0;font-size:0.9rem;">Vous pouvez consulter ci-dessous votre certificat, votre attestation et les autres documents de fin de formation.</p>
                </div>
            `;
        } else {
            // Tout est complété
            container.innerHTML = `
                <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:var(--radius-xl);padding:1.5rem;text-align:center;">
                    <span style="font-size:2rem;">🎉</span>
                    <h3 style="font-size:1.1rem;font-weight:700;color:#065f46;margin:0.5rem 0 0;">Toutes les étapes sont complétées !</h3>
                </div>
            `;
        }
    },

    renderClientDocsList(formation) {
        const container = document.getElementById('client-formation-docs');
        if (!container) return;

        const docs = (formation.formation_documents || []).filter(d => d.visible_client !== false && d.type !== 'contrat_sous_traitance');
        const staticDocsList = [
            { name: 'Livret d\'accueil NJM Conseil', type: 'livret_accueil', document_url: 'assets/static/livret-accueil.pdf' },
            { name: 'Fiche de réclamation', type: 'fiche_reclamation', document_url: 'assets/static/fiche-reclamation.pdf' }
        ];
        const allDocs = [...docs, ...staticDocsList];

        const docTypes = {
            'doc_prealable': { icon: '📋', label: 'Document préalable' },
            'manual': { icon: '📎', label: 'Document' },
            'convention': { icon: '📄', label: 'Convention' },
            'attendance_sheet': { icon: '📋', label: 'Feuille de présence' },
            'certificate': { icon: '🏅', label: 'Attestation' },
            'fiche_pedagogique': { icon: '📝', label: 'Fiche pédagogique' },
            'google_doc': { icon: '📝', label: 'Fiche pédagogique' },
            'livret_accueil': { icon: '📖', label: 'Livret d\'accueil' },
            'fiche_reclamation': { icon: '📝', label: 'Fiche de réclamation' },
            'convocation': { icon: '📨', label: 'Convocation' }
        };

        const regenerableTypes = ['fiche_pedagogique', 'google_doc', 'convention', 'attendance_sheet', 'certificate'];

        container.innerHTML = `
            <div style="background:white;border-radius:var(--radius-xl);padding:1.5rem;box-shadow:var(--shadow-sm);">
                <!-- SOUS-SECTION 1 — Documents administratifs -->
                <h3 style="font-size:1.05rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">📋 Documents administratifs</h3>
                <div style="display:grid;gap:0.6rem;">
                    ${allDocs.length === 0 ? '<p style="color:var(--gray-500);font-size:0.9rem;padding:0.5rem 0;">Aucun document disponible pour le moment.</p>' :
                    allDocs.map(doc => {
                        const dt = docTypes[doc.type] || { icon: '📑', label: 'Document' };
                        const canRegen = regenerableTypes.includes(doc.type) && formation.id;
                        let onClick = '';
                        if (canRegen) {
                            onClick = `event.preventDefault(); CRMApp.openDocument(${formation.id}, '${doc.type}')`;
                        } else {
                            const url = doc.document_url || doc.url || '';
                            if (!url || url === '#' || url.startsWith('generate://')) {
                                onClick = `event.preventDefault(); showToast('Document non disponible', 'warning')`;
                            }
                        }
                        const displayUrl = canRegen ? '#' : (typeof toPdfUrl === 'function' ? (toPdfUrl(doc.document_url || doc.url || '') || '#') : (doc.document_url || '#'));

                        return `
                            <a href="${displayUrl}" ${canRegen ? '' : 'target="_blank" rel="noopener noreferrer"'}
                                ${onClick ? `onclick="${onClick}"` : ''}
                                style="display:flex;align-items:center;gap:1rem;padding:0.85rem 1rem;background:var(--gray-50);border-radius:var(--radius-md);text-decoration:none;color:var(--gray-900);border:1px solid transparent;transition:all 0.15s;"
                                onmouseover="this.style.background='white';this.style.borderColor='var(--gray-200)';"
                                onmouseout="this.style.background='var(--gray-50)';this.style.borderColor='transparent';">
                                <span style="font-size:1.5rem;">${dt.icon}</span>
                                <div style="flex:1;">
                                    <div style="font-weight:600;color:var(--gray-900);font-size:0.9rem;">${doc.name || dt.label}</div>
                                    <div style="font-size:0.75rem;color:var(--gray-500);margin-top:0.15rem;">${dt.label}</div>
                                </div>
                                <span style="font-size:0.8rem;color:var(--primary-pink);font-weight:500;">Télécharger →</span>
                            </a>
                        `;
                    }).join('')}
                </div>

                <!-- Séparateur -->
                <div style="height:1px;background:var(--gray-200);margin:2rem 0;"></div>

                <!-- SOUS-SECTION 2 — Supports de formation -->
                <h3 style="font-size:1.05rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">📚 Supports de formation</h3>
                <div id="client-formation-supports"></div>

                <!-- Séparateur -->
                <div style="height:1px;background:var(--gray-200);margin:2rem 0;"></div>

                <!-- SOUS-SECTION 3 — Questionnaires à remplir -->
                <h3 style="font-size:1.05rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">📝 Questionnaires à remplir</h3>
                <div id="client-formation-questionnaires-list">
                    <p style="color:var(--gray-400);font-size:0.85rem;">Chargement...</p>
                </div>
            </div>
        `;

        // Charger les questionnaires attribués côté client
        this._loadClientQuestionnaires(formation.id);
    },

    _legacyRenderClientFormationTabs(formation) {
        // DEAD CODE — remplacé par renderClientSpace(). Conservé temporairement au cas où.
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
            const docs = (formation.formation_documents || []).filter(d => d.visible_client !== false && d.type !== 'contrat_sous_traitance');

            // Documents statiques toujours visibles pour le client
            const staticDocsList = [
                { name: 'Document préalable à la formation', type: 'doc_prealable', document_url: 'assets/static/document-prealable.docx' },
                { name: 'Livret d\'accueil NJM Conseil', type: 'livret_accueil', document_url: 'assets/static/livret-accueil.pdf' },
                { name: 'Fiche de réclamation', type: 'fiche_reclamation', document_url: 'assets/static/fiche-reclamation.pdf' }
            ];

            const allDocs = [...docs, ...staticDocsList];

            const docTypes = {
                'doc_prealable': { icon: '📋', label: 'Document préalable', color: '#2563eb' },
                'manual': { icon: '📎', label: 'Document', color: '#6b7280' },
                'convention': { icon: '📄', label: 'Convention', color: '#7c3aed' },
                'attendance_sheet': { icon: '📋', label: 'Feuille de présence', color: '#059669' },
                'certificate': { icon: '🏅', label: 'Attestation', color: '#dc2626' },
                'program': { icon: '📚', label: 'Programme', color: '#0284c7' },
                'fiche_pedagogique': { icon: '📝', label: 'Fiche pédagogique', color: '#ea580c' },
                'google_doc': { icon: '📝', label: 'Fiche pédagogique', color: '#ea580c' },
                'contrat_sous_traitance': { icon: '📝', label: 'Contrat sous-traitance', color: '#b45309' },
                'convocation': { icon: '📨', label: 'Convocation', color: '#0891b2' },
                'livret_accueil': { icon: '📖', label: 'Livret d\'accueil', color: '#7c3aed' },
                'fiche_reclamation': { icon: '📝', label: 'Fiche de réclamation', color: '#b45309' }
            };

            documentsContainer.innerHTML = `
                <div style="display: grid; gap: 1rem;">
                    ${allDocs.map(doc => {
                        const docType = docTypes[doc.type] || { icon: '📑', label: doc.type || 'Document', color: '#6b7280' };

                        // Types régénérables localement
                        const regenerableTypes = ['fiche_pedagogique', 'google_doc', 'convention', 'contrat_sous_traitance', 'attendance_sheet', 'certificate'];
                        const canRegenerate = regenerableTypes.includes(doc.type) && formation.id;

                        let onClickAttr = '';
                        if (canRegenerate) {
                            onClickAttr = `event.preventDefault(); CRMApp.openDocument(${formation.id}, '${doc.type}')`;
                        } else {
                            const docUrl = doc.document_url || doc.url || '';
                            if (!docUrl || docUrl === '#' || docUrl.startsWith('generate://')) {
                                onClickAttr = `event.preventDefault(); showToast('Document non disponible', 'warning')`;
                            }
                        }

                        const displayUrl = canRegenerate ? '#' : (toPdfUrl(doc.document_url || doc.url || '') || '#');

                        return `
                            <a href="${displayUrl}" ${canRegenerate ? '' : 'target="_blank" rel="noopener noreferrer"'}
                               style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md); text-decoration: none; color: var(--gray-900); transition: all 0.2s; border: 1px solid transparent;"
                               onmouseover="this.style.background='white'; this.style.borderColor='var(--gray-200)'; this.style.boxShadow='var(--shadow-sm)';"
                               onmouseout="this.style.background='var(--gray-50)'; this.style.borderColor='transparent'; this.style.boxShadow='none';"
                               ${onClickAttr ? `onclick="${onClickAttr}"` : ''}>
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

        // Charger les supports assignés à cette formation pour le client
        this.loadClientFormationSupports(formation);

        // Onglet Préalable (saisie des apprenants par le client)
        this.renderClientPrealableTab(formation);
    },

    async loadClientFormationSupports(formation) {
        const container = document.getElementById('client-formation-supports');
        if (!container) return;

        const result = await SupabaseData.getFormationSupports(formation.id);
        const supports = result.success ? result.data : [];

        if (supports.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-500);font-size:0.9rem;padding:0.5rem 0;">Vos supports de formation seront disponibles prochainement.</p>';
            return;
        }

        const fileIcon = (title) => {
            const t = (title || '').toLowerCase();
            if (t.includes('pdf')) return '📕';
            if (t.includes('pptx') || t.includes('ppt')) return '📊';
            if (t.includes('xlsx') || t.includes('xls')) return '📗';
            return '📘';
        };

        container.innerHTML = `
            <div style="display:grid;gap:0.6rem;">
                ${supports.map(s => `
                    <a href="${normalizeAssetUrl(s.file_url)}" target="_blank" rel="noopener noreferrer"
                       style="display:flex;align-items:center;gap:1rem;padding:0.85rem 1rem;background:var(--gray-50);border-radius:var(--radius-md);text-decoration:none;color:var(--gray-900);border:1px solid transparent;transition:all 0.15s;"
                       onmouseover="this.style.background='white';this.style.borderColor='var(--gray-200)';"
                       onmouseout="this.style.background='var(--gray-50)';this.style.borderColor='transparent';">
                        <span style="font-size:1.5rem;">${fileIcon(s.title)}</span>
                        <div style="flex:1;">
                            <div style="font-weight:600;color:var(--gray-900);font-size:0.9rem;">${s.title}</div>
                            <div style="font-size:0.75rem;color:var(--gray-500);margin-top:0.15rem;">${s.description || 'Support pédagogique'}</div>
                        </div>
                        <span style="font-size:0.8rem;color:var(--primary-pink);font-weight:500;">Ouvrir →</span>
                    </a>
                `).join('')}
            </div>
        `;
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

    // ==================== PREALABLE CLIENT ====================

    PREALABLE_FORMATION_TYPES: [
        'Techniques de vente', 'Management', 'Manager commercial', 'Commercial',
        'Parcours client', 'Méthode AEC Disc', 'Recrutement', 'Communication'
    ],

    renderClientPrealableTab(formation) {
        const container = document.getElementById('client-formation-questionnaires');
        if (!container) return;

        const recu = formation.prealable_recu === true;

        if (recu && !this.clientPrealableEditing) {
            this._renderPrealableReadonly(container, formation);
        } else {
            this._renderPrealableForm(container, formation);
        }
    },

    _renderPrealableReadonly(container, formation) {
        let learners = formation.learners_data || [];
        if (typeof learners === 'string') {
            try { learners = JSON.parse(learners); } catch (e) { learners = []; }
        }

        const formationType = formation.prealable_formation_type || '—';
        const opcoName = formation.opco_name || '—';
        const opcoSubrogation = formation.opco_subrogation === true ? 'Avec subrogation' : formation.opco_subrogation === false && formation.opco_name ? 'Sans subrogation' : '—';

        const thStyle = 'text-align:left;padding:0.5rem 0.75rem;font-size:0.75rem;color:var(--gray-600);font-weight:600;white-space:nowrap;';
        const tdStyle = 'padding:0.5rem 0.75rem;font-size:0.85rem;color:var(--gray-900);';

        container.innerHTML = `
            <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:var(--radius-xl);padding:2rem;margin-bottom:1.5rem;">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem;">
                    <span style="font-size:1.5rem;">✅</span>
                    <h3 style="color:#065f46;font-weight:700;margin:0;">Préalable envoyé</h3>
                </div>

                <!-- Section Formation -->
                <div style="background:white;border-radius:var(--radius-md);padding:1rem;margin-bottom:1rem;">
                    <div style="font-size:0.75rem;font-weight:600;color:var(--gray-500);text-transform:uppercase;margin-bottom:0.5rem;">Formation</div>
                    <div style="font-weight:500;color:var(--gray-900);">${formationType}</div>
                </div>

                <!-- Section Apprenants -->
                <div style="background:white;border-radius:var(--radius-md);overflow:hidden;margin-bottom:1rem;">
                    <div style="padding:0.75rem 1rem;font-size:0.75rem;font-weight:600;color:var(--gray-500);text-transform:uppercase;border-bottom:1px solid var(--gray-100);">Apprenants (${learners.length})</div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%;border-collapse:collapse;">
                            <thead>
                                <tr style="background:var(--gray-50);">
                                    <th style="${thStyle}">Prénom</th>
                                    <th style="${thStyle}">Nom</th>
                                    <th style="${thStyle}">Année</th>
                                    <th style="${thStyle}">Poste</th>
                                    <th style="${thStyle}">Tél</th>
                                    <th style="${thStyle}">Email</th>
                                    <th style="${thStyle}">Entité</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${learners.map(l => `
                                    <tr style="border-top:1px solid var(--gray-100);">
                                        <td style="${tdStyle}">${l.first_name || ''}</td>
                                        <td style="${tdStyle}">${l.last_name || ''}</td>
                                        <td style="${tdStyle}">${l.birth_year || '—'}</td>
                                        <td style="${tdStyle}">${l.position_title || '—'}</td>
                                        <td style="${tdStyle}">${l.phone || '—'}</td>
                                        <td style="${tdStyle}">${l.email || '—'}</td>
                                        <td style="${tdStyle}">${l.entity || '—'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Section OPCO -->
                <div style="background:white;border-radius:var(--radius-md);padding:1rem;margin-bottom:1rem;">
                    <div style="font-size:0.75rem;font-weight:600;color:var(--gray-500);text-transform:uppercase;margin-bottom:0.5rem;">OPCO</div>
                    <div style="display:flex;gap:2rem;">
                        <div><span style="color:var(--gray-500);font-size:0.85rem;">Nom :</span> <span style="font-weight:500;color:var(--gray-900);">${opcoName}</span></div>
                        <div><span style="color:var(--gray-500);font-size:0.85rem;">Subrogation :</span> <span style="font-weight:500;color:var(--gray-900);">${opcoSubrogation}</span></div>
                    </div>
                </div>

                <button onclick="CRMApp.editClientPrealable()"
                    style="padding:0.5rem 1.25rem;background:white;color:#065f46;border:1px solid #6ee7b7;border-radius:var(--radius-md);font-weight:500;cursor:pointer;">
                    Modifier
                </button>
            </div>
        `;
    },

    _renderPrealableForm(container, formation) {
        // Initialiser les données du formulaire
        if (!this.clientPrealableLearners) {
            let existing = formation.learners_data || [];
            if (typeof existing === 'string') {
                try { existing = JSON.parse(existing); } catch (e) { existing = []; }
            }
            this.clientPrealableLearners = existing.length > 0
                ? existing.map(l => ({ ...l }))
                : [{ id: Date.now(), first_name: '', last_name: '', email: '', birth_year: '', position_title: '', phone: '', entity: '' }];
        }

        if (this.clientPrealableFormationType === undefined) {
            this.clientPrealableFormationType = formation.prealable_formation_type || '';
        }
        if (this.clientPrealableFormationTypeAutre === undefined) {
            const known = this.PREALABLE_FORMATION_TYPES;
            const val = this.clientPrealableFormationType;
            this.clientPrealableFormationTypeAutre = (val && !known.includes(val)) ? val : '';
        }
        if (this.clientPrealableOpcoName === undefined) {
            this.clientPrealableOpcoName = formation.opco_name || '';
        }
        if (this.clientPrealableOpcoSubrogation === undefined) {
            this.clientPrealableOpcoSubrogation = formation.opco_subrogation;
        }

        const inputStyle = 'padding:0.45rem 0.6rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.85rem;width:100%;box-sizing:border-box;';
        const labelStyle = 'font-size:0.75rem;font-weight:600;color:var(--gray-600);padding:0.5rem 0.5rem 0.25rem;white-space:nowrap;';

        const formationTypes = this.PREALABLE_FORMATION_TYPES;
        const selectedType = this.clientPrealableFormationType;
        const isAutre = selectedType && !formationTypes.includes(selectedType);

        container.innerHTML = `
            <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:var(--radius-xl);padding:2rem;margin-bottom:1.5rem;">
                <h3 style="color:#1e40af;font-weight:700;margin:0 0 0.5rem 0;">Préalable à la formation</h3>
                <p style="color:#1e40af;margin:0;font-size:0.9rem;">Veuillez compléter l'ensemble des informations ci-dessous avant le début de votre formation.</p>
            </div>

            <!-- SECTION 1 — Formation -->
            <div style="background:white;border:1px solid var(--gray-200);border-radius:var(--radius-xl);padding:1.5rem;margin-bottom:1.5rem;">
                <h4 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">1. Formation</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:0.5rem;">
                    ${formationTypes.map(type => `
                        <label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:${selectedType === type ? '#eff6ff' : 'var(--gray-50)'};border:1px solid ${selectedType === type ? '#3b82f6' : 'var(--gray-200)'};border-radius:var(--radius-md);cursor:pointer;font-size:0.875rem;color:var(--gray-800);">
                            <input type="radio" name="prealable-formation-type" value="${type}"
                                ${selectedType === type ? 'checked' : ''}
                                onchange="CRMApp.setPrealableFormationType(this.value)"
                                style="margin:0;">
                            ${type}
                        </label>
                    `).join('')}
                    <label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:${isAutre ? '#eff6ff' : 'var(--gray-50)'};border:1px solid ${isAutre ? '#3b82f6' : 'var(--gray-200)'};border-radius:var(--radius-md);cursor:pointer;font-size:0.875rem;color:var(--gray-800);">
                        <input type="radio" name="prealable-formation-type" value="__autre__"
                            ${isAutre ? 'checked' : ''}
                            onchange="CRMApp.setPrealableFormationType('__autre__')"
                            style="margin:0;">
                        Autre
                    </label>
                </div>
                <div id="prealable-autre-container" style="margin-top:0.75rem;${isAutre ? '' : 'display:none;'}">
                    <input type="text" id="prealable-autre-input" placeholder="Précisez le type de formation"
                        value="${this.clientPrealableFormationTypeAutre || ''}"
                        onchange="CRMApp.clientPrealableFormationTypeAutre = this.value"
                        style="${inputStyle} max-width:350px;">
                </div>
            </div>

            <!-- SECTION 2 — Apprenants -->
            <div style="background:white;border:1px solid var(--gray-200);border-radius:var(--radius-xl);padding:1.5rem;margin-bottom:1.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h4 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0;">2. Apprenants</h4>
                    <span style="font-size:0.8rem;color:var(--gray-500);">${this.clientPrealableLearners.length}/12</span>
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;min-width:800px;">
                        <thead>
                            <tr style="background:var(--gray-50);">
                                <th style="${labelStyle}">#</th>
                                <th style="${labelStyle}">Prénom *</th>
                                <th style="${labelStyle}">NOM *</th>
                                <th style="${labelStyle}">Année naissance</th>
                                <th style="${labelStyle}">Poste</th>
                                <th style="${labelStyle}">N° téléphone</th>
                                <th style="${labelStyle}">Adresse mail</th>
                                <th style="${labelStyle}">Entité *</th>
                                <th style="${labelStyle}"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.clientPrealableLearners.map((l, i) => `
                                <tr style="border-top:1px solid var(--gray-100);">
                                    <td style="padding:0.4rem 0.5rem;text-align:center;color:var(--gray-500);font-weight:600;font-size:0.85rem;">${i + 1}</td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="text" value="${l.first_name || ''}" onchange="CRMApp.updateClientLearnerField(${i},'first_name',this.value)" style="${inputStyle}"></td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="text" value="${l.last_name || ''}" onchange="CRMApp.updateClientLearnerField(${i},'last_name',this.value)" style="${inputStyle} text-transform:uppercase;"></td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="text" value="${l.birth_year || ''}" placeholder="ex: 1985" maxlength="4" onchange="CRMApp.updateClientLearnerField(${i},'birth_year',this.value)" style="${inputStyle} max-width:80px;"></td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="text" value="${l.position_title || ''}" onchange="CRMApp.updateClientLearnerField(${i},'position_title',this.value)" style="${inputStyle}"></td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="tel" value="${l.phone || ''}" onchange="CRMApp.updateClientLearnerField(${i},'phone',this.value)" style="${inputStyle} max-width:130px;"></td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="email" value="${l.email || ''}" onchange="CRMApp.updateClientLearnerField(${i},'email',this.value)" style="${inputStyle}"></td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="text" value="${l.entity || ''}" onchange="CRMApp.updateClientLearnerField(${i},'entity',this.value)" style="${inputStyle}"></td>
                                    <td style="padding:0.4rem 0.25rem;text-align:center;">
                                        ${this.clientPrealableLearners.length > 1 ? `
                                            <button onclick="CRMApp.removeClientLearnerRow(${i})" style="background:none;border:none;color:var(--gray-400);cursor:pointer;font-size:1.1rem;padding:0.25rem;" title="Supprimer">✕</button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="font-size:0.75rem;color:var(--gray-500);margin:0.75rem 0 0;font-style:italic;">* Entité : raison sociale, n° SIRET et adresse auxquelles l'apprenant doit être rattaché.</p>
                ${this.clientPrealableLearners.length < 12 ? `
                    <button onclick="CRMApp.addClientLearnerRow()"
                        style="margin-top:0.75rem;padding:0.45rem 1rem;background:var(--gray-100);color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.85rem;cursor:pointer;">
                        + Ajouter un apprenant
                    </button>
                ` : ''}
            </div>

            <!-- SECTION 3 — OPCO -->
            <div style="background:white;border:1px solid var(--gray-200);border-radius:var(--radius-xl);padding:1.5rem;margin-bottom:1.5rem;">
                <h4 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">3. OPCO</h4>
                <div style="display:flex;gap:1.5rem;align-items:flex-end;flex-wrap:wrap;">
                    <div style="flex:1;min-width:200px;">
                        <label style="display:block;font-size:0.8rem;font-weight:600;color:var(--gray-600);margin-bottom:0.35rem;">Nom de l'OPCO</label>
                        <input type="text" id="prealable-opco-name" value="${this.clientPrealableOpcoName || ''}"
                            onchange="CRMApp.clientPrealableOpcoName = this.value"
                            style="${inputStyle} max-width:300px;">
                    </div>
                    <div style="display:flex;gap:1rem;">
                        <label style="display:flex;align-items:center;gap:0.4rem;padding:0.5rem 0.75rem;background:${this.clientPrealableOpcoSubrogation === true ? '#eff6ff' : 'var(--gray-50)'};border:1px solid ${this.clientPrealableOpcoSubrogation === true ? '#3b82f6' : 'var(--gray-200)'};border-radius:var(--radius-md);cursor:pointer;font-size:0.875rem;">
                            <input type="radio" name="prealable-opco-subrogation" value="true"
                                ${this.clientPrealableOpcoSubrogation === true ? 'checked' : ''}
                                onchange="CRMApp.clientPrealableOpcoSubrogation = true"
                                style="margin:0;">
                            Avec subrogation
                        </label>
                        <label style="display:flex;align-items:center;gap:0.4rem;padding:0.5rem 0.75rem;background:${this.clientPrealableOpcoSubrogation === false ? '#eff6ff' : 'var(--gray-50)'};border:1px solid ${this.clientPrealableOpcoSubrogation === false ? '#3b82f6' : 'var(--gray-200)'};border-radius:var(--radius-md);cursor:pointer;font-size:0.875rem;">
                            <input type="radio" name="prealable-opco-subrogation" value="false"
                                ${this.clientPrealableOpcoSubrogation === false ? 'checked' : ''}
                                onchange="CRMApp.clientPrealableOpcoSubrogation = false"
                                style="margin:0;">
                            Sans subrogation
                        </label>
                    </div>
                </div>
            </div>

            <!-- Bouton Envoyer -->
            <div style="display:flex;justify-content:flex-end;margin-top:1rem;">
                <button onclick="CRMApp.submitClientPrealable()"
                    style="padding:0.75rem 2rem;background:var(--primary-purple);color:white;border:none;border-radius:var(--radius-md);font-weight:600;font-size:1rem;cursor:pointer;">
                    Envoyer le préalable
                </button>
            </div>
        `;
    },

    setPrealableFormationType(value) {
        if (value === '__autre__') {
            this.clientPrealableFormationType = this.clientPrealableFormationTypeAutre || '';
            const autreContainer = document.getElementById('prealable-autre-container');
            if (autreContainer) autreContainer.style.display = '';
            const autreInput = document.getElementById('prealable-autre-input');
            if (autreInput) autreInput.focus();
        } else {
            this.clientPrealableFormationType = value;
            this.clientPrealableFormationTypeAutre = '';
            const autreContainer = document.getElementById('prealable-autre-container');
            if (autreContainer) autreContainer.style.display = 'none';
        }
    },

    addClientLearnerRow() {
        if (!this.clientPrealableLearners) this.clientPrealableLearners = [];
        if (this.clientPrealableLearners.length >= 12) {
            showToast('Maximum 12 apprenants', 'warning');
            return;
        }
        this.clientPrealableLearners.push({ id: Date.now(), first_name: '', last_name: '', email: '', birth_year: '', position_title: '', phone: '', entity: '' });
        this.renderClientPrealableTab(this.currentClientFormation);
    },

    removeClientLearnerRow(index) {
        this.clientPrealableLearners.splice(index, 1);
        this.renderClientPrealableTab(this.currentClientFormation);
    },

    updateClientLearnerField(index, field, value) {
        if (this.clientPrealableLearners && this.clientPrealableLearners[index]) {
            this.clientPrealableLearners[index][field] = value;
        }
    },

    async submitClientPrealable() {
        const formation = this.currentClientFormation;
        if (!formation) return;

        // Résoudre le type de formation
        const isAutre = document.querySelector('input[name="prealable-formation-type"][value="__autre__"]');
        let formationType = this.clientPrealableFormationType;
        if (isAutre && isAutre.checked) {
            formationType = (this.clientPrealableFormationTypeAutre || '').trim();
        }

        // Validation
        if (!formationType) {
            showToast('Veuillez sélectionner un type de formation', 'error');
            return;
        }

        const valid = (this.clientPrealableLearners || []).filter(l =>
            (l.first_name || '').trim() || (l.last_name || '').trim()
        );

        if (valid.length === 0) {
            showToast('Veuillez renseigner au moins un apprenant', 'error');
            return;
        }

        // Construire les données apprenants
        const learnersData = valid.map((l, i) => ({
            id: l.id || Date.now() + i,
            first_name: (l.first_name || '').trim(),
            last_name: (l.last_name || '').trim(),
            birth_year: (l.birth_year || '').trim(),
            position_title: (l.position_title || '').trim(),
            phone: (l.phone || '').trim(),
            email: (l.email || '').trim(),
            entity: (l.entity || '').trim(),
            position: i + 1
        }));

        try {
            const result = await SupabaseData.updateFormation(formation.id, {
                learners_data: learnersData,
                prealable_recu: true,
                status: 'planned',
                prealable_formation_type: formationType,
                opco_name: (this.clientPrealableOpcoName || '').trim() || null,
                opco_subrogation: this.clientPrealableOpcoSubrogation === true,
                number_of_learners: learnersData.length
            });

            if (!result.success) throw new Error(result.message);

            const clientName = formation.company_name || formation.client_name || 'Client';
            addNotification('formation', `Préalable reçu — ${clientName} (${learnersData.length} apprenant${learnersData.length > 1 ? 's' : ''})`);

            // Mettre à jour l'état local
            this.currentClientFormation.prealable_recu = true;
            this.currentClientFormation.learners_data = learnersData;
            this.currentClientFormation.prealable_formation_type = formationType;
            this.currentClientFormation.opco_name = this.clientPrealableOpcoName;
            this.currentClientFormation.opco_subrogation = this.clientPrealableOpcoSubrogation === true;
            this.clientPrealableLearners = null;
            this.clientPrealableFormationType = undefined;
            this.clientPrealableFormationTypeAutre = undefined;
            this.clientPrealableOpcoName = undefined;
            this.clientPrealableOpcoSubrogation = undefined;
            this.clientPrealableEditing = false;

            showToast('Préalable enregistré !', 'success');
            this.renderClientPrealableTab(this.currentClientFormation);
        } catch (err) {
            console.error('Erreur soumission préalable:', err);
            showToast('Erreur lors de l\'enregistrement', 'error');
        }
    },

    editClientPrealable() {
        const formation = this.currentClientFormation;
        if (!formation) return;

        let existing = formation.learners_data || [];
        if (typeof existing === 'string') {
            try { existing = JSON.parse(existing); } catch (e) { existing = []; }
        }
        this.clientPrealableLearners = existing.length > 0
            ? existing.map(l => ({ ...l }))
            : [{ id: Date.now(), first_name: '', last_name: '', email: '', birth_year: '', position_title: '', phone: '', entity: '' }];
        this.clientPrealableFormationType = formation.prealable_formation_type || '';
        this.clientPrealableOpcoName = formation.opco_name || '';
        this.clientPrealableOpcoSubrogation = formation.opco_subrogation;
        this.clientPrealableEditing = true;

        // Déterminer si c'est "Autre"
        const known = this.PREALABLE_FORMATION_TYPES;
        const val = this.clientPrealableFormationType;
        this.clientPrealableFormationTypeAutre = (val && !known.includes(val)) ? val : '';

        this.renderClientPrealableTab(formation);
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
        // Forcer display:none inline sur toutes les pages (override tout autre style)
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.remove('active');
            page.style.display = 'none';
        });

        const targetPage = document.getElementById(`page-${pageName}`);
        if (targetPage) {
            targetPage.classList.add('active');
            targetPage.style.display = 'block';
            this.currentPage = pageName;
            window.scrollTo({ top: 0, behavior: 'instant' });
        }

        // Reload users when navigating to access management page
        if (pageName === 'acces') {
            setTimeout(() => UserManagement.loadUsers(), 100);
        }

        // Reload BPF when navigating to BPF page
        if (pageName === 'bpf') {
            setTimeout(() => this.loadBPF(), 100);
        }

        if (pageName === 'clients') {
            setTimeout(() => this.loadClientsList(), 100);
        }
        if (pageName === 'subcontractors') {
            setTimeout(() => this.loadSubcontractorsList(), 100);
        }

        if (pageName === 'mes-documents') {
            setTimeout(() => this.loadFormateurContracts(), 100);
        }

        if (pageName === 'questionnaires') {
            setTimeout(() => this.loadQuestionnaires(), 100);
        }

        if (pageName === 'biblio-supports') {
            const addBtn = document.getElementById('btn-add-support-file');
            if (addBtn && window.currentUserRole === 'formateur') {
                addBtn.style.display = 'none';
            }
        }

        if (pageName === 'email-templates') {
            setTimeout(() => this.loadEmailTemplates(), 100);
        }

        const pageTitles = {
            'dashboard': 'Tableau de bord',
            'formations': 'Formation 2026',
            'clients': 'Clients',
            'subcontractors': 'Sous-traitants',
            'veille': 'Veille',
            'bpf': 'BPF',
            'biblio-supports': 'Bibliothèque Supports',
            'biblio-templates': 'Bibliothèque Templates',
            'questionnaires': 'Questionnaires',
            'email-templates': 'Templates Emails',
            'formation-detail-formateur': 'Fiche formation',
            'acces': 'Gestion des Accès',
            'parametres': 'Paramètres',
            'missions': 'Mes missions',
            'mes-documents': 'Mes documents',
            'ma-formation': 'Ma formation'
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
        this.showQuickFormationForm();
    },

    async showQuickFormationForm() {
        // Charger clients et sous-traitants
        const [clientsResult, subsResult] = await Promise.all([
            SupabaseData.getClients(),
            SupabaseData.getSubcontractors()
        ]);
        const clients = clientsResult.success ? clientsResult.data || [] : [];
        const subs = subsResult.success ? subsResult.data || [] : [];

        const clientOpts = clients.map(c => `<option value="${c.id}">${c.company_name}</option>`).join('');
        const subOpts = subs.map(s => `<option value="${s.id}">${s.first_name} ${s.last_name}</option>`).join('');

        const existing = document.getElementById('quick-formation-modal');
        if (existing) existing.remove();

        const inputStyle = 'width:100%;padding:0.6rem 0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.9rem;font-family:inherit;';
        const labelStyle = 'display:block;font-size:0.8rem;font-weight:600;color:var(--gray-700);margin-bottom:0.35rem;';

        const modal = document.createElement('div');
        modal.id = 'quick-formation-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div style="background:white;border-radius:var(--radius-xl);padding:2rem;max-width:560px;width:90%;max-height:90vh;overflow-y:auto;position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                    <h2 style="font-size:1.25rem;font-weight:700;color:var(--gray-900);margin:0;">Nouvelle formation</h2>
                    <button onclick="document.getElementById('quick-formation-modal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--gray-400);">&times;</button>
                </div>

                <div style="display:grid;gap:1rem;">
                    <div>
                        <label style="${labelStyle}">Client *</label>
                        <select id="qf-client" style="${inputStyle}" required>
                            <option value="">Sélectionnez un client...</option>
                            ${clientOpts}
                        </select>
                    </div>
                    <div>
                        <label style="${labelStyle}">Type de formation *</label>
                        <select id="qf-formation-type" style="${inputStyle}" required>
                            <option value="">Sélectionnez...</option>
                            <option value="Techniques de vente">Techniques de vente</option>
                            <option value="Management">Management</option>
                            <option value="Manager commercial">Manager commercial</option>
                            <option value="__custom__">Autre</option>
                        </select>
                        <input type="text" id="qf-formation-custom" placeholder="Nom de la formation..." style="${inputStyle} margin-top:0.5rem;display:none;">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <label style="${labelStyle}">Date début *</label>
                            <input type="date" id="qf-start-date" style="${inputStyle}" required>
                        </div>
                        <div>
                            <label style="${labelStyle}">Date fin *</label>
                            <input type="date" id="qf-end-date" style="${inputStyle}" required>
                        </div>
                    </div>
                    <div>
                        <label style="${labelStyle}">Lieu</label>
                        <input type="text" id="qf-location" style="${inputStyle}" placeholder="ex: Paris, locaux client...">
                    </div>
                    <div>
                        <label style="${labelStyle}">Mode *</label>
                        <select id="qf-mode" style="${inputStyle}" onchange="document.getElementById('qf-sub-section').style.display = this.value === 'sous-traitant' ? 'block' : 'none'">
                            <option value="direct">Direct</option>
                            <option value="sous-traitant">Sous-traitant</option>
                        </select>
                    </div>
                    <div id="qf-sub-section" style="display:none;">
                        <label style="${labelStyle}">Formateur (sous-traitant) *</label>
                        <select id="qf-subcontractor" style="${inputStyle}">
                            <option value="">Sélectionnez...</option>
                            ${subOpts}
                        </select>
                    </div>
                </div>

                <div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--gray-200);">
                    <button onclick="document.getElementById('quick-formation-modal').remove()" style="padding:0.6rem 1.25rem;background:var(--gray-100);color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);font-weight:500;cursor:pointer;">
                        Annuler
                    </button>
                    <button onclick="CRMApp.submitQuickFormation()" id="qf-submit-btn" style="padding:0.6rem 1.25rem;background:var(--primary-purple);color:white;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">
                        Créer et envoyer le préalable
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);

        // Toggle champ "Autre"
        document.getElementById('qf-formation-type').addEventListener('change', function() {
            document.getElementById('qf-formation-custom').style.display = this.value === '__custom__' ? 'block' : 'none';
        });
    },

    async submitQuickFormation() {
        const clientId = parseInt(document.getElementById('qf-client').value);
        const formationTypeSelect = document.getElementById('qf-formation-type').value;
        const startDate = document.getElementById('qf-start-date').value;
        const endDate = document.getElementById('qf-end-date').value;

        // Validation
        if (!clientId) { showToast('Veuillez sélectionner un client', 'error'); return; }
        if (!formationTypeSelect) { showToast('Veuillez sélectionner un type de formation', 'error'); return; }
        if (!startDate || !endDate) { showToast('Veuillez renseigner les dates', 'error'); return; }

        const formationName = formationTypeSelect === '__custom__'
            ? (document.getElementById('qf-formation-custom').value.trim() || 'Formation')
            : formationTypeSelect;

        const mode = document.getElementById('qf-mode').value;
        const subcontractorId = mode === 'sous-traitant'
            ? parseInt(document.getElementById('qf-subcontractor').value) || null
            : null;

        if (mode === 'sous-traitant' && !subcontractorId) {
            showToast('Veuillez sélectionner un formateur', 'error');
            return;
        }

        const location = document.getElementById('qf-location').value.trim();

        // Récupérer les infos client pour auto-remplir
        const clientsResult = await SupabaseData.getClients();
        const clients = clientsResult.success ? clientsResult.data : [];
        const selectedClient = clients.find(c => c.id === clientId);

        // Récupérer le sous-traitant si applicable
        let subData = {};
        if (subcontractorId) {
            const subsResult = await SupabaseData.getSubcontractors();
            const sub = (subsResult.data || []).find(s => s.id === subcontractorId);
            if (sub) {
                subData = {
                    subcontractor_first_name: sub.first_name,
                    subcontractor_last_name: sub.last_name,
                    subcontractor_address: sub.address || '',
                    subcontractor_siret: sub.siret || '',
                    subcontractor_nda: sub.nda || ''
                };
            }
        }

        const submitBtn = document.getElementById('qf-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Création en cours...';

        try {
            const currentUser = (await supabaseClient.auth.getUser()).data.user;

            const formData = {
                formation_name: formationName,
                formation_type: 'entreprises',
                collaboration_mode: mode,
                client_id: clientId,
                subcontractor_id: subcontractorId,
                client_name: selectedClient ? selectedClient.company_name : '',
                company_name: selectedClient ? selectedClient.company_name : '',
                company_address: selectedClient ? selectedClient.address : '',
                company_postal_code: selectedClient ? [selectedClient.postal_code, selectedClient.city].filter(Boolean).join(' ') : '',
                company_director_name: selectedClient ? selectedClient.contact_name : '',
                client_email: selectedClient ? selectedClient.email : '',
                start_date: startDate,
                end_date: endDate,
                training_location: location,
                status: 'awaiting_prealable',
                title: formationName,
                created_by: currentUser.id,
                ...subData
            };

            const { data: created, error } = await supabaseClient
                .from('formations')
                .insert([formData])
                .select()
                .single();

            if (error) throw error;

            addNotification('formation', `Formation créée — ${formationName}`);

            // Créer l'accès client + envoyer le mail automatiquement
            let accessMsg = '';
            if (selectedClient && selectedClient.email) {
                const accessResult = await this.createClientAccessSilent(created.id);
                if (accessResult.success) {
                    accessMsg = ` — préalable envoyé à ${accessResult.email}`;
                } else {
                    accessMsg = ` — accès client non créé : ${accessResult.message}`;
                }
            }

            // Fermer la modal
            const modal = document.getElementById('quick-formation-modal');
            if (modal) modal.remove();

            showToast(`Formation créée${accessMsg}`, 'success', 5000);

            // Naviguer vers la liste formations
            this.showPage('formations');
            document.querySelectorAll('.nav-item').forEach(nav => {
                nav.classList.toggle('active', nav.getAttribute('data-page') === 'formations');
            });
            this.loadFormations();
        } catch (err) {
            console.error('Erreur création formation:', err);
            showToast('Erreur : ' + err.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Créer et envoyer le préalable';
        }
    },

    async loadFormations() {
        const result = await SupabaseData.getFormations();


        if (!result.success) {
            console.error('❌ Erreur lors du chargement des formations:', result.message);
            showToast('Erreur chargement: ' + result.message, 'error');
            return;
        }

        const formations = result.data;
        this.allFormations = formations; // Stocker pour le filtrage

        const tbody = document.getElementById('formations-tbody');

        if (!tbody) {
            console.error('❌ Élément formations-tbody introuvable dans le DOM!');
            return;
        }


        tbody.innerHTML = formations.map(f => `
            <tr style="border-bottom: 1px solid var(--gray-200); vertical-align: top;">
                <td style="padding: 1rem;">${f.client_name || f.title || 'Sans nom'}</td>
                <td style="padding: 1rem;">${f.formation_name || f.description || 'N/A'}</td>
                <td style="padding: 1rem;">
                    <span style="padding: 0.25rem 0.75rem; background: ${f.status === 'completed' ? '#d1fae5' : f.status === 'in_progress' ? '#fef3c7' : f.status === 'awaiting_prealable' ? '#f3e8ff' : '#dbeafe'}; color: ${f.status === 'completed' ? '#065f46' : f.status === 'in_progress' ? '#92400e' : f.status === 'awaiting_prealable' ? '#6b21a8' : '#1e40af'}; border-radius: 9999px; font-size: 0.875rem; font-weight: 500;">
                        ${f.status === 'completed' ? 'Terminée' : f.status === 'in_progress' ? 'En cours' : f.status === 'awaiting_prealable' ? '⏳ Préalable en attente' : 'Planifiée'}
                    </span>
                    ${f.status === 'awaiting_prealable' ? `<br><a href="#" onclick="event.preventDefault();CRMApp.sendPrealableReminderDirect(${f.id})" style="font-size:0.75rem;color:#6b21a8;margin-top:0.25rem;display:inline-block;">Relancer le client</a>` : ''}
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

                    const rTypes = ['fiche_pedagogique', 'google_doc', 'convention', 'contrat_sous_traitance', 'attendance_sheet', 'certificate'];
                    const canRegen = rTypes.includes(doc.type);

                    return `
                            <div style="margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                                <a href="#" onclick="event.preventDefault(); ${canRegen ? `CRMApp.openDocument(${f.id}, '${doc.type}')` : (doc.document_url ? `window.open('${doc.document_url}', '_blank')` : `showToast('Document non disponible', 'warning')`)}" style="color: ${color}; text-decoration: none; font-size: 0.875rem; display: flex; align-items: center; gap: 4px; flex: 1; cursor: pointer;">
                                    ${icon}
                                    <span style="flex: 1;">${doc.name || 'Document'}</span>
                                </a>
                            </div>
                        `;
                }).join('')
                : '<span style="color: #9ca3af; font-size: 0.875rem;">0 fichier(s)</span>'
            }
                </td>
                <td style="padding: 1rem; text-align: center;">
                    <div class="dropdown">
                        <button onclick="this.parentElement.classList.toggle('open')" style="padding: 0.5rem 1rem; background: var(--gray-100); border: none; border-radius: var(--radius-md); cursor: pointer; color: var(--gray-700); font-weight: 500;">Actions ▼</button>
                        <div class="dropdown-content" style="min-width: 220px;">
                            <button onclick="CRMApp.viewFormation(${f.id})" style="font-weight: 500;">📋 Voir / Modifier</button>

                            <div style="border-top: 1px solid #e5e7eb; margin: 4px 0; padding-top: 2px;">
                                <span style="font-size: 0.65rem; color: #9ca3af; padding: 0 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Documents</span>
                            </div>
                            <button onclick="CRMApp.createPedagogicalSheet(${f.id})">📄 Fiche pédagogique</button>
                            <button onclick="CRMApp.createConvention(${f.id})">📑 Convention</button>
                            <button onclick="CRMApp.createContratSousTraitance(${f.id})">📝 Contrat sous-traitance</button>
                            <button onclick="CRMApp.createAttendanceSheet(${f.id})">📋 Feuille de présence</button>
                            <button onclick="CRMApp.createCertificate(${f.id})">🏅 Certificat + Attestation</button>

                            <div style="border-top: 1px solid #e5e7eb; margin: 4px 0; padding-top: 2px;">
                                <span style="font-size: 0.65rem; color: #9ca3af; padding: 0 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Emails</span>
                            </div>
                            <button onclick="CRMApp.inviterClient(${f.id})" style="color: #0284c7;">🔑 Inviter client (acces)</button>
                            <button onclick="CRMApp.sendConvocation(${f.id})" style="color: #7c3aed;">📧 Convocation</button>
                            <button onclick="CRMApp.relanceConvention(${f.id})" style="color: #b45309;">📩 Relance convention</button>
                            <button onclick="CRMApp.sendMailFinFormation(${f.id})" style="color: #059669;">✅ Mail fin de formation</button>
                            <button onclick="CRMApp.relanceQuestionnaires(${f.id})" style="color: #dc2626;">📊 Relance questionnaires</button>

                            <div style="border-top: 1px solid #e5e7eb; margin: 4px 0; padding-top: 2px;">
                                <span style="font-size: 0.65rem; color: #9ca3af; padding: 0 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Admin</span>
                            </div>
                            <button onclick="CRMApp.envoyerVersBPF(${f.id})" style="color: #059669;">📈 Envoyer vers BPF</button>
                            <button onclick="CRMApp.deleteFormation(${f.id})" style="color: #991b1b;">🗑 Supprimer</button>
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');

    },

    filterFormations() {
        const search = (document.getElementById('formations-search')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('formations-status-filter')?.value || '';

        const tbody = document.getElementById('formations-tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        let visibleCount = 0;

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const statusCell = row.querySelector('td:nth-child(3)');
            const statusText = statusCell ? statusCell.textContent.trim().toLowerCase() : '';

            let matchesSearch = !search || text.includes(search);
            let matchesStatus = !statusFilter;

            if (statusFilter) {
                const statusMap = { 'planned': 'planifi', 'in_progress': 'en cours', 'completed': 'termin', 'awaiting_prealable': 'pr\u00E9alable' };
                matchesStatus = statusText.includes(statusMap[statusFilter] || statusFilter);
            }

            if (matchesSearch && matchesStatus) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });
    },

    viewFormation(id) {
        this.showFormationDetail(id);
    },

    async showFormationDetail(formationId) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*, formation_documents(*)')
                .eq('id', formationId)
                .single();

            if (error) throw error;

            // Récupérer les logs de convocation
            const convocResult = await SupabaseData.getConvocationLogs(formationId);
            const convocLogs = convocResult.success ? convocResult.data : [];

            // Déterminer les documents existants
            const docs = formation.formation_documents || [];
            const hasDoc = (type) => docs.some(d => d.type === type || (type === 'fiche_pedagogique' && d.type === 'google_doc'));
            const hasConvocation = convocLogs.length > 0;

            // Infos formatées
            const startDate = formation.start_date ? new Date(formation.start_date).toLocaleDateString('fr-FR') : 'N/A';
            const endDate = formation.end_date ? new Date(formation.end_date).toLocaleDateString('fr-FR') : 'N/A';
            const learnersData = typeof formation.learners_data === 'string' ? JSON.parse(formation.learners_data || '[]') : (formation.learners_data || []);

            const statusColors = {
                'planned': 'planned', 'in_progress': 'in_progress',
                'completed': 'completed', 'cancelled': 'cancelled',
                'awaiting_prealable': 'awaiting_prealable'
            };

            // Verifier si le compte client existe
            let hasClientAccount = false;
            if (formation.client_email) {
                const profileCheck = await SupabaseData.getProfileByEmail(formation.client_email);
                hasClientAccount = profileCheck.success && profileCheck.data;
            }

            // États des étapes
            const hasPrealable = formation.prealable_recu === true;
            const hasFichePeda = hasDoc('fiche_pedagogique');
            const hasConvention = hasDoc('convention');
            const hasContratST = hasDoc('contrat_sous_traitance');
            const hasAttendance = hasDoc('attendance_sheet');
            const hasCertificate = hasDoc('certificate');
            const isSousTraitant = !!formation.subcontractor_first_name;
            const learnersCount = learnersData.length;

            // Helper pour générer un item de phase
            const phaseItem = (done, label, primary, secondary) => {
                const checkIcon = done ? '✅' : '□';
                const checkColor = done ? '#059669' : 'var(--gray-400)';
                const labelColor = done ? 'var(--gray-600)' : 'var(--gray-900)';
                const textDecor = done ? 'text-decoration:line-through;' : '';
                return `
                    <div style="padding:0.75rem 0;border-bottom:1px solid var(--gray-100);">
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
                            <span style="font-size:1rem;color:${checkColor};">${checkIcon}</span>
                            <span style="font-size:0.9rem;font-weight:500;color:${labelColor};${textDecor}">${label}</span>
                        </div>
                        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;padding-left:1.5rem;">
                            ${primary ? `<button onclick="${primary.action}" style="padding:0.35rem 0.75rem;background:${primary.bg || 'var(--primary-pink)'};color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-size:0.8rem;font-weight:500;">${primary.label}</button>` : ''}
                            ${secondary ? `<button onclick="${secondary.action}" style="padding:0.35rem 0.75rem;background:var(--gray-100);color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);cursor:pointer;font-size:0.8rem;">${secondary.label}</button>` : ''}
                        </div>
                    </div>`;
            };

            // Documents pour l'espace client (BLOC 3)
            const clientDocTypes = {
                'fiche_pedagogique': '📝', 'google_doc': '📝',
                'convention': '📄', 'attendance_sheet': '📋',
                'certificate': '🏅', 'contrat_sous_traitance': '📝',
                'manual': '📎'
            };
            const clientVisibleDocs = docs.filter(d => d.type !== 'contrat_sous_traitance');
            const staticDocs = [
                { icon: '📖', name: 'Livret d\'accueil NJM Conseil', label: 'Automatique' },
                { icon: '📝', name: 'Fiche de réclamation', label: 'Automatique' },
                { icon: '📋', name: 'Document préalable', label: 'Automatique' }
            ];

            const container = document.getElementById('formation-detail-content');
            container.innerHTML = `
                <!-- BLOC 1 — Header -->
                <div class="formation-detail-header">
                    <div>
                        <button onclick="CRMApp.showPage('formations')" style="background: none; border: none; cursor: pointer; color: var(--primary-purple); font-weight: 500; margin-bottom: 0.5rem; padding: 0; font-size: 0.9rem;">
                            ← Retour aux formations
                        </button>
                        <h2>${formation.formation_name || 'Formation'}</h2>
                        <div class="meta">
                            ${formation.company_name || formation.client_name || 'Client'} &bull;
                            ${formation.custom_dates || (startDate + (startDate !== endDate ? ' - ' + endDate : ''))} &bull;
                            ${formation.training_location || ''} &bull;
                            ${learnersCount} apprenant(s) &bull;
                            ${formation.hours_per_learner || 0}h &bull;
                            ${formation.total_amount || 0} EUR HT
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <select class="status-badge-select ${statusColors[formation.status] || 'planned'}" onchange="CRMApp.updateFormationStatus(${formationId}, this.value)" id="detail-status-select">
                            <option value="awaiting_prealable" ${formation.status === 'awaiting_prealable' ? 'selected' : ''}>⏳ Préalable en attente</option>
                            <option value="planned" ${formation.status === 'planned' ? 'selected' : ''}>Planifiée</option>
                            <option value="in_progress" ${formation.status === 'in_progress' ? 'selected' : ''}>En cours</option>
                            <option value="completed" ${formation.status === 'completed' ? 'selected' : ''}>Terminée</option>
                            <option value="cancelled" ${formation.status === 'cancelled' ? 'selected' : ''}>Annulée</option>
                        </select>
                        <button onclick="FormationForm.show(${formationId})" style="padding: 0.5rem 1rem; background: var(--gray-100); border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; color: var(--gray-700);">
                            Modifier les infos
                        </button>
                    </div>
                </div>

                <!-- BLOC 2 — 3 phases -->
                <div class="formation-phases" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:1rem;margin-bottom:1.5rem;">
                    <!-- ① Préparer -->
                    <div style="background:white;border-radius:var(--radius-xl);padding:1.25rem;box-shadow:var(--shadow-sm);border-top:3px solid #3b82f6;">
                        <h3 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">① Préparer</h3>
                        ${phaseItem(
                            hasPrealable,
                            hasPrealable ? `Préalable reçu (${learnersCount} apprenant${learnersCount > 1 ? 's' : ''})` : 'Préalable',
                            { label: hasPrealable ? 'Modifier' : 'Remplir', action: `CRMApp.showPrealableAdminForm(${formationId})`, bg: hasPrealable ? 'var(--gray-400)' : 'var(--primary-pink)' },
                            hasPrealable ? null : { label: 'Relancer', action: `CRMApp.sendPrealableReminderDirect(${formationId})` }
                        )}
                        ${phaseItem(
                            hasFichePeda,
                            'Fiche pédagogique',
                            { label: hasFichePeda ? 'Ouvrir' : 'Créer', action: hasFichePeda ? `CRMApp.openDocument(${formationId}, 'fiche_pedagogique')` : `CRMApp.createPedagogicalSheet(${formationId})` }
                        )}
                        ${phaseItem(
                            hasConvention && !!formation.client_signed_at,
                            hasConvention
                                ? (formation.client_signed_at
                                    ? `Convention — <span style="color:#059669;font-weight:600;">✍️ Signée le ${new Date(formation.client_signed_at).toLocaleDateString('fr-FR')}</span>`
                                    : `Convention — <span style="color:#d97706;font-weight:600;">⏳ En attente signature client</span>`)
                                : 'Convention',
                            { label: hasConvention ? 'Ouvrir' : 'Créer', action: hasConvention ? `CRMApp.openDocument(${formationId}, 'convention')` : `CRMApp.createConvention(${formationId})` },
                            hasConvention ? { label: 'Relancer', action: `CRMApp.relanceConvention(${formationId})` } : null
                        )}
                        ${phaseItem(
                            hasConvocation,
                            'Convocation',
                            { label: hasConvocation ? 'Renvoyer' : 'Envoyer', action: `CRMApp.sendConvocation(${formationId})` }
                        )}
                        ${isSousTraitant ? phaseItem(
                            hasContratST && !!formation.subcontractor_signed_at,
                            hasContratST
                                ? (formation.subcontractor_signed_at
                                    ? `Contrat sous-traitance — <span style="color:#059669;font-weight:600;">✍️ Signé le ${new Date(formation.subcontractor_signed_at).toLocaleDateString('fr-FR')}</span>`
                                    : `Contrat sous-traitance — <span style="color:#d97706;font-weight:600;">⏳ En attente signature formateur</span>`)
                                : 'Contrat sous-traitance',
                            { label: hasContratST ? 'Ouvrir' : 'Créer', action: hasContratST ? `CRMApp.openDocument(${formationId}, 'contrat_sous_traitance')` : `CRMApp.createContratSousTraitance(${formationId})` },
                            { label: 'Envoyer', action: `CRMApp.sendContratSousTraitance(${formationId})` }
                        ) : ''}
                    </div>

                    <!-- ② Pendant -->
                    <div style="background:white;border-radius:var(--radius-xl);padding:1.25rem;box-shadow:var(--shadow-sm);border-top:3px solid #f59e0b;">
                        <h3 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">② Pendant</h3>
                        ${phaseItem(
                            hasAttendance,
                            'Feuille de présence',
                            { label: hasAttendance ? 'Ouvrir' : 'Créer', action: hasAttendance ? `CRMApp.openDocument(${formationId}, 'attendance_sheet')` : `CRMApp.createAttendanceSheet(${formationId})` }
                        )}
                        ${phaseItem(
                            hasClientAccount,
                            'Accès client',
                            { label: hasClientAccount ? 'Inviter' : "Créer + envoyer", action: hasClientAccount ? `CRMApp.inviterClient(${formationId})` : `CRMApp.createClientAccessFromWorkflow(${formationId})` }
                        )}
                    </div>

                    <!-- ③ Clôturer -->
                    <div style="background:white;border-radius:var(--radius-xl);padding:1.25rem;box-shadow:var(--shadow-sm);border-top:3px solid #059669;">
                        <h3 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">③ Clôturer</h3>
                        ${phaseItem(
                            hasCertificate,
                            'Certificat + Attestation',
                            { label: hasCertificate ? 'Ouvrir' : 'Créer', action: hasCertificate ? `CRMApp.openDocument(${formationId}, 'certificate')` : `CRMApp.createCertificate(${formationId})` }
                        )}
                        ${phaseItem(
                            false,
                            'Mail fin de formation',
                            { label: 'Envoyer', action: `CRMApp.sendMailFinFormation(${formationId})` }
                        )}
                        ${phaseItem(
                            false,
                            'Bilan de formation',
                            { label: 'Télécharger', action: `window.open('assets/static/bilan-formation.docx', '_blank')`, bg: 'var(--gray-400)' }
                        )}
                        ${phaseItem(
                            false,
                            'BPF',
                            { label: 'Envoyer', action: `CRMApp.envoyerVersBPF(${formationId})` }
                        )}
                    </div>
                </div>

                <!-- BLOC 3 — Espace client -->
                <div style="background:white;border-radius:var(--radius-xl);padding:1.5rem;box-shadow:var(--shadow-sm);margin-bottom:1.5rem;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
                        <h3 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0;">👁 Espace client — Ce que voit le client</h3>
                        <input type="file" id="upload-doc-${formationId}" accept=".pdf,.doc,.docx,.xlsx,.png,.jpg" onchange="CRMApp.uploadFormationDocument(${formationId}, this.files[0])" style="display:none;">
                        <button onclick="document.getElementById('upload-doc-${formationId}').click()" style="padding:0.35rem 0.85rem;background:var(--primary-orange);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-size:0.8rem;font-weight:600;">+ Ajouter un document</button>
                    </div>
                    <div style="display:grid;gap:0.5rem;">
                        ${clientVisibleDocs.length === 0 && staticDocs.length === 0 ? '<p style="color:var(--gray-500);font-size:0.9rem;">Aucun document généré</p>' : ''}
                        ${clientVisibleDocs.map(doc => {
                            const typeLabels = { 'fiche_pedagogique': 'Fiche pédagogique', 'google_doc': 'Fiche pédagogique', 'convention': 'Convention', 'attendance_sheet': 'Feuille de présence', 'certificate': 'Certificat', 'manual': 'Document' };
                            const icon = clientDocTypes[doc.type] || '📄';
                            const visible = doc.visible_client !== false;
                            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;background:var(--gray-50);border-radius:var(--radius-md);border:1px solid ${visible ? 'var(--gray-200)' : '#fca5a5'};">
                                <span style="font-size:0.9rem;color:var(--gray-800);display:flex;align-items:center;gap:0.5rem;">
                                    <span style="font-size:1.1rem;">${icon}</span>
                                    ${doc.name || typeLabels[doc.type] || doc.type}
                                </span>
                                <div style="display:flex;align-items:center;gap:0.75rem;">
                                    <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.8rem;color:${visible ? '#059669' : '#dc2626'};font-weight:500;cursor:pointer;" title="Basculer la visibilité client">
                                        <input type="checkbox" ${visible ? 'checked' : ''} onchange="CRMApp.toggleDocVisibility(${doc.id}, this.checked, ${formationId})" style="cursor:pointer;">
                                        ${visible ? '👁 Visible' : '🔒 Masqué'}
                                    </label>
                                    <button onclick="${doc.type === 'manual' ? `window.open('${doc.document_url}', '_blank')` : `CRMApp.openDocument(${formationId}, '${doc.type}')`}" style="padding:0.3rem 0.7rem;background:white;color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);cursor:pointer;font-size:0.8rem;">Ouvrir</button>
                                    <button onclick="CRMApp.deleteManualDocument(${doc.id}, ${formationId})" title="Supprimer" style="padding:0.3rem 0.55rem;background:white;color:#dc2626;border:1px solid #fca5a5;border-radius:var(--radius-md);cursor:pointer;font-size:0.9rem;line-height:1;">🗑️</button>
                                </div>
                            </div>`;
                        }).join('')}
                        ${staticDocs.map(d => `
                            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;background:#f3e8ff;border-radius:var(--radius-md);border:1px solid #c084fc;">
                                <span style="font-size:0.9rem;color:var(--gray-800);display:flex;align-items:center;gap:0.5rem;">
                                    <span style="font-size:1.1rem;">${d.icon}</span>
                                    ${d.name}
                                </span>
                                <span style="font-size:0.75rem;color:#6b21a8;background:white;padding:0.2rem 0.6rem;border-radius:9999px;font-weight:500;">${d.label}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- BLOC 4 — Communications -->
                <div style="background:white;border-radius:var(--radius-xl);padding:1.5rem;box-shadow:var(--shadow-sm);margin-bottom:1.5rem;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
                        <h3 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0;">✉️ Communications (${convocLogs.length})</h3>
                        <button onclick="CRMApp.sendMailLibre(${formationId})" style="padding:0.45rem 1rem;background:var(--primary-pink);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:600;font-size:0.85rem;">
                            ✉️ Envoyer un mail
                        </button>
                    </div>
                    ${convocLogs.length === 0 ? '<p style="color:var(--gray-500);font-size:0.9rem;">Aucun email envoyé</p>' :
                        `<div style="display:grid;gap:0.5rem;">
                            ${convocLogs.map(log => `
                                <div style="padding:0.65rem 0.85rem;background:var(--gray-50);border-radius:var(--radius-md);border-left:3px solid var(--primary-pink);">
                                    <div style="font-size:0.85rem;font-weight:500;color:var(--gray-900);">${log.subject || 'Mail'}</div>
                                    <div style="font-size:0.75rem;color:var(--gray-500);margin-top:0.15rem;">${new Date(log.sent_at || log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} — ${log.sent_to}</div>
                                </div>
                            `).join('')}
                        </div>`
                    }
                </div>

                <!-- Supports pédagogiques -->
                <div class="workflow-section">
                    <h3 style="display: flex; align-items: center; justify-content: space-between;">
                        <span>📚 Supports pédagogiques</span>
                        <button onclick="CRMApp.showAssignSupportModal(${formationId})" style="padding: 0.35rem 0.85rem; background: var(--primary-orange); color: white; border: none; border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 600; cursor: pointer;">+ Assigner</button>
                    </h3>
                    <div id="formation-supports-list" style="margin-top: 0.5rem;">
                        <p style="color: var(--gray-400); font-size: 0.85rem;">Chargement...</p>
                    </div>
                </div>

                <!-- Questionnaires attribués -->
                <div class="workflow-section" style="background:white;border-radius:var(--radius-xl);padding:1.5rem;box-shadow:var(--shadow-sm);margin-top:1.5rem;">
                    <h3 style="display: flex; align-items: center; justify-content: space-between; margin: 0 0 1rem 0; font-size:1rem; font-weight:700; color:var(--gray-900);">
                        <span>📝 Questionnaires attribués</span>
                        <button onclick="CRMApp.showAssignQuestionnaireModal(${formationId})" style="padding: 0.35rem 0.85rem; background: var(--primary-orange); color: white; border: none; border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 600; cursor: pointer;">+ Attribuer</button>
                    </h3>
                    <div id="formation-questionnaires-list" style="display: grid; gap: 0.5rem;">
                        <p style="color: var(--gray-400); font-size: 0.85rem;">Chargement...</p>
                    </div>
                </div>
            `;

            // Charger les supports assignés
            this.loadFormationSupports(formationId);

            // Charger les questionnaires attribués
            this.loadFormationQuestionnaires(formationId);

            // Afficher la page
            this.showPage('formation-detail');

        } catch (error) {
            console.error('Erreur affichage detail formation:', error);
            showToast('Erreur: ' + error.message, 'error');
        }
    },

    async loadFormationSupports(formationId, containerId) {
        const container = document.getElementById(containerId || 'formation-supports-list');
        if (!container) return;

        const result = await SupabaseData.getFormationSupports(formationId);
        const supports = result.success ? result.data : [];

        if (supports.length === 0) {
            container.innerHTML = '<p style="color: var(--gray-400); font-size: 0.85rem;">Aucun support assigné. Cliquez "+ Assigner" pour en ajouter.</p>';
            return;
        }

        const fileIcon = (title) => {
            const t = (title || '').toLowerCase();
            if (t.includes('pdf')) return '📕';
            if (t.includes('pptx') || t.includes('ppt')) return '📊';
            if (t.includes('xlsx') || t.includes('xls')) return '📗';
            return '📘';
        };

        container.innerHTML = supports.map(s => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--gray-100);">
                <span style="font-size: 0.85rem; color: var(--gray-800); display: flex; align-items: center; gap: 0.5rem;">
                    ${fileIcon(s.title)} ${s.title}
                    <span style="font-size: 0.7rem; color: var(--gray-400); background: var(--gray-100); padding: 0.1rem 0.4rem; border-radius: 8px;">${this.supportCategoryLabels[s.category] || s.category}</span>
                </span>
                <div style="display: flex; gap: 0.5rem;">
                    ${s.file_url ? `<a href="${normalizeAssetUrl(s.file_url)}" target="_blank" style="font-size: 0.8rem; color: var(--primary-purple); text-decoration: none; padding: 0.2rem 0.5rem; background: #f3f0ff; border-radius: var(--radius-sm);">Ouvrir</a>` : ''}
                    <button onclick="CRMApp.removeSupportFromFormation(${formationId}, ${s.id})" style="background: none; border: none; color: var(--gray-400); cursor: pointer; font-size: 0.8rem;">✕</button>
                </div>
            </div>
        `).join('');
    },

    async showAssignSupportModal(formationId) {
        // Charger tous les supports disponibles
        const allSupports = [];
        for (const cat of this.supportCategories) {
            const result = await SupabaseData.getPedagogicalLibrary(cat);
            if (result.success) {
                result.data.forEach(s => allSupports.push(s));
            }
        }

        // Charger les supports déjà assignés
        const assigned = await SupabaseData.getFormationSupports(formationId);
        const assignedIds = new Set((assigned.data || []).map(s => s.id));

        // Grouper par catégorie
        const byCategory = {};
        allSupports.forEach(s => {
            if (assignedIds.has(s.id)) return; // Exclure les déjà assignés
            const cat = this.supportCategoryLabels[s.category] || s.category;
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(s);
        });

        const modal = document.createElement('div');
        modal.id = 'assign-support-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        modal.innerHTML = `
            <div style="background:white;border-radius:var(--radius-xl);padding:2rem;width:600px;max-width:90%;max-height:80vh;overflow-y:auto;box-shadow:var(--shadow-lg);">
                <h3 style="font-size:1.125rem;font-weight:700;margin-bottom:1rem;">Assigner des supports à cette formation</h3>
                <input type="search" id="assign-support-search" placeholder="Rechercher un support..." oninput="document.querySelectorAll('#assign-support-list .support-assign-item').forEach(el => el.style.display = el.textContent.toLowerCase().includes(this.value.toLowerCase()) ? '' : 'none')" style="width:100%;padding:0.6rem 1rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);margin-bottom:1rem;box-sizing:border-box;">
                <div id="assign-support-list" style="max-height: 50vh; overflow-y: auto;">
                    ${Object.entries(byCategory).map(([cat, supports]) => {
                        const ids = supports.map(s => s.id).join(',');
                        return `
                        <div style="margin-bottom: 1rem;">
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid var(--gray-200); margin-bottom: 0.5rem;">
                                <span style="font-weight: 600; font-size: 0.85rem; color: var(--gray-700);">${cat} (${supports.length})</span>
                                <button onclick="CRMApp.assignAllSupports(${formationId}, [${ids}], this)" style="padding: 0.2rem 0.7rem; background: #059669; color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.75rem; font-weight: 600;">Tout ajouter</button>
                            </div>
                            ${supports.map(s => `
                                <div class="support-assign-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.5rem; border-radius: var(--radius-sm);" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background='transparent'">
                                    <span style="font-size: 0.85rem;">${s.title}</span>
                                    <button onclick="CRMApp.assignSupport(${formationId}, ${s.id}, this)" style="padding: 0.2rem 0.6rem; background: var(--primary-purple); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.75rem;">Ajouter</button>
                                </div>
                            `).join('')}
                        </div>`;
                    }).join('')}
                </div>
                <div style="margin-top:1rem;text-align:right;">
                    <button onclick="document.getElementById('assign-support-modal').remove()" style="padding:0.6rem 1.25rem;background:var(--gray-200);color:var(--gray-700);border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:500;">Fermer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async assignAllSupports(formationId, supportIds, btn) {
        btn.disabled = true;
        btn.textContent = 'Ajout en cours...';

        let added = 0;
        for (const id of supportIds) {
            const result = await SupabaseData.assignSupportToFormation(formationId, id);
            if (result.success) added++;
        }

        btn.textContent = `✓ ${added} ajoutés`;
        btn.style.background = '#059669';
        showToast(`${added} supports assignés !`, 'success');
        this.loadFormationSupports(formationId);

        // Désactiver les boutons individuels "Ajouter" de ce groupe
        const parent = btn.closest('div[style*="margin-bottom"]');
        if (parent) {
            parent.querySelectorAll('.support-assign-item button').forEach(b => {
                b.textContent = '✓';
                b.disabled = true;
                b.style.background = '#059669';
            });
        }
    },

    async assignSupport(formationId, supportId, btn) {
        const result = await SupabaseData.assignSupportToFormation(formationId, supportId);
        if (result.success) {
            btn.textContent = '✓';
            btn.disabled = true;
            btn.style.background = '#059669';
            showToast('Support assigné !', 'success');
            this.loadFormationSupports(formationId);
        } else {
            showToast('Erreur: ' + result.message, 'error');
        }
    },

    async removeSupportFromFormation(formationId, supportId) {
        const result = await SupabaseData.removeSupportFromFormation(formationId, supportId);
        if (result.success) {
            showToast('Support retiré', 'info');
            this.loadFormationSupports(formationId);
        } else {
            showToast('Erreur: ' + result.message, 'error');
        }
    },

    async updateFormationStatus(formationId, newStatus) {
        try {
            const { error } = await supabaseClient
                .from('formations')
                .update({ status: newStatus })
                .eq('id', formationId);

            if (error) throw error;

            // Mettre a jour le badge visuel
            const select = document.getElementById('detail-status-select');
            if (select) {
                select.className = 'status-badge-select ' + newStatus;
            }

            showToast('Statut mis a jour', 'success');
            this.loadFormations(); // Mettre a jour le tableau en arriere-plan
        } catch (error) {
            console.error('Erreur mise a jour statut:', error);
            showToast('Erreur: ' + error.message, 'error');
        }
    },

    async createPedagogicalSheet(id) {
        await DocumentPreview.open(id, 'fiche_pedagogique');
    },

    async createConvention(id) {
        await DocumentPreview.open(id, 'convention');
    },

    async createContratSousTraitance(id) {
        await DocumentPreview.open(id, 'contrat_sous_traitance');
    },

    async sendContratSousTraitance(id) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;

            // Chercher l'email du sous-traitant via subcontractors ou profiles
            let subEmail = '';
            let subName = `${formation.subcontractor_first_name || ''} ${formation.subcontractor_last_name || ''}`.trim();

            if (formation.subcontractor_id) {
                const { data: sub } = await supabaseClient
                    .from('subcontractors')
                    .select('email, name, first_name, last_name')
                    .eq('id', formation.subcontractor_id)
                    .single();
                if (sub) {
                    subEmail = sub.email || '';
                    if (!subName) subName = sub.name || `${sub.first_name || ''} ${sub.last_name || ''}`.trim();
                }
            }

            const companyName = formation.company_name || formation.client_name || '';
            const formationName = formation.formation_name || '';

            const tpl = await SupabaseData.getEmailTemplate('contrat_sous_traitance');
            const vars = { '{{formation}}': formationName, '{{client}}': companyName, '{{formateur}}': subName };
            const tplSubject = tpl ? Object.keys(vars).reduce((s, k) => s.replaceAll(k, vars[k]), tpl.subject) : `Contrat de sous-traitance \u2014 ${formationName} \u2014 ${companyName}`;
            const tplBody = tpl ? Object.keys(vars).reduce((s, k) => s.replaceAll(k, vars[k]), tpl.body) : `Bonjour ${subName},\n\nVeuillez trouver ci-joint ou dans votre espace formateur le contrat de sous-traitance pour la formation "${formationName}" (client : ${companyName}).\n\nJe vous invite \u00E0 vous connecter \u00E0 votre espace formateur pour consulter l'ensemble des documents relatifs \u00E0 cette mission.\n\nCordialement,\nNathalie JOULIE MORAND\nNJM Conseil`;

            GenericEmail.show({
                title: 'Envoyer le contrat de sous-traitance',
                to: subEmail,
                subject: tplSubject,
                body: tplBody,
                formationId: id,
            });
        } catch (err) {
            console.error('Erreur envoi contrat sous-traitance:', err);
            showToast('Erreur: ' + err.message, 'error');
        }
    },

    async createAttendanceSheet(id) {
        await DocumentPreview.open(id, 'attendance_sheet');
    },

    async createCertificate(id) {
        await DocumentPreview.open(id, 'certificate');
    },

    /**
     * Sauvegarde la référence du document généré dans la BDD
     * Le PDF est régénéré à la volée quand l'utilisateur clique dessus
     */
    async _uploadAndSaveDoc(formationId, result, docType) {
        try {
            const docData = {
                name: result.name,
                type: docType,
                document_url: `generate://${docType}/${formationId}`,
                uploaded_at: new Date().toISOString()
            };

            const saveResult = await SupabaseData.addFormationDocument(formationId, docData);

            if (!saveResult.success) {
                console.error('Erreur sauvegarde doc:', saveResult);
                showToast('Erreur liaison: ' + saveResult.message, 'error');
                return null;
            }

            return docData;
        } catch (error) {
            console.error('Erreur sauvegarde document:', error);
            showToast('Erreur sauvegarde: ' + error.message, 'error');
            return null;
        }
    },

    async uploadFormationDocument(formationId, file) {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            showToast('Fichier trop lourd (max 10 Mo)', 'error');
            return;
        }
        try {
            showToast('Upload en cours...', 'info');
            const fileName = `formations/${formationId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('documents')
                .upload(fileName, file, { contentType: file.type, upsert: true });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabaseClient.storage
                .from('documents')
                .getPublicUrl(fileName);

            const publicUrl = urlData?.publicUrl || '';

            const saveResult = await SupabaseData.addFormationDocument(formationId, {
                name: file.name,
                type: 'manual',
                document_url: publicUrl,
                visible_client: true,
                uploaded_at: new Date().toISOString()
            });

            if (!saveResult.success) throw new Error(saveResult.message);

            showToast('Document ajouté !', 'success');
            addNotification('formation', `Document ajouté — ${file.name}`);
            this.showFormationDetail(formationId);
        } catch (error) {
            console.error('Erreur upload document:', error);
            showToast('Erreur upload: ' + error.message, 'error');
        }
    },

    async deleteManualDocument(docId, formationId) {
        const confirmed = await showConfirmDialog({
            title: 'Supprimer le document',
            message: 'Voulez-vous vraiment supprimer ce document ?',
            confirmText: 'Supprimer',
            isDangerous: true
        });
        if (!confirmed) return;
        try {
            const result = await SupabaseData.deleteFormationDocument(docId);
            if (result.success) {
                showToast('Document supprimé', 'success');
                this.showFormationDetail(formationId);
            } else {
                showToast('Erreur : ' + result.message, 'error');
            }
        } catch (error) {
            showToast('Erreur suppression: ' + error.message, 'error');
        }
    },

    async toggleDocVisibility(docId, visible, formationId) {
        try {
            const { error } = await supabaseClient
                .from('formation_documents')
                .update({ visible_client: visible })
                .eq('id', docId);
            if (error) throw error;

            showToast(visible ? 'Document visible par le client' : 'Document masqué au client', 'success');

            // Rafraîchir la fiche pour refléter le nouvel état (bordure + texte)
            if (formationId) {
                this.showFormationDetail(formationId);
            }
        } catch (error) {
            console.error('Erreur toggle visibilité:', error);
            showToast('Erreur : ' + (error.message || 'impossible de mettre à jour la visibilité'), 'error');
        }
    },

    /**
     * Ouvre un document en le régénérant à la volée depuis les données formation
     */
    async openDocument(formationId, docType) {
        try {
            const { data, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', formationId)
                .single();

            if (error) throw error;

            let result;
            switch (docType) {
                case 'fiche_pedagogique':
                case 'google_doc':
                    result = await PdfGenerator.generatePedagogicalSheet(data);
                    break;
                case 'convention':
                    result = await PdfGenerator.generateConvention(data);
                    break;
                case 'contrat_sous_traitance':
                    result = await PdfGenerator.generateContratSousTraitance(data);
                    break;
                case 'attendance_sheet':
                    result = await PdfGenerator.generateAttendanceSheet(data);
                    break;
                case 'certificate':
                    result = await PdfGenerator.generateCertificate(data);
                    break;
                default:
                    showToast('Type de document inconnu: ' + docType, 'error');
                    return null;
            }

            return result;
        } catch (error) {
            console.error('Erreur régénération document:', error);
            showToast('Erreur ouverture document: ' + error.message, 'error');
            return null;
        }
    },

    async deleteDocument(docId, formationName, docType = 'pdf') {
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
                showToast('Erreur suppression: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Exception dans deleteDocument:', error);
            showToast('Erreur: ' + error.message, 'error');
        }
    },


    async deleteFormation(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette formation ? Cette action est irréversible.')) {
            const result = await SupabaseData.deleteFormation(id);
            if (result.success) {
                await this.loadFormations();
                await this.updateDashboardStats();
            } else {
                showToast('Erreur suppression: ' + result.message, 'error');
            }
        }
    },

    async envoyerVersBPF(formationId) {
        try {
            // Vérifier si déjà envoyé vers BPF
            const { data: existingBPF } = await supabaseClient
                .from('bpf')
                .select('id')
                .eq('formation_id', formationId)
                .maybeSingle();

            if (existingBPF) {
                showToast('Cette formation a déjà été envoyée vers le BPF', 'warning');
                return;
            }

            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', formationId)
                .single();

            if (error) throw error;

            // Calculer le nombre d'apprenants
            let learnersCount = 0;
            let learnersData = [];
            if (formation.learners_data) {
                learnersData = typeof formation.learners_data === 'string'
                    ? JSON.parse(formation.learners_data)
                    : formation.learners_data;
                learnersCount = learnersData.length;
            }

            // Calculer l'année fiscale
            const startDate = formation.start_date ? new Date(formation.start_date) : new Date();
            const year = startDate.getMonth() >= 8 ? startDate.getFullYear() : startDate.getFullYear() - 1; // JS months: 0-11, septembre = 8

            const bpfData = {
                formation_type: formation.formation_name || '',
                company_name: formation.company_name || formation.client_name || '',
                year: year,
                amount_ht: formation.total_amount || 0,
                number_of_learners: learnersCount,
                total_hours: formation.hours_per_learner || 0,
                formation_id: formationId
            };

            if (!confirm(`Envoyer cette formation vers le BPF ?\n\n• ${bpfData.formation_type}\n• ${bpfData.company_name}\n• ${bpfData.amount_ht} € HT\n• ${bpfData.number_of_learners} apprenant(s)\n• ${bpfData.total_hours}h`)) {
                return;
            }

            const result = await SupabaseData.addBPF(bpfData);

            if (result.success) {
                showToast('Formation envoyée vers le BPF !', 'success');
                this.loadBPF();
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            console.error('Erreur envoi BPF:', error);
            showToast("Erreur lors de l'envoi vers le BPF", 'error');
        }
    },

    async createClientAccessFromWorkflow(formationId) {
        showToast('Création de l\'accès en cours...', 'info');
        const result = await this.createClientAccessSilent(formationId);
        if (result.success) {
            showToast(
                result.exists
                    ? `Mail d'accès renvoyé à ${result.email}`
                    : `Compte créé — mail envoyé à ${result.email}`,
                'success'
            );
            this.showFormationDetail(formationId);
        } else {
            showToast('Erreur : ' + (result.message || 'inconnue'), 'error');
        }
    },

    async createClientAccessSilent(formationId) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations').select('*').eq('id', formationId).single();
            if (error) throw error;

            const clientEmail = formation.client_email;
            if (!clientEmail) {
                return { success: false, message: 'Email client non renseigné' };
            }

            // Charger le template
            const tpl = await SupabaseData.getEmailTemplate('acces_client');
            const siteUrl = window.location.origin;
            const directorName = formation.company_director_name || '';
            const formationName = formation.formation_name || 'Formation';

            // Vérifier si le compte existe déjà
            const profileCheck = await SupabaseData.getProfileByEmail(clientEmail);
            if (profileCheck.success && profileCheck.data) {
                // S'assurer que le lien user ↔ client est bien créé (même si compte existait pour un autre client)
                if (formation.client_id && profileCheck.data.id) {
                    await SupabaseData.linkUserToClient(profileCheck.data.id, formation.client_id);
                }
                // Compte existe — envoyer directement le mail d'invitation
                let clientPassword = profileCheck.data.initial_password || '[mot de passe déjà communiqué]';
                const vars = { '{{formation}}': formationName, '{{dirigeant}}': directorName, '{{email}}': clientEmail, '{{password}}': clientPassword, '{{url}}': siteUrl };
                const subject = tpl ? Object.keys(vars).reduce((s, k) => s.replaceAll(k, vars[k]), tpl.subject) : `Votre espace formation NJM Conseil — ${formationName}`;
                const body = tpl ? Object.keys(vars).reduce((s, k) => s.replaceAll(k, vars[k]), tpl.body) : `Bonjour${directorName ? ' ' + directorName : ''},\n\nVotre espace formation est prêt.\n\nAccès : ${siteUrl}\nIdentifiant : ${clientEmail}\nMot de passe : ${clientPassword}\n\nMerci de compléter le questionnaire préalable depuis l'onglet "Préalable" de votre espace.\n\nCordialement,\nNathalie Joulie-Morand`;

                await EmailService.sendEmail(clientEmail, subject, body, []);
                return { success: true, exists: true, email: clientEmail };
            }

            // Créer le compte
            const password = Math.random().toString(36).slice(-8) + 'A1!';
            const clientName = formation.company_director_name || formation.company_name || '';

            const currentUser = (await supabaseClient.auth.getUser()).data.user;
            const result = await SupabaseAuth.registerUser(currentUser.id, {
                email: clientEmail,
                password: password,
                name: clientName,
                role: 'client',
                mustChangePassword: false
            });

            if (!result || !result.success) {
                return { success: false, message: result?.message || 'Erreur création compte' };
            }

            // Lier au client
            if (formation.client_id && result.userId) {
                await SupabaseData.linkUserToClient(result.userId, formation.client_id);
            }

            addNotification('acces', `Accès client créé pour ${clientEmail}`);

            // Envoyer le mail d'invitation via template
            const vars = { '{{formation}}': formationName, '{{dirigeant}}': directorName, '{{email}}': clientEmail, '{{password}}': password, '{{url}}': siteUrl };
            const subject = tpl ? Object.keys(vars).reduce((s, k) => s.replaceAll(k, vars[k]), tpl.subject) : `Votre espace formation NJM Conseil — ${formationName}`;
            const body = tpl ? Object.keys(vars).reduce((s, k) => s.replaceAll(k, vars[k]), tpl.body) : `Bonjour${directorName ? ' ' + directorName : ''},\n\nJ'ai créé pour vous un espace confidentiel où vous retrouverez tous les documents relatifs à la formation.\n\nAccès : ${siteUrl}\nIdentifiant : ${clientEmail}\nMot de passe : ${password}\n\nMerci de compléter le questionnaire préalable depuis l'onglet "Préalable" de votre espace.\n\nCordialement,\nNathalie Joulie-Morand`;

            await EmailService.sendEmail(clientEmail, subject, body, []);

            return { success: true, exists: false, email: clientEmail, password: password };
        } catch (err) {
            console.error('Erreur createClientAccessSilent:', err);
            return { success: false, message: err.message };
        }
    },

    async inviterClient(formationId) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', formationId)
                .single();

            if (error) throw error;

            const clientEmail = formation.client_email;
            if (!clientEmail) {
                showToast('Email client non renseigné. Modifiez la fiche pour ajouter un email.', 'error');
                return;
            }

            // Récupérer les identifiants du compte client
            let clientLogin = clientEmail;
            let clientPassword = '[mot de passe non disponible]';
            const profileResult = await SupabaseData.getProfileByEmail(clientEmail);
            if (profileResult.success && profileResult.data) {
                if (profileResult.data.initial_password) {
                    clientPassword = profileResult.data.initial_password;
                } else {
                    clientPassword = '⚠️ Réinitialisez le mot de passe dans Gestion des Accès';
                    showToast('Mot de passe initial non disponible. Réinitialisez-le dans Gestion des Accès.', 'warning', 5000);
                }
            } else {
                showToast('Aucun compte client trouvé pour ' + clientEmail + '. Créez-le dans Gestion des Accès.', 'warning', 6000);
                clientPassword = '⚠️ Compte non créé - créez-le dans Gestion des Accès';
            }

            const siteUrl = window.location.origin;
            const directorName = formation.company_director_name || '';
            const subject = `Vos accès à votre espace formation - ${formation.formation_name || 'Formation'}`;
            const body = `Bonjour${directorName ? ' ' + directorName : ''},

J'ai créé pour vous un espace confidentiel où vous retrouverez tous les documents relatifs à la formation.

En voici l'accès : ${siteUrl}
Votre identifiant : ${clientLogin}
Votre mot de passe : ${clientPassword}

Conservez-les précieusement.

Vous y trouverez :
-la convention de formation. Merci de me la retourner signée.
-la fiche pédagogique, telle que nous l'avons réfléchie ensemble
-le livret d'accueil d'NJM Conseil (pour les apprenants)
-la fiche de réclamation (pour les apprenants)

Cordialement

Nathalie Joulie-Morand`;

            GenericEmail.show({
                title: '🔑 Invitation client - Accès espace formation',
                to: clientEmail,
                subject,
                body,
                formationId
            });
        } catch (error) {
            console.error('Erreur invitation client:', error);
            showToast('Erreur invitation: ' + error.message, 'error');
        }
    },

    async sendConvocation(formationId) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*, formation_documents(*)')
                .eq('id', formationId)
                .single();

            if (error) throw error;

            ConvocationEmail.show(formation);
        } catch (error) {
            console.error('Erreur sendConvocation:', error);
            showToast('Erreur: ' + error.message, 'error');
        }
    },

    async showPrealableAdminForm(formationId) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations').select('*').eq('id', formationId).single();
            if (error) throw error;

            // Initialiser les données
            let learners = formation.learners_data || [];
            if (typeof learners === 'string') {
                try { learners = JSON.parse(learners); } catch (e) { learners = []; }
            }
            if (learners.length === 0) {
                learners = [{ id: Date.now(), first_name: '', last_name: '', email: '', birth_year: '', position_title: '', phone: '', entity: '' }];
            }

            this._adminPrealableLearners = learners.map(l => ({ ...l }));
            this._adminPrealableFormationType = formation.prealable_formation_type || '';
            this._adminPrealableOpcoName = formation.opco_name || '';
            this._adminPrealableOpcoSubrogation = formation.opco_subrogation;

            const known = this.PREALABLE_FORMATION_TYPES;
            const isAutre = this._adminPrealableFormationType && !known.includes(this._adminPrealableFormationType);
            this._adminPrealableFormationTypeAutre = isAutre ? this._adminPrealableFormationType : '';
            this._adminPrealableFormationId = formationId;

            const existing = document.getElementById('admin-prealable-modal');
            if (existing) existing.remove();

            const inputStyle = 'padding:0.45rem 0.6rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.85rem;width:100%;box-sizing:border-box;';
            const labelStyle = 'font-size:0.75rem;font-weight:600;color:var(--gray-600);padding:0.5rem 0.5rem 0.25rem;white-space:nowrap;';

            const modal = document.createElement('div');
            modal.id = 'admin-prealable-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div style="background:white;border-radius:var(--radius-xl);padding:2rem;max-width:900px;width:95%;max-height:90vh;overflow-y:auto;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                        <h2 style="font-size:1.25rem;font-weight:700;color:var(--gray-900);margin:0;">Remplir le préalable — ${formation.company_name || formation.client_name || 'Client'}</h2>
                        <button onclick="document.getElementById('admin-prealable-modal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--gray-400);">&times;</button>
                    </div>
                    <div id="admin-prealable-content"></div>
                    <div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--gray-200);">
                        <button onclick="document.getElementById('admin-prealable-modal').remove()" style="padding:0.6rem 1.25rem;background:var(--gray-100);color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);font-weight:500;cursor:pointer;">Annuler</button>
                        <button onclick="CRMApp.submitPrealableAdmin()" id="admin-prealable-submit" style="padding:0.6rem 1.5rem;background:var(--primary-purple);color:white;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">Enregistrer le préalable</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            setTimeout(() => modal.classList.add('show'), 10);

            this._renderAdminPrealableForm();
        } catch (err) {
            console.error('Erreur showPrealableAdminForm:', err);
            showToast('Erreur: ' + err.message, 'error');
        }
    },

    _renderAdminPrealableForm() {
        const container = document.getElementById('admin-prealable-content');
        if (!container) return;

        const inputStyle = 'padding:0.45rem 0.6rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.85rem;width:100%;box-sizing:border-box;';
        const labelStyle = 'font-size:0.75rem;font-weight:600;color:var(--gray-600);padding:0.5rem 0.5rem 0.25rem;white-space:nowrap;';
        const formationTypes = this.PREALABLE_FORMATION_TYPES;
        const selectedType = this._adminPrealableFormationType;
        const isAutre = selectedType && !formationTypes.includes(selectedType);

        container.innerHTML = `
            <!-- SECTION 1 — Formation -->
            <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius-xl);padding:1.5rem;margin-bottom:1.5rem;">
                <h4 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">1. Formation</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:0.5rem;">
                    ${formationTypes.map(type => `
                        <label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:${selectedType === type ? '#eff6ff' : 'white'};border:1px solid ${selectedType === type ? '#3b82f6' : 'var(--gray-200)'};border-radius:var(--radius-md);cursor:pointer;font-size:0.875rem;">
                            <input type="radio" name="admin-pf-type" value="${type}" ${selectedType === type ? 'checked' : ''} onchange="CRMApp._setAdminPrealableType(this.value)" style="margin:0;">
                            ${type}
                        </label>
                    `).join('')}
                    <label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:${isAutre ? '#eff6ff' : 'white'};border:1px solid ${isAutre ? '#3b82f6' : 'var(--gray-200)'};border-radius:var(--radius-md);cursor:pointer;font-size:0.875rem;">
                        <input type="radio" name="admin-pf-type" value="__autre__" ${isAutre ? 'checked' : ''} onchange="CRMApp._setAdminPrealableType('__autre__')" style="margin:0;">
                        Autre
                    </label>
                </div>
                <div id="admin-pf-autre-container" style="margin-top:0.75rem;${isAutre ? '' : 'display:none;'}">
                    <input type="text" id="admin-pf-autre-input" placeholder="Précisez le type de formation" value="${this._adminPrealableFormationTypeAutre || ''}" onchange="CRMApp._adminPrealableFormationTypeAutre = this.value" style="${inputStyle} max-width:350px;">
                </div>
            </div>

            <!-- SECTION 2 — Apprenants -->
            <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius-xl);padding:1.5rem;margin-bottom:1.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h4 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0;">2. Apprenants</h4>
                    <span style="font-size:0.8rem;color:var(--gray-500);">${this._adminPrealableLearners.length}/12</span>
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;min-width:800px;">
                        <thead>
                            <tr style="background:white;">
                                <th style="${labelStyle}">#</th>
                                <th style="${labelStyle}">Prénom *</th>
                                <th style="${labelStyle}">NOM *</th>
                                <th style="${labelStyle}">Année naissance</th>
                                <th style="${labelStyle}">Poste</th>
                                <th style="${labelStyle}">N° téléphone</th>
                                <th style="${labelStyle}">Adresse mail</th>
                                <th style="${labelStyle}">Entité</th>
                                <th style="${labelStyle}"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this._adminPrealableLearners.map((l, i) => `
                                <tr style="border-top:1px solid var(--gray-200);">
                                    <td style="padding:0.4rem 0.5rem;text-align:center;color:var(--gray-500);font-weight:600;font-size:0.85rem;">${i + 1}</td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="text" value="${l.first_name || ''}" onchange="CRMApp._adminPrealableLearners[${i}].first_name=this.value" style="${inputStyle}"></td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="text" value="${l.last_name || ''}" onchange="CRMApp._adminPrealableLearners[${i}].last_name=this.value" style="${inputStyle} text-transform:uppercase;"></td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="text" value="${l.birth_year || ''}" placeholder="1985" maxlength="4" onchange="CRMApp._adminPrealableLearners[${i}].birth_year=this.value" style="${inputStyle} max-width:80px;"></td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="text" value="${l.position_title || ''}" onchange="CRMApp._adminPrealableLearners[${i}].position_title=this.value" style="${inputStyle}"></td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="tel" value="${l.phone || ''}" onchange="CRMApp._adminPrealableLearners[${i}].phone=this.value" style="${inputStyle} max-width:130px;"></td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="email" value="${l.email || ''}" onchange="CRMApp._adminPrealableLearners[${i}].email=this.value" style="${inputStyle}"></td>
                                    <td style="padding:0.4rem 0.25rem;"><input type="text" value="${l.entity || ''}" onchange="CRMApp._adminPrealableLearners[${i}].entity=this.value" style="${inputStyle}"></td>
                                    <td style="padding:0.4rem 0.25rem;text-align:center;">
                                        ${this._adminPrealableLearners.length > 1 ? `<button onclick="CRMApp._removeAdminPrealableLearner(${i})" style="background:none;border:none;color:var(--gray-400);cursor:pointer;font-size:1.1rem;">✕</button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="font-size:0.75rem;color:var(--gray-500);margin:0.75rem 0 0;font-style:italic;">Entité : raison sociale, n° SIRET et adresse.</p>
                ${this._adminPrealableLearners.length < 12 ? `
                    <button onclick="CRMApp._addAdminPrealableLearner()" style="margin-top:0.75rem;padding:0.45rem 1rem;background:white;color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.85rem;cursor:pointer;">+ Ajouter un apprenant</button>
                ` : ''}
            </div>

            <!-- SECTION 3 — OPCO -->
            <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius-xl);padding:1.5rem;">
                <h4 style="font-size:1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">3. OPCO</h4>
                <div style="display:flex;gap:1.5rem;align-items:flex-end;flex-wrap:wrap;">
                    <div style="flex:1;min-width:200px;">
                        <label style="display:block;font-size:0.8rem;font-weight:600;color:var(--gray-600);margin-bottom:0.35rem;">Nom de l'OPCO</label>
                        <input type="text" id="admin-pf-opco-name" value="${this._adminPrealableOpcoName || ''}" onchange="CRMApp._adminPrealableOpcoName=this.value" style="${inputStyle} max-width:300px;">
                    </div>
                    <div style="display:flex;gap:1rem;">
                        <label style="display:flex;align-items:center;gap:0.4rem;padding:0.5rem 0.75rem;background:${this._adminPrealableOpcoSubrogation === true ? '#eff6ff' : 'white'};border:1px solid ${this._adminPrealableOpcoSubrogation === true ? '#3b82f6' : 'var(--gray-200)'};border-radius:var(--radius-md);cursor:pointer;font-size:0.875rem;">
                            <input type="radio" name="admin-pf-subrogation" value="true" ${this._adminPrealableOpcoSubrogation === true ? 'checked' : ''} onchange="CRMApp._adminPrealableOpcoSubrogation=true" style="margin:0;">
                            Avec subrogation
                        </label>
                        <label style="display:flex;align-items:center;gap:0.4rem;padding:0.5rem 0.75rem;background:${this._adminPrealableOpcoSubrogation === false ? '#eff6ff' : 'white'};border:1px solid ${this._adminPrealableOpcoSubrogation === false ? '#3b82f6' : 'var(--gray-200)'};border-radius:var(--radius-md);cursor:pointer;font-size:0.875rem;">
                            <input type="radio" name="admin-pf-subrogation" value="false" ${this._adminPrealableOpcoSubrogation === false ? 'checked' : ''} onchange="CRMApp._adminPrealableOpcoSubrogation=false" style="margin:0;">
                            Sans subrogation
                        </label>
                    </div>
                </div>
            </div>
        `;
    },

    _setAdminPrealableType(value) {
        if (value === '__autre__') {
            this._adminPrealableFormationType = this._adminPrealableFormationTypeAutre || '';
            const c = document.getElementById('admin-pf-autre-container');
            if (c) c.style.display = '';
            const inp = document.getElementById('admin-pf-autre-input');
            if (inp) inp.focus();
        } else {
            this._adminPrealableFormationType = value;
            this._adminPrealableFormationTypeAutre = '';
            const c = document.getElementById('admin-pf-autre-container');
            if (c) c.style.display = 'none';
        }
    },

    _addAdminPrealableLearner() {
        if (this._adminPrealableLearners.length >= 12) { showToast('Maximum 12 apprenants', 'warning'); return; }
        this._adminPrealableLearners.push({ id: Date.now(), first_name: '', last_name: '', email: '', birth_year: '', position_title: '', phone: '', entity: '' });
        this._renderAdminPrealableForm();
    },

    _removeAdminPrealableLearner(index) {
        this._adminPrealableLearners.splice(index, 1);
        this._renderAdminPrealableForm();
    },

    async submitPrealableAdmin() {
        const isAutreRadio = document.querySelector('input[name="admin-pf-type"][value="__autre__"]');
        let formationType = this._adminPrealableFormationType;
        if (isAutreRadio && isAutreRadio.checked) {
            formationType = (this._adminPrealableFormationTypeAutre || '').trim();
        }

        if (!formationType) {
            showToast('Veuillez sélectionner un type de formation', 'error');
            return;
        }

        const valid = this._adminPrealableLearners.filter(l =>
            (l.first_name || '').trim() || (l.last_name || '').trim()
        );
        if (valid.length === 0) {
            showToast('Veuillez renseigner au moins un apprenant', 'error');
            return;
        }

        const learnersData = valid.map((l, i) => ({
            id: l.id || Date.now() + i,
            first_name: (l.first_name || '').trim(),
            last_name: (l.last_name || '').trim(),
            birth_year: (l.birth_year || '').trim(),
            position_title: (l.position_title || '').trim(),
            phone: (l.phone || '').trim(),
            email: (l.email || '').trim(),
            entity: (l.entity || '').trim(),
            position: i + 1
        }));

        const submitBtn = document.getElementById('admin-prealable-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enregistrement...';

        try {
            const result = await SupabaseData.updateFormation(this._adminPrealableFormationId, {
                learners_data: learnersData,
                prealable_recu: true,
                status: 'planned',
                prealable_formation_type: formationType,
                opco_name: (this._adminPrealableOpcoName || '').trim() || null,
                opco_subrogation: this._adminPrealableOpcoSubrogation === true,
                number_of_learners: learnersData.length
            });

            if (!result.success) throw new Error(result.message);

            showToast('Préalable renseigné manuellement', 'success');
            const modal = document.getElementById('admin-prealable-modal');
            if (modal) modal.remove();

            // Recharger la fiche formation
            this.showFormationDetail(this._adminPrealableFormationId);
        } catch (err) {
            console.error('Erreur submitPrealableAdmin:', err);
            showToast('Erreur: ' + err.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enregistrer le préalable';
        }
    },

    async sendPrealableReminderDirect(formationId) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations').select('client_email, formation_name, title, company_director_name').eq('id', formationId).single();
            if (error) throw error;

            const to = formation.client_email;
            if (!to) { showToast('Aucun email client renseigné', 'error'); return; }

            const formationName = formation.formation_name || formation.title || 'votre formation';
            const dirigeant = formation.company_director_name || '';
            const tpl = await SupabaseData.getEmailTemplate('prealable_reminder');
            const vars = { '{{formation}}': formationName, '{{dirigeant}}': dirigeant };
            const fallbackSubject = `Rappel — Merci de renseigner vos apprenants pour la formation ${formationName}`;
            const fallbackBody = `Bonjour${dirigeant ? ' ' + dirigeant : ''},\n\nNous vous rappelons que nous attendons les informations sur vos apprenants pour la formation "${formationName}".\n\nMerci de vous connecter à votre espace client pour remplir le questionnaire préalable.\n\nCordialement,\nNathalie JOULIE-MORAND\nNJM Conseil`;
            const subject = tpl ? Object.keys(vars).reduce((s, k) => s.replaceAll(k, vars[k]), tpl.subject) : fallbackSubject;
            const body = tpl ? Object.keys(vars).reduce((s, k) => s.replaceAll(k, vars[k]), tpl.body) : fallbackBody;

            const result = await EmailService.sendEmail(to, subject, body, []);
            if (result.success) {
                await SupabaseData.updateFormation(formationId, { prealable_envoye_at: new Date().toISOString() });
                showToast('Relance envoyée !', 'success');
                addNotification('mail', `Relance préalable envoyée à ${to}`);
            } else {
                window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
                showToast(`Envoi automatique échoué : ${result.message || 'erreur inconnue'}. Brouillon ouvert dans votre client mail.`, 'error', 6000);
            }
        } catch (err) {
            console.error('Erreur relance préalable:', err);
            showToast('Erreur: ' + err.message, 'error');
        }
    },

    // ==================== SIGNATURE ÉLECTRONIQUE ====================

    openSignatureModal(type, formationId) {
        if (typeof SignaturePad === 'undefined') {
            showToast('Module signature non chargé. Rafraîchissez la page.', 'error');
            return;
        }

        const existing = document.getElementById('signature-modal');
        if (existing) existing.remove();

        const title = type === 'client' ? 'Signez la convention' : 'Signez le contrat';

        const modal = document.createElement('div');
        modal.id = 'signature-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div style="background:white;border-radius:var(--radius-xl);padding:2rem;max-width:520px;width:95%;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h2 style="font-size:1.2rem;font-weight:700;color:var(--gray-900);margin:0;">${title}</h2>
                    <button onclick="document.getElementById('signature-modal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--gray-400);">&times;</button>
                </div>
                <p style="color:var(--gray-600);font-size:0.9rem;margin:0 0 1rem 0;">Utilisez votre souris ou votre doigt pour signer dans le cadre ci-dessous.</p>
                <div style="border:2px solid var(--gray-300);border-radius:var(--radius-md);background:white;overflow:hidden;touch-action:none;">
                    <canvas id="signature-canvas" width="470" height="200" style="display:block;width:100%;height:200px;cursor:crosshair;"></canvas>
                </div>
                <div style="display:flex;justify-content:space-between;gap:0.75rem;margin-top:1rem;flex-wrap:wrap;">
                    <button onclick="CRMApp._clearSignature()" style="padding:0.6rem 1rem;background:var(--gray-100);color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);font-weight:500;cursor:pointer;">
                        ✕ Effacer
                    </button>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                        <button onclick="document.getElementById('signature-modal').remove()" style="padding:0.6rem 1.25rem;background:var(--gray-100);color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);font-weight:500;cursor:pointer;">
                            Annuler
                        </button>
                        <button onclick="CRMApp.saveSignature('${type}', ${formationId})" id="signature-save-btn" style="padding:0.6rem 1.5rem;background:var(--primary-pink);color:white;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">
                            Valider la signature
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);

        // Initialiser SignaturePad
        const canvas = document.getElementById('signature-canvas');
        // Ajuster la résolution canvas au DPR pour un rendu net
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d').scale(ratio, ratio);

        this._signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)',
            minWidth: 0.8,
            maxWidth: 2.5
        });
    },

    _clearSignature() {
        if (this._signaturePad) this._signaturePad.clear();
    },

    async saveSignature(type, formationId) {
        if (!this._signaturePad || this._signaturePad.isEmpty()) {
            showToast('Veuillez dessiner votre signature avant de valider', 'error');
            return;
        }

        const btn = document.getElementById('signature-save-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement...'; }

        try {
            const signatureBase64 = this._signaturePad.toDataURL('image/png');
            const now = new Date().toISOString();

            // Charger la formation pour récupérer les noms (client/formateur)
            const { data: formation } = await supabaseClient
                .from('formations')
                .select('company_name, client_name, subcontractor_first_name, subcontractor_last_name')
                .eq('id', formationId)
                .single();

            const updates = type === 'client'
                ? { client_signature: signatureBase64, client_signed_at: now }
                : { subcontractor_signature: signatureBase64, subcontractor_signed_at: now };

            const result = await SupabaseData.updateFormation(formationId, updates);
            if (!result.success) throw new Error(result.message);

            showToast(type === 'client' ? 'Convention signée ✅' : 'Contrat signé ✅', 'success');

            // Notification détaillée avec nom et date
            const dateFr = new Date().toLocaleDateString('fr-FR');
            if (type === 'client') {
                const clientName = formation?.company_name || formation?.client_name || 'Client';
                addNotification('signature', `Convention signée — ${clientName} le ${dateFr}`);
            } else {
                const trainerName = `${formation?.subcontractor_first_name || ''} ${formation?.subcontractor_last_name || ''}`.trim() || 'Formateur';
                addNotification('signature', `Contrat signé — ${trainerName} le ${dateFr}`);
            }

            const modal = document.getElementById('signature-modal');
            if (modal) modal.remove();
            this._signaturePad = null;

            // Recharger la vue concernée
            if (type === 'client') {
                // Recharger la formation active pour refléter la signature
                if (this.clientFormations) {
                    const idx = this.clientFormations.findIndex(f => f.id === formationId);
                    if (idx !== -1) {
                        this.clientFormations[idx] = { ...this.clientFormations[idx], ...updates };
                        this.currentClientFormation = this.clientFormations[idx];
                    }
                }
                this.renderClientSpace();
            } else {
                // Sous-traitant : recharger les vues formateur
                if (this.currentPage === 'mes-documents') this.loadFormateurContracts();
                else this.loadMissions();
            }

            // Si l'admin a la fiche formation ouverte, recharger pour voir le badge
            if (this.currentPage === 'formation-detail') {
                await this.showFormationDetail(formationId);
            }
        } catch (err) {
            console.error('Erreur saveSignature:', err);
            showToast('Erreur : ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Valider la signature'; }
        }
    },

    // ==================== END SIGNATURE ====================

    async sendMailLibre(formationId) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations').select('client_email').eq('id', formationId).single();
            if (error) throw error;

            GenericEmail.show({
                title: 'Envoyer un mail',
                to: formation.client_email || '',
                subject: '',
                body: '',
                formationId: formationId
            });
        } catch (err) {
            console.error('Erreur sendMailLibre:', err);
            showToast('Erreur: ' + err.message, 'error');
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
                showToast("Aucun email client renseigné. Veuillez renseigner l'email dans la fiche formation.", 'error');
                return;
            }

            const directorName = formation.company_director_name || '';
            const companyName = formation.company_name || '';
            const formationName = formation.formation_name || 'Formation';

            const tpl = await SupabaseData.getEmailTemplate('relance_convention');
            const vars = { '{{formation}}': formationName, '{{client}}': companyName, '{{dirigeant}}': directorName };
            const subject = tpl ? Object.keys(vars).reduce((s, k) => s.replaceAll(k, vars[k]), tpl.subject) : `Convention de formation - ${formationName} - ${companyName}`;
            const body = tpl ? Object.keys(vars).reduce((s, k) => s.replaceAll(k, vars[k]), tpl.body) : `Bonjour${directorName ? ' ' + directorName : ''},\n\nVous allez bien ?\n\nJe me permets de revenir vers vous au sujet de la formation à venir.\nSauf erreur de ma part, je n'ai pas reçu la convention signée. Pouvez-vous me la transmettre au plus tôt ?\n\nDésolée pour ce côté administratif mais la démarche qualité Qualiopi exige ce document signé des deux parties.\n\nEn vous remerciant par avance.\n\nNathalie Joulie-Morand`;

            GenericEmail.show({
                title: '📩 Relance convention',
                to: clientEmail,
                subject,
                body,
                formationId
            });
        } catch (error) {
            console.error('Erreur relance convention:', error);
            showToast('Erreur préparation relance', 'error');
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
                showToast('Email client non renseigné', 'warning');
                return;
            }

            // Récupérer les identifiants du compte client
            let clientPassword = '[mot de passe non disponible]';
            const profileResult = await SupabaseData.getProfileByEmail(clientEmail);
            if (profileResult.success && profileResult.data) {
                clientPassword = profileResult.data.initial_password || '[voir avec l\'administrateur]';
            }

            const siteUrl = window.location.origin;
            const formationName = formation.formation_name || 'Formation';

            const tpl = await SupabaseData.getEmailTemplate('fin_formation');
            const vars = { '{{formation}}': formationName, '{{url}}': siteUrl, '{{password}}': clientPassword };
            const fallbackBody = `Bonjour,\n\nTout va bien pour vous? J'espère que l'équipe est satisfaite de la formation.\n\nJe transmets ici plusieurs éléments relatifs à la démarche qualité de la formation.\nC'est important que ce soit complété par chaque personne qui a suivi la formation :\n-un questionnaire de satisfaction :\n\n-un questionnaire d'évaluation des acquis :\n\nPar ailleurs, je vous transmets à nouveau le lien et le mot de passe de votre espace confidentiel NJM Conseil.\nLien : ${siteUrl}\nMot de passe : ${clientPassword}\nVous y trouverez tous les documents pour l'OPCO : feuilles de présence, certificats de fin de formation.\nVous pourrez aussi y récupérer :\n-pour vous : le bilan de la formation\n-pour les apprenants : le support pédagogique, les grilles d'évaluation\n\nAutre chose, ce serait sympa de prendre 1 minute pour déposer un avis sincère sur Google. Cela me donnera plus de visibilité sur le net. Merci d'aller sur:\nhttps://g.page/r/CTDsPUbHjCnREB0/review\n\nDésolée, cela fait de la paperasse mais c'est indispensable par rapport à la prise en charge de la formation.\n\nMerci encore à vous et à toute l'équipe pour la gentillesse de votre accueil.\n\nCordialement\n\nNathalie JOULIÉ MORAND`;
            const subject = tpl ? Object.keys(vars).reduce((s, k) => s.replaceAll(k, vars[k]), tpl.subject) : `Suite formation "${formationName}" - Documents et questionnaires`;
            const body = tpl ? Object.keys(vars).reduce((s, k) => s.replaceAll(k, vars[k]), tpl.body) : fallbackBody;

            GenericEmail.show({
                title: '📧 Mail fin de formation',
                to: clientEmail,
                subject,
                body,
                showQuestionnaires: true,
                formationId
            });
        } catch (error) {
            console.error('Erreur mail fin de formation:', error);
            showToast('Erreur préparation du mail', 'error');
        }
    },

    async relanceQuestionnaires(formationId) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', formationId)
                .single();

            if (error) throw error;

            const clientEmail = formation.client_email;
            if (!clientEmail) {
                showToast('Email client non renseigné', 'warning');
                return;
            }

            const subject = `Questionnaires post-formation "${formation.formation_name || 'Formation'}"`;
            const body = `Bonjour,

J'espère que vous allez bien.

A l'issue de la formation, je vous ai transmis un mail avec 2 questionnaires à compléter par chaque apprenant. Ces derniers sont importants pour mesurer l'impact de la formation et pour répondre aux exigences de la démarche qualité Qualiopi.

Sauf erreur de ma part, les questionnaires n'ont pas été complétés à ce jour. Pouvez-vous les transmettre à nouveau aux apprenants et leur demander de les remplir au plus tôt ?

Questionnaire d'évaluation des acquis :

Questionnaire de satisfaction :

En vous remerciant par avance

Nathalie Joulie-Morand`;

            GenericEmail.show({
                title: '📋 Relance questionnaires',
                to: clientEmail,
                subject,
                body,
                showQuestionnaires: true,
                formationId
            });
        } catch (error) {
            console.error('Erreur relance questionnaires:', error);
            showToast('Erreur préparation du mail', 'error');
        }
    },

    async showConvocationDetails(formationId) {
        try {
            const result = await SupabaseData.getConvocationLogs(formationId);
            if (!result.success) {
                showToast('Erreur récupération détails', 'error');
                return;
            }

            const logs = result.data;
            if (logs.length === 0) {
                showToast('Aucune convocation envoyée', 'info');
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
            showToast('Erreur récupération détails', 'error');
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

        container.innerHTML = items.length ? items.map(item => {
            // Extraire le lien si présent dans le contenu
            const urlMatch = (item.content || '').match(/Lien\s*:\s*(https?:\/\/\S+)/);
            const url = urlMatch ? urlMatch[1] : null;
            const contentWithoutUrl = (item.content || '').replace(/\n?\n?Lien\s*:\s*https?:\/\/\S+/, '').trim();

            return `
            <div style="background: white; padding: 1.5rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); border-left: 4px solid var(--primary-pink);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h4 style="font-weight: 600; color: var(--gray-900); margin-bottom: 0.5rem; cursor:pointer;" onclick="CRMApp.editVeille(${item.id})" title="Cliquer pour modifier">${item.title}</h4>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <button onclick="CRMApp.editVeille(${item.id})" style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:0.85rem; padding:0.2rem;" title="Modifier">&#9998;</button>
                        <button onclick="if(confirm('Supprimer cette veille ?')) CRMApp.deleteVeille(${item.id})" style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:0.8rem; padding:0.2rem;" title="Supprimer">&times;</button>
                    </div>
                </div>
                ${contentWithoutUrl ? `<p style="color: var(--gray-600); font-size: 0.875rem; margin-bottom: 0.75rem; white-space: pre-line;">${contentWithoutUrl}</p>` : ''}
                ${url ? `<a href="${url}" target="_blank" style="display:inline-flex; align-items:center; gap:0.3rem; color:var(--primary-purple); font-size:0.85rem; text-decoration:none; margin-bottom:0.75rem;">Voir le lien &rarr;</a>` : ''}
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; color: var(--gray-500);">
                    <span>${new Date(item.created_at).toLocaleDateString('fr-FR')}</span>
                    <button onclick="CRMApp.toggleVeilleRead(${item.id})" style="padding: 0.25rem 0.75rem; background: ${item.read ? 'var(--gray-200)' : 'var(--primary-green)'}; color: ${item.read ? 'var(--gray-700)' : 'white'}; border: none; border-radius: var(--radius-sm); cursor: pointer;">
                        ${item.read ? 'Lu' : 'Marquer lu'}
                    </button>
                </div>
            </div>`;
        }).join('') : '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">Aucune veille pour cette catégorie</p>';
    },

    async toggleVeilleRead(id) {
        await SupabaseData.toggleVeilleRead(id);
        await this.loadVeille();
    },

    async deleteVeille(id) {
        const { error } = await supabaseClient.from('veille').delete().eq('id', id);
        if (error) {
            showToast('Erreur suppression: ' + error.message, 'error');
        } else {
            await this.loadVeille();
            showToast('Veille supprimée', 'success');
        }
    },

    editingVeilleId: null,

    addVeille() {
        this.editingVeilleId = null;
        const modal = document.getElementById('veilleModal');
        document.querySelector('#veilleModal h3').textContent = 'Nouvelle veille';
        document.getElementById('veille-title').value = '';
        document.getElementById('veille-content').value = '';
        document.getElementById('veille-url').value = '';
        this.selectVeilleCategory(this.currentVeilleType || 'formation');
        modal.style.display = 'flex';
    },

    async editVeille(id) {
        const { data: item, error } = await supabaseClient.from('veille').select('*').eq('id', id).single();
        if (error || !item) {
            showToast('Veille introuvable', 'error');
            return;
        }

        this.editingVeilleId = id;
        const modal = document.getElementById('veilleModal');
        document.querySelector('#veilleModal h3').textContent = 'Modifier la veille';

        // Extraire le lien du contenu
        const urlMatch = (item.content || '').match(/Lien\s*:\s*(https?:\/\/\S+)/);
        const url = urlMatch ? urlMatch[1] : '';
        const contentWithoutUrl = (item.content || '').replace(/\n?\n?Lien\s*:\s*https?:\/\/\S+/, '').trim();

        document.getElementById('veille-title').value = item.title || '';
        document.getElementById('veille-content').value = contentWithoutUrl;
        document.getElementById('veille-url').value = url;
        this.selectVeilleCategory(item.type || 'formation');
        modal.style.display = 'flex';
    },

    selectVeilleCategory(cat) {
        this.newVeilleCategory = cat;
        const buttons = document.querySelectorAll('#veille-modal-category button');
        buttons.forEach(btn => {
            if (btn.dataset.cat === cat) {
                btn.style.background = 'var(--primary-pink)';
                btn.style.color = 'white';
            } else {
                btn.style.background = 'var(--gray-200)';
                btn.style.color = 'var(--gray-700)';
            }
        });
    },

    async saveVeille() {
        const title = document.getElementById('veille-title').value.trim();
        const content = document.getElementById('veille-content').value.trim();
        const url = document.getElementById('veille-url').value.trim();

        if (!title) {
            showToast('Le titre est obligatoire', 'error');
            document.getElementById('veille-title').focus();
            return;
        }

        const category = this.newVeilleCategory || this.currentVeilleType || 'formation';
        const fullContent = (content ? content : '') + (url ? '\n\nLien : ' + url : '');

        if (this.editingVeilleId) {
            // Mode édition
            const { error } = await supabaseClient.from('veille').update({
                title,
                content: fullContent,
                type: category
            }).eq('id', this.editingVeilleId);

            if (error) {
                showToast('Erreur modification: ' + error.message, 'error');
                return;
            }
            showToast('Veille modifiée !', 'success');
        } else {
            // Mode création
            const result = await SupabaseData.addVeille(category, { title, content: fullContent });
            if (!result.success) {
                showToast(result.message, 'error');
                return;
            }
            showToast('Veille ajoutée !', 'success');
        }

        document.getElementById('veilleModal').style.display = 'none';
        this.editingVeilleId = null;
        this.currentVeilleType = category;
        await this.loadVeille();
        this.filterVeille(category);
    },

    // ==================== PARAMETRES ====================

    async loadParametres() {
        // Charger depuis Supabase, fallback localStorage
        let params = {};
        const companyResult = await SupabaseData.getSetting('company');
        if (companyResult.success && companyResult.data) {
            params = companyResult.data;
        } else {
            params = JSON.parse(localStorage.getItem('njm_parametres') || '{}');
        }
        const fields = [
            'raison-sociale', 'siret', 'num-activite', 'naf', 'rcs', 'capital',
            'adresse', 'qualiopi', 'website', 'dirigeante-nom', 'dirigeante-qualite',
            'dirigeante-tel', 'dirigeante-email', 'dirigeante-diplome'
        ];
        fields.forEach(f => {
            const el = document.getElementById('param-' + f);
            if (el && params[f]) el.value = params[f];
        });

        // Charger les previews signature et cachet
        const sigResult = await SupabaseData.getSetting('signature');
        const sig = (sigResult.success && sigResult.data) ? sigResult.data : localStorage.getItem('njm_signature');
        if (sig) { const el = document.getElementById('param-signature-preview'); if (el) el.src = sig; }
        const cachetResult = await SupabaseData.getSetting('cachet');
        const cachet = (cachetResult.success && cachetResult.data) ? cachetResult.data : localStorage.getItem('njm_cachet');
        if (cachet) { const el = document.getElementById('param-cachet-preview'); if (el) el.src = cachet; }
    },

    async saveParametres() {
        const fields = [
            'raison-sociale', 'siret', 'num-activite', 'naf', 'rcs', 'capital',
            'adresse', 'qualiopi', 'website', 'dirigeante-nom', 'dirigeante-qualite',
            'dirigeante-tel', 'dirigeante-email', 'dirigeante-diplome'
        ];
        const params = {};
        fields.forEach(f => {
            const el = document.getElementById('param-' + f);
            if (el) params[f] = el.value.trim();
        });
        localStorage.setItem('njm_parametres', JSON.stringify(params));
        const result = await SupabaseData.updateSetting('company', params);
        if (result.success) {
            showToast('Paramètres enregistrés !', 'success');
        } else {
            showToast('Paramètres sauvegardés localement (erreur Supabase)', 'warning');
        }
    },

    // ==================== EMAIL TEMPLATES ====================

    // Mapping des templates par section et métadonnées
    _emailTemplateSections: {
        avant: {
            label: 'Avant la formation',
            icon: '🟣',
            color: '#8b5cf6',
            ids: ['acces_client', 'prealable_reminder', 'convocation_v2', 'relance_convention_v2', 'contrat_sous_traitance'],
            descriptions: {
                acces_client: 'Envoyé automatiquement quand vous créez une nouvelle formation',
                prealable_reminder: 'A envoyer si le client n\'a pas encore rempli le questionnaire des apprenants',
                convocation_v2: 'Envoyée une semaine avant la formation avec le questionnaire amont',
                relance_convention_v2: 'Si vous n\'avez pas reçu la convention signée du client',
                contrat_sous_traitance: 'Envoyé au formateur pour signature du contrat'
            }
        },
        apres: {
            label: 'Après la formation',
            icon: '🟢',
            color: '#059669',
            ids: ['fin_formation_v2', 'relance_questionnaires', 'avis_google_sous_traitant', 'avis_google_direct'],
            descriptions: {
                fin_formation_v2: 'Envoyé au client avec les questionnaires et liens vers l\'espace',
                relance_questionnaires: 'Si les apprenants n\'ont pas répondu aux questionnaires de satisfaction et d\'évaluation',
                avis_google_sous_traitant: 'Envoyé 3 jours après la fin de formation, mentionne le formateur sous-traitant',
                avis_google_direct: 'Envoyé 3 jours après la fin de formation, quand vous animez vous-même'
            }
        }
    },

    // IDs d'anciennes versions masquées quand une _v2 existe
    _hiddenTemplateIds: ['convocation', 'fin_formation', 'relance_convention'],

    async loadEmailTemplates() {
        const container = document.getElementById('email-templates-list');
        if (!container) return;

        const result = await SupabaseData.getEmailTemplates();
        if (!result.success || result.data.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:1rem;">Aucun template trouvé. Executez la migration SQL pour initialiser les templates.</p>';
            return;
        }

        const allTemplates = result.data;

        // Déterminer les IDs v2 présents pour masquer les anciennes versions
        const allIds = allTemplates.map(t => t.id);
        const hidden = new Set(this._hiddenTemplateIds.filter(oldId => allIds.includes(oldId + '_v2')));

        const templates = allTemplates.filter(t => !hidden.has(t.id));
        const templateMap = {};
        templates.forEach(t => { templateMap[t.id] = t; });

        // Collecter les IDs assignés à une section
        const assignedIds = new Set();
        Object.values(this._emailTemplateSections).forEach(s => s.ids.forEach(id => assignedIds.add(id)));

        // Autres templates (non assignés à une section)
        const otherTemplates = templates.filter(t => !assignedIds.has(t.id));

        // Rendu d'une mini-card
        const renderCard = (t, description) => {
            const updatedAt = t.updated_at ? new Date(t.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
            return `
                <div style="display:flex;align-items:center;gap:1rem;padding:1rem;border:1px solid var(--gray-200);border-radius:8px;background:white;transition:all 0.15s;cursor:default;"
                     onmouseover="this.style.background='#fdf2f8';this.style.borderColor='#f9a8d4';"
                     onmouseout="this.style.background='white';this.style.borderColor='var(--gray-200)';">
                    <span style="font-size:1.75rem;flex-shrink:0;">📨</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;color:var(--gray-900);font-size:0.95rem;">${t.name}</div>
                        <div style="font-size:0.8rem;color:var(--gray-500);margin-top:0.2rem;line-height:1.4;">${description || t.subject}</div>
                        ${updatedAt ? '<div style="font-size:0.7rem;color:var(--gray-400);margin-top:0.25rem;">Modifie le ' + updatedAt + '</div>' : ''}
                    </div>
                    <div style="display:flex;gap:0.4rem;flex-shrink:0;">
                        <button onclick="CRMApp.showTemplatePreview('${t.id}')"
                            style="padding:0.4rem 0.75rem;background:white;color:var(--gray-600);border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.8rem;cursor:pointer;white-space:nowrap;">
                            👁 Apercu
                        </button>
                        <button onclick="CRMApp.editEmailTemplate('${t.id}')"
                            style="padding:0.4rem 0.75rem;background:var(--primary-pink);color:white;border:none;border-radius:var(--radius-md);font-size:0.8rem;cursor:pointer;font-weight:500;white-space:nowrap;">
                            ✏️ Modifier
                        </button>
                    </div>
                </div>`;
        };

        // Rendu d'une section
        const renderSection = (key) => {
            const section = this._emailTemplateSections[key];
            const sectionTemplates = section.ids.map(id => templateMap[id]).filter(Boolean);
            if (sectionTemplates.length === 0) return '';

            return `
                <div style="background:white;border-radius:var(--radius-xl);padding:1.5rem;box-shadow:var(--shadow-sm);border-left:4px solid ${section.color};margin-bottom:1.5rem;">
                    <h3 style="font-size:1.1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">${section.icon} ${section.label}</h3>
                    <div style="display:grid;gap:0.75rem;">
                        ${sectionTemplates.map(t => renderCard(t, section.descriptions[t.id])).join('')}
                    </div>
                </div>`;
        };

        let html = '';

        // Sections principales
        html += renderSection('avant');
        html += renderSection('apres');

        // Autres templates
        if (otherTemplates.length > 0) {
            html += `
                <div style="background:white;border-radius:var(--radius-xl);padding:1.5rem;box-shadow:var(--shadow-sm);border-left:4px solid var(--gray-400);margin-bottom:1.5rem;">
                    <h3 style="font-size:1.1rem;font-weight:700;color:var(--gray-900);margin:0 0 1rem 0;">📁 Autres templates</h3>
                    <div style="display:grid;gap:0.75rem;">
                        ${otherTemplates.map(t => renderCard(t, null)).join('')}
                    </div>
                </div>`;
        }

        container.innerHTML = html;
    },

    async showTemplatePreview(templateId) {
        const template = await SupabaseData.getEmailTemplate(templateId);
        if (!template) { showToast('Template introuvable', 'error'); return; }

        const existing = document.getElementById('template-preview-modal');
        if (existing) existing.remove();

        // Mettre en surbrillance les variables {{xxx}}
        const highlightVars = (text) => (text || '').replace(/\{\{[^}]+\}\}/g, match =>
            '<span style="background:#fef3c7;color:#92400e;padding:0.1rem 0.3rem;border-radius:4px;font-family:monospace;font-size:0.85em;">' + match + '</span>'
        );

        const modal = document.createElement('div');
        modal.id = 'template-preview-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div style="background:white;border-radius:var(--radius-xl);padding:2rem;max-width:700px;width:95%;max-height:90vh;overflow-y:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                    <h2 style="font-size:1.15rem;font-weight:700;color:var(--gray-900);margin:0;">📨 ${template.name}</h2>
                    <button onclick="document.getElementById('template-preview-modal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--gray-400);">&times;</button>
                </div>

                <div style="margin-bottom:1.25rem;">
                    <div style="font-size:0.75rem;font-weight:600;color:var(--gray-500);text-transform:uppercase;margin-bottom:0.35rem;">Objet</div>
                    <div style="font-weight:600;color:var(--gray-900);font-size:0.95rem;padding:0.75rem;background:var(--gray-50);border-radius:var(--radius-md);">${highlightVars(template.subject)}</div>
                </div>

                <div style="margin-bottom:1.25rem;">
                    <div style="font-size:0.75rem;font-weight:600;color:var(--gray-500);text-transform:uppercase;margin-bottom:0.35rem;">Corps du message</div>
                    <div style="padding:1rem;background:var(--gray-50);border-radius:var(--radius-md);font-size:0.9rem;color:var(--gray-800);line-height:1.6;white-space:pre-wrap;max-height:400px;overflow-y:auto;">${highlightVars(template.body)}</div>
                </div>

                ${template.variables ? `
                <div style="margin-bottom:1.25rem;">
                    <div style="font-size:0.75rem;font-weight:600;color:var(--gray-500);text-transform:uppercase;margin-bottom:0.35rem;">Variables utilisables</div>
                    <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
                        ${template.variables.split(',').map(v => v.trim()).filter(Boolean).map(v =>
                            '<span style="padding:0.2rem 0.5rem;background:#fef3c7;color:#92400e;border-radius:var(--radius-md);font-size:0.8rem;font-family:monospace;">' + v + '</span>'
                        ).join('')}
                    </div>
                </div>` : ''}

                <div style="display:flex;justify-content:flex-end;gap:0.75rem;padding-top:1rem;border-top:1px solid var(--gray-200);">
                    <button onclick="document.getElementById('template-preview-modal').remove()"
                        style="padding:0.6rem 1.25rem;background:var(--gray-100);color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);font-weight:500;cursor:pointer;">
                        Fermer
                    </button>
                    <button onclick="document.getElementById('template-preview-modal').remove(); CRMApp.editEmailTemplate('${templateId}')"
                        style="padding:0.6rem 1.25rem;background:var(--primary-pink);color:white;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">
                        ✏️ Modifier ce template
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    },

    async editEmailTemplate(templateId) {
        const template = await SupabaseData.getEmailTemplate(templateId);
        if (!template) {
            showToast('Template introuvable', 'error');
            return;
        }

        const existing = document.getElementById('email-template-modal');
        if (existing) existing.remove();

        const variables = template.variables ? template.variables.split(',').map(v => v.trim()).filter(Boolean) : [];
        const variablesHtml = variables.length > 0 ? `
            <div style="margin-bottom:1rem;">
                <label style="display:block;font-size:0.8rem;font-weight:600;color:var(--gray-700);margin-bottom:0.5rem;">Variables disponibles (cliquer pour insérer)</label>
                <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
                    ${variables.map(v => `
                        <button type="button" onclick="CRMApp.insertTemplateVariable('${v}')"
                            style="padding:0.25rem 0.6rem;background:#eff6ff;color:#1e40af;border:1px solid #93c5fd;border-radius:var(--radius-md);font-size:0.8rem;cursor:pointer;font-family:monospace;">
                            ${v}
                        </button>
                    `).join('')}
                </div>
            </div>
        ` : '';

        const inputStyle = 'width:100%;padding:0.6rem 0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.9rem;font-family:inherit;box-sizing:border-box;';

        const modal = document.createElement('div');
        modal.id = 'email-template-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div style="background:white;border-radius:var(--radius-xl);padding:2rem;max-width:650px;width:90%;max-height:90vh;overflow-y:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                    <h2 style="font-size:1.15rem;font-weight:700;color:var(--gray-900);margin:0;">Modifier : ${template.name}</h2>
                    <button onclick="document.getElementById('email-template-modal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--gray-400);">&times;</button>
                </div>

                <div style="margin-bottom:1rem;">
                    <label style="display:block;font-size:0.8rem;font-weight:600;color:var(--gray-700);margin-bottom:0.35rem;">Objet du mail</label>
                    <input type="text" id="tpl-edit-subject" value="${template.subject.replace(/"/g, '&quot;')}" style="${inputStyle}">
                </div>

                ${variablesHtml}

                <div style="margin-bottom:1rem;">
                    <label style="display:block;font-size:0.8rem;font-weight:600;color:var(--gray-700);margin-bottom:0.35rem;">Corps du message</label>
                    <textarea id="tpl-edit-body" rows="16" style="${inputStyle} resize:vertical;">${template.body}</textarea>
                </div>

                <div style="display:flex;justify-content:flex-end;gap:0.75rem;padding-top:1rem;border-top:1px solid var(--gray-200);">
                    <button onclick="document.getElementById('email-template-modal').remove()" style="padding:0.6rem 1.25rem;background:var(--gray-100);color:var(--gray-700);border:1px solid var(--gray-300);border-radius:var(--radius-md);font-weight:500;cursor:pointer;">
                        Annuler
                    </button>
                    <button onclick="CRMApp.saveEmailTemplate('${template.id}')" style="padding:0.6rem 1.25rem;background:var(--primary-purple);color:white;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">
                        Enregistrer
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    },

    insertTemplateVariable(variable) {
        const textarea = document.getElementById('tpl-edit-body');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        textarea.value = text.substring(0, start) + variable + text.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
    },

    async saveEmailTemplate(templateId) {
        const subject = document.getElementById('tpl-edit-subject').value.trim();
        const body = document.getElementById('tpl-edit-body').value;

        if (!subject) {
            showToast('L\'objet ne peut pas être vide', 'error');
            return;
        }

        const result = await SupabaseData.updateEmailTemplate(templateId, { subject, body });
        if (result.success) {
            showToast('Template enregistré !', 'success');
            const modal = document.getElementById('email-template-modal');
            if (modal) modal.remove();
            this.loadEmailTemplates();
        } else {
            showToast('Erreur : ' + result.message, 'error');
        }
    },

    // ==================== END EMAIL TEMPLATES ====================

    changeLogo(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Veuillez sélectionner une image (PNG ou JPEG)', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image trop lourde (max 5 Mo)', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('param-logo-preview');
            if (preview) preview.src = e.target.result;
            localStorage.setItem('njm_logo', e.target.result);
            SupabaseData.updateSetting('logo', e.target.result);
            showToast('Logo mis à jour !', 'success');
        };
        reader.readAsDataURL(file);
    },

    changeSignature(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Veuillez sélectionner une image (PNG ou JPEG)', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image trop lourde (max 5 Mo)', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('param-signature-preview');
            if (preview) preview.src = e.target.result;
            localStorage.setItem('njm_signature', e.target.result);
            SupabaseData.updateSetting('signature', e.target.result);
            showToast('Signature mise à jour !', 'success');
        };
        reader.readAsDataURL(file);
    },

    changeCachet(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Veuillez sélectionner une image (PNG ou JPEG)', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image trop lourde (max 5 Mo)', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('param-cachet-preview');
            if (preview) preview.src = e.target.result;
            localStorage.setItem('njm_cachet', e.target.result);
            SupabaseData.updateSetting('cachet', e.target.result);
            showToast('Cachet mis à jour !', 'success');
        };
        reader.readAsDataURL(file);
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
                showToast('BPF mis à jour !', 'success');
            } else {
                showToast(result.message, 'error');
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
            showToast('BPF supprimé', 'success');
        } else {
            showToast(result.message, 'error');
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
            showToast('Aucune donnée à exporter', 'warning');
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

    currentSupportCategory: null,
    allSupportsCache: {},

    async loadSupports() {
        // Charger toutes les catégories en parallèle
        const promises = this.supportCategories.map(async (cat) => {
            const result = await SupabaseData.getPedagogicalLibrary(cat);
            return { category: cat, data: result.success ? result.data : [] };
        });

        const results = await Promise.all(promises);
        this.allSupportsCache = {};
        results.forEach(r => { this.allSupportsCache[r.category] = r.data; });

        // Générer les onglets
        const tabsContainer = document.getElementById('supports-tabs');
        if (tabsContainer) {
            tabsContainer.innerHTML = this.supportCategories.map(cat => {
                const count = (this.allSupportsCache[cat] || []).length;
                const label = this.supportCategoryLabels[cat] || cat;
                const isActive = this.currentSupportCategory === cat;
                return `<button onclick="CRMApp.showSupportCategory('${cat}')"
                    style="padding: 0.5rem 1rem; border: 1px solid ${isActive ? 'var(--primary-purple)' : 'var(--gray-300)'}; background: ${isActive ? 'var(--primary-purple)' : 'white'}; color: ${isActive ? 'white' : 'var(--gray-700)'}; border-radius: 20px; cursor: pointer; font-size: 0.8rem; font-weight: 500; transition: all 0.15s;">
                    ${label} <span style="background: ${isActive ? 'rgba(255,255,255,0.3)' : 'var(--gray-100)'}; padding: 0.1rem 0.4rem; border-radius: 10px; font-size: 0.7rem; margin-left: 0.25rem;">${count}</span>
                </button>`;
            }).join('');
        }

        // Afficher la première catégorie par défaut
        if (!this.currentSupportCategory) {
            this.currentSupportCategory = this.supportCategories[0];
        }
        this.showSupportCategory(this.currentSupportCategory);
    },

    showSupportCategory(category) {
        this.currentSupportCategory = category;
        const supports = this.allSupportsCache[category] || [];
        const container = document.getElementById('supports-content');
        const label = this.supportCategoryLabels[category] || category;

        // Mettre à jour les onglets (active state)
        const tabsContainer = document.getElementById('supports-tabs');
        if (tabsContainer) {
            tabsContainer.querySelectorAll('button').forEach(btn => {
                const isActive = btn.textContent.trim().startsWith(label);
                btn.style.background = isActive ? 'var(--primary-purple)' : 'white';
                btn.style.color = isActive ? 'white' : 'var(--gray-700)';
                btn.style.borderColor = isActive ? 'var(--primary-purple)' : 'var(--gray-300)';
            });
        }

        if (!container) return;

        const fileIcon = (title) => {
            const t = title.toLowerCase();
            if (t.endsWith('.pdf') || t.includes('pdf')) return '📕';
            if (t.endsWith('.pptx') || t.endsWith('.ppt') || t.includes('pptx')) return '📊';
            if (t.endsWith('.xlsx') || t.endsWith('.xls') || t.includes('xlsx')) return '📗';
            if (t.endsWith('.docx') || t.endsWith('.doc') || t.includes('doc')) return '📘';
            return '📄';
        };

        if (supports.length === 0) {
            container.innerHTML = `<p style="color: var(--gray-500); text-align: center; padding: 2rem;">Aucun fichier dans "${label}"</p>`;
            return;
        }

        // Grouper par sous-dossier (champ description)
        const groups = {};
        supports.forEach(s => {
            const sub = s.description || '';
            if (!groups[sub]) groups[sub] = [];
            groups[sub].push(s);
        });

        // Trier : dossiers nommés d'abord (alphabétique), puis racine
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (!a) return 1;
            if (!b) return -1;
            return a.localeCompare(b);
        });

        const renderFile = (s) => `
            <div class="support-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; border-radius: var(--radius-md); transition: background 0.1s;" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background='transparent'">
                <span style="font-size: 0.85rem; color: var(--gray-800); display: flex; align-items: center; gap: 0.5rem;">
                    ${fileIcon(s.title || s.file_url || '')} ${s.title}
                </span>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    ${s.file_url ? `<a href="${normalizeAssetUrl(s.file_url)}" target="_blank" rel="noopener noreferrer" style="color: var(--primary-purple); font-weight: 600; text-decoration: none; font-size: 0.8rem; padding: 0.2rem 0.5rem; background: #f3f0ff; border-radius: var(--radius-sm);">Ouvrir</a>` : ''}
                    <button onclick="CRMApp.deleteSupport('${s.id}')" style="background:none;border:none;color:var(--gray-400);cursor:pointer;font-size:0.8rem;padding:0.2rem;" title="Supprimer">✕</button>
                </div>
            </div>`;

        const hasFolders = sortedKeys.some(k => k !== '');

        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--gray-200);">
                <h3 style="font-size: 1rem; font-weight: 600; color: var(--gray-900);">${label} (${supports.length} fichier${supports.length > 1 ? 's' : ''})</h3>
            </div>
            <div id="supports-list">
                ${sortedKeys.map(sub => {
                    const files = groups[sub];
                    const folderName = sub || (hasFolders ? 'Fichiers généraux' : '');

                    if (folderName) {
                        return `
                            <div style="margin-bottom: 1rem;">
                                <div onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.chevron').textContent = this.nextElementSibling.style.display === 'none' ? '▶' : '▼'"
                                     style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; cursor: pointer; user-select: none;">
                                    <span class="chevron" style="font-size: 0.7rem; color: var(--gray-500);">▼</span>
                                    <span style="font-size: 0.9rem; font-weight: 600; color: var(--gray-700);">📁 ${folderName}</span>
                                    <span style="font-size: 0.7rem; color: var(--gray-400); background: var(--gray-100); padding: 0.1rem 0.4rem; border-radius: 8px;">${files.length}</span>
                                </div>
                                <div style="padding-left: 1.25rem; display: grid; gap: 0.1rem;">
                                    ${files.map(renderFile).join('')}
                                </div>
                            </div>`;
                    } else {
                        return `<div style="display: grid; gap: 0.1rem;">${files.map(renderFile).join('')}</div>`;
                    }
                }).join('')}
            </div>
        `;
    },

    filterSupportsSearch() {
        const search = (document.getElementById('supports-search')?.value || '').toLowerCase();
        const items = document.querySelectorAll('#supports-list .support-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(search) ? '' : 'none';
        });
    },

    uploadSupportFile() {
        const currentCat = this.currentSupportCategory || this.supportCategories[0];
        const categoryOptionsHtml = this.supportCategories.map(c =>
            `<option value="${c}" ${c === currentCat ? 'selected' : ''}>${this.supportCategoryLabels[c]}</option>`
        ).join('');

        // Collecter les sous-dossiers existants pour la catégorie active
        const existingSubfolders = new Set();
        (this.allSupportsCache[currentCat] || []).forEach(s => {
            if (s.description) existingSubfolders.add(s.description);
        });
        const subfolderOptions = [...existingSubfolders].sort().map(s =>
            `<option value="${s}">${s}</option>`
        ).join('');

        const modal = document.createElement('div');
        modal.id = 'upload-support-file-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        modal.innerHTML = `
            <div style="background:white;border-radius:var(--radius-xl);padding:2rem;width:500px;max-width:90%;box-shadow:var(--shadow-lg);">
                <h3 style="font-size:1.125rem;font-weight:700;color:var(--gray-900);margin-bottom:1.5rem;">Ajouter un support pédagogique</h3>
                <div style="display:grid;gap:1rem;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:var(--gray-700);">Fichier *</label>
                        <input type="file" id="sf-file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv" style="width:100%;padding:0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:var(--gray-700);">Catégorie</label>
                        <select id="sf-category" onchange="CRMApp.updateSubfolderOptions(this.value)" style="width:100%;padding:0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);">
                            ${categoryOptionsHtml}
                        </select>
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:var(--gray-700);">Sous-dossier (optionnel)</label>
                        <div style="display:flex;gap:0.5rem;">
                            <select id="sf-subfolder" style="flex:1;padding:0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);">
                                <option value="">Racine (pas de sous-dossier)</option>
                                ${subfolderOptions}
                            </select>
                            <input type="text" id="sf-new-subfolder" placeholder="Ou créer un nouveau..." style="flex:1;padding:0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);box-sizing:border-box;">
                        </div>
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:var(--gray-700);">Nom (optionnel)</label>
                        <input type="text" id="sf-title" placeholder="Nom du fichier sera utilisé par défaut" style="width:100%;padding:0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);box-sizing:border-box;">
                    </div>
                </div>
                <div style="display:flex;gap:1rem;margin-top:1.5rem;justify-content:flex-end;">
                    <button onclick="document.getElementById('upload-support-file-modal').remove()" style="padding:0.75rem 1.5rem;background:var(--gray-200);color:var(--gray-700);border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">Annuler</button>
                    <button onclick="CRMApp.submitSupportFile()" style="padding:0.75rem 1.5rem;background:var(--primary-orange);color:white;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">Ajouter</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    updateSubfolderOptions(category) {
        const subfolders = new Set();
        (this.allSupportsCache[category] || []).forEach(s => {
            if (s.description) subfolders.add(s.description);
        });
        const select = document.getElementById('sf-subfolder');
        if (select) {
            select.innerHTML = '<option value="">Racine (pas de sous-dossier)</option>' +
                [...subfolders].sort().map(s => `<option value="${s}">${s}</option>`).join('');
        }
    },

    async submitSupportFile() {
        const fileInput = document.getElementById('sf-file');
        const file = fileInput && fileInput.files[0];
        const category = document.getElementById('sf-category').value;
        const existingSubfolder = document.getElementById('sf-subfolder').value;
        const newSubfolder = document.getElementById('sf-new-subfolder').value.trim();
        const titleInput = document.getElementById('sf-title').value.trim();

        if (!file) {
            showToast('Veuillez sélectionner un fichier', 'warning');
            return;
        }

        const subfolder = newSubfolder || existingSubfolder || '';
        const title = titleInput || file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');

        try {
            // Upload dans Supabase Storage
            const fileName = `supports/${category}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('documents')
                .upload(fileName, file, { contentType: file.type, upsert: true });

            if (uploadError) {
                showToast('Erreur upload: ' + uploadError.message, 'error');
                return;
            }

            const { data: urlData } = supabaseClient.storage
                .from('documents')
                .getPublicUrl(fileName);

            const file_url = urlData ? urlData.publicUrl : '';

            // Sauvegarder en BDD
            const result = await SupabaseData.addToPedagogicalLibrary(category, {
                title,
                description: subfolder,
                file_url
            });

            document.getElementById('upload-support-file-modal').remove();

            if (result.success) {
                showToast('Support ajouté !', 'success');
                await this.loadSupports();
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            console.error('Erreur upload support:', error);
            showToast('Erreur: ' + error.message, 'error');
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
                        <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:var(--gray-700);">Fichier (PDF, Word, PowerPoint...)</label>
                        <input type="file" id="support-file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" style="width:100%;padding:0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.95rem;box-sizing:border-box;">
                        <p style="font-size:0.75rem;color:var(--gray-500);margin-top:0.25rem;">Ou collez un lien externe :</p>
                        <input type="url" id="support-url" placeholder="https://..." style="width:100%;padding:0.5rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);font-size:0.85rem;box-sizing:border-box;margin-top:0.25rem;">
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
        const externalUrl = document.getElementById('support-url').value.trim();
        const fileInput = document.getElementById('support-file');
        const file = fileInput && fileInput.files[0];

        if (!title) {
            showToast('Veuillez saisir un nom', 'warning');
            return;
        }

        let file_url = externalUrl || null;

        // Si un fichier est sélectionné, l'uploader dans Supabase Storage
        if (file) {
            try {
                const fileName = `supports/${category}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                const { data: uploadData, error: uploadError } = await supabaseClient.storage
                    .from('documents')
                    .upload(fileName, file, { contentType: file.type, upsert: true });

                if (uploadError) {
                    console.warn('Upload Storage échoué:', uploadError.message);
                    showToast('Erreur upload: ' + uploadError.message, 'error');
                    return;
                }

                // Obtenir l'URL publique
                const { data: urlData } = supabaseClient.storage
                    .from('documents')
                    .getPublicUrl(fileName);

                if (urlData) {
                    file_url = urlData.publicUrl;
                }

                showToast('Fichier uploadé !', 'info');
            } catch (e) {
                console.error('Erreur upload:', e);
                showToast('Erreur upload fichier', 'error');
                return;
            }
        }

        const result = await SupabaseData.addToPedagogicalLibrary(category, {
            title,
            description: '',
            file_url
        });

        document.getElementById('upload-support-modal').remove();

        if (result.success) {
            await this.loadSupports();
            showToast('Support ajouté !', 'success');
        } else {
            showToast(result.message, 'error');
        }
    },

    async migrateLocalSupports() {
        const confirmed = await showConfirmDialog({
            title: 'Importer les fichiers locaux',
            message: 'Cette action va supprimer tous les anciens supports (liens Google Drive) et les remplacer par les fichiers locaux du dossier assets/supports/. Continuer ?',
            confirmText: 'Importer',
            isDangerous: false
        });

        if (!confirmed) return;

        showToast('Migration en cours...', 'info', 10000);

        try {
            // 1. Charger le manifeste des fichiers locaux
            const response = await fetch('assets/supports-manifest.json');
            const manifest = await response.json();

            // 2. Supprimer tous les anciens supports
            for (const category of this.supportCategories) {
                const result = await SupabaseData.getPedagogicalLibrary(category);
                if (result.success && result.data) {
                    for (const support of result.data) {
                        await SupabaseData.deleteFromPedagogicalLibrary(support.id);
                    }
                }
            }

            // 3. Insérer les nouveaux depuis le manifeste
            let imported = 0;
            let errors = 0;
            for (const item of manifest) {
                const result = await SupabaseData.addToPedagogicalLibrary(item.category, {
                    title: item.title,
                    description: item.subfolder || '',
                    file_url: item.file_url
                });
                if (result.success) {
                    imported++;
                } else {
                    errors++;
                    console.warn('Erreur import:', item.title, result.message);
                }
            }

            await this.loadSupports();
            showToast(`Migration terminée : ${imported} fichiers importés${errors > 0 ? ', ' + errors + ' erreurs' : ''}`, 'success', 5000);
        } catch (error) {
            console.error('Erreur migration:', error);
            showToast('Erreur migration: ' + error.message, 'error');
        }
    },

    async deleteSupport(id) {
        if (!confirm('Voulez-vous vraiment supprimer ce support ?')) return;

        const result = await SupabaseData.deleteFromPedagogicalLibrary(id);
        if (result.success) {
            await this.loadSupports();
        } else {
            showToast(result.message, 'error');
        }
    },

    async loadTemplates() {
        // Charger les documents Qualiopi depuis le manifeste local
        try {
            const response = await fetch('assets/qualiopi-manifest.json');
            const manifest = await response.json();

            const fileIcon = (title, ext) => {
                const e = (ext || '').toLowerCase();
                if (e === '.pdf') return '📕';
                if (e === '.pptx' || e === '.ppt') return '📊';
                if (e === '.xlsx' || e === '.xls') return '📗';
                if (e === '.docx' || e === '.doc') return '📘';
                return '📄';
            };

            const renderFile = (f) => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; border-radius: var(--radius-md); transition: background 0.1s;" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background='transparent'">
                    <span style="font-size: 0.85rem; color: var(--gray-800); display: flex; align-items: center; gap: 0.5rem;">
                        ${fileIcon(f.title, f.ext)} ${f.title}
                    </span>
                    <a href="${normalizeAssetUrl(f.file_url)}" target="_blank" rel="noopener noreferrer" style="color: var(--primary-purple); font-weight: 600; text-decoration: none; font-size: 0.8rem; padding: 0.2rem 0.5rem; background: #f3f0ff; border-radius: var(--radius-sm);">Ouvrir</a>
                </div>`;

            ['avant', 'pendant', 'apres'].forEach(phase => {
                const files = manifest[phase] || [];
                const container = document.getElementById(`qualiopi-${phase}-list`);
                const countEl = document.getElementById(`qualiopi-${phase}-count`);
                if (countEl) countEl.textContent = files.length + ' fichier' + (files.length > 1 ? 's' : '');
                if (container) {
                    container.innerHTML = files.length
                        ? files.map(renderFile).join('')
                        : '<p style="color: var(--gray-400); font-size: 0.875rem;">Aucun document</p>';
                }
            });
        } catch (error) {
            console.error('Erreur chargement Qualiopi:', error);
        }
    },

    uploadQualiopi(phase) {
        const phaseLabels = { avant: 'Avant la formation', pendant: 'Pendant la formation', apres: 'Après la formation' };
        const modal = document.createElement('div');
        modal.id = 'upload-qualiopi-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        modal.innerHTML = `
            <div style="background:white;border-radius:var(--radius-xl);padding:2rem;width:500px;max-width:90%;box-shadow:var(--shadow-lg);">
                <h3 style="font-size:1.125rem;font-weight:700;color:var(--gray-900);margin-bottom:1.5rem;">Ajouter un document Qualiopi — ${phaseLabels[phase] || phase}</h3>
                <div style="display:grid;gap:1rem;">
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:var(--gray-700);">Fichier</label>
                        <input type="file" id="qualiopi-file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" style="width:100%;padding:0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;font-weight:600;margin-bottom:0.5rem;color:var(--gray-700);">Nom (optionnel, sinon nom du fichier)</label>
                        <input type="text" id="qualiopi-title" placeholder="Ex: Convention de formation TYPE" style="width:100%;padding:0.75rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);box-sizing:border-box;">
                    </div>
                </div>
                <div style="display:flex;gap:1rem;margin-top:1.5rem;justify-content:flex-end;">
                    <button onclick="document.getElementById('upload-qualiopi-modal').remove()" style="padding:0.75rem 1.5rem;background:var(--gray-200);color:var(--gray-700);border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">Annuler</button>
                    <button onclick="CRMApp.submitQualiopi('${phase}')" style="padding:0.75rem 1.5rem;background:var(--primary-purple);color:white;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;">Ajouter</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async submitQualiopi(phase) {
        const fileInput = document.getElementById('qualiopi-file');
        const titleInput = document.getElementById('qualiopi-title');
        const file = fileInput && fileInput.files[0];

        if (!file) {
            showToast('Veuillez sélectionner un fichier', 'warning');
            return;
        }

        const title = titleInput.value.trim() || file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');

        try {
            // Upload dans Supabase Storage
            const fileName = `qualiopi/${phase}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('documents')
                .upload(fileName, file, { contentType: file.type, upsert: true });

            if (uploadError) {
                showToast('Erreur upload: ' + uploadError.message, 'error');
                return;
            }

            const { data: urlData } = supabaseClient.storage
                .from('documents')
                .getPublicUrl(fileName);

            const file_url = urlData ? urlData.publicUrl : '';

            // Mettre à jour le manifeste local (ajouter au JSON)
            const response = await fetch('assets/qualiopi-manifest.json');
            const manifest = await response.json();
            const ext = '.' + file.name.split('.').pop().toLowerCase();
            manifest[phase] = manifest[phase] || [];
            manifest[phase].push({ title, file_url, ext });

            // Note: en prod il faudrait sauvegarder le manifeste côté serveur
            // Pour l'instant on recharge depuis le manifeste + ce nouvel item en mémoire

            document.getElementById('upload-qualiopi-modal').remove();
            showToast('Document Qualiopi ajouté !', 'success');

            // Recharger l'affichage
            await this.loadTemplates();
        } catch (error) {
            console.error('Erreur upload Qualiopi:', error);
            showToast('Erreur: ' + error.message, 'error');
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
                showToast('Document ajouté !', 'success');
            } else {
                showToast(result.message, 'error');
            }
        }
    },

    // ==================== QUESTIONNAIRES ====================

    _questionnairesCache: [],
    _questionnairesCurrentCategory: 'all',

    _categoryLabels: {
        amont: 'Amont',
        satisfaction: 'Satisfaction',
        evaluation_acquis: 'Eval. acquis',
        froid_dirigeant: 'Froid dirigeant',
        froid_apprenant: 'Froid apprenant',
        autre: 'Autre'
    },

    _categoryColors: {
        amont: '#3b82f6',
        satisfaction: '#10b981',
        evaluation_acquis: '#f59e0b',
        froid_dirigeant: '#8b5cf6',
        froid_apprenant: '#ec4899',
        autre: '#6b7280'
    },

    async loadQuestionnaires(category) {
        if (category) this._questionnairesCurrentCategory = category;
        const cat = this._questionnairesCurrentCategory;
        const result = await SupabaseData.getQuestionnaires(cat === 'all' ? null : cat);
        if (!result.success) {
            showToast('Erreur chargement questionnaires', 'error');
            return;
        }
        this._questionnairesCache = result.data;
        this._renderQuestionnaires(result.data);
    },

    showQuestionnaireCategory(category) {
        this._questionnairesCurrentCategory = category;
        // Update tabs
        document.querySelectorAll('.quest-tab').forEach(btn => {
            const isActive = btn.textContent.trim() === (category === 'all' ? 'Tous' : (this._categoryLabels[category] || category));
            btn.style.background = isActive ? 'var(--primary-orange)' : 'white';
            btn.style.color = isActive ? 'white' : 'var(--gray-700)';
        });
        this.loadQuestionnaires(category);
    },

    filterQuestionnairesSearch() {
        const search = (document.getElementById('questionnaires-search')?.value || '').toLowerCase();
        const filtered = this._questionnairesCache.filter(q =>
            q.title.toLowerCase().includes(search) ||
            (q.description || '').toLowerCase().includes(search) ||
            (q.formation_type || '').toLowerCase().includes(search)
        );
        this._renderQuestionnaires(filtered);
    },

    _renderQuestionnaires(questionnaires) {
        const container = document.getElementById('questionnaires-content');
        if (!container) return;

        if (questionnaires.length === 0) {
            container.innerHTML = '<p style="color: var(--gray-500); grid-column: 1/-1;">Aucun questionnaire trouvé.</p>';
            return;
        }

        const isAdmin = window.currentUserRole === 'admin';

        container.innerHTML = questionnaires.map(q => {
            const color = this._categoryColors[q.category] || '#6b7280';
            const label = this._categoryLabels[q.category] || q.category;
            return `
                <div style="background: white; border-radius: var(--radius-xl); padding: 1.25rem; box-shadow: var(--shadow-sm); border: 1px solid var(--gray-200); display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <h4 style="font-size: 1rem; font-weight: 600; color: var(--gray-900); margin: 0 0 0.5rem 0;">${q.title}</h4>
                            <span style="display: inline-block; padding: 0.15rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 500; background: ${color}15; color: ${color};">${label}</span>
                            ${q.formation_type ? `<span style="display: inline-block; padding: 0.15rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 500; background: var(--gray-100); color: var(--gray-600); margin-left: 0.25rem;">${q.formation_type}</span>` : ''}
                        </div>
                        ${!q.active ? '<span style="font-size: 0.75rem; color: #dc2626; font-weight: 500;">Inactif</span>' : ''}
                    </div>
                    ${q.description ? `<p style="font-size: 0.85rem; color: var(--gray-600); margin: 0; line-height: 1.4;">${q.description}</p>` : ''}
                    <div style="display: flex; gap: 0.5rem; margin-top: auto; flex-wrap: wrap;">
                        <a href="${q.url}" target="_blank" rel="noopener"
                            style="padding: 0.4rem 0.85rem; background: ${color}; color: white; border: none; border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 500; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 0.3rem;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            Ouvrir
                        </a>
                        ${isAdmin ? `
                        <button onclick="CRMApp.editQuestionnaire(${q.id})"
                            style="padding: 0.4rem 0.85rem; background: var(--gray-100); color: var(--gray-700); border: none; border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 500; cursor: pointer;">Modifier</button>
                        <button onclick="CRMApp.deleteQuestionnaireConfirm(${q.id}, '${q.title.replace(/'/g, "\\'")}')"
                            style="padding: 0.4rem 0.85rem; background: #fee2e2; color: #dc2626; border: none; border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 500; cursor: pointer;">Supprimer</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    addQuestionnaire() {
        document.getElementById('questionnaire-edit-id').value = '';
        document.getElementById('questionnaire-title').value = '';
        document.getElementById('questionnaire-category').value = 'amont';
        document.getElementById('questionnaire-formation-type').value = '';
        document.getElementById('questionnaire-url').value = '';
        document.getElementById('questionnaire-description').value = '';
        document.getElementById('questionnaire-modal-title').textContent = 'Ajouter un questionnaire';
        document.getElementById('questionnaireModal').style.display = 'flex';
    },

    async editQuestionnaire(id) {
        const result = await SupabaseData.getQuestionnaire(id);
        if (!result.success) { showToast('Erreur chargement', 'error'); return; }
        const q = result.data;
        document.getElementById('questionnaire-edit-id').value = q.id;
        document.getElementById('questionnaire-title').value = q.title;
        document.getElementById('questionnaire-category').value = q.category;
        document.getElementById('questionnaire-formation-type').value = q.formation_type || '';
        document.getElementById('questionnaire-url').value = q.url;
        document.getElementById('questionnaire-description').value = q.description || '';
        document.getElementById('questionnaire-modal-title').textContent = 'Modifier le questionnaire';
        document.getElementById('questionnaireModal').style.display = 'flex';
    },

    closeQuestionnaireModal() {
        document.getElementById('questionnaireModal').style.display = 'none';
    },

    async saveQuestionnaire() {
        const id = document.getElementById('questionnaire-edit-id').value;
        const title = document.getElementById('questionnaire-title').value.trim();
        const category = document.getElementById('questionnaire-category').value;
        const formation_type = document.getElementById('questionnaire-formation-type').value.trim() || null;
        const url = document.getElementById('questionnaire-url').value.trim();
        const description = document.getElementById('questionnaire-description').value.trim() || null;

        if (!title || !url) { showToast('Titre et URL requis', 'error'); return; }

        let result;
        if (id) {
            result = await SupabaseData.updateQuestionnaire(id, { title, category, formation_type, url, description });
        } else {
            result = await SupabaseData.createQuestionnaire({ title, category, formation_type, url, description });
        }

        if (result.success) {
            this.closeQuestionnaireModal();
            showToast(id ? 'Questionnaire modifie' : 'Questionnaire ajoute', 'success');
            await this.loadQuestionnaires();
        } else {
            showToast(result.message || 'Erreur', 'error');
        }
    },

    async deleteQuestionnaireConfirm(id, title) {
        if (!confirm(`Supprimer le questionnaire "${title}" ?`)) return;
        const result = await SupabaseData.deleteQuestionnaire(id);
        if (result.success) {
            showToast('Questionnaire supprime', 'success');
            await this.loadQuestionnaires();
        } else {
            showToast(result.message || 'Erreur suppression', 'error');
        }
    },

    // ==================== CLIENT-SIDE QUESTIONNAIRES ====================

    async _loadClientQuestionnaires(formationId) {
        const container = document.getElementById('client-formation-questionnaires-list');
        if (!container) return;

        const result = await SupabaseData.getFormationQuestionnaires(formationId);
        if (!result.success || result.data.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-400);font-size:0.85rem;">Aucun questionnaire pour le moment.</p>';
            return;
        }

        container.innerHTML = `<div style="display:grid;gap:0.6rem;">
            ${result.data.map(fq => {
                const q = fq.questionnaires;
                if (!q) return '';
                const color = this._categoryColors[q.category] || '#6b7280';
                const label = this._categoryLabels[q.category] || q.category;
                return `
                    <a href="${q.url}" target="_blank" rel="noopener noreferrer"
                        style="display:flex;align-items:center;gap:1rem;padding:0.85rem 1rem;background:var(--gray-50);border-radius:var(--radius-md);text-decoration:none;color:var(--gray-900);border:1px solid transparent;transition:all 0.15s;"
                        onmouseover="this.style.background='white';this.style.borderColor='var(--gray-200)';"
                        onmouseout="this.style.background='var(--gray-50)';this.style.borderColor='transparent';">
                        <span style="font-size:1.5rem;">📝</span>
                        <div style="flex:1;">
                            <div style="font-weight:600;color:var(--gray-900);font-size:0.9rem;">${q.title}</div>
                            <div style="font-size:0.75rem;color:var(--gray-500);margin-top:0.15rem;">
                                <span style="display:inline-block;padding:0.1rem 0.4rem;border-radius:8px;background:${color}15;color:${color};font-weight:500;">${label}</span>
                            </div>
                        </div>
                        <span style="font-size:0.8rem;color:var(--primary-pink);font-weight:500;">Ouvrir le questionnaire →</span>
                    </a>
                `;
            }).join('')}
        </div>`;
    },

    // ==================== ENVOI QUESTIONNAIRES AUX APPRENANTS ====================

    async sendQuestionnaireToLearners(formationId, questionnaireId) {
        try {
            // Charger la formation pour récupérer les apprenants et infos
            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', formationId)
                .single();
            if (error) throw error;

            // Charger le questionnaire
            const questResult = await SupabaseData.getQuestionnaire(questionnaireId);
            if (!questResult.success) throw new Error('Questionnaire introuvable');
            const questionnaire = questResult.data;

            // Parser les apprenants
            const learnersData = typeof formation.learners_data === 'string'
                ? JSON.parse(formation.learners_data || '[]')
                : (formation.learners_data || []);

            const learnersWithEmail = learnersData.filter(l => l.email);

            if (learnersWithEmail.length === 0) {
                // Pas d'email apprenant : envoyer au client (dirigeant)
                if (!formation.client_email) {
                    showToast('Aucun email apprenant ni client renseigné', 'warning');
                    return;
                }

                const catLabel = this._categoryLabels[questionnaire.category] || questionnaire.category;
                const subject = catLabel + ' - Formation "' + (formation.formation_name || 'Formation') + '"';
                const body = 'Bonjour,\n\nDans le cadre de la formation "' + (formation.formation_name || '') + '", pourriez-vous transmettre le questionnaire ci-dessous à chaque participant ?\n\n' + catLabel + ' : ' + questionnaire.url + '\n\nMerci par avance.\n\nCordialement,\nNathalie JOULIÉ-MORAND\nNJM Conseil';

                GenericEmail.show({
                    title: '📧 Envoi questionnaire — ' + catLabel,
                    to: formation.client_email,
                    subject,
                    body,
                    formationId
                });
                return;
            }

            // Confirmation
            if (!confirm('Envoyer le questionnaire "' + questionnaire.title + '" à ' + learnersWithEmail.length + ' apprenant(s) ?')) return;

            let sent = 0;
            let errors = 0;
            const catLabel = this._categoryLabels[questionnaire.category] || questionnaire.category;

            for (const learner of learnersWithEmail) {
                try {
                    const learnerName = ((learner.first_name || '') + ' ' + (learner.last_name || '')).trim();
                    const subject = catLabel + ' - Formation "' + (formation.formation_name || '') + '"';
                    const body = 'Bonjour' + (learnerName ? ' ' + learnerName : '') + ',\n\nSuite à la formation "' + (formation.formation_name || '') + '", pourriez-vous prendre quelques minutes pour compléter le questionnaire ci-dessous ?\n\n' + questionnaire.url + '\n\nVotre retour est précieux pour améliorer la qualité de nos formations.\n\nCordialement,\nNathalie JOULIÉ-MORAND\nNJM Conseil';

                    const emailResult = await SupabaseData.sendEmail({
                        to: learner.email,
                        subject,
                        body
                    });

                    if (emailResult.success) {
                        sent++;
                        // Logger dans convocation_logs
                        await supabaseClient.from('convocation_logs').insert([{
                            formation_id: formationId,
                            sent_to: learner.email,
                            subject,
                            body,
                            questionnaire_url: questionnaire.url
                        }]);
                    } else {
                        errors++;
                    }
                } catch (e) {
                    console.error('Erreur envoi questionnaire à', learner.email, e);
                    errors++;
                }
            }

            // Marquer comme envoyé dans formation_questionnaires
            await supabaseClient
                .from('formation_questionnaires')
                .update({ sent_to_learners: true, sent_at: new Date().toISOString() })
                .eq('formation_id', formationId)
                .eq('questionnaire_id', questionnaireId);

            showToast('Questionnaire envoyé à ' + sent + ' apprenant(s)' + (errors > 0 ? ' (' + errors + ' erreur(s))' : ''), sent > 0 ? 'success' : 'error');

            // Rafraîchir les listes
            this.loadFormationQuestionnaires(formationId);
            this._loadFormateurFormationQuestionnaires(formationId);
            if (this.currentPage === 'formation-detail-formateur') {
                this.showFormateurFormationDetail(formationId);
            }
        } catch (err) {
            console.error('Erreur sendQuestionnaireToLearners:', err);
            showToast('Erreur envoi questionnaire: ' + err.message, 'error');
        }
    },

    // ==================== FORMATION-QUESTIONNAIRES (attribution) ====================

    async loadFormationQuestionnaires(formationId) {
        const container = document.getElementById('formation-questionnaires-list');
        if (!container) return;

        const result = await SupabaseData.getFormationQuestionnaires(formationId);
        if (!result.success) {
            container.innerHTML = '<p style="color:#dc2626;font-size:0.85rem;">Erreur chargement</p>';
            return;
        }

        if (result.data.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-400);font-size:0.85rem;">Aucun questionnaire attribue</p>';
            return;
        }

        container.innerHTML = result.data.map(fq => {
            const q = fq.questionnaires;
            if (!q) return '';
            const color = this._categoryColors[q.category] || '#6b7280';
            const label = this._categoryLabels[q.category] || q.category;
            const sentInfo = fq.sent_at
                ? `<span style="font-size:0.75rem;color:#059669;font-weight:500;">Envoye le ${new Date(fq.sent_at).toLocaleDateString('fr-FR')}</span>`
                : '<span style="font-size:0.75rem;color:var(--gray-500);">Non envoye</span>';

            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;background:var(--gray-50);border-radius:var(--radius-md);border:1px solid var(--gray-200);">
                <div style="display:flex;align-items:center;gap:0.75rem;flex:1;">
                    <span style="display:inline-block;padding:0.15rem 0.5rem;border-radius:12px;font-size:0.7rem;font-weight:500;background:${color}15;color:${color};">${label}</span>
                    <span style="font-size:0.9rem;color:var(--gray-800);">${q.title}</span>
                    ${sentInfo}
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <a href="${q.url}" target="_blank" rel="noopener" style="padding:0.3rem 0.6rem;background:${color};color:white;border:none;border-radius:var(--radius-md);font-size:0.75rem;cursor:pointer;text-decoration:none;">Ouvrir</a>
                    <button onclick="CRMApp.removeFormationQuestionnaire(${formationId}, ${q.id})" style="padding:0.3rem 0.55rem;background:white;color:#dc2626;border:1px solid #fca5a5;border-radius:var(--radius-md);cursor:pointer;font-size:0.8rem;">Retirer</button>
                </div>
            </div>`;
        }).join('');
    },

    async showAssignQuestionnaireModal(formationId) {
        const result = await SupabaseData.getQuestionnaires();
        if (!result.success) { showToast('Erreur chargement questionnaires', 'error'); return; }

        const existingResult = await SupabaseData.getFormationQuestionnaires(formationId);
        const existingIds = (existingResult.data || []).map(fq => fq.questionnaire_id);

        const available = result.data.filter(q => !existingIds.includes(q.id) && q.active !== false);

        const modal = document.createElement('div');
        modal.id = 'assign-questionnaire-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:50001;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:white;padding:2rem;border-radius:var(--radius-xl);max-width:600px;width:95%;max-height:80vh;overflow-y:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h3 style="font-size:1.1rem;font-weight:700;color:var(--gray-900);margin:0;">Attribuer un questionnaire</h3>
                    <button onclick="document.getElementById('assign-questionnaire-modal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--gray-500);">&times;</button>
                </div>
                <input type="search" id="assign-quest-search" placeholder="Rechercher..."
                    oninput="CRMApp._filterAssignQuestList()" style="width:100%;padding:0.6rem;border:1px solid var(--gray-300);border-radius:var(--radius-md);margin-bottom:1rem;font-size:0.9rem;">
                <div id="assign-quest-list" style="display:grid;gap:0.5rem;">
                    ${available.length === 0 ? '<p style="color:var(--gray-500);font-size:0.9rem;">Tous les questionnaires sont deja attribues</p>' :
                        available.map(q => {
                            const color = this._categoryColors[q.category] || '#6b7280';
                            const label = this._categoryLabels[q.category] || q.category;
                            return `<div class="assign-quest-item" data-title="${q.title.toLowerCase()}" style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;background:var(--gray-50);border-radius:var(--radius-md);border:1px solid var(--gray-200);">
                                <div>
                                    <span style="font-size:0.9rem;font-weight:500;color:var(--gray-900);">${q.title}</span>
                                    <span style="display:inline-block;padding:0.1rem 0.5rem;border-radius:10px;font-size:0.7rem;background:${color}15;color:${color};margin-left:0.5rem;">${label}</span>
                                </div>
                                <button onclick="CRMApp.assignFormationQuestionnaire(${formationId}, ${q.id})"
                                    style="padding:0.35rem 0.75rem;background:var(--primary-orange);color:white;border:none;border-radius:var(--radius-md);font-size:0.8rem;font-weight:500;cursor:pointer;">Attribuer</button>
                            </div>`;
                        }).join('')
                    }
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    _filterAssignQuestList() {
        const search = (document.getElementById('assign-quest-search')?.value || '').toLowerCase();
        document.querySelectorAll('.assign-quest-item').forEach(item => {
            item.style.display = item.dataset.title.includes(search) ? 'flex' : 'none';
        });
    },

    async assignFormationQuestionnaire(formationId, questionnaireId) {
        const result = await SupabaseData.assignQuestionnaireToFormation(formationId, questionnaireId);
        if (result.success) {
            showToast('Questionnaire attribue', 'success');
            const modal = document.getElementById('assign-questionnaire-modal');
            if (modal) modal.remove();
            await this.loadFormationQuestionnaires(formationId);
        } else {
            showToast(result.message || 'Erreur', 'error');
        }
    },

    async removeFormationQuestionnaire(formationId, questionnaireId) {
        if (!confirm('Retirer ce questionnaire de la formation ?')) return;
        const result = await SupabaseData.removeQuestionnaireFromFormation(formationId, questionnaireId);
        if (result.success) {
            showToast('Questionnaire retire', 'success');
            await this.loadFormationQuestionnaires(formationId);
        } else {
            showToast(result.message || 'Erreur', 'error');
        }
    },

    // ==================== QUESTIONNAIRES À FROID ====================

    async checkQuestionnairesFroid() {
        try {
            const { data: formations, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('status', 'completed');

            if (error || !formations) return;

            const now = new Date();
            const sixMonths = 6 * 30 * 24 * 60 * 60 * 1000;
            const alertes = [];

            formations.forEach(f => {
                if (!f.end_date) return;
                const endDate = new Date(f.end_date);
                const diff = now - endDate;
                if (diff >= sixMonths && !f.questionnaire_froid_sent) {
                    alertes.push({
                        id: f.id,
                        formation_name: f.formation_name,
                        company_name: f.company_name || f.client_name,
                        end_date: endDate.toLocaleDateString('fr-FR')
                    });
                }
            });

            const alertContainer = document.getElementById('questionnaire-froid-alertes');
            if (alertContainer && alertes.length > 0) {
                alertContainer.style.display = 'block';
                alertContainer.innerHTML = `
                    <div style="padding: 1rem; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: var(--radius-md); margin-bottom: 1rem;">
                        <strong>Questionnaires a froid a envoyer (6 mois) :</strong>
                        <ul style="margin-top: 0.5rem; margin-left: 1rem; list-style: none;">
                            ${alertes.map(a => `
                                <li style="margin-bottom: 0.75rem; padding: 0.75rem; background: white; border-radius: var(--radius-md); border: 1px solid #fcd34d;">
                                    <div style="font-weight: 500; margin-bottom: 0.5rem;">${a.formation_name} - ${a.company_name} <span style="color: var(--gray-400); font-weight: 400;">(terminée le ${a.end_date})</span></div>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <button onclick="CRMApp.envoyerQuestionnaireFroidDirigeant(${a.id})"
                                            style="padding: 0.3rem 0.75rem; background: #7c3aed; color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-size: 0.8rem;">
                                            📧 Questionnaire dirigeant
                                        </button>
                                        <button onclick="CRMApp.envoyerQuestionnaireFroidApprenants(${a.id})"
                                            style="padding: 0.3rem 0.75rem; background: #0284c7; color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-size: 0.8rem;">
                                            📧 Questionnaire apprenants
                                        </button>
                                    </div>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Erreur verification questionnaires a froid:', error);
        }
    },

    /**
     * Ajoute le nom de l'entreprise en paramètre pré-rempli dans une URL Google Forms
     */
    personalizeFormUrl(url, companyName) {
        if (!url || !companyName) return url;
        // Ajouter le nom d'entreprise comme paramètre pré-rempli
        // Le séparateur dépend de si l'URL a déjà des paramètres
        const separator = url.includes('?') ? '&' : '?';
        return url + separator + 'usp=pp_url&entry.company=' + encodeURIComponent(companyName);
    },

    async envoyerQuestionnaireFroidDirigeant(formationId) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', formationId)
                .single();

            if (error) throw error;

            const clientEmail = formation.client_email;
            if (!clientEmail) { showToast('Email client non renseigné', 'warning'); return; }

            const directorName = formation.company_director_name || '';
            const companyName = formation.company_name || formation.client_name || '';
            const subject = `Questionnaire à froid (dirigeant) - Formation "${formation.formation_name || ''}" - ${companyName}`;
            const body = `Bonjour${directorName ? ' ' + directorName : ''},

J'espère que vous allez bien.

Il y a maintenant 6 mois que la formation "${formation.formation_name || ''}" s'est terminée. Dans le cadre de la démarche qualité Qualiopi, je souhaiterais recueillir votre retour sur l'impact de cette formation.

Pourriez-vous prendre quelques minutes pour compléter ce questionnaire réservé au dirigeant ?

Questionnaire dirigeant :
[Lien du questionnaire dirigeant]

Ce retour est précieux pour améliorer continuellement la qualité de mes formations.

En vous remerciant par avance.

Nathalie Joulié-Morand`;

            GenericEmail.show({
                title: '📧 Questionnaire à froid — Dirigeant',
                to: clientEmail,
                subject,
                body,
                showQuestionnaires: true
            });
        } catch (error) {
            console.error('Erreur envoi questionnaire dirigeant:', error);
            showToast('Erreur: ' + error.message, 'error');
        }
    },

    async envoyerQuestionnaireFroidApprenants(formationId) {
        try {
            const { data: formation, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', formationId)
                .single();

            if (error) throw error;

            const clientEmail = formation.client_email;
            if (!clientEmail) { showToast('Email client non renseigné', 'warning'); return; }

            const directorName = formation.company_director_name || '';
            const companyName = formation.company_name || formation.client_name || '';

            // Récupérer les noms des apprenants
            let learnersNames = '';
            if (formation.learners_data) {
                const ld = typeof formation.learners_data === 'string' ? JSON.parse(formation.learners_data) : formation.learners_data;
                learnersNames = ld.map(l => `${l.first_name || ''} ${l.last_name || ''}`.trim()).filter(n => n).join(', ');
            }

            const subject = `Questionnaire à froid (apprenants) - Formation "${formation.formation_name || ''}" - ${companyName}`;
            const body = `Bonjour${directorName ? ' ' + directorName : ''},

J'espère que vous allez bien.

Il y a maintenant 6 mois que la formation "${formation.formation_name || ''}" s'est terminée. Dans le cadre de la démarche qualité Qualiopi, je souhaiterais recueillir le retour de chaque apprenant sur l'impact de cette formation dans leur activité quotidienne.

Pourriez-vous transmettre ce questionnaire à chaque apprenant ayant participé à la formation ?
${learnersNames ? 'Apprenants concernés : ' + learnersNames : ''}

Questionnaire apprenant :
[Lien du questionnaire apprenant]

Ce retour est précieux pour améliorer continuellement la qualité de mes formations.

En vous remerciant par avance.

Nathalie Joulié-Morand`;

            GenericEmail.show({
                title: '📧 Questionnaire à froid — Apprenants',
                to: clientEmail,
                subject,
                body,
                showQuestionnaires: true
            });

            // Marquer comme envoyé
            await supabaseClient
                .from('formations')
                .update({ questionnaire_froid_sent: true })
                .eq('id', formationId);
        } catch (error) {
            console.error('Erreur envoi questionnaire apprenants:', error);
            showToast('Erreur: ' + error.message, 'error');
        }
    },

    // Garder l'ancienne méthode pour compatibilité (boutons existants)
    async envoyerQuestionnaireFroid(formationId) {
        this.envoyerQuestionnaireFroidDirigeant(formationId);
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
                showToast('Vous devez être connecté', 'error');
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
                showToast('Utilisateur créé !', 'success');
            } else {
                showToast(result.message, 'error');
            }
        }
    }
};

// ==================== User Management Logic ====================
const UserManagement = {
    currentUser: null,
    allUsers: [],
    currentTab: 'clients',

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
            showToast(result.message, 'error');
            return;
        }

        this.allUsers = result.users;
        this.renderUsers(this.allUsers);
        this.updateStats(this.allUsers);
        this.showTab(this.currentTab);
    },

    showTab(tabName) {
        this.currentTab = tabName;

        // Mettre à jour les onglets visuellement
        ['clients', 'formateurs', 'admins'].forEach(t => {
            const btn = document.getElementById(`tab-${t}`);
            if (btn) {
                const isActive = t === tabName;
                btn.style.color = isActive ? 'var(--primary-purple)' : 'var(--gray-500)';
                btn.style.fontWeight = isActive ? '600' : '500';
                btn.style.borderBottom = isActive ? '2px solid var(--primary-purple)' : 'none';
            }
        });

        const container = document.getElementById('acces-tab-content');
        if (!container) return;

        const roleMap = { clients: 'client', formateurs: 'formateur', admins: 'admin' };
        const filtered = this.allUsers.filter(u => u.role === roleMap[tabName]);

        if (tabName === 'clients') {
            this.renderClientCards(container, filtered);
        } else {
            this.renderUserTable(container, filtered, tabName);
        }
    },

    renderClientCards(container, clients) {
        if (clients.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--gray-500);">Aucun client. Cliquez "+ Nouvel utilisateur" pour en créer un.</div>';
            return;
        }

        container.innerHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1rem;">
            ${clients.map(u => {
                const companies = u.client_names || [];
                const companyTags = companies.length > 0
                    ? companies.map(c => `<span style="display: inline-block; padding: 0.2rem 0.6rem; background: #ede9fe; color: #7c3aed; border-radius: 12px; font-size: 0.75rem; font-weight: 500;">${c}</span>`).join(' ')
                    : '<span style="color: var(--gray-400); font-size: 0.8rem;">Aucune entreprise liée</span>';

                const statusBadge = u.active
                    ? '<span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: #059669; background: #d1fae5; padding: 0.15rem 0.5rem; border-radius: 10px;">Actif</span>'
                    : '<span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: #dc2626; background: #fee2e2; padding: 0.15rem 0.5rem; border-radius: 10px;">Inactif</span>';

                const passwordSection = u.initial_password
                    ? `<div style="display: flex; align-items: center; gap: 0.5rem;">
                        <code style="background: var(--gray-100); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${u.initial_password}</code>
                        <button onclick="UserManagement.copyToClipboard('${u.initial_password}')" style="background: none; border: none; cursor: pointer; font-size: 0.7rem; color: var(--primary-purple);">Copier</button>
                       </div>`
                    : '<span style="font-size: 0.75rem; color: var(--gray-400);">Modifié par l\'utilisateur</span>';

                return `<div class="user-card" style="background: white; border-radius: var(--radius-xl); padding: 1.25rem; box-shadow: var(--shadow-sm); border: 1px solid var(--gray-200);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                        <div>
                            <div style="font-weight: 600; font-size: 1rem; color: var(--gray-900);">${u.name || 'Sans nom'}</div>
                            <div style="font-size: 0.85rem; color: var(--gray-500); margin-top: 0.15rem;">${u.email}</div>
                        </div>
                        ${statusBadge}
                    </div>

                    <div style="margin-bottom: 0.75rem; display: flex; gap: 0.35rem; flex-wrap: wrap;">
                        ${companyTags}
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; font-size: 0.8rem; color: var(--gray-600);">
                        🔑 ${passwordSection}
                    </div>

                    <div style="display: flex; gap: 0.5rem; padding-top: 0.75rem; border-top: 1px solid var(--gray-100);">
                        <button onclick="UserManagement.sendWelcomeEmail('${u.id}')" style="flex: 1; padding: 0.4rem; background: var(--primary-purple); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-size: 0.8rem; font-weight: 500;">📧 Envoyer accès</button>
                        <button onclick="UserManagement.editUser('${u.id}')" style="padding: 0.4rem 0.75rem; background: var(--gray-100); color: var(--gray-700); border: none; border-radius: var(--radius-md); cursor: pointer; font-size: 0.8rem;">Modifier</button>
                        <button onclick="UserManagement.deleteUser('${u.id}')" style="padding: 0.4rem 0.75rem; background: none; color: #dc2626; border: 1px solid #fca5a5; border-radius: var(--radius-md); cursor: pointer; font-size: 0.8rem;">Suppr.</button>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
    },

    renderUserTable(container, users, tabName) {
        if (users.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--gray-500);">Aucun utilisateur dans cette catégorie.</div>';
            return;
        }

        container.innerHTML = `<div style="background: white; border-radius: var(--radius-xl); padding: 1rem; box-shadow: var(--shadow-sm);">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--gray-200);">
                        <th style="text-align: left; padding: 0.75rem; font-weight: 600; color: var(--gray-700); font-size: 0.85rem;">Nom</th>
                        <th style="text-align: left; padding: 0.75rem; font-weight: 600; color: var(--gray-700); font-size: 0.85rem;">Email</th>
                        <th style="text-align: left; padding: 0.75rem; font-weight: 600; color: var(--gray-700); font-size: 0.85rem;">Statut</th>
                        <th style="text-align: right; padding: 0.75rem; font-weight: 600; color: var(--gray-700); font-size: 0.85rem;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `<tr style="border-bottom: 1px solid var(--gray-100);">
                        <td style="padding: 0.75rem; font-weight: 500;">${u.name || 'Sans nom'}</td>
                        <td style="padding: 0.75rem; color: var(--gray-600); font-size: 0.9rem;">${u.email}</td>
                        <td style="padding: 0.75rem;">${u.active ? '<span style="color: #059669; font-size: 0.8rem;">Actif</span>' : '<span style="color: #dc2626; font-size: 0.8rem;">Inactif</span>'}</td>
                        <td style="padding: 0.75rem; text-align: right;">
                            <button onclick="UserManagement.editUser('${u.id}')" style="padding: 0.3rem 0.6rem; background: var(--gray-100); border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.8rem;">Modifier</button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    },

    filterUsers() {
        const search = (document.getElementById('user-search')?.value || '').toLowerCase();
        const cards = document.querySelectorAll('.user-card, #acces-tab-content tr');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(search) ? '' : 'none';
        });
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
            showToast('Mot de passe copié !', 'success');
        }).catch(err => {
            console.error('Erreur copie:', err);
            // Fallback pour les navigateurs plus anciens
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('Mot de passe copié !', 'success');
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
                showToast('Mot de passe copié !', 'success');
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
            showToast('Erreur lors de la récupération des utilisateurs', 'error');
            return;
        }

        const user = result.users.find(u => u.id === userId);
        if (!user) {
            showToast('Utilisateur non trouvé', 'error');
            return;
        }

        const password = user.initial_password || '[mot de passe modifié - veuillez le réinitialiser]';
        const siteUrl = window.location.origin;
        const docPrealableUrl = window.location.origin + '/assets/static/document-prealable.docx';

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
                    showToast('Le prénom et le nom du sous-traitant sont obligatoires', 'error');
                    return;
                }

                const subResult = await SupabaseData.addSubcontractor({
                    first_name: firstName,
                    last_name: lastName,
                    email: subEmail || null
                });

                if (!subResult.success) {
                    showToast('Erreur création sous-traitant: ' + subResult.message, 'error');
                    return;
                }

                subcontractorId = subResult.data.id;
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
                    showToast('La raison sociale est obligatoire pour un compte client', 'error');
                    return;
                }

                const clientResult = await SupabaseData.addClient({
                    company_name: companyName,
                    contact_name: contactName || null,
                    email: clientEmail || null,
                    address: address || null
                });

                if (!clientResult.success) {
                    showToast('Erreur création client: ' + clientResult.message, 'error');
                    return;
                }

                clientId = clientResult.data.id;
                clientIds = [clientId];
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

                    // Envoi automatique du mail avec les accès
                    try {
                        const siteUrl = window.location.origin;
                        const pwd = existingProfile.data.initial_password || '[mot de passe à réinitialiser]';
                        const subject = `Votre espace NJM Conseil — nouvelle entreprise associée`;
                        const body = `Bonjour ${existingProfile.data.name || ''},\n\nL'entreprise "${clientNames}" a été associée à votre espace client NJM Conseil.\n\nAccès : ${siteUrl}\nIdentifiant : ${email}\nMot de passe : ${pwd}\n\nVous pouvez désormais basculer entre vos entreprises depuis votre espace.\n\nCordialement,\nNathalie Joulie-Morand`;
                        await EmailService.sendEmail(email, subject, body, []);
                    } catch (mailErr) {
                        console.warn('Envoi mail échec:', mailErr);
                    }

                    showToast(`Entreprise "${clientNames}" ajoutée au compte existant "${existingProfile.data.name}" — mail envoyé`, 'success');
                    this.closeModal();
                    await this.loadUsers();
                    return;
                } else {
                    // Compte orphelin : existe en auth.users mais pas en profiles
                    showToast(
                        `Cet email est déjà utilisé dans le système d'authentification mais n'est lié à aucun profil utilisable. Utilisez un autre email (ex: ${email.replace('@', '+test@')}) ou contactez l'administrateur pour supprimer le compte orphelin.`,
                        'error',
                        10000
                    );
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
                    showToast(result.message + ' — Pensez à copier le mot de passe !', 'success');
                    await this.loadUsers();
                    return;
                }
            }

            showToast(result.message, result.success ? "success" : "error");
            this.closeModal();
            await this.loadUsers();
        } else {
            showToast(result.message, result.success ? "success" : "error");
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
            showToast(result.message, result.success ? "success" : "error");
            await this.loadUsers();
        } else {
            showToast(result.message, result.success ? "success" : "error");
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
            showToast(result.message, result.success ? "success" : "error");
            this.closeResetPasswordModal();
            await this.loadUsers(); // Rafraîchir pour voir le nouveau mot de passe
        } else {
            showToast(result.message, result.success ? "success" : "error");
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
            showToast(result.message, result.success ? "success" : "error");
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

// Fermer les dropdowns quand on clique ailleurs
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
    }
    // Fermer le dropdown quand on clique sur un bouton à l'intérieur
    const dropdownBtn = e.target.closest('.dropdown-content button');
    if (dropdownBtn) {
        const dropdown = dropdownBtn.closest('.dropdown');
        if (dropdown) setTimeout(() => dropdown.classList.remove('open'), 100);
    }
});

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

    // URLs des documents statiques (à stocker dans Supabase Storage)
    // Uploadez les PDF dans le bucket 'documents/static/' et mettez à jour les URLs ci-dessous
    STATIC_DOCUMENTS: {
        livret_accueil: {
            name: 'Livret d\'accueil NJM Conseil',
            pdfUrl: 'assets/static/livret-accueil.pdf'
        },
        fiche_reclamation: {
            name: 'Fiche de réclamation',
            pdfUrl: 'assets/static/fiche-reclamation.pdf'
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
                if (profileResult.data.initial_password) {
                    clientPassword = profileResult.data.initial_password;
                } else {
                    clientPassword = '⚠️ Mot de passe non disponible - réinitialisez-le dans Gestion des Accès';
                }
            } else {
                clientLogin = '⚠️ Compte non créé - créez-le d\'abord dans Gestion des Accès';
                clientPassword = '⚠️ Compte non créé';
                showToast('Attention : aucun compte client trouvé pour ' + formation.client_email + '. Créez-le dans Gestion des Accès.', 'warning', 6000);
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
        // Les documents sont dans l'espace client, pas en PJ - cacher la section
        const attachmentsSection = document.getElementById('convocation-attachments-section');
        if (attachmentsSection) attachmentsSection.style.display = 'none';
        return;

        // Liste des pièces jointes requises
        const requiredAttachments = [
            { name: 'Fiche pédagogique', type: 'fiche_pedagogique', icon: '📄', color: '#0284c7' },
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
                // Documents statiques (stockés dans Supabase Storage)
                const staticDoc = this.STATIC_DOCUMENTS[attachment.type];
                if (staticDoc) {
                    pdfUrl = staticDoc.pdfUrl;
                }
            } else {
                // Documents de la formation
                doc = formationDocs.find(d => {
                    if (attachment.type === 'fiche_pedagogique') {
                        return d.type === 'fiche_pedagogique' && d.name && d.name.toLowerCase().includes('pédagogique');
                    }
                    return d.type === attachment.type;
                });

                if (doc) {
                    pdfUrl = doc.document_url || '';
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
        const questionnaireRegex = /\[Lien du questionnaire[^\]]*\]|https:\/\/[^\s\n]*/g;

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
            showToast('Copié dans le presse-papiers', 'success');
        } catch (err) {
            // Fallback pour les navigateurs plus anciens
            bodyTextarea.select();
            document.execCommand('copy');
            showToast('Copié dans le presse-papiers', 'success');
        }
    },

    async sendEmail() {
        const toInput = document.getElementById('convocation-to');
        const subjectInput = document.getElementById('convocation-subject');
        const bodyTextarea = document.getElementById('convocation-body');
        const questionnaireSelect = document.getElementById('convocation-questionnaire');
        const sendButton = document.getElementById('convocation-send-btn');

        if (!toInput.value) {
            showToast("Veuillez renseigner l'adresse email du destinataire", 'error');
            toInput.focus();
            return;
        }

        // Vérifier que le format email est valide
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(toInput.value)) {
            showToast('Veuillez entrer une adresse email valide', 'error');
            toInput.focus();
            return;
        }

        // Désactiver le bouton pendant l'envoi
        const originalButtonText = sendButton.innerHTML;
        sendButton.disabled = true;
        sendButton.innerHTML = '⏳ Envoi en cours...';

        try {
            // Les documents sont dans l'espace client, pas en PJ du mail
            const attachments = [];

            // Envoyer via Resend (Edge Function)
            const result = await EmailService.sendEmail(
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
                    email_message_id: result.messageId,
                    sent_by: 'resend',
                    company_name: this.currentFormation.company_name || this.currentFormation.client_name || ''
                };

                await SupabaseData.logConvocationSent(this.currentFormation.id, logData);

                // Transition automatique : Planifiée → En cours après convocation
                if (this.currentFormation.status === 'planned') {
                    await supabaseClient.from('formations').update({ status: 'in_progress' }).eq('id', this.currentFormation.id);
                    showToast('Statut passé à "En cours"', 'info');
                }

                showToast('Email envoyé avec succès !', 'success');
                this.closeModal();

                // Recharger les formations pour mettre à jour l'icône
                await CRMApp.loadFormations();
            } else {
                // En cas d'erreur, proposer l'alternative mailto
                const useMailto = confirm(
                    `❌ Erreur lors de l'envoi:\n${result.error}\n\nVoulez-vous ouvrir votre client mail par défaut à la place ?`
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

        // 1. Documents dynamiques - régénérés à la volée
        const docsToGenerate = [
            { type: 'fiche_pedagogique', name: 'Fiche pédagogique', generator: 'generatePedagogicalSheet' },
            { type: 'convention', name: 'Convention', generator: 'generateConvention' }
        ];

        for (const docConfig of docsToGenerate) {
            // Vérifier que le document a été créé pour cette formation
            const exists = formationDocs.find(d => d.type === docConfig.type || (docConfig.type === 'fiche_pedagogique' && d.type === 'google_doc'));
            if (exists && typeof PdfGenerator !== 'undefined' && PdfGenerator[docConfig.generator]) {
                try {
                    const result = await PdfGenerator[docConfig.generator](formation);
                    if (result && result.success && result.blob) {
                        const base64 = await PdfGenerator.blobToBase64(result.blob);
                        attachments.push({
                            name: `${docConfig.name} - ${formation.formation_name || 'Formation'}.pdf`,
                            mimeType: 'application/pdf',
                            data: base64
                        });
                    }
                } catch (error) {
                    console.warn(`Impossible de générer ${docConfig.name}:`, error);
                }
            }
        }

        // 2. Documents statiques (Livret d'accueil et Fiche de réclamation)
        for (const key in this.STATIC_DOCUMENTS) {
            const staticDoc = this.STATIC_DOCUMENTS[key];
            if (staticDoc.pdfUrl) {
                try {
                    const pdfData = await this.downloadPdfFromUrl(staticDoc.pdfUrl);
                    if (pdfData) {
                        attachments.push({
                            name: `${staticDoc.name}.pdf`,
                            mimeType: 'application/pdf',
                            data: pdfData
                        });
                    }
                } catch (error) {
                    console.error(`Erreur téléchargement document statique ${staticDoc.name}:`, error);
                }
            }
        }

        return attachments;
    },

    /**
     * Télécharge un PDF depuis une URL et retourne le contenu en base64
     */
    async downloadPdfFromUrl(url) {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Erreur téléchargement PDF:', error);
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

    show({ title, to, subject, body, showQuestionnaires = false, formationId = null }) {
        this.currentFormationId = formationId;
        document.getElementById('generic-email-title').textContent = title || 'Envoi de mail';
        document.getElementById('generic-email-to').value = to || '';
        document.getElementById('generic-email-subject').value = subject || '';
        document.getElementById('generic-email-body').value = body || '';

        // Afficher/masquer les sélecteurs de questionnaires
        const questSection = document.getElementById('generic-email-questionnaires');
        if (questSection) {
            questSection.style.display = showQuestionnaires ? 'block' : 'none';
            const evalSelect = document.getElementById('generic-email-quest-eval');
            const satisSelect = document.getElementById('generic-email-quest-satis');
            if (evalSelect) evalSelect.value = '';
            if (satisSelect) satisSelect.value = '';
        }

        // Afficher les pieces jointes si on a une formation
        const attachSection = document.getElementById('generic-email-attachments');
        if (attachSection) {
            attachSection.style.display = formationId ? 'block' : 'none';
            // Reset les checkboxes
            document.querySelectorAll('input[name="email-attach"]').forEach(cb => cb.checked = false);
        }

        const sendBtn = document.getElementById('generic-email-send-btn');
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Envoyer le mail';

        document.getElementById('genericEmailModal').style.display = 'flex';
    },

    insertQuestionnaire(type) {
        const body = document.getElementById('generic-email-body');
        if (!body) return;

        const selectId = type === 'eval' ? 'generic-email-quest-eval' : 'generic-email-quest-satis';
        const select = document.getElementById(selectId);
        if (!select) return;

        let url = select.value;

        // Personnaliser l'URL avec le nom de l'entreprise (pré-remplissage Google Forms)
        // Extraire le nom de l'entreprise depuis le sujet ou le corps du mail
        const subjectInput = document.getElementById('generic-email-subject');
        if (url && subjectInput) {
            // Essayer d'extraire le nom de l'entreprise depuis le sujet
            const subjectMatch = subjectInput.value.match(/- (.+?)$/);
            if (subjectMatch && subjectMatch[1]) {
                const companyName = subjectMatch[1].trim();
                const separator = url.includes('?') ? '&' : '?';
                url = url + separator + 'usp=pp_url&entry.company=' + encodeURIComponent(companyName);
            }
        }

        let text = body.value;

        if (type === 'eval') {
            text = text.replace(/Questionnaire d'évaluation des acquis :\s*\n?\[?[^\]\n]*\]?/,
                `Questionnaire d'évaluation des acquis :\n${url || '[Sélectionnez un questionnaire ci-dessus]'}`);
        } else {
            text = text.replace(/Questionnaire de satisfaction :\s*\n?\[?[^\]\n]*\]?/,
                `Questionnaire de satisfaction :\n${url || '[Sélectionnez un questionnaire ci-dessus]'}`);
        }

        body.value = text;
    },

    copyToClipboard() {
        const body = document.getElementById('generic-email-body').value;
        navigator.clipboard.writeText(body).then(() => {
            showToast('Copié !', 'success');
        }).catch(() => {
            // Fallback
            const textarea = document.getElementById('generic-email-body');
            textarea.select();
            document.execCommand('copy');
            showToast('Copié !', 'success');
        });
    },

    async sendEmail() {
        const to = document.getElementById('generic-email-to').value;
        const subject = document.getElementById('generic-email-subject').value;
        const body = document.getElementById('generic-email-body').value;
        const sendBtn = document.getElementById('generic-email-send-btn');

        if (!to) {
            showToast("Veuillez renseigner l'adresse email du destinataire", 'error');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            showToast('Veuillez entrer une adresse email valide', 'error');
            return;
        }

        sendBtn.disabled = true;
        sendBtn.innerHTML = '\u23F3 Envoi en cours...';

        try {
            // Generer les pieces jointes PDF cochees
            const attachments = [];
            const checkedDocs = document.querySelectorAll('input[name="email-attach"]:checked');
            if (checkedDocs.length > 0 && this.currentFormationId) {
                sendBtn.innerHTML = '\u23F3 G\u00E9n\u00E9ration des PDF...';
                const { data: formation } = await supabaseClient
                    .from('formations').select('*').eq('id', this.currentFormationId).single();

                if (formation) {
                    const generators = {
                        fiche_pedagogique: { method: 'generatePedagogicalSheet', label: 'Fiche p\u00E9dagogique' },
                        convention: { method: 'generateConvention', label: 'Convention' },
                        contrat_sous_traitance: { method: 'generateContratSousTraitance', label: 'Contrat sous-traitance' },
                        attendance_sheet: { method: 'generateAttendanceSheet', label: 'Feuille de pr\u00E9sence' },
                        certificate: { method: 'generateCertificate', label: 'Certificat' },
                    };
                    for (const cb of checkedDocs) {
                        const gen = generators[cb.value];
                        if (gen && PdfGenerator[gen.method]) {
                            const result = await PdfGenerator[gen.method](formation);
                            if (result && result.success && result.blob) {
                                const base64 = await new Promise((resolve) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                                    reader.readAsDataURL(result.blob);
                                });
                                attachments.push({
                                    name: `${gen.label} - ${formation.formation_name || 'Formation'}.pdf`,
                                    data: base64,
                                    mimeType: 'application/pdf'
                                });
                            }
                        }
                    }
                }
                sendBtn.innerHTML = '\u23F3 Envoi en cours...';
            }

            const result = await EmailService.sendEmail(to, subject, body, attachments);

            if (result.success) {
                showToast('Email envoyé !', 'success');
                addNotification('mail', `Mail envoyé à ${to}`);
                if (this.currentFormationId) {
                    await SupabaseData.logConvocationSent(this.currentFormationId, {
                        sent_to: to,
                        subject: subject,
                        sent_by: 'resend'
                    });
                }
                this.closeModal();
            } else {
                const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                window.open(mailtoUrl, '_blank');
                showToast("L'envoi automatique a échoué. Brouillon ouvert dans votre client mail.", 'warning');
            }
        } catch (error) {
            console.error('Erreur envoi email:', error);
            showToast("Erreur lors de l'envoi", 'error');
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Envoyer le mail';
        }
    }
};

// ==================== DOCUMENT PREVIEW (modal generique) ====================

const DOC_CONFIGS = {
    convention: {
        title: 'Convention de formation',
        template: 'convention_template.docx',
        fields: [
            { key: 'company_name', label: 'Nom du client', type: 'input', required: true },
            { key: 'company_address', label: 'Adresse', type: 'input' },
            { key: 'company_postal_city', label: 'CP / Ville', type: 'input' },
            { key: 'contact_title', label: 'Civilit\u00E9', type: 'input' },
            { key: 'contact_name', label: 'Nom dirigeant', type: 'input' },
            { key: 'contact_role', label: 'Fonction', type: 'input' },
            { key: 'formation_name', label: 'Titre formation', type: 'input', required: true },
            { key: 'trainer', label: 'Formateur', type: 'input' },
            { key: 'dates', label: 'Dates', type: 'input', required: true },
            { key: 'duration', label: 'Dur\u00E9e (heures)', type: 'input', required: true },
            { key: 'training_location', label: 'Lieu', type: 'input', required: true },
            { key: 'learner_count', label: 'Effectif', type: 'input' },
            { key: 'learners', label: 'Apprenants', type: 'textarea', required: true },
            { key: 'price', label: 'Montant (\u20AC)', type: 'input', required: true },
            { key: 'objectives', label: 'Objectifs', type: 'textarea', required: true },
            { key: 'content_summary', label: 'Contenus (r\u00E9sum\u00E9 court — Article 1)', type: 'input', required: true },
            { key: 'module_content', label: 'Contenus (d\u00E9tail — Article 2)', type: 'textarea', required: true },
            { key: 'methods', label: 'M\u00E9thodes', type: 'textarea', required: true },
            { key: 'signature_date', label: 'Date signature', type: 'input' },
        ],
        prepareVars(f) {
            const learnersData = PdfGenerator.parseLearners(f);
            const learnersList = learnersData.map(l => PdfGenerator.getLearnerName(l)).filter(n => n).join(', ');
            const startDate = f.start_date ? new Date(f.start_date).toLocaleDateString('fr-FR') : '';
            const endDate = f.end_date ? new Date(f.end_date).toLocaleDateString('fr-FR') : '';
            const dates = f.custom_dates || (startDate === endDate ? startDate : `${startDate} au ${endDate}`);
            return {
                company_name: f.company_name || f.client_name || '',
                company_address: f.company_address || f.client_address || '',
                company_postal_city: f.company_postal_code || f.client_postal_city || '',
                contact_title: f.company_director_title || f.contact_title || 'M.',
                contact_name: f.company_director_name || f.contact_name || '',
                contact_role: f.contact_role || 'dirigeant',
                formation_name: f.formation_name || '',
                trainer: PdfGenerator.getFormateurText(f),
                dates,
                duration: String(f.hours_per_learner || f.total_hours || ''),
                training_location: f.training_location || '',
                learner_count: String(learnersData.length || 1),
                learners: learnersList,
                price: String(f.total_amount || f.price || ''),
                objectives: f.objectives || '',
                content_summary: f.content_summary || '',
                module_content: f.module_1 || '',
                methods: f.methods_tools || '',
                signature_date: new Date().toLocaleDateString('fr-FR'),
            };
        },
    },

    fiche_pedagogique: {
        title: 'Fiche p\u00E9dagogique',
        template: 'fiche_peda_template.docx',
        fields: [
            { key: 'formation_name', label: 'Titre formation', type: 'input', required: true },
            { key: 'public', label: 'Public', type: 'input' },
            { key: 'prerequisites', label: 'Pr\u00E9 requis', type: 'input' },
            { key: 'duration', label: 'Dur\u00E9e (heures)', type: 'input', required: true },
            { key: 'objectives', label: 'Objectifs', type: 'textarea', required: true },
            { key: 'content', label: 'Contenu', type: 'textarea', required: true },
            { key: 'methods', label: 'M\u00E9thodes et outils', type: 'textarea', required: true },
            { key: 'evaluation', label: 'M\u00E9thodologie d\'\u00E9valuation', type: 'input' },
            { key: 'added_value', label: 'Le + apport\u00E9', type: 'input' },
            { key: 'access_delays', label: 'D\u00E9lais d\'acc\u00E8s', type: 'input' },
        ],
        prepareVars(f) {
            return {
                formation_name: f.formation_name || '',
                public: f.target_audience || '',
                prerequisites: f.prerequisites || 'RAS',
                duration: String(f.hours_per_learner || ''),
                objectives: f.objectives || '',
                content: f.module_1 || '',
                methods: f.methods_tools || '',
                evaluation: f.evaluation_methodology || '',
                added_value: f.added_value || '',
                access_delays: f.access_delays || 'les dates disponibles le sont \u00E0 partir du 6 mois',
            };
        },
    },

    contrat_sous_traitance: {
        title: 'Contrat de sous-traitance',
        template: 'contrat_sous_traitance_template.docx',
        fields: [
            { key: 'trainer_name', label: 'Nom sous-traitant', type: 'input', required: true },
            { key: 'trainer_address', label: 'Adresse sous-traitant', type: 'input' },
            { key: 'trainer_siret', label: 'SIRET sous-traitant', type: 'input' },
            { key: 'trainer_nda', label: 'N\u00B0 activit\u00E9 sous-traitant', type: 'input' },
            { key: 'formation_name', label: 'Titre formation', type: 'input', required: true },
            { key: 'dates', label: 'Dates', type: 'input', required: true },
            { key: 'duration', label: 'Dur\u00E9e (heures)', type: 'input', required: true },
            { key: 'price', label: 'Prix/jour (\u20AC)', type: 'input', required: true },
            { key: 'signature_date', label: 'Date signature', type: 'input' },
        ],
        prepareVars(f) {
            const startDate = f.start_date ? new Date(f.start_date).toLocaleDateString('fr-FR') : '';
            const endDate = f.end_date ? new Date(f.end_date).toLocaleDateString('fr-FR') : '';
            const dates = f.custom_dates || (startDate === endDate ? startDate : `${startDate} au ${endDate}`);
            return {
                trainer_name: `${f.subcontractor_first_name || ''} ${f.subcontractor_last_name || ''}`.trim(),
                trainer_address: f.subcontractor_address || '',
                trainer_siret: f.subcontractor_siret || '',
                trainer_nda: f.subcontractor_nda || '',
                formation_name: f.formation_name || '',
                dates,
                duration: String(f.hours_per_learner || ''),
                price: f.subcontractor_price || '600',
                signature_date: new Date().toLocaleDateString('fr-FR'),
            };
        },
    },

    attendance_sheet: {
        title: 'Feuille de pr\u00E9sence',
        template: 'feuille_presence_template.docx',
        pdfOnly: true,
        fields: [
            { key: 'formation_name', label: 'Titre formation', type: 'input', required: true },
            { key: 'training_location', label: 'Lieu', type: 'input', required: true },
            { key: 'dates_list', label: 'Jours de formation (1 feuille par jour)', type: 'textarea' },
            { key: 'learners_list', label: 'Apprenants', type: 'textarea' },
            { key: 'hours_per_day', label: 'Heures / jour / apprenant', type: 'input' },
        ],
        prepareVars(f) {
            const sheets = PdfGenerator.buildAttendanceSheets(f);
            const learnersData = PdfGenerator.parseLearners(f);
            const totalHours = parseFloat(f.hours_per_learner) || 0;
            const numDays = sheets.length || 1;
            const hoursPerDay = numDays > 0 ? Math.round(totalHours / numDays) : totalHours;
            const datesList = sheets.map(s => s.date ? new Date(s.date).toLocaleDateString('fr-FR') : '?').join('\n');
            const learnersList = learnersData.map(l => PdfGenerator.getLearnerName(l)).filter(n => n).join('\n');
            return {
                formation_name: f.formation_name || '',
                training_location: f.training_location || '',
                dates_list: datesList || 'Aucune date d\u00E9finie',
                learners_list: learnersList || 'Aucun apprenant',
                hours_per_day: String(hoursPerDay) + 'h',
            };
        },
    },

    certificate: {
        title: 'Certificat / Attestation',
        template: 'attestation_template.docx',
        dynamicAcquis: true,
        fields: [
            { key: 'learner_name', label: 'Nom apprenant', type: 'input', required: true },
            { key: 'company_name', label: 'Entreprise', type: 'input', required: true },
            { key: 'formation_name', label: 'Titre formation', type: 'input', required: true },
            { key: 'objectives', label: 'Objectifs', type: 'textarea' },
            { key: 'training_location', label: 'Lieu', type: 'input' },
            { key: 'dates', label: 'Dates', type: 'input', required: true },
            { key: 'duration', label: 'Dur\u00E9e (heures)', type: 'input', required: true },
            { key: 'signature_date', label: 'Date signature', type: 'input' },
        ],
        prepareVars(f) {
            const learnersData = PdfGenerator.parseLearners(f);
            const startDate = f.start_date ? new Date(f.start_date).toLocaleDateString('fr-FR') : '';
            const endDate = f.end_date ? new Date(f.end_date).toLocaleDateString('fr-FR') : '';
            const dates = f.custom_dates || (startDate === endDate ? startDate : `du ${startDate} au ${endDate}`);
            const objectives = (f.objectives || '').split(/\n/).map(s => s.trim()).filter(s => s.length > 0);
            const firstLearner = learnersData[0] || {};
            return {
                learner_name: PdfGenerator.getLearnerName(firstLearner),
                company_name: f.company_name || f.client_name || '',
                formation_name: f.formation_name || '',
                objectives: f.objectives || '',
                training_location: f.training_location || '',
                dates,
                duration: String(firstLearner.hours || f.hours_per_learner || ''),
                signature_date: endDate || new Date().toLocaleDateString('fr-FR'),
                _learners: learnersData.map(l => ({
                    name: PdfGenerator.getLearnerName(l),
                    hours: l.hours || f.hours_per_learner || '',
                    acquis: l.acquis || [],
                })),
                _objectives: objectives,
            };
        },
    },
};

const DocumentPreview = {
    currentType: null,
    currentFormationData: null,
    currentFormationId: null,

    async open(formationId, docType) {
        try {
            showToast('Chargement...', 'info');

            const config = DOC_CONFIGS[docType];
            if (!config) {
                showToast('Type de document inconnu: ' + docType, 'error');
                return;
            }

            // Fetch formation
            const { data, error } = await supabaseClient
                .from('formations')
                .select('*')
                .eq('id', formationId)
                .single();
            if (error) throw error;

            // Fetch client pour pre-remplir les infos manquantes
            if (data.client_id) {
                const { data: client } = await supabaseClient
                    .from('clients')
                    .select('*')
                    .eq('id', data.client_id)
                    .single();
                if (client) {
                    if (!data.company_name && !data.client_name) data.company_name = client.company_name || '';
                    if (!data.company_address && !data.client_address) data.company_address = client.address || client.company_address || '';
                    if (!data.company_postal_code && !data.client_postal_city) data.company_postal_code = client.postal_code || client.city || '';
                    if (!data.company_director_name && !data.contact_name) data.company_director_name = client.contact_name || client.director_name || '';
                    if (!data.company_director_title && !data.contact_title) data.company_director_title = client.contact_title || '';
                    if (!data.contact_role) data.contact_role = client.contact_role || 'dirigeant';
                }
            }

            this.currentType = docType;
            this.currentFormationData = data;
            this.currentFormationId = formationId;

            // Preparer les valeurs par defaut
            const vars = config.prepareVars(data);

            // Generer l'apercu en lecture seule
            const container = document.getElementById('doc-preview-fields');
            container.innerHTML = '';

            const missing = [];
            config.fields.forEach(field => {
                const value = vars[field.key] || '';
                const isEmpty = !value.trim();
                if (field.required && isEmpty) missing.push(field.label);

                const wrapper = document.createElement('div');
                if (field.type === 'textarea') wrapper.style.gridColumn = '1 / -1';

                const label = document.createElement('div');
                label.textContent = field.label + (field.required ? ' *' : '');
                label.style.cssText = 'font-size: 0.75rem; font-weight: 600; color: var(--gray-500); margin-bottom: 0.15rem; text-transform: uppercase; letter-spacing: 0.3px;';
                wrapper.appendChild(label);

                const val = document.createElement('div');
                val.dataset.key = field.key;
                if (isEmpty) {
                    val.textContent = '\u2014 non renseign\u00E9';
                    val.style.cssText = 'padding: 0.4rem 0.5rem; font-size: 0.85rem; color: #EF4444; font-style: italic; background: #FEF2F2; border-radius: var(--radius-sm);';
                } else {
                    val.textContent = value;
                    val.style.cssText = 'padding: 0.4rem 0.5rem; font-size: 0.85rem; color: var(--gray-800); background: var(--gray-50); border-radius: var(--radius-sm); white-space: pre-wrap; max-height: 100px; overflow-y: auto;';
                }
                wrapper.appendChild(val);
                container.appendChild(wrapper);
            });

            // Apprenants (lecture seule)
            if (config.dynamicLearners && vars._learners) {
                const section = document.createElement('div');
                section.style.gridColumn = '1 / -1';
                const title = document.createElement('div');
                title.textContent = 'APPRENANTS';
                title.style.cssText = 'font-size: 0.75rem; font-weight: 600; color: var(--gray-500); margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.3px;';
                section.appendChild(title);
                if (vars._learners.length === 0) {
                    const empty = document.createElement('div');
                    empty.textContent = '\u2014 aucun apprenant';
                    empty.style.cssText = 'color: #EF4444; font-style: italic; font-size: 0.85rem; background: #FEF2F2; padding: 0.4rem 0.5rem; border-radius: var(--radius-sm);';
                    section.appendChild(empty);
                    missing.push('Apprenants');
                } else {
                    vars._learners.forEach(l => {
                        const row = document.createElement('div');
                        row.style.cssText = 'padding: 0.3rem 0.5rem; font-size: 0.85rem; color: var(--gray-800); background: var(--gray-50); border-radius: var(--radius-sm); margin-bottom: 0.2rem;';
                        row.textContent = l.name + (l.hours ? ` \u2014 ${l.hours}h` : '');
                        section.appendChild(row);
                    });
                }
                container.appendChild(section);
            }

            // Acquis (lecture seule pour certificat)
            if (config.dynamicAcquis && vars._learners && vars._objectives) {
                const section = document.createElement('div');
                section.style.gridColumn = '1 / -1';
                section.id = 'doc-preview-acquis';
                section.style.cssText += 'border-top: 1px solid var(--gray-200); padding-top: 0.5rem; margin-top: 0.5rem;';
                const title = document.createElement('div');
                title.textContent = 'R\u00C9SULTATS DES ACQUIS';
                title.style.cssText = 'font-size: 0.75rem; font-weight: 600; color: var(--gray-500); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.3px;';
                section.appendChild(title);
                vars._learners.forEach((learner, li) => {
                    if (!learner.name) return;
                    const block = document.createElement('div');
                    block.style.cssText = 'margin-bottom: 0.75rem; padding: 0.5rem; background: var(--gray-50); border-radius: var(--radius-sm);';
                    block.classList.add('doc-acquis-learner');
                    block.dataset.learnerIndex = li;
                    const nameEl = document.createElement('div');
                    nameEl.textContent = learner.name;
                    nameEl.style.cssText = 'font-weight: 600; font-size: 0.85rem; margin-bottom: 0.4rem; color: var(--gray-800);';
                    block.appendChild(nameEl);
                    vars._objectives.forEach((obj, oi) => {
                        const row = document.createElement('div');
                        row.style.cssText = 'padding: 0.25rem 0; border-bottom: 1px solid var(--gray-100); display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;';
                        const objLabel = document.createElement('div');
                        objLabel.textContent = obj;
                        objLabel.style.cssText = 'font-size: 0.8rem; color: var(--gray-600); flex: 1; min-width: 150px;';
                        row.appendChild(objLabel);
                        const radios = document.createElement('div');
                        radios.style.cssText = 'display: flex; gap: 0.75rem;';
                        const currentVal = learner.acquis[oi] || '';
                        ['acquis', 'en_cours', 'non_acquis'].forEach(val => {
                            const lbl = document.createElement('label');
                            lbl.style.cssText = 'font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 2px;';
                            const radio = document.createElement('input');
                            radio.type = 'radio';
                            radio.name = 'doc-acquis-' + li + '-' + oi;
                            radio.value = val;
                            if (currentVal === val) radio.checked = true;
                            lbl.appendChild(radio);
                            lbl.appendChild(document.createTextNode(val === 'acquis' ? ' Acquis' : val === 'en_cours' ? ' En cours' : ' Non acquis'));
                            radios.appendChild(lbl);
                        });
                        row.appendChild(radios);
                        block.appendChild(row);
                    });
                    section.appendChild(block);
                });
                container.appendChild(section);
            }

            // Bandeau status
            const statusDiv = document.getElementById('doc-preview-status');
            const btnPdf = document.getElementById('doc-preview-btn-pdf');
            const btnDocx = document.getElementById('doc-preview-btn-docx');
            if (missing.length > 0) {
                statusDiv.style.display = 'block';
                statusDiv.style.background = '#FEF2F2';
                statusDiv.style.border = '1px solid #FECACA';
                statusDiv.style.color = '#991B1B';
                statusDiv.innerHTML = '<strong>\u26A0 Champs obligatoires manquants :</strong> ' + missing.join(', ') + '<br><em>Cliquez "Modifier les infos" pour les compl\u00E9ter.</em>';
                btnPdf.disabled = true; btnPdf.style.opacity = '0.5'; btnPdf.style.cursor = 'not-allowed';
                btnDocx.disabled = true; btnDocx.style.opacity = '0.5'; btnDocx.style.cursor = 'not-allowed';
            } else {
                statusDiv.style.display = 'block';
                statusDiv.style.background = '#F0FDF4';
                statusDiv.style.border = '1px solid #BBF7D0';
                statusDiv.style.color = '#166534';
                statusDiv.innerHTML = '\u2705 <strong>Tout est pr\u00EAt !</strong> Vous pouvez t\u00E9l\u00E9charger le document.';
                btnPdf.disabled = false; btnPdf.style.opacity = '1'; btnPdf.style.cursor = 'pointer';
                btnDocx.disabled = false; btnDocx.style.opacity = '1'; btnDocx.style.cursor = 'pointer';
            }

            // Masquer DOCX si pdfOnly
            if (config.pdfOnly) {
                btnDocx.style.display = 'none';
            } else {
                btnDocx.style.display = '';
            }

            // Titre + ouvrir modal
            document.getElementById('doc-preview-title').textContent = config.title;
            document.getElementById('documentPreviewModal').style.display = 'flex';

        } catch (err) {
            console.error('Erreur DocumentPreview.open:', err);
            showToast('Erreur: ' + err.message, 'error');
        }
    },

    validate() {
        const config = DOC_CONFIGS[this.currentType];
        if (!config) return true;

        const requiredFields = config.fields.filter(f => f.required);
        const missing = [];

        requiredFields.forEach(field => {
            const el = document.querySelector(`#doc-preview-fields [data-key="${field.key}"]`);
            const value = el ? (el.value || el.textContent || '').trim() : '';
            if (!value) {
                missing.push(field.label);
                if (el && el.style) el.style.borderColor = '#EF4444';
            } else {
                if (el && el.style) el.style.borderColor = '';
            }
        });

        const warningDiv = document.getElementById('doc-preview-warnings');
        const btnPdf = document.getElementById('doc-preview-btn-pdf');
        const btnDocx = document.getElementById('doc-preview-btn-docx');

        if (missing.length > 0) {
            if (warningDiv) {
                warningDiv.style.display = 'block';
                warningDiv.innerHTML = '<strong>\u26A0 Champs obligatoires \u00E0 compl\u00E9ter :</strong> ' + missing.join(', ');
            }
            if (btnPdf) { btnPdf.disabled = true; btnPdf.style.opacity = '0.5'; btnPdf.style.cursor = 'not-allowed'; }
            if (btnDocx) { btnDocx.disabled = true; btnDocx.style.opacity = '0.5'; btnDocx.style.cursor = 'not-allowed'; }
            return false;
        } else {
            if (warningDiv) warningDiv.style.display = 'none';
            if (btnPdf) { btnPdf.disabled = false; btnPdf.style.opacity = '1'; btnPdf.style.cursor = 'pointer'; }
            if (btnDocx) { btnDocx.disabled = false; btnDocx.style.opacity = '1'; btnDocx.style.cursor = 'pointer'; }
            return true;
        }
    },

    addLearnerRow(name, hours) {
        const list = document.getElementById('doc-preview-learners-list');
        if (!list) return;

        const row = document.createElement('div');
        row.style.cssText = 'display: flex; gap: 0.4rem; align-items: center;';
        row.classList.add('doc-learner-row');

        const input = document.createElement('input');
        input.type = 'text';
        input.value = name || '';
        input.placeholder = 'Nom et pr\u00E9nom';
        input.classList.add('doc-learner-input');
        input.style.cssText = 'flex: 1; padding: 0.5rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: 0.85rem;';

        const hoursInput = document.createElement('input');
        hoursInput.type = 'text';
        hoursInput.value = hours || '';
        hoursInput.placeholder = 'Heures';
        hoursInput.classList.add('doc-learner-hours');
        hoursInput.style.cssText = 'width: 70px; padding: 0.5rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: 0.85rem; text-align: center;';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '\u00D7';
        removeBtn.style.cssText = 'width: 28px; height: 28px; background: var(--gray-200); border: none; border-radius: var(--radius-md); font-size: 1.1rem; cursor: pointer; color: var(--gray-600); display: flex; align-items: center; justify-content: center;';
        removeBtn.onclick = () => row.remove();

        row.appendChild(input);
        row.appendChild(hoursInput);
        row.appendChild(removeBtn);
        list.appendChild(row);
    },

    close() {
        document.getElementById('documentPreviewModal').style.display = 'none';
        document.getElementById('doc-preview-fields').innerHTML = '';
        this.currentType = null;
        this.currentFormationData = null;
        this.currentFormationId = null;
    },

    goToEdit() {
        const formationId = this.currentFormationId;
        const docType = this.currentType;
        this.close();
        if (formationId && typeof FormationForm !== 'undefined') {
            // Stocker le contexte pour revenir a la modal apres save
            FormationForm._returnToDocPreview = { formationId, docType };
            FormationForm.show(formationId);
        }
    },

    getFormValues() {
        const values = {};
        // Editable inputs
        document.querySelectorAll('#doc-preview-fields .doc-preview-input').forEach(el => {
            values[el.dataset.key] = el.value || '';
        });
        // Readonly fields
        document.querySelectorAll('#doc-preview-fields .doc-preview-readonly').forEach(el => {
            values[el.dataset.key] = el.textContent || '';
        });
        // Dynamic learners
        const learnerRows = document.querySelectorAll('#doc-preview-learners-list .doc-learner-row');
        if (learnerRows.length > 0) {
            learnerRows.forEach((row, i) => {
                const nameInput = row.querySelector('.doc-learner-input');
                const hoursInput = row.querySelector('.doc-learner-hours');
                values[`learner_${i + 1}`] = nameInput ? nameInput.value || '' : '';
                values[`hours_${i + 1}`] = hoursInput ? (hoursInput.value ? hoursInput.value + 'h' : '') : '';
            });
            // Vider les slots restants dans le template (jusqu'a 20)
            for (let i = learnerRows.length + 1; i <= 20; i++) {
                values[`learner_${i}`] = '';
                values[`hours_${i}`] = '';
            }
        }
        // Dynamic acquis (certificat)
        const acquisBlocks = document.querySelectorAll('#doc-preview-acquis .doc-acquis-learner');
        if (acquisBlocks.length > 0) {
            values._acquis = [];
            acquisBlocks.forEach((block, li) => {
                const learnerAcquis = [];
                let oi = 0;
                while (true) {
                    const radio = document.querySelector(`input[name="doc-acquis-${li}-${oi}"]:checked`);
                    if (!radio && oi > 0) break;
                    learnerAcquis.push(radio ? radio.value : '');
                    oi++;
                    if (oi > 50) break;
                }
                values._acquis.push(learnerAcquis);
            });
        }
        return values;
    },

    async downloadPdf() {
        const btnPdf = document.getElementById('doc-preview-btn-pdf');
        const btnDocx = document.getElementById('doc-preview-btn-docx');
        try {
            if (typeof PdfGenerator === 'undefined') {
                showToast('Service PDF non disponible', 'error');
                return;
            }
            if (btnPdf) { btnPdf.disabled = true; btnPdf.textContent = '\u23F3 G\u00E9n\u00E9ration...'; }
            if (btnDocx) { btnDocx.disabled = true; }

            showToast('G\u00E9n\u00E9ration du PDF...', 'info');
            const f = { ...this.currentFormationData };

            // Injecter les acquis coches dans les learners_data
            const acquisBlocks = document.querySelectorAll('#doc-preview-acquis .doc-acquis-learner');
            if (acquisBlocks.length > 0) {
                const learnersData = PdfGenerator.parseLearners(f);
                acquisBlocks.forEach((block, li) => {
                    if (!learnersData[li]) return;
                    const acquis = [];
                    let oi = 0;
                    while (true) {
                        const radio = document.querySelector('input[name="doc-acquis-' + li + '-' + oi + '"]:checked');
                        if (!radio && oi > 0) break;
                        acquis.push(radio ? radio.value : '');
                        oi++;
                        if (oi > 50) break;
                    }
                    learnersData[li].acquis = acquis;
                });
                f.learners_data = learnersData;

                // Sauvegarder les acquis en base
                try {
                    await SupabaseData.updateFormation(this.currentFormationId, { learners_data: learnersData });
                } catch (e) { console.warn('Sauvegarde acquis:', e); }
            }

            const generators = {
                convention: 'generateConvention',
                fiche_pedagogique: 'generatePedagogicalSheet',
                contrat_sous_traitance: 'generateContratSousTraitance',
                attendance_sheet: 'generateAttendanceSheet',
                certificate: 'generateCertificate',
            };

            const method = generators[this.currentType];
            if (!method || !PdfGenerator[method]) {
                showToast('G\u00E9n\u00E9rateur PDF non disponible pour ce type', 'error');
                return;
            }

            const result = await PdfGenerator[method](f);
            if (result && result.success) {
                // Enregistrer dans le CRM
                await CRMApp._uploadAndSaveDoc(this.currentFormationId, result, this.currentType);
                CRMApp.loadFormations();
                showToast('PDF g\u00E9n\u00E9r\u00E9 !', 'success');
                this.close();
            }
        } catch (err) {
            console.error('Erreur DocumentPreview.downloadPdf:', err);
            showToast('Erreur: ' + err.message, 'error');
        } finally {
            if (btnPdf) { btnPdf.disabled = false; btnPdf.textContent = 'Telecharger PDF'; }
            if (btnDocx) { btnDocx.disabled = false; }
        }
    },

    async saveToDb() {
        try {
            if (!this.currentFormationId) return;

            const vars = this.getFormValues();
            const updates = {};

            // Mapper les champs du formulaire vers les colonnes de la table formations
            const mapping = {
                company_name: 'company_name',
                company_address: 'company_address',
                company_postal_city: 'company_postal_code',
                contact_name: 'company_director_name',
                contact_title: 'company_director_title',
                contact_role: 'contact_role',
                formation_name: 'formation_name',
                objectives: 'objectives',
                content_summary: 'content_summary',
                module_content: 'module_1',
                content: 'module_1',
                methods: 'methods_tools',
                training_location: 'training_location',
                duration: 'hours_per_learner',
                dates: 'custom_dates',
                price: 'total_amount',
                total_amount: 'total_amount',
                // Fiche peda
                public: 'target_audience',
                prerequisites: 'prerequisites',
                evaluation: 'evaluation_methodology',
                added_value: 'added_value',
                access_delays: 'access_delays',
            };

            Object.entries(vars).forEach(([key, value]) => {
                if (mapping[key] && value !== undefined && !key.startsWith('_')) {
                    updates[mapping[key]] = value;
                }
            });

            if (Object.keys(updates).length === 0) {
                showToast('Rien \u00E0 enregistrer', 'info');
                return;
            }

            // Sauvegarder — retirer les colonnes inexistantes en cas d'erreur
            let result = await SupabaseData.updateFormation(this.currentFormationId, updates);
            let retries = 0;
            while (!result.success && result.message && retries < 5) {
                const match = result.message.match(/column "([^"]+)"/);
                if (!match) break;
                console.warn('Colonne inexistante, retrait:', match[1]);
                delete updates[match[1]];
                if (Object.keys(updates).length === 0) break;
                result = await SupabaseData.updateFormation(this.currentFormationId, updates);
                retries++;
            }

            if (result.success) {
                showToast('Modifications enregistr\u00E9es !', 'success');
                CRMApp.loadFormations();
            } else {
                showToast('Erreur: ' + result.message, 'error');
            }
        } catch (err) {
            console.error('Erreur DocumentPreview.saveToDb:', err);
            showToast('Erreur: ' + err.message, 'error');
        }
    },

    async download() {
        const btnPdf = document.getElementById('doc-preview-btn-pdf');
        const btnDocx = document.getElementById('doc-preview-btn-docx');
        try {
            const config = DOC_CONFIGS[this.currentType];
            if (!config) return;
            if (btnPdf) { btnPdf.disabled = true; }
            if (btnDocx) { btnDocx.disabled = true; btnDocx.textContent = '\u23F3 G\u00E9n\u00E9ration...'; }

            showToast('G\u00E9n\u00E9ration du document...', 'info');

            // Charger PizZip
            if (!window.PizZip) {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://unpkg.com/pizzip@3.1.4/dist/pizzip.js';
                    s.onload = resolve; s.onerror = reject;
                    document.head.appendChild(s);
                });
            }

            // Charger le template
            const { data, error } = await supabaseClient.storage
                .from('templates')
                .download(config.template);
            if (error) throw new Error('Template non trouv\u00E9: ' + error.message);

            const arrayBuffer = await data.arrayBuffer();
            const zip = new window.PizZip(arrayBuffer);
            let xml = zip.file('word/document.xml').asText();

            // Preparer les variables depuis la formation
            const vars = config.prepareVars(this.currentFormationData);
            Object.entries(vars).forEach(([key, value]) => {
                if (key.startsWith('_')) return;
                let safeValue = String(value || '').replace(/\n/g, '</w:t><w:br/><w:t>');
                xml = xml.split(`{{${key}}}`).join(safeValue);
            });

            // Remettre le XML
            zip.file('word/document.xml', xml);

            // Generer et telecharger
            const blob = zip.generate({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });

            const fileName = `${config.title} - ${this.currentFormationData.formation_name || 'Formation'}`;

            // Telecharger localement
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.docx`;
            a.click();
            URL.revokeObjectURL(url);

            // Uploader dans Supabase Storage
            try {
                const storagePath = `formations/${this.currentFormationId}/${Date.now()}_${fileName.replace(/\s+/g, '_')}.docx`;
                const { error: uploadErr } = await supabaseClient.storage
                    .from('documents')
                    .upload(storagePath, blob, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: true });

                let docUrl = '';
                if (!uploadErr) {
                    const { data: urlData } = supabaseClient.storage.from('documents').getPublicUrl(storagePath);
                    docUrl = urlData?.publicUrl || '';
                }

                await SupabaseData.addFormationDocument(this.currentFormationId, {
                    name: fileName,
                    type: this.currentType,
                    document_url: docUrl || `generate://${this.currentType}/${this.currentFormationId}`,
                    uploaded_at: new Date().toISOString()
                });
            } catch (storageErr) {
                console.warn('Upload Storage echoue, fallback reference:', storageErr);
                await CRMApp._uploadAndSaveDoc(this.currentFormationId, { success: true, name: fileName }, this.currentType);
            }

            addNotification(this.currentType, `${config.title} g\u00E9n\u00E9r\u00E9(e) \u2014 ${this.currentFormationData.company_name || this.currentFormationData.client_name || ''}`);
            CRMApp.loadFormations();

            showToast(`${config.title} t\u00E9l\u00E9charg\u00E9(e) !`, 'success');
            this.close();

        } catch (err) {
            console.error('Erreur DocumentPreview.download:', err);
            showToast('Erreur: ' + err.message, 'error');
        } finally {
            if (btnPdf) { btnPdf.disabled = false; }
            if (btnDocx) { btnDocx.disabled = false; btnDocx.textContent = 'Telecharger .docx'; }
        }
    },
};

// Expose globally for HTML event handlers
window.CRMApp = CRMApp;
window.UserManagement = UserManagement;
window.ConvocationEmail = ConvocationEmail;
window.GenericEmail = GenericEmail;
window.DocumentPreview = DocumentPreview;
