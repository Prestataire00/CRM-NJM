/**
 * EMAIL SERVICE
 * Envoie des emails via Resend (à travers une Supabase Edge Function)
 * Remplace l'envoi via Gmail API de google-docs-service.js
 */

const EmailService = {
    // URL de la Supabase Edge Function pour l'envoi d'emails
    // À configurer avec votre URL Supabase
    EDGE_FUNCTION_URL: '',

    /**
     * Initialise le service avec l'URL Supabase
     */
    init() {
        // Récupérer l'URL Supabase depuis la config
        if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url) {
            this.EDGE_FUNCTION_URL = SUPABASE_CONFIG.url + '/functions/v1/send-email';
        }
    },

    /**
     * Envoie un email via la Supabase Edge Function
     * @param {string} to - Adresse email du destinataire
     * @param {string} subject - Objet du mail
     * @param {string} body - Corps du mail (texte brut)
     * @param {Array} attachments - Pièces jointes optionnelles [{name, content (base64), type}]
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async sendEmail(to, subject, body, attachments = []) {
        try {
            // Vérifier que l'URL est configurée
            if (!this.EDGE_FUNCTION_URL) {
                this.init();
            }

            if (!this.EDGE_FUNCTION_URL) {
                throw new Error('URL de la Edge Function non configurée. Vérifiez votre configuration Supabase.');
            }

            // Construire les headers d'authentification Supabase
            const anonKey = (typeof SUPABASE_CONFIG !== 'undefined') ? SUPABASE_CONFIG.anonKey : '';
            const headers = {
                'Content-Type': 'application/json',
                'apikey': anonKey
            };

            // Ajouter le Bearer token si l'utilisateur a une session active
            try {
                if (typeof supabaseClient !== 'undefined') {
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    if (session && session.access_token) {
                        headers['Authorization'] = `Bearer ${session.access_token}`;
                    } else {
                        // Pas de session : utiliser la clé anon comme Bearer (requis par Supabase)
                        headers['Authorization'] = `Bearer ${anonKey}`;
                    }
                }
            } catch (e) {
                console.warn('Session auth non disponible, utilisation de la clé anon:', e);
                headers['Authorization'] = `Bearer ${anonKey}`;
            }

            const response = await fetch(this.EDGE_FUNCTION_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    to,
                    subject,
                    body,
                    attachments: attachments.map(a => ({
                        filename: a.name,
                        content: a.data || a.content,
                        type: a.mimeType || a.type || 'application/pdf'
                    }))
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
            }

            const result = await response.json();

            return {
                success: true,
                messageId: result.id || result.messageId
            };

        } catch (error) {
            console.error('Erreur envoi email Resend:', error);
            return {
                success: false,
                error: error.message || 'Erreur inconnue'
            };
        }
    }
};

// Initialiser quand le DOM est prêt
window.addEventListener('load', () => {
    EmailService.init();
});

// Exposer globalement
window.EmailService = EmailService;
