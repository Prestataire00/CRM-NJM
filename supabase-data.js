// Supabase Data Management
// Remplace crm-data.js avec Supabase Database

const SupabaseData = {
    // Get current fiscal year (Oct - Sep)
    getFiscalYear() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        return currentMonth >= 10 ? currentYear : currentYear - 1;
    },

    // ==================== LEARNERS ====================

    // Get learners count for current fiscal year
    async getLearnersCount() {
        try {
            const fiscalYear = this.getFiscalYear();
            const startDate = new Date(fiscalYear, 9, 1).toISOString(); // Oct 1
            const endDate = new Date(fiscalYear + 1, 8, 30).toISOString(); // Sep 30

            const { count, error } = await supabaseClient
                .from('learners')
                .select('*', { count: 'exact', head: true })
                .gte('enrollment_date', startDate)
                .lte('enrollment_date', endDate);

            if (error) throw error;
            return count || 0;
        } catch (error) {
            console.error('Error getting learners count:', error);
            return 0;
        }
    },

    // Get all learners
    async getLearners() {
        try {
            const { data, error } = await supabaseClient
                .from('learners')
                .select('*')
                .order('enrollment_date', { ascending: false });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting learners:', error);
            return { success: false, message: 'Erreur lors de la récupération des apprenants.' };
        }
    },

    // Add learner
    async addLearner(learner) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();

            const { data, error } = await supabaseClient
                .from('learners')
                .insert([{
                    ...learner,
                    created_by: user?.id,
                    enrollment_date: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding learner:', error);
            return { success: false, message: 'Erreur lors de l\'ajout de l\'apprenant.' };
        }
    },

    // Update learner
    async updateLearner(id, updates) {
        try {
            const { data, error } = await supabaseClient
                .from('learners')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating learner:', error);
            return { success: false, message: 'Erreur lors de la mise à jour de l\'apprenant.' };
        }
    },

    // Delete learner
    async deleteLearner(id) {
        try {
            const { error } = await supabaseClient
                .from('learners')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting learner:', error);
            return { success: false, message: 'Erreur lors de la suppression de l\'apprenant.' };
        }
    },

    // ==================== FORMATIONS ====================

    // Get all formations
    async getFormations() {
        try {
            console.log('🔍 getFormations() - Début de la requête...');
            const { data, error } = await supabaseClient
                .from('formations')
                .select('*, formation_documents(*), convocation_logs(*)')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Erreur Supabase:', error);
                throw error;
            }

            console.log('✅ Données récupérées:', data);
            console.log(`📊 Nombre de formations: ${data?.length || 0}`);

            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting formations:', error);
            return { success: false, message: 'Erreur lors de la récupération des formations.' };
        }
    },

    // Get formations assigned to a formateur (via subcontractor link)
    async getFormationsByFormateur(formateurUserId) {
        try {
            // 1. Récupérer le subcontractor_id du formateur
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('subcontractor_id')
                .eq('id', formateurUserId)
                .single();

            if (profileError) {
                console.error('Error getting formateur profile:', profileError);
                return { success: false, message: 'Erreur lors de la récupération du profil.' };
            }

            if (!profile?.subcontractor_id) {
                console.log('Formateur non lié à un sous-traitant');
                return { success: true, data: [], message: 'Aucun sous-traitant lié à ce compte.' };
            }

            // 2. Récupérer les formations avec ce subcontractor_id
            const { data: formations, error: formError } = await supabaseClient
                .from('formations')
                .select('*, formation_documents(*), subcontractors(*)')
                .eq('subcontractor_id', profile.subcontractor_id)
                .order('start_date', { ascending: false });

            if (formError) {
                console.error('Error getting formations for formateur:', formError);
                return { success: false, message: 'Erreur lors de la récupération des formations.' };
            }

            console.log(`✅ ${formations?.length || 0} formations trouvées pour le formateur`);
            return { success: true, data: formations || [] };
        } catch (error) {
            console.error('Exception in getFormationsByFormateur:', error);
            return { success: false, message: 'Une erreur est survenue.' };
        }
    },

    // Get formations assigned to a client (via client link)
    async getFormationsByClient(clientUserId, specificClientId = null) {
        try {
            console.log('🔍 getFormationsByClient - User ID:', clientUserId, 'Specific Client ID:', specificClientId);

            let clientIds = [];

            if (specificClientId) {
                clientIds = [specificClientId];
            } else {
                // Priorité 1 : profile_clients (many-to-many moderne)
                const { data: links } = await supabaseClient
                    .from('profile_clients')
                    .select('client_id')
                    .eq('profile_id', clientUserId);

                if (links && links.length > 0) {
                    clientIds = links.map(l => l.client_id);
                    console.log('🔗 Clients liés via profile_clients:', clientIds);
                } else {
                    // Fallback : profiles.client_id (rétrocompat)
                    const { data: profile, error: profileError } = await supabaseClient
                        .from('profiles')
                        .select('client_id, name, email')
                        .eq('id', clientUserId)
                        .single();

                    if (profileError) {
                        console.error('Error getting client profile:', profileError);
                        return { success: false, message: 'Erreur lors de la récupération du profil.' };
                    }

                    if (profile?.client_id) {
                        clientIds = [profile.client_id];
                        console.log('🔗 Client lié via profiles.client_id:', profile.client_id);
                    }
                }

                if (clientIds.length === 0) {
                    console.log('⚠️ Aucun client lié à ce profil');
                    return { success: true, data: [], message: 'Aucune entreprise liée à ce compte.' };
                }
            }

            console.log('🏢 Client IDs utilisés:', clientIds);

            // Récupérer les formations pour tous ces clients
            const { data: formations, error: formError } = await supabaseClient
                .from('formations')
                .select('*, formation_documents(*)')
                .in('client_id', clientIds)
                .order('start_date', { ascending: false });

            if (formError) {
                console.error('Error getting formations for client:', formError);
                return { success: false, message: 'Erreur lors de la récupération des formations.' };
            }

            console.log(`✅ ${formations?.length || 0} formations trouvées pour le client`);
            return { success: true, data: formations || [] };
        } catch (error) {
            console.error('Exception in getFormationsByClient:', error);
            return { success: false, message: 'Une erreur est survenue.' };
        }
    },

    // Log convocation sent
    async logConvocationSent(formationId, logData) {
        try {
            const { data, error } = await supabaseClient
                .from('convocation_logs')
                .insert([{
                    formation_id: formationId,
                    sent_to: logData.sent_to,
                    subject: logData.subject,
                    questionnaire_url: logData.questionnaire_url,
                    attachments: logData.attachments || [],
                    gmail_message_id: logData.email_message_id || logData.gmail_message_id,
                    sent_by: logData.sent_by
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error logging convocation:', error);
            return { success: false, message: 'Erreur lors de l\'enregistrement de la convocation.' };
        }
    },

    // Get convocation logs for a formation
    async getConvocationLogs(formationId) {
        try {
            const { data, error } = await supabaseClient
                .from('convocation_logs')
                .select('*')
                .eq('formation_id', formationId)
                .order('sent_at', { ascending: false });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting convocation logs:', error);
            return { success: false, message: 'Erreur lors de la récupération des logs.' };
        }
    },

    // Add formation
    async addFormation(formation) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();

            const { data, error } = await supabaseClient
                .from('formations')
                .insert([{
                    ...formation,
                    created_by: user?.id
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding formation:', error);
            return { success: false, message: 'Erreur lors de l\'ajout de la formation.' };
        }
    },

    // Update formation
    async updateFormation(id, updates) {
        try {
            const { data, error } = await supabaseClient
                .from('formations')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating formation:', error);
            return { success: false, message: error.message || 'Erreur lors de la mise à jour de la formation.' };
        }
    },

    // Delete formation
    // Delete formation
    async deleteFormation(id) {
        try {
            console.log('Attempting to delete formation:', id);
            const { error, count } = await supabaseClient
                .from('formations')
                .delete({ count: 'exact' })
                .eq('id', id);

            if (error) throw error;

            // Si aucune ligne n'a été supprimée (souvent dû aux permissions RLS)
            if (count === 0) {
                // Vérifier les permissions actuelles pour le debug
                const { data: { user } } = await supabaseClient.auth.getUser();
                const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single();

                return {
                    success: false,
                    message: `Impossible de supprimer. Vérifiez vos droits (Votre rôle: ${profile?.role || 'inconnu'}). RLS bloquant ?`
                };
            }

            return { success: true };
        } catch (error) {
            console.error('Error deleting formation:', error);
            return { success: false, message: 'Erreur technique: ' + error.message };
        }
    },

    // Add document to formation
    async addFormationDocument(formationId, document) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();

            const { data, error } = await supabaseClient
                .from('formation_documents')
                .insert([{
                    formation_id: formationId,
                    ...document,
                    uploaded_by: user?.id
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding formation document:', error);
            return { success: false, message: 'Erreur lors de l\'ajout du document.' };
        }
    },

    // Delete formation document
    async deleteFormationDocument(docId) {
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
    },

    // ==================== VEILLE ====================

    // Get veille items by type
    async getVeille(type = null) {
        try {
            let query = supabaseClient
                .from('veille')
                .select('*')
                .order('created_at', { ascending: false });

            if (type) {
                query = query.eq('type', type);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting veille:', error);
            return { success: false, message: 'Erreur lors de la récupération de la veille.' };
        }
    },

    // Add veille item
    async addVeille(type, item) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();

            const { data, error } = await supabaseClient
                .from('veille')
                .insert([{
                    type,
                    ...item,
                    created_by: user?.id,
                    read: false
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding veille:', error);
            return { success: false, message: 'Erreur lors de l\'ajout de la veille.' };
        }
    },

    // Toggle veille read status
    async toggleVeilleRead(id) {
        try {
            // Get current status
            const { data: current, error: fetchError } = await supabaseClient
                .from('veille')
                .select('read')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            // Toggle
            const { data, error } = await supabaseClient
                .from('veille')
                .update({ read: !current.read })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error toggling veille read:', error);
            return { success: false, message: 'Erreur lors de la mise à jour de la veille.' };
        }
    },

    // Delete veille
    async deleteVeille(id) {
        try {
            const { error } = await supabaseClient
                .from('veille')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting veille:', error);
            return { success: false, message: 'Erreur lors de la suppression de la veille.' };
        }
    },

    // ==================== BPF ====================

    // Get all BPF
    async getBPF() {
        try {
            const { data, error } = await supabaseClient
                .from('bpf')
                .select('*')
                .order('year', { ascending: false });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting BPF:', error);
            return { success: false, message: 'Erreur lors de la récupération des BPF.' };
        }
    },

    // Add BPF
    async addBPF(bpf) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();

            const { data, error } = await supabaseClient
                .from('bpf')
                .insert([{
                    ...bpf,
                    created_by: user?.id
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding BPF:', error);
            return { success: false, message: 'Erreur lors de l\'ajout du BPF.' };
        }
    },

    // Update BPF
    async updateBPF(id, updates) {
        try {
            const { data, error } = await supabaseClient
                .from('bpf')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating BPF:', error);
            return { success: false, message: 'Erreur lors de la mise à jour du BPF.' };
        }
    },

    // Delete BPF
    async deleteBPF(id) {
        try {
            const { error } = await supabaseClient
                .from('bpf')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting BPF:', error);
            return { success: false, message: 'Erreur lors de la suppression du BPF.' };
        }
    },

    // ==================== PEDAGOGICAL LIBRARY ====================

    // Get pedagogical library by category
    async getPedagogicalLibrary(category = null) {
        try {
            let query = supabaseClient
                .from('pedagogical_library')
                .select('*')
                .order('uploaded_at', { ascending: false });

            if (category) {
                query = query.eq('category', category);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting pedagogical library:', error);
            return { success: false, message: 'Erreur lors de la récupération de la bibliothèque pédagogique.' };
        }
    },

    // Add to pedagogical library
    async addToPedagogicalLibrary(category, item) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();

            const { data, error } = await supabaseClient
                .from('pedagogical_library')
                .insert([{
                    category,
                    ...item,
                    uploaded_by: user?.id
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding to pedagogical library:', error);
            return { success: false, message: 'Erreur lors de l\'ajout à la bibliothèque.' };
        }
    },

    // Delete from pedagogical library
    async deleteFromPedagogicalLibrary(id) {
        try {
            const { error } = await supabaseClient
                .from('pedagogical_library')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting from pedagogical library:', error);
            return { success: false, message: 'Erreur lors de la suppression du support.' };
        }
    },

    // ==================== FORMATION SUPPORTS ====================

    async getFormationSupports(formationId) {
        try {
            const { data, error } = await supabaseClient
                .from('formation_supports')
                .select('*, pedagogical_library(*)')
                .eq('formation_id', formationId);

            if (error) throw error;
            return { success: true, data: (data || []).map(fs => fs.pedagogical_library).filter(Boolean) };
        } catch (error) {
            console.error('Error getting formation supports:', error);
            return { success: false, data: [], message: error.message };
        }
    },

    async assignSupportToFormation(formationId, supportId) {
        try {
            const { data, error } = await supabaseClient
                .from('formation_supports')
                .insert([{ formation_id: formationId, support_id: supportId }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error assigning support:', error);
            return { success: false, message: error.message };
        }
    },

    async removeSupportFromFormation(formationId, supportId) {
        try {
            const { error } = await supabaseClient
                .from('formation_supports')
                .delete()
                .eq('formation_id', formationId)
                .eq('support_id', supportId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error removing support:', error);
            return { success: false, message: error.message };
        }
    },

    // ==================== QUESTIONNAIRES ====================

    async getQuestionnaires(category = null) {
        try {
            let query = supabaseClient
                .from('questionnaires')
                .select('*')
                .order('category')
                .order('title');
            if (category) query = query.eq('category', category);
            const { data, error } = await query;
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting questionnaires:', error);
            return { success: false, data: [], message: error.message };
        }
    },

    async getQuestionnaire(id) {
        try {
            const { data, error } = await supabaseClient
                .from('questionnaires')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error getting questionnaire:', error);
            return { success: false, message: error.message };
        }
    },

    async createQuestionnaire({ title, category, formation_type, url, description }) {
        try {
            const { data, error } = await supabaseClient
                .from('questionnaires')
                .insert([{ title, category, formation_type, url, description }])
                .select()
                .single();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error creating questionnaire:', error);
            return { success: false, message: error.message };
        }
    },

    async updateQuestionnaire(id, fields) {
        try {
            const { data, error } = await supabaseClient
                .from('questionnaires')
                .update({ ...fields, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating questionnaire:', error);
            return { success: false, message: error.message };
        }
    },

    async deleteQuestionnaire(id) {
        try {
            const { error } = await supabaseClient
                .from('questionnaires')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting questionnaire:', error);
            return { success: false, message: error.message };
        }
    },

    async getFormationQuestionnaires(formationId) {
        try {
            const { data, error } = await supabaseClient
                .from('formation_questionnaires')
                .select('*, questionnaires(*)')
                .eq('formation_id', formationId);
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting formation questionnaires:', error);
            return { success: false, data: [], message: error.message };
        }
    },

    async assignQuestionnaireToFormation(formationId, questionnaireId) {
        try {
            const { data, error } = await supabaseClient
                .from('formation_questionnaires')
                .insert([{ formation_id: formationId, questionnaire_id: questionnaireId }])
                .select('*, questionnaires(*)')
                .single();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error assigning questionnaire:', error);
            return { success: false, message: error.message };
        }
    },

    async removeQuestionnaireFromFormation(formationId, questionnaireId) {
        try {
            const { error } = await supabaseClient
                .from('formation_questionnaires')
                .delete()
                .eq('formation_id', formationId)
                .eq('questionnaire_id', questionnaireId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error removing questionnaire from formation:', error);
            return { success: false, message: error.message };
        }
    },

    // ==================== TEMPLATES LIBRARY ====================

    // Get templates by category
    async getTemplatesLibrary(category = null) {
        try {
            let query = supabaseClient
                .from('templates_library')
                .select('*')
                .order('uploaded_at', { ascending: false });

            if (category) {
                query = query.eq('category', category);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting templates library:', error);
            return { success: false, message: 'Erreur lors de la récupération des templates.' };
        }
    },

    // Add template
    async addTemplate(category, template) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();

            const { data, error } = await supabaseClient
                .from('templates_library')
                .insert([{
                    category,
                    ...template,
                    uploaded_by: user?.id,
                    reminder_set: category === 'formateurs' && template.expiry_date ? true : false
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding template:', error);
            return { success: false, message: 'Erreur lors de l\'ajout du template.' };
        }
    },

    // Get expiring documents
    async getExpiringDocuments() {
        try {
            const now = new Date();
            const oneMonthFromNow = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

            const { data, error } = await supabaseClient
                .from('templates_library')
                .select('*')
                .eq('category', 'formateurs')
                .not('expiry_date', 'is', null)
                .gte('expiry_date', now.toISOString())
                .lte('expiry_date', oneMonthFromNow.toISOString());

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting expiring documents:', error);
            return { success: false, message: 'Erreur lors de la récupération des documents expirants.' };
        }
    },

    // ==================== SETTINGS ====================

    // Get setting by key
    async getSetting(key) {
        try {
            const { data, error } = await supabaseClient
                .from('settings')
                .select('value')
                .eq('key', key)
                .single();

            if (error) throw error;
            return { success: true, data: data?.value };
        } catch (error) {
            console.error('Error getting setting:', error);
            return { success: false, message: 'Erreur lors de la récupération du paramètre.' };
        }
    },

    // Update setting
    async updateSetting(key, value) {
        try {
            const { data, error } = await supabaseClient
                .from('settings')
                .upsert([{ key, value }], { onConflict: 'key' })
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating setting:', error);
            return { success: false, message: 'Erreur lors de la mise à jour du paramètre.' };
        }
    },

    // Update multiple settings
    async updateSettings(settings) {
        try {
            const promises = Object.entries(settings).map(([key, value]) =>
                this.updateSetting(key, value)
            );

            await Promise.all(promises);
            return { success: true };
        } catch (error) {
            console.error('Error updating settings:', error);
            return { success: false, message: 'Erreur lors de la mise à jour des paramètres.' };
        }
    },

    // ==================== DASHBOARD STATS ====================

    // Get dashboard statistics
    async getDashboardStats() {
        try {
            const fiscalYear = this.getFiscalYear();
            const startDate = new Date(fiscalYear, 9, 1).toISOString();
            const endDate = new Date(fiscalYear + 1, 8, 30).toISOString();

            // Get learners count from formations.learners_data
            const { data: fiscalFormations } = await supabaseClient
                .from('formations')
                .select('learners_data')
                .gte('start_date', startDate)
                .lte('start_date', endDate);

            let learnersCount = 0;
            if (fiscalFormations) {
                fiscalFormations.forEach(f => {
                    let learners = f.learners_data || [];
                    if (typeof learners === 'string') {
                        try { learners = JSON.parse(learners); } catch(e) { learners = []; }
                    }
                    learnersCount += learners.length;
                });
            }

            // Get formations stats
            const { count: completedFormations } = await supabaseClient
                .from('formations')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'completed');

            const { count: inProgressFormations } = await supabaseClient
                .from('formations')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'in_progress');

            // Get client accesses (tous les comptes clients)
            const { count: clientAccesses } = await supabaseClient
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'client');

            return {
                success: true,
                stats: {
                    learnersCount: learnersCount || 0,
                    formationsCompleted: completedFormations || 0,
                    formationsInProgress: inProgressFormations || 0,
                    clientAccesses: clientAccesses || 0
                }
            };
        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            return {
                success: false,
                stats: {
                    learnersCount: 0,
                    formationsCompleted: 0,
                    formationsInProgress: 0,
                    clientAccesses: 0
                }
            };
        }
    },

    // ==================== CONVENTIONS ====================

    // Get all conventions
    async getConventions() {
        try {
            const { data, error } = await supabaseClient
                .from('conventions')
                .select('*, formations(*)')
                .order('generated_at', { ascending: false });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting conventions:', error);
            return { success: false, message: 'Erreur lors de la récupération des conventions.' };
        }
    },

    // Get conventions by formation ID
    async getConventionsByFormation(formationId) {
        try {
            const { data, error } = await supabaseClient
                .from('conventions')
                .select('*')
                .eq('formation_id', formationId)
                .order('generated_at', { ascending: false });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting conventions by formation:', error);
            return { success: false, message: 'Erreur lors de la récupération des conventions.' };
        }
    },

    // Add convention
    async addConvention(convention) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();

            const { data, error } = await supabaseClient
                .from('conventions')
                .insert([{
                    ...convention,
                    created_by: user?.id,
                    generated_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding convention:', error);
            return { success: false, message: 'Erreur lors de l\'ajout de la convention.' };
        }
    },

    // Update convention
    async updateConvention(id, updates) {
        try {
            const { data, error } = await supabaseClient
                .from('conventions')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating convention:', error);
            return { success: false, message: 'Erreur lors de la mise à jour de la convention.' };
        }
    },

    // Delete convention by ID
    async deleteConvention(id) {
        try {
            const { error, count } = await supabaseClient
                .from('conventions')
                .delete({ count: 'exact' })
                .eq('id', id);

            if (error) throw error;

            if (count === 0) {
                return {
                    success: false,
                    message: "La convention n'a pas pu être supprimée. Vérifiez vos droits."
                };
            }

            return { success: true };
        } catch (error) {
            console.error('Error deleting convention:', error);
            return { success: false, message: 'Erreur lors de la suppression de la convention.' };
        }
    },

    // Delete convention by Google Doc ID
    async deleteConventionByGoogleDocId(googleDocId) {
        try {
            const { error, count } = await supabaseClient
                .from('conventions')
                .delete({ count: 'exact' })
                .eq('google_doc_id', googleDocId);

            if (error) throw error;

            if (count === 0) {
                console.warn('Aucune convention trouvée avec google_doc_id:', googleDocId);
                return {
                    success: true,
                    message: "Aucune convention correspondante trouvée (peut-être déjà supprimée)."
                };
            }

            return { success: true };
        } catch (error) {
            console.error('Error deleting convention by Google Doc ID:', error);
            return { success: false, message: 'Erreur lors de la suppression de la convention.' };
        }
    },

    // ==================== TRANSFER TO CLIENT SPACE ====================

    // Transfer document to client space
    async transferToClientSpace(documentId, clientId) {
        try {
            // This would integrate with client space system
            console.log(`Transferring document ${documentId} to client ${clientId}`);
            // Implement actual transfer logic here
            return { success: true, message: 'Document transféré avec succès.' };
        } catch (error) {
            console.error('Error transferring to client space:', error);
            return { success: false, message: 'Erreur lors du transfert.' };
        }
    },

    // ==================== ADMIN LOGS ====================

    // Log an admin action
    async logAdminAction(actionData) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return { success: false, message: 'Non authentifié' };

            // Get admin profile
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('name, email')
                .eq('id', user.id)
                .single();

            const logEntry = {
                admin_id: user.id,
                admin_name: profile?.name || 'Unknown',
                admin_email: profile?.email || user.email,
                action_type: actionData.action_type,
                action_description: actionData.description,
                target_type: actionData.target_type || null,
                target_id: actionData.target_id || null,
                target_name: actionData.target_name || null,
                old_values: actionData.old_values || null,
                new_values: actionData.new_values || null,
                user_agent: navigator.userAgent
            };

            const { data, error } = await supabaseClient
                .from('admin_logs')
                .insert([logEntry])
                .select()
                .single();

            if (error) {
                console.error('Error logging admin action:', error);
                return { success: false, message: error.message };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Exception logging admin action:', error);
            return { success: false, message: error.message };
        }
    },

    // Get admin logs with filters
    async getAdminLogs(filters = {}) {
        try {
            let query = supabaseClient
                .from('admin_logs')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply filters
            if (filters.action_type) {
                query = query.eq('action_type', filters.action_type);
            }
            if (filters.target_type) {
                query = query.eq('target_type', filters.target_type);
            }
            if (filters.admin_id) {
                query = query.eq('admin_id', filters.admin_id);
            }
            if (filters.from_date) {
                query = query.gte('created_at', filters.from_date);
            }
            if (filters.to_date) {
                query = query.lte('created_at', filters.to_date);
            }
            if (filters.limit) {
                query = query.limit(filters.limit);
            } else {
                query = query.limit(100); // Default limit
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting admin logs:', error);
            return { success: false, message: 'Erreur lors de la récupération des logs.' };
        }
    },

    // Get admin logs summary (for dashboard)
    async getAdminLogsSummary() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data, error } = await supabaseClient
                .from('admin_logs')
                .select('action_type, created_at')
                .gte('created_at', today.toISOString());

            if (error) throw error;

            // Group by action type
            const summary = {
                total_today: data.length,
                user_actions: data.filter(l => l.action_type.startsWith('user_')).length,
                formation_actions: data.filter(l => l.action_type.startsWith('formation_')).length,
                other_actions: data.filter(l => !l.action_type.startsWith('user_') && !l.action_type.startsWith('formation_')).length
            };

            return { success: true, data: summary };
        } catch (error) {
            console.error('Error getting admin logs summary:', error);
            return { success: false, message: 'Erreur lors de la récupération du résumé.' };
        }
    },

    // ==================== SUBCONTRACTORS (SOUS-TRAITANTS) ====================

    // Get all subcontractors
    async getSubcontractors() {
        try {
            const { data, error } = await supabaseClient
                .from('subcontractors')
                .select('*')
                .order('last_name', { ascending: true });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting subcontractors:', error);
            return { success: false, message: 'Erreur lors de la récupération des sous-traitants.' };
        }
    },

    // Get subcontractors not linked to any user account
    async getAvailableSubcontractors() {
        try {
            // Get all subcontractors
            const { data: subcontractors, error: subError } = await supabaseClient
                .from('subcontractors')
                .select('*')
                .order('last_name', { ascending: true });

            if (subError) throw subError;

            // Get all profiles with subcontractor_id set
            const { data: linkedProfiles, error: profileError } = await supabaseClient
                .from('profiles')
                .select('subcontractor_id')
                .not('subcontractor_id', 'is', null);

            if (profileError) throw profileError;

            // Filter out subcontractors already linked to a profile
            const linkedIds = new Set(linkedProfiles?.map(p => p.subcontractor_id) || []);
            const available = subcontractors?.filter(s => !linkedIds.has(s.id)) || [];

            return { success: true, data: available };
        } catch (error) {
            console.error('Error getting available subcontractors:', error);
            return { success: false, message: 'Erreur lors de la récupération des sous-traitants disponibles.' };
        }
    },

    // Add subcontractor
    async addSubcontractor(subcontractor) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();

            const { data, error } = await supabaseClient
                .from('subcontractors')
                .insert([{
                    ...subcontractor,
                    created_by: user?.id
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding subcontractor:', error);
            return { success: false, message: 'Erreur lors de l\'ajout du sous-traitant.' };
        }
    },

    // Update subcontractor
    async updateSubcontractor(id, updates) {
        try {
            const { data, error } = await supabaseClient
                .from('subcontractors')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating subcontractor:', error);
            return { success: false, message: 'Erreur lors de la mise à jour du sous-traitant.' };
        }
    },

    // Delete subcontractor
    async deleteSubcontractor(id) {
        try {
            const { error } = await supabaseClient
                .from('subcontractors')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting subcontractor:', error);
            return { success: false, message: 'Erreur lors de la suppression du sous-traitant.' };
        }
    },

    // Link a user profile to a subcontractor
    async linkUserToSubcontractor(userId, subcontractorId) {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .update({ subcontractor_id: subcontractorId })
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error linking user to subcontractor:', error);
            return { success: false, message: 'Erreur lors de la liaison utilisateur-sous-traitant.' };
        }
    },

    // ==================== CLIENTS ====================

    // Get all clients
    async getClients() {
        try {
            const { data, error } = await supabaseClient
                .from('clients')
                .select('*')
                .order('company_name', { ascending: true });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting clients:', error);
            return { success: false, message: 'Erreur lors de la récupération des clients.' };
        }
    },

    // Get clients not linked to any user account
    async getAvailableClients() {
        try {
            // Get all clients
            const { data: clients, error: clientError } = await supabaseClient
                .from('clients')
                .select('*')
                .order('company_name', { ascending: true });

            if (clientError) throw clientError;

            // Get all profiles with client_id set
            const { data: linkedProfiles, error: profileError } = await supabaseClient
                .from('profiles')
                .select('client_id')
                .not('client_id', 'is', null);

            if (profileError) throw profileError;

            // Filter out clients already linked to a profile
            const linkedIds = new Set(linkedProfiles?.map(p => p.client_id) || []);
            const available = clients?.filter(c => !linkedIds.has(c.id)) || [];

            return { success: true, data: available };
        } catch (error) {
            console.error('Error getting available clients:', error);
            return { success: false, message: 'Erreur lors de la récupération des clients disponibles.' };
        }
    },

    // Get clients that are linked to user accounts (for formation form dropdown)
    async getClientsWithUserAccounts() {
        try {
            // Get all profile_clients links with profile info
            const { data: links, error: linkError } = await supabaseClient
                .from('profile_clients')
                .select('client_id, profile_id');

            if (linkError) throw linkError;

            if (!links || links.length === 0) {
                return { success: true, data: [] };
            }

            // Get profiles with role='client'
            const profileIds = [...new Set(links.map(l => l.profile_id))];
            const { data: profiles, error: profileError } = await supabaseClient
                .from('profiles')
                .select('id, name, email, role')
                .in('id', profileIds)
                .eq('role', 'client');

            if (profileError) throw profileError;

            const clientProfileIds = new Set((profiles || []).map(p => p.id));

            // Filter links to only those with client role profiles
            const clientLinks = links.filter(l => clientProfileIds.has(l.profile_id));
            const clientIds = [...new Set(clientLinks.map(l => l.client_id))];

            if (clientIds.length === 0) {
                return { success: true, data: [] };
            }

            // Get client details
            const { data: clients, error: clientError } = await supabaseClient
                .from('clients')
                .select('*')
                .in('id', clientIds);

            if (clientError) throw clientError;

            // Merge client data with user info (use first linked profile for display)
            const clientsWithUsers = clients?.map(client => {
                const link = clientLinks.find(l => l.client_id === client.id);
                const userProfile = link ? (profiles || []).find(p => p.id === link.profile_id) : null;
                return {
                    ...client,
                    user_name: userProfile?.name || null,
                    user_email: userProfile?.email || null,
                    user_id: userProfile?.id || null
                };
            }) || [];

            // Sort by company name
            clientsWithUsers.sort((a, b) => a.company_name.localeCompare(b.company_name));

            return { success: true, data: clientsWithUsers };
        } catch (error) {
            console.error('Error getting clients with user accounts:', error);
            return { success: false, message: 'Erreur lors de la récupération des clients.' };
        }
    },

    // Get all clients linked to a specific user via profile_clients
    async getClientsByUserId(userId) {
        try {
            const { data: links, error: linkError } = await supabaseClient
                .from('profile_clients')
                .select('client_id')
                .eq('profile_id', userId);

            if (linkError) throw linkError;

            if (!links || links.length === 0) {
                return { success: true, data: [] };
            }

            const clientIds = links.map(l => l.client_id);
            const { data: clients, error: clientError } = await supabaseClient
                .from('clients')
                .select('*')
                .in('id', clientIds)
                .order('company_name', { ascending: true });

            if (clientError) throw clientError;

            return { success: true, data: clients || [] };
        } catch (error) {
            console.error('Error getting clients by user id:', error);
            return { success: false, data: [] };
        }
    },

    // Add client
    async addClient(client) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();

            const { data, error } = await supabaseClient
                .from('clients')
                .insert([{
                    ...client,
                    created_by: user?.id
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding client:', error);
            return { success: false, message: 'Erreur lors de l\'ajout du client.' };
        }
    },

    // Check if client exists by company name
    async getClientByCompanyName(companyName) {
        try {
            const { data, error } = await supabaseClient
                .from('clients')
                .select('*')
                .ilike('company_name', companyName)
                .maybeSingle();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error getting client by company name:', error);
            return { success: false, message: 'Erreur lors de la recherche du client.' };
        }
    },

    // Update client
    async updateClient(id, updates) {
        try {
            const { data, error } = await supabaseClient
                .from('clients')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating client:', error);
            return { success: false, message: 'Erreur lors de la mise à jour du client.' };
        }
    },

    // Delete client
    async deleteClient(id) {
        try {
            const { error, count } = await supabaseClient
                .from('clients')
                .delete({ count: 'exact' })
                .eq('id', id);

            if (error) throw error;
            if (count === 0) return { success: false, message: 'Suppression refusée — vérifiez vos droits admin.' };
            return { success: true };
        } catch (error) {
            console.error('Error deleting client:', error);
            return { success: false, message: 'Erreur lors de la suppression du client.' };
        }
    },

    // Link a user profile to a client (via junction table profile_clients)
    async linkUserToClient(userId, clientId) {
        try {
            const { data, error } = await supabaseClient
                .from('profile_clients')
                .upsert({ profile_id: userId, client_id: clientId }, { onConflict: 'profile_id,client_id' })
                .select()
                .single();

            // Also keep profiles.client_id in sync (backward compat)
            await supabaseClient
                .from('profiles')
                .update({ client_id: clientId })
                .eq('id', userId);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error linking user to client:', error);
            return { success: false, message: 'Erreur lors de la liaison utilisateur-client.' };
        }
    },

    // Link a user profile to multiple clients (replaces all existing links)
    async linkUserToClients(userId, clientIds) {
        try {
            // Remove existing links
            await supabaseClient
                .from('profile_clients')
                .delete()
                .eq('profile_id', userId);

            if (!clientIds || clientIds.length === 0) {
                // Also clear profiles.client_id
                await supabaseClient
                    .from('profiles')
                    .update({ client_id: null })
                    .eq('id', userId);
                return { success: true, data: [] };
            }

            // Insert new links
            const rows = clientIds.map(cid => ({ profile_id: userId, client_id: cid }));
            const { data, error } = await supabaseClient
                .from('profile_clients')
                .insert(rows)
                .select();

            if (error) throw error;

            // Keep profiles.client_id in sync with first client (backward compat)
            await supabaseClient
                .from('profiles')
                .update({ client_id: clientIds[0] })
                .eq('id', userId);

            return { success: true, data };
        } catch (error) {
            console.error('Error linking user to clients:', error);
            return { success: false, message: 'Erreur lors de la liaison utilisateur-clients.' };
        }
    },

    // Get a user profile by email
    async getProfileByEmail(email) {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error getting profile by email:', error);
            return { success: false, data: null };
        }
    },

    // Get all client IDs linked to a user profile
    async getUserClientIds(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('profile_clients')
                .select('client_id')
                .eq('profile_id', userId);

            if (error) throw error;
            return { success: true, clientIds: (data || []).map(r => r.client_id) };
        } catch (error) {
            console.error('Error getting user client ids:', error);
            return { success: false, clientIds: [] };
        }
    },

    // ==================== EMAIL TEMPLATES ====================

    async getEmailTemplates() {
        try {
            const { data, error } = await supabaseClient
                .from('email_templates')
                .select('*')
                .order('name');
            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error getting email templates:', error);
            return { success: false, data: [], message: error.message };
        }
    },

    async getEmailTemplate(id) {
        try {
            const { data, error } = await supabaseClient
                .from('email_templates')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting email template:', id, error);
            return null;
        }
    },

    async updateEmailTemplate(id, updates) {
        try {
            const { data, error } = await supabaseClient
                .from('email_templates')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating email template:', error);
            return { success: false, message: error.message };
        }
    }
};

window.SupabaseData = SupabaseData;
