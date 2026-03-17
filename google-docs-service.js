/**
 * GOOGLE DOCS SERVICE
 * Gère l'authentification et la génération de documents via Google Docs API
 */

const GoogleDocsService = {
    CLIENT_ID: '628878282476-0euuem5aea9dvhra07cddbd47l5b7ouj.apps.googleusercontent.com',
    TEMPLATE_ID: '1lSQ_WfqUxfqO1sbThu93inoE0ogt704F',
    CONVENTION_TEMPLATE_ID: '1Z8O3BSoAloSfDeiv_AhsPRjaL2l3UinFEFYRBvmQKSU',
    ATTENDANCE_SHEET_TEMPLATE_ID: '1FIpJUnv77uECcvLzuVfWbQDM-itX1efEGOcd7UFeRfE',
    CERTIFICATE_TEMPLATE_ID: '1C6pP787-xBA86aRlhH8MPKiQWUv1OVSm7oVu-lJr8JI',
    CONTRAT_SOUS_TRAITANCE_TEMPLATE_ID: '1zqj60jUBhcBJpg8pQ7zQ1K11s_6zvNzY',
    SCOPES: 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.send',

    tokenClient: null,
    gapiInited: false,
    gisInited: false,

    /**
     * Initialisation des clients Google
     */
    init() {
        this.loadGapi();
        this.loadGis();
    },

    loadGapi() {
        if (window.gapi) {
            gapi.load('client', async () => {
                await gapi.client.init({
                    clientId: this.CLIENT_ID,
                    discoveryDocs: [
                        'https://docs.googleapis.com/$discovery/rest?version=v1',
                        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
                        'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'
                    ],
                });
                this.gapiInited = true;
                console.log('GAPI Initialized');
            });
        }
    },

    loadGis() {
        if (window.google) {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: '', // défini lors de la demande
            });
            this.gisInited = true;
            console.log('GIS Initialized');
        }
    },

    /**
     * Authentification et demande de token
     */
    async authenticate() {
        return new Promise((resolve, reject) => {
            if (!this.tokenClient) {
                // Retry init simply
                this.loadGis();
                if (!this.tokenClient) return reject('Google Identity Services not initialized');
            }

            this.tokenClient.callback = async (resp) => {
                if (resp.error) {
                    reject(resp);
                }
                resolve(resp);
            };

            if (gapi.client.getToken() === null) {
                // Prompt the user to select a Google Account and ask for consent to share their data
                // when establishing a new session.
                this.tokenClient.requestAccessToken({ prompt: 'consent' });
            } else {
                // Skip display of account chooser and consent dialog for an existing session.
                this.tokenClient.requestAccessToken({ prompt: '' });
                resolve(gapi.client.getToken());
            }
        });
    },

    /**
     * Méthode générique de génération de document
     */
    async _generateDoc(templateId, newName, requests) {
        try {
            if (!this.gapiInited) await new Promise(r => setTimeout(r, 1000));
            if (!this.gapiInited) this.loadGapi();

            await this.authenticate();

            // 1. Copier le template
            const copyResponse = await gapi.client.drive.files.copy({
                fileId: templateId,
                resource: {
                    name: newName,
                    mimeType: 'application/vnd.google-apps.document',
                },
            });

            const newDocId = copyResponse.result.id;
            console.log('Document created:', newDocId);

            // 2. Appliquer les modifications
            if (requests && requests.length > 0) {
                await gapi.client.docs.documents.batchUpdate({
                    documentId: newDocId,
                    resource: { requests: requests },
                });
            }

            // 3. Ouvrir le document
            const docUrl = `https://docs.google.com/document/d/${newDocId}/edit`;
            const pdfUrl = `https://docs.google.com/document/d/${newDocId}/export?format=pdf`;
            window.open(docUrl, '_blank');

            return {
                success: true,
                fileId: newDocId,
                name: copyResponse.result.name,
                url: docUrl,
                pdfUrl: pdfUrl
            };

        } catch (error) {
            console.error('Erreur génération Google Doc:', error);
            alert('Erreur: ' + (error.result?.error?.message || error.message || error));
            return { success: false, message: error.message };
        }
    },

    /**
     * Génère la fiche pédagogique
     */
    async generatePedagogicalSheet(formation) {
        const requests = [
            { replaceAllText: { containsText: { text: '{{Titre}}', matchCase: true }, replaceText: formation.formation_name || 'Titre non défini' } },
            { replaceAllText: { containsText: { text: '{{Public}}', matchCase: true }, replaceText: formation.target_audience || 'Non défini' } },
            { replaceAllText: { containsText: { text: '{{Prerequis}}', matchCase: true }, replaceText: formation.prerequisites || 'Aucun' } },
            { replaceAllText: { containsText: { text: '{{NombreHeures}}', matchCase: true }, replaceText: (formation.hours_per_learner || 0) + 'h' } },
            { replaceAllText: { containsText: { text: '{{NombreJours}}', matchCase: true }, replaceText: (formation.number_of_days || 0) + ' jours' } },
            { replaceAllText: { containsText: { text: '{{objectifs}}', matchCase: true }, replaceText: formation.objectives || 'Non définis' } },
            { replaceAllText: { containsText: { text: '{{Module1}}', matchCase: true }, replaceText: formation.module_1 || 'Contenu non défini' } },
            { replaceAllText: { containsText: { text: '{{Methodemoyensoutils}}', matchCase: true }, replaceText: formation.methods_tools || 'Non définis' } },
            { replaceAllText: { containsText: { text: '{{methodologiedevaluation1}}', matchCase: true }, replaceText: formation.evaluation_methodology || 'Non définie' } },
            { replaceAllText: { containsText: { text: '{{Le+apporté}}', matchCase: true }, replaceText: formation.added_value || 'Non défini' } },
            { replaceAllText: { containsText: { text: '{{Délaisdacces}}', matchCase: true }, replaceText: formation.access_delays || 'Non définis' } },
        ];

        return this._generateDoc(
            this.TEMPLATE_ID,
            `Fiche Pédagogique - ${formation.formation_name || 'Nouvelle Formation'}`,
            requests
        );
    },

    /**
     * Retourne le texte du formateur selon le sous-traitant
     */
    getFormateurText(formation) {
        const subFirstName = (formation.subcontractor_first_name || '').toLowerCase().trim();
        if (subFirstName === 'quentin') {
            return 'Mr Quentin Durand, Titulaire d\'un DUT en techniques de commercialisation';
        }
        return 'Mme Nathalie JOULIE MORAND, titulaire d\'un Master en marketing et communication, gérante de NJM Conseil';
    },

    /**
     * Génère la convention de formation
     */
    async generateConvention(formation) {
        const currentDate = new Date().toLocaleDateString('fr-FR');

        // Calcul des dates formatées
        const startDate = formation.start_date ? new Date(formation.start_date).toLocaleDateString('fr-FR') : 'Date non définie';
        const endDate = formation.end_date ? new Date(formation.end_date).toLocaleDateString('fr-FR') : 'Date non définie';
        const dates = startDate === endDate ? startDate : `${startDate}, ${endDate}`;

        // Calculer le nombre d'apprenants et leurs noms
        let learnersCount = 0;
        let learnersNames = '';

        if (formation.learners_data && Array.isArray(formation.learners_data)) {
            learnersCount = formation.learners_data.length;
            learnersNames = formation.learners_data.map(l => {
                const firstName = l.first_name || l.firstname || '';
                const lastName = l.last_name || l.lastname || '';
                return `${firstName} ${lastName}`.trim();
            }).join(', ');
        } else if (typeof formation.learners_data === 'string') {
            // Fallback si c'est une chaine JSON
            try {
                const parsed = JSON.parse(formation.learners_data);
                if (Array.isArray(parsed)) {
                    learnersCount = parsed.length;
                    learnersNames = parsed.map(l => {
                        const firstName = l.first_name || l.firstname || '';
                        const lastName = l.last_name || l.lastname || '';
                        return `${firstName} ${lastName}`.trim();
                    }).join(', ');
                }
            } catch (e) { console.log('Erreur parsing learners', e); }
        }

        const requests = [
            // En-tête / Client
            { replaceAllText: { containsText: { text: '{{Raison_sociale}}', matchCase: true }, replaceText: formation.company_name || formation.client_name || '' } },
            { replaceAllText: { containsText: { text: '{{Adresse}}', matchCase: true }, replaceText: formation.company_address || '' } },
            { replaceAllText: { containsText: { text: '{{CP}}', matchCase: true }, replaceText: formation.company_postal_code || '' } },
            { replaceAllText: { containsText: { text: '{{Ville}}', matchCase: true }, replaceText: '' } },
            { replaceAllText: { containsText: { text: '{{Nom_du_dirigeant}}', matchCase: true }, replaceText: formation.company_director_name || '' } },
            { replaceAllText: { containsText: { text: '{{Nom_dirigeant}}', matchCase: true }, replaceText: formation.company_director_name || '' } },
            { replaceAllText: { containsText: { text: '{{Qualité_dirigeant}}', matchCase: true }, replaceText: formation.company_director_title || 'dirigeant' } },

            // Formation
            { replaceAllText: { containsText: { text: '{{Titre}}', matchCase: true }, replaceText: formation.formation_name || '' } },
            { replaceAllText: { containsText: { text: '{{objectifs}}', matchCase: true }, replaceText: formation.objectives || '' } },
            { replaceAllText: { containsText: { text: '{{Module_1}}', matchCase: true }, replaceText: formation.module_1 || '' } },
            { replaceAllText: { containsText: { text: '{{Méthode_moyens_outils}}', matchCase: true }, replaceText: formation.methods_tools || '' } },

            // Dates et Lieu (Spécifique demande user)
            { replaceAllText: { containsText: { text: '{{Dates}}', matchCase: true }, replaceText: dates } },
            { replaceAllText: { containsText: { text: '{{Lieu}}', matchCase: true }, replaceText: formation.training_location || 'Lieu non défini' } },

            // Détails quantitatifs
            { replaceAllText: { containsText: { text: '{{Nombres_heures}}', matchCase: true }, replaceText: (formation.hours_per_learner || 0).toString() } },
            { replaceAllText: { containsText: { text: '{{Nombres_personnes}}', matchCase: true }, replaceText: learnersCount.toString() } },
            { replaceAllText: { containsText: { text: '{{Noms des apprenants}}', matchCase: true }, replaceText: learnersNames || 'Aucun' } },

            // Financier et Dates
            { replaceAllText: { containsText: { text: '{{somme}}', matchCase: true }, replaceText: (formation.total_amount || 0).toString() } },
            { replaceAllText: { containsText: { text: '{{Date_de_ce_jour}}', matchCase: true }, replaceText: currentDate } },

            // Formateur : adapté selon le sous-traitant
            { replaceAllText: { containsText: { text: '{{Formateur}}', matchCase: true }, replaceText: this.getFormateurText(formation) } },
        ];

        // Remplir les noms individuels des apprenants (jusqu'à 6)
        // Récupérer les données des apprenants
        let learnersData = [];
        if (formation.learners_data && Array.isArray(formation.learners_data)) {
            learnersData = formation.learners_data;
        } else if (typeof formation.learners_data === 'string') {
            try {
                learnersData = JSON.parse(formation.learners_data);
            } catch (e) { console.log('Erreur parsing learners_data', e); }
        }

        for (let i = 1; i <= 6; i++) {
            let learnerName = '';
            if (learnersData[i - 1]) {
                const learner = learnersData[i - 1];
                const firstName = learner.first_name || learner.firstname || '';
                const lastName = learner.last_name || learner.lastname || '';
                learnerName = `${firstName} ${lastName}`.trim();
            }
            requests.push({
                replaceAllText: {
                    containsText: { text: `{{Nom de l_apprenant_${i}}}`, matchCase: true },
                    replaceText: learnerName
                }
            });
        }

        return this._generateDoc(
            this.CONVENTION_TEMPLATE_ID,
            `Convention - ${formation.company_name || formation.client_name || 'Client'} - ${formation.formation_name || 'Formation'}`,
            requests
        );
    },

    /**
     * Génère le contrat de sous-traitance
     */
    async generateContratSousTraitance(formation) {
        // Calcul des dates formatées
        let dates = '';
        if (formation.start_date && formation.end_date) {
            const start = new Date(formation.start_date).toLocaleDateString('fr-FR');
            const end = new Date(formation.end_date).toLocaleDateString('fr-FR');
            dates = `du ${start} au ${end}`;
        }

        const totalHours = parseFloat(formation.hours_per_learner) || 0;

        const requests = [
            { replaceAllText: { containsText: { text: '{{Client}}', matchCase: true }, replaceText: formation.company_name || formation.client_name || '' } },
            { replaceAllText: { containsText: { text: '{{Dates}}', matchCase: true }, replaceText: dates } },
            { replaceAllText: { containsText: { text: '{{Heures}}', matchCase: true }, replaceText: totalHours + 'h' } },
        ];

        return this._generateDoc(
            this.CONTRAT_SOUS_TRAITANCE_TEMPLATE_ID,
            `Contrat sous-traitance - ${formation.company_name || formation.client_name || 'Client'} - ${formation.formation_name || 'Formation'}`,
            requests
        );
    },

    /**
     * Génère la feuille de présence
     * Template avec 6 jours (1 page par jour) et 6 apprenants maximum par jour
     * Chaque page/jour a ses propres apprenants avec leurs noms et heures
     */
    async generateAttendanceSheet(formation) {
        const requests = [];

        // Informations générales (appliquées à toutes les pages)
        requests.push({ replaceAllText: { containsText: { text: '{{Titre}}', matchCase: true }, replaceText: formation.formation_name || 'Formation' } });
        requests.push({ replaceAllText: { containsText: { text: '{{Ville}}', matchCase: true }, replaceText: formation.training_location || 'Lieu non défini' } });

        // Récupérer les données de présence (attendance_sheets)
        let attendanceSheets = [];
        if (formation.attendance_sheets && Array.isArray(formation.attendance_sheets)) {
            attendanceSheets = formation.attendance_sheets;
        } else if (typeof formation.attendance_sheets === 'string') {
            try {
                attendanceSheets = JSON.parse(formation.attendance_sheets);
            } catch (e) { console.log('Erreur parsing attendance_sheets', e); }
        }

        // Remplir les données pour chaque jour (jusqu'à 6 jours/pages)
        for (let jour = 1; jour <= 6; jour++) {
            const dayData = attendanceSheets.find(sheet => sheet.day === jour) || attendanceSheets[jour - 1];

            // Date du jour
            let dateStr = '';
            if (dayData && dayData.date) {
                dateStr = new Date(dayData.date).toLocaleDateString('fr-FR');
            }
            requests.push({ replaceAllText: { containsText: { text: `{{Date__jour_${jour}}}`, matchCase: true }, replaceText: dateStr } });

            // Pour chaque apprenant de ce jour (jusqu'à 6)
            for (let apprenant = 1; apprenant <= 6; apprenant++) {
                let learnerName = '';
                let hours = '';

                if (dayData && dayData.learners_hours && Array.isArray(dayData.learners_hours)) {
                    const learnerData = dayData.learners_hours[apprenant - 1];
                    if (learnerData) {
                        learnerName = learnerData.learner_name || '';
                        if (learnerData.hours !== undefined && learnerData.hours !== null && learnerData.hours !== '') {
                            hours = `${learnerData.hours}h`;
                        }
                    }
                }

                // Nom de l'apprenant pour ce jour
                // Format: {{NOM__et_prénom_de_lapprenant1_jour_1}} pour apprenant 1, {{NOM__et_prénom_de_lapprenant_2_jour_1}} pour apprenant 2+
                if (apprenant === 1) {
                    requests.push({
                        replaceAllText: {
                            containsText: { text: `{{NOM__et_prénom_de_lapprenant1_jour_${jour}}}`, matchCase: true },
                            replaceText: learnerName
                        }
                    });
                } else {
                    requests.push({
                        replaceAllText: {
                            containsText: { text: `{{NOM__et_prénom_de_lapprenant_${apprenant}_jour_${jour}}}`, matchCase: true },
                            replaceText: learnerName
                        }
                    });
                }

                // Heures de l'apprenant pour ce jour - format {{Nombre_dheures_par_apprenant_X_jourY}}
                requests.push({
                    replaceAllText: {
                        containsText: { text: `{{Nombre_dheures_par_apprenant_${apprenant}_jour${jour}}}`, matchCase: true },
                        replaceText: hours
                    }
                });
            }
        }

        return this._generateDoc(
            this.ATTENDANCE_SHEET_TEMPLATE_ID,
            `Feuille de présence - ${formation.formation_name || 'Formation'} - ${formation.client_name || 'Client'}`,
            requests
        );
    },

    /**
     * Génère le certificat de réalisation et l'attestation de fin de formation
     * Template avec 6 apprenants maximum (2 pages par apprenant : certificat + attestation)
     */
    async generateCertificate(formation) {
        const requests = [];

        // Récupérer les apprenants
        let learnersData = [];
        if (formation.learners_data && Array.isArray(formation.learners_data)) {
            learnersData = formation.learners_data;
        } else if (typeof formation.learners_data === 'string') {
            try {
                learnersData = JSON.parse(formation.learners_data);
            } catch (e) { console.log('Erreur parsing learners_data', e); }
        }

        // Calculer les dates formatées
        const startDate = formation.start_date ? new Date(formation.start_date).toLocaleDateString('fr-FR') : '';
        const endDate = formation.end_date ? new Date(formation.end_date).toLocaleDateString('fr-FR') : '';
        const dates = startDate === endDate ? startDate : `${startDate} au ${endDate}`;

        // Informations générales (appliquées à toutes les pages)
        requests.push({ replaceAllText: { containsText: { text: '{{Titre}}', matchCase: true }, replaceText: formation.formation_name || 'Formation' } });
        requests.push({ replaceAllText: { containsText: { text: '{{raison_sociale_entreprise}}', matchCase: true }, replaceText: formation.company_name || formation.client_name || '' } });
        requests.push({ replaceAllText: { containsText: { text: '{{dates}}', matchCase: true }, replaceText: dates } });
        requests.push({ replaceAllText: { containsText: { text: '{{dates}}', matchCase: true }, replaceText: dates } });


        // Calcul des heures totales : heures pour UN apprenant (pas le cumul de tous)
        let totalHours = 0;
        if (learnersData.length > 0) {
            totalHours = parseFloat(learnersData[0].hours) || 0;
        } else {
            totalHours = parseFloat(formation.hours_per_learner) || 0;
        }


        requests.push({ replaceAllText: { containsText: { text: '{{Nombre_heures}}', matchCase: true }, replaceText: totalHours + 'h' } });
        requests.push({ replaceAllText: { containsText: { text: '{{Ville}}', matchCase: true }, replaceText: formation.training_location || 'Lieu non défini' } });
        requests.push({ replaceAllText: { containsText: { text: '{{être_capable_de}}', matchCase: true }, replaceText: formation.objectives || '' } });
        requests.push({ replaceAllText: { containsText: { text: '{{date_du_dernier_jour_de_formation_}}', matchCase: true }, replaceText: endDate || startDate || new Date().toLocaleDateString('fr-FR') } });

        // Ajout des informations entreprise (Onglet Entreprise & Apprenants)
        requests.push({ replaceAllText: { containsText: { text: '{{Adresse}}', matchCase: true }, replaceText: formation.company_address || '' } });
        requests.push({ replaceAllText: { containsText: { text: '{{CP}}', matchCase: true }, replaceText: formation.company_postal_code || '' } });
        requests.push({ replaceAllText: { containsText: { text: '{{Nom_du_dirigeant}}', matchCase: true }, replaceText: formation.company_director_name || '' } });

        // Remplir les noms des apprenants (jusqu'à 6)
        // Note: le formulaire utilise first_name/last_name, mais on supporte aussi firstname/lastname pour compatibilité
        for (let i = 1; i <= 6; i++) {
            let learnerName = '';
            let learnerHours = '';
            if (learnersData[i - 1]) {
                const learner = learnersData[i - 1];
                const firstName = learner.first_name || learner.firstname || '';
                const lastName = learner.last_name || learner.lastname || '';
                learnerName = `${firstName} ${lastName}`.trim();
                // Heures de l'apprenant (si renseignées)
                if (learner.hours) {
                    learnerHours = learner.hours + 'h';
                }
            }
            requests.push({
                replaceAllText: {
                    containsText: { text: `{{NOM__et_prénom_de_lapprenant_${i}}}`, matchCase: true },
                    replaceText: learnerName
                }
            });
            // Heures par apprenant pour l'attestation de fin de formation
            requests.push({
                replaceAllText: {
                    containsText: { text: `{{Nombre_heures_de_lapprenant_${i}}}`, matchCase: true },
                    replaceText: learnerHours
                }
            });
        }

        return this._generateDoc(
            this.CERTIFICATE_TEMPLATE_ID,
            `Certificat - ${formation.formation_name || 'Formation'} - ${formation.client_name || 'Client'}`,
            requests
        );
    },

    // ==================== Gmail API ====================

    /**
     * Envoie un email via Gmail API
     * @param {string} to - Adresse email du destinataire
     * @param {string} subject - Objet du mail
     * @param {string} body - Corps du mail (texte brut)
     * @param {Array} attachments - Pièces jointes optionnelles [{name, mimeType, data}]
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async sendEmail(to, subject, body, attachments = []) {
        try {
            // S'assurer que l'utilisateur est authentifié
            await this.authenticate();

            // Construire le message MIME
            const message = this._buildMimeMessage(to, subject, body, attachments);

            // Encoder en base64 URL-safe
            const encodedMessage = this._base64UrlEncode(message);

            // Envoyer via Gmail API
            const response = await gapi.client.gmail.users.messages.send({
                userId: 'me',
                resource: {
                    raw: encodedMessage
                }
            });

            console.log('Email envoyé avec succès:', response.result);
            return {
                success: true,
                messageId: response.result.id
            };

        } catch (error) {
            console.error('Erreur envoi email Gmail:', error);
            return {
                success: false,
                error: error.result?.error?.message || error.message || 'Erreur inconnue'
            };
        }
    },

    /**
     * Construit un message MIME pour l'envoi via Gmail
     */
    _buildMimeMessage(to, subject, body, attachments = []) {
        const boundary = '----=_Part_' + Date.now().toString(36);
        const nl = '\r\n';

        let message = '';

        // Headers
        message += 'MIME-Version: 1.0' + nl;
        message += 'From: me' + nl;
        message += 'To: ' + to + nl;
        message += 'Subject: =?UTF-8?B?' + btoa(unescape(encodeURIComponent(subject))) + '?=' + nl;

        if (attachments.length > 0) {
            // Message multipart avec pièces jointes
            message += 'Content-Type: multipart/mixed; boundary="' + boundary + '"' + nl + nl;

            // Partie texte
            message += '--' + boundary + nl;
            message += 'Content-Type: text/plain; charset=UTF-8' + nl;
            message += 'Content-Transfer-Encoding: base64' + nl + nl;
            message += btoa(unescape(encodeURIComponent(body))) + nl + nl;

            // Pièces jointes
            for (const attachment of attachments) {
                message += '--' + boundary + nl;
                message += 'Content-Type: ' + (attachment.mimeType || 'application/octet-stream') + nl;
                message += 'Content-Disposition: attachment; filename="' + attachment.name + '"' + nl;
                message += 'Content-Transfer-Encoding: base64' + nl + nl;
                message += attachment.data + nl + nl;
            }

            message += '--' + boundary + '--';
        } else {
            // Message simple sans pièces jointes
            message += 'Content-Type: text/plain; charset=UTF-8' + nl;
            message += 'Content-Transfer-Encoding: base64' + nl + nl;
            message += btoa(unescape(encodeURIComponent(body)));
        }

        return message;
    },

    /**
     * Encode en base64 URL-safe pour Gmail API
     */
    _base64UrlEncode(str) {
        return btoa(unescape(encodeURIComponent(str)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }
};

// Initialiser au chargement
window.onload = function () {
    // Si d'autres window.onload existent, ceci pourrait les écraser. 
    // Mieux vaut appeler init manuellement ou via event listener.
    // Mais gardons-le simple pour l'accès global.
    // On va utiliser un event listener safe.
};

window.addEventListener('load', () => {
    GoogleDocsService.init();
});

// Exposer globalement
window.GoogleDocsService = GoogleDocsService;
