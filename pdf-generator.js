/**
 * PDF GENERATOR SERVICE
 * Remplace google-docs-service.js - Génère les documents PDF localement avec jsPDF
 * Templates fidèles aux modèles Google Docs de NJM Conseil
 */

const PdfGenerator = {
    // Logo NJM - sera chargé dynamiquement
    LOGO_LOADED: false,
    LOGO_DATA: null,
    // Signature et cachet - chargés depuis localStorage
    SIGNATURE_DATA: null,
    CACHET_DATA: null,

    /**
     * Charge le logo depuis le fichier PNG
     */
    async loadLogo() {
        if (this.LOGO_LOADED) return this.LOGO_DATA;
        try {
            const response = await fetch('logo-njm.png');
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    this.LOGO_DATA = reader.result;
                    this.LOGO_LOADED = true;
                    resolve(this.LOGO_DATA);
                };
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn('Logo non chargé:', e);
            return null;
        }
    },

    /**
     * Charge la signature depuis localStorage
     */
    async loadSignature() {
        const result = await SupabaseData.getSetting('signature');
        this.SIGNATURE_DATA = (result.success && result.data) ? result.data : localStorage.getItem('njm_signature');
        return this.SIGNATURE_DATA;
    },

    /**
     * Charge le cachet depuis Supabase, fallback localStorage
     */
    async loadCachet() {
        const result = await SupabaseData.getSetting('cachet');
        this.CACHET_DATA = (result.success && result.data) ? result.data : localStorage.getItem('njm_cachet');
        return this.CACHET_DATA;
    },

    // Couleurs NJM
    COLORS: {
        pink: [233, 30, 140],       // #e91e8c
        purple: [123, 63, 158],      // #7b3f9e
        orange: [227, 106, 58],      // #e36a3a
        green: [184, 201, 68],       // #b8c944
        darkGray: [51, 51, 51],
        gray: [107, 114, 128],
        lightGray: [229, 231, 235],
        white: [255, 255, 255],
        tableOrange: [227, 130, 70],  // Bordure tableau orange
        headerBg: [253, 245, 240]     // Fond en-tête tableau
    },

    /**
     * Crée une instance jsPDF configurée
     */
    createDoc() {
        const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!jsPDF) throw new Error('jsPDF non disponible. Vérifiez que le script CDN est chargé.');
        return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    },

    /**
     * Ajoute le logo NJM + les activités à droite (fidèle au modèle)
     */
    addNJMHeader(doc) {
        // Logo NJM en haut à gauche
        if (this.LOGO_DATA) {
            doc.addImage(this.LOGO_DATA, 'PNG', 15, 10, 35, 20);
        }

        // Activités en haut à droite (comme dans le modèle)
        const activities = ['MARKETING', 'WEB MARKETING', 'COMMERCIAL', 'COMMUNICATION', 'COACHING'];
        const colors = [this.COLORS.orange, this.COLORS.orange, this.COLORS.orange, this.COLORS.orange, this.COLORS.orange];

        activities.forEach((activity, i) => {
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colors[i]);
            doc.text(activity, 195, 12 + (i * 4), { align: 'right' });
        });

        return 38;
    },

    /**
     * Ajoute le pied de page NJM Conseil (fidèle au modèle)
     */
    addNJMFooter(doc) {
        const pageHeight = doc.internal.pageSize.height;
        const y = pageHeight - 15;

        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');

        // Ligne multicolore
        doc.setDrawColor(...this.COLORS.pink);
        doc.setLineWidth(0.3);
        doc.line(15, y - 3, 50, y - 3);
        doc.setDrawColor(...this.COLORS.purple);
        doc.line(50, y - 3, 100, y - 3);
        doc.setDrawColor(...this.COLORS.orange);
        doc.line(100, y - 3, 150, y - 3);
        doc.setDrawColor(...this.COLORS.green);
        doc.line(150, y - 3, 195, y - 3);

        // Infos
        doc.setTextColor(...this.COLORS.purple);
        doc.text('NJM Conseil - NATHALIE JOULIÉ MORAND - LE CASSAN - 12330 CLAIRVAUX D\'AVEYRON - 06 88 10 40 67 - njm.conseil@orange.fr', 105, y, { align: 'center' });
        doc.setFontSize(5.5);
        doc.setTextColor(...this.COLORS.gray);
        doc.text('www.njm-conseil.fr SAS NJM Conseil au capital social de 3000€ N°RCS Rodez 534 935 473 NAF : 7022Z N° Activité : 73120063512 Qualiopi C2-5-V2 16-11-2020', 105, y + 4, { align: 'center' });
    },

    // ==================== Helpers ====================

    parseLearners(formation) {
        let data = [];
        if (formation.learners_data && Array.isArray(formation.learners_data)) {
            data = formation.learners_data;
        } else if (typeof formation.learners_data === 'string') {
            try { data = JSON.parse(formation.learners_data); } catch (e) { }
        }
        return data;
    },

    formatDate(dateStr) {
        if (!dateStr) return 'Non définie';
        return new Date(dateStr).toLocaleDateString('fr-FR');
    },

    getLearnerName(learner) {
        const firstName = learner.first_name || learner.firstname || '';
        const lastName = learner.last_name || learner.lastname || '';
        return `${firstName} ${lastName}`.trim();
    },

    getFormateurText(formation) {
        const subFirstName = (formation.subcontractor_first_name || '').toLowerCase().trim();
        if (subFirstName === 'quentin') {
            return 'Mr Quentin Durand, Titulaire d\'un DUT en techniques de commercialisation';
        }
        return 'Mme Nathalie JOULIÉ MORAND, titulaire d\'un Master en marketing et communication, gérante de NJM Conseil';
    },

    /**
     * Dessine un tableau avec bordures orange (comme le modèle)
     */
    drawTable(doc, startY, headers, rows, colWidths) {
        const startX = 15;
        const rowHeight = 8;
        const cellPadding = 1.5;
        const totalWidth = colWidths.reduce((a, b) => a + b, 0);

        doc.setDrawColor(...this.COLORS.tableOrange);
        doc.setLineWidth(0.4);

        // En-tête du tableau
        doc.setFillColor(255, 248, 240);
        doc.rect(startX, startY, totalWidth, rowHeight * 2, 'FD');

        // Lignes verticales d'en-tête
        let xPos = startX;
        headers.forEach((header, i) => {
            if (i > 0) {
                doc.line(xPos, startY, xPos, startY + rowHeight * 2);
            }
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.COLORS.darkGray);
            const lines = doc.splitTextToSize(header, colWidths[i] - cellPadding * 2);
            doc.text(lines, xPos + cellPadding, startY + 4, { maxWidth: colWidths[i] - cellPadding * 2 });
            xPos += colWidths[i];
        });

        let y = startY + rowHeight * 2;

        // Lignes du tableau
        rows.forEach(row => {
            // Calculer la hauteur de la ligne
            let maxLines = 1;
            row.forEach((cell, i) => {
                const lines = doc.splitTextToSize(String(cell || ''), colWidths[i] - cellPadding * 2);
                maxLines = Math.max(maxLines, lines.length);
            });
            const currentRowHeight = Math.max(rowHeight, maxLines * 4 + 4);

            // Vérifier si on dépasse la page
            if (y + currentRowHeight > 270) {
                doc.addPage();
                this.addNJMHeader(doc);
                this.addNJMFooter(doc);
                y = 40;
            }

            // Bordure de la ligne
            doc.setDrawColor(...this.COLORS.tableOrange);
            doc.rect(startX, y, totalWidth, currentRowHeight);

            // Contenu des cellules
            xPos = startX;
            row.forEach((cell, i) => {
                if (i > 0) {
                    doc.line(xPos, y, xPos, y + currentRowHeight);
                }
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...this.COLORS.darkGray);
                const lines = doc.splitTextToSize(String(cell || ''), colWidths[i] - cellPadding * 2);
                doc.text(lines, xPos + cellPadding, y + 4, { maxWidth: colWidths[i] - cellPadding * 2 });
                xPos += colWidths[i];
            });

            y += currentRowHeight;
        });

        return y;
    },

    // ==================== FICHE PÉDAGOGIQUE ====================

    async generatePedagogicalSheet(formation) {
        try {
            await this.loadLogo();
            const doc = this.createDoc();
            let y = this.addNJMHeader(doc);

            // Titre souligné centré (fidèle au modèle original)
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.COLORS.darkGray);
            const title = `FICHE PEDAGOGIQUE : ${formation.formation_name || 'Formation'}`;
            doc.text(title, 105, y, { align: 'center' });
            const titleWidth = doc.getTextWidth(title);
            doc.setDrawColor(...this.COLORS.darkGray);
            doc.setLineWidth(0.3);
            doc.line(105 - titleWidth / 2, y + 1, 105 + titleWidth / 2, y + 1);
            y += 10;

            // Public et Prérequis
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`Public : ${formation.target_audience || 'RAS'}`, 15, y);
            y += 5;
            doc.text(`Pré requis : ${formation.prerequisites || 'RAS'}`, 15, y);
            y += 7;

            // Tableau principal (comme le modèle)
            const headers = [
                'Durée\n(en heures)',
                'Objectifs pédagogiques mesurables\n(aptitudes et compétences)',
                'Contenu pédagogique\npar module',
                'Méthodes, moyens et outils\npédagogiques'
            ];

            const colWidths = [20, 40, 65, 55];

            const rows = [[
                `${formation.hours_per_learner || 0}h\n\n${formation.number_of_days || 0} ${(formation.number_of_days || 0) <= 1 ? 'jour' : 'jours'}`,
                formation.objectives || 'RAS',
                formation.module_1 || 'Commerce',
                formation.methods_tools || 'RAS'
            ]];

            y = this.drawTable(doc, y, headers, rows, colWidths);
            y += 5;

            // Méthodologie, Le + apporté, Délais d'accès
            doc.setFontSize(9);
            doc.setTextColor(...this.COLORS.darkGray);

            // Méthodologie d'évaluation
            doc.setFont('helvetica', 'bold');
            const labelMethodo = "Méthodologie d'évaluation : ";
            doc.text(labelMethodo, 15, y);
            const wMethodo = doc.getTextWidth(labelMethodo);
            doc.setFont('helvetica', 'normal');
            doc.text(formation.evaluation_methodology || 'RAS', 15 + wMethodo, y);
            y += 6;

            // Le + apporté
            doc.setFont('helvetica', 'bold');
            const labelPlus = "Le + apporté : ";
            doc.text(labelPlus, 15, y);
            const wPlus = doc.getTextWidth(labelPlus);
            doc.setFont('helvetica', 'normal');
            doc.text(formation.added_value || 'RAS', 15 + wPlus, y);
            y += 6;

            // Délais d'accès
            const delaisText = formation.access_delays || 'les dates disponibles le sont à partir du 6 mois';
            doc.text(`Délais d'accès : ${delaisText}`, 15, y);

            this.addNJMFooter(doc);

            const fileName = `Fiche Pédagogique - ${formation.formation_name || 'Formation'}`;
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');

            return { success: true, name: fileName, blob: pdfBlob, url: pdfUrl };
        } catch (error) {
            console.error('Erreur génération fiche pédagogique:', error);
            alert('Erreur: ' + error.message);
            return { success: false, message: error.message };
        }
    },

    // ==================== CONVENTION DE FORMATION ====================

    /**
     * Helper : écrit du texte avec retour à la ligne automatique et gestion de page
     */
    _writeText(doc, x, y, text, options = {}) {
        const maxWidth = options.maxWidth || 170;
        const lineHeight = options.lineHeight || 4.5;
        const fontSize = options.fontSize || 9;
        const font = options.font || 'normal';
        const bottomMargin = 25; // espace pour footer

        doc.setFontSize(fontSize);
        doc.setFont('helvetica', font);
        doc.setTextColor(...(options.color || this.COLORS.darkGray));

        const lines = doc.splitTextToSize(String(text), maxWidth);
        for (const line of lines) {
            if (y > doc.internal.pageSize.height - bottomMargin) {
                this.addNJMFooter(doc);
                doc.addPage();
                y = this.addNJMHeader(doc);
            }
            doc.text(line, x, y);
            y += lineHeight;
        }
        return y;
    },

    /**
     * Helper : écrit un bullet point (●) avec label bold + valeur
     */
    _writeBullet(doc, x, y, label, value, maxWidth) {
        const bottomMargin = 25;
        if (y > doc.internal.pageSize.height - bottomMargin) {
            this.addNJMFooter(doc);
            doc.addPage();
            y = this.addNJMHeader(doc);
        }

        doc.setFontSize(9);

        // Bullet point (cercle rempli orange)
        doc.setFillColor(...this.COLORS.orange);
        doc.circle(x + 1.5, y - 1, 1, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...this.COLORS.orange);
        const labelText = label + ' ';
        doc.text(labelText, x + 5, y);
        const labelW = doc.getTextWidth(labelText);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...this.COLORS.darkGray);
        const remaining = maxWidth - 5 - labelW;
        const lines = doc.splitTextToSize(String(value || 'RAS'), remaining > 30 ? remaining : maxWidth - 5);

        // First line after label
        if (lines.length > 0) {
            doc.text(lines[0], x + 5 + labelW, y);
        }
        y += 4.5;

        // Remaining lines
        for (let i = 1; i < lines.length; i++) {
            if (y > doc.internal.pageSize.height - bottomMargin) {
                this.addNJMFooter(doc);
                doc.addPage();
                y = this.addNJMHeader(doc);
            }
            doc.text(lines[i], x + 5, y);
            y += 4.5;
        }
        return y;
    },

    async generateConvention(formation) {
        try {
            await this.loadLogo();
            await this.loadSignature();
            const doc = this.createDoc();
            const margin = 20;
            const maxW = 170;

            const currentDate = new Date().toLocaleDateString('fr-FR');
            const startDate = this.formatDate(formation.start_date);
            const endDate = this.formatDate(formation.end_date);
            // Priorité : custom_dates > attendance_sheets > fallback start/end
            let dates;
            if (formation.custom_dates) {
                dates = formation.custom_dates;
            } else {
                dates = startDate;
                let sheets = formation.attendance_sheets || [];
                if (typeof sheets === 'string') {
                    try { sheets = JSON.parse(sheets); } catch (e) { sheets = []; }
                }
                if (sheets.length > 0) {
                    const realDates = sheets
                        .filter(s => s.date)
                        .map(s => new Date(s.date).toLocaleDateString('fr-FR'))
                        .sort((a, b) => new Date(a.split('/').reverse().join('-'))
                            - new Date(b.split('/').reverse().join('-')));
                    if (realDates.length > 0) dates = realDates.join(', ');
                } else if (startDate !== endDate) {
                    dates = `${startDate} au ${endDate}`;
                }
            }
            const learnersData = this.parseLearners(formation);
            const learnersNames = learnersData.map(l => this.getLearnerName(l)).filter(n => n).join(', ');

            // ===== PAGE 1 =====
            let y = this.addNJMHeader(doc);

            // Titre
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.COLORS.darkGray);
            doc.text('CONVENTION DE FORMATION PROFESSIONNELLE', 105, y, { align: 'center' });
            y += 12;

            // Entre les soussignés
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Entre les soussignés :', margin, y);
            y += 5;

            // Organisme de formation
            doc.setFont('helvetica', 'normal');
            doc.text('L\'organisme de formation :', margin, y); y += 5;

            doc.setFont('helvetica', 'bold');
            const indent = margin + 15;
            doc.text('SAS NJM Conseil', indent, y); y += 4;
            doc.text('Le Cassan', indent, y); y += 4;
            doc.text('12330 Clairvaux d\'Aveyron', indent, y); y += 4;
            doc.text('N° activité : 73120063512', indent, y); y += 5;

            doc.setFont('helvetica', 'normal');
            doc.text('Représentée par Mme JOULIE-MORAND Nathalie agissant en qualité de gérante', margin, y); y += 6;
            doc.text('Ci-après désigné "l\'organisme de formation", NJM Conseil', margin, y); y += 8;

            // Client
            doc.text('Et', margin, y); y += 4;
            doc.text('Le client :', margin, y); y += 6;

            doc.setFont('helvetica', 'bold');
            doc.text(formation.company_name || formation.client_name || '', indent, y); y += 4;
            doc.text(formation.company_address || '', indent, y); y += 4;
            doc.text(formation.company_postal_code || '', indent, y); y += 6;

            doc.setFont('helvetica', 'normal');
            doc.text(`Représenté par ${formation.company_director_name || ''}  agissant en qualité de ${formation.company_director_title || 'dirigeant(e)'}`, margin, y); y += 6;
            doc.text('Ci-après désigné "le Client",', margin, y); y += 8;

            // Texte légal
            const legalIntro = 'Est conclue la convention suivante, en application des dispositions de la sixième partie du Code du Travail portant sur l\'organisation de la formation professionnelle tout au long de la vie.';
            y = this._writeText(doc, margin, y, legalIntro, { maxWidth: maxW });
            y += 4;

            // Article 1
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.COLORS.darkGray);
            doc.text('Article 1- Objet de la convention :', margin, y);
            // Souligner
            const a1w = doc.getTextWidth('Article 1- Objet de la convention :');
            doc.setDrawColor(...this.COLORS.darkGray);
            doc.line(margin, y + 0.5, margin + a1w, y + 0.5);
            y += 5;

            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin, y, 'En exécution de la présente convention, l\'organisme de formation s\'engage à organiser l\'action de formation intitulée :', { maxWidth: maxW });
            y += 3;

            // Titre formation centré
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`Convention de formation : ${formation.formation_name || ''}`, 105, y, { align: 'center' });
            y += 8;

            // Bullet points (ordre conforme au modèle de référence)
            y = this._writeBullet(doc, margin, y, 'Objectifs:', formation.objectives || 'RAS', maxW);
            y = this._writeBullet(doc, margin, y, 'Type d\'action de formation', '(au sens de l\'article L. 900-2 du Code du travail): Acquisition et entretien des connaissances et mise en parallèle avec l\'activité.', maxW);
            y = this._writeBullet(doc, margin, y, 'Contenus:', formation.module_1 || formation.program_summary || 'RAS', maxW);
            y = this._writeBullet(doc, margin, y, 'Méthodes et moyens pédagogiques:', formation.methods_tools || 'RAS', maxW);
            y = this._writeBullet(doc, margin, y, 'Formateur:', this.getFormateurText(formation), maxW);
            y = this._writeBullet(doc, margin, y, 'Date(s):', dates, maxW);
            y = this._writeBullet(doc, margin, y, 'Durée:', `${formation.hours_per_learner || 0} heures.`, maxW);
            y = this._writeBullet(doc, margin, y, 'Lieu:', formation.training_location || '', maxW);
            y = this._writeBullet(doc, margin, y, 'Effectif formé:', `${learnersData.length} personne(s), ${learnersNames || ''}`, maxW);
            y += 1;
            y = this._writeBullet(doc, margin, y, 'Modalités de suivi et appréciation des résultats:', 'fiche de présence émargée, accompagnement rectificatif et évaluation des productions de l\'apprenant.', maxW);

            this.addNJMFooter(doc);

            // ===== PAGE 2 =====
            doc.addPage();
            y = 20;

            // Article 2
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.COLORS.darkGray);
            doc.text('Article 2- Description de la formation:', margin, y);
            const a2w = doc.getTextWidth('Article 2- Description de la formation:');
            doc.setDrawColor(...this.COLORS.darkGray);
            doc.line(margin, y + 0.5, margin + a2w, y + 0.5);
            y += 5;

            doc.setFont('helvetica', 'normal');
            doc.text('Objectifs :', margin, y); y += 4;
            (formation.objectives || 'RAS').split('\n').filter(l => l.trim()).forEach(line => {
                y = this._writeText(doc, margin + 3, y, `-   ${line.trim()}`, { maxWidth: maxW - 3 });
            });
            y += 2;

            doc.setFont('helvetica', 'normal');
            doc.text('Contenus :', margin, y); y += 4;
            (formation.module_1 || 'RAS').split('\n').filter(l => l.trim()).forEach(line => {
                y = this._writeText(doc, margin + 3, y, `-   ${line.trim()}`, { maxWidth: maxW - 3 });
            });
            y += 2;

            doc.setFont('helvetica', 'normal');
            doc.text('Modalités :', margin, y); y += 4;
            (formation.methods_tools || 'RAS').split('\n').filter(l => l.trim()).forEach(line => {
                y = this._writeText(doc, margin + 3, y, `-   ${line.trim()}`, { maxWidth: maxW - 3 });
            });
            y += 2;

            doc.setFont('helvetica', 'normal');
            doc.text('Mode d\'évaluation des acquis :', margin, y); y += 4;
            doc.text('-   Questionnaire individuel en ligne en fin de formation', margin + 3, y); y += 8;

            // Article 3
            doc.setFont('helvetica', 'bold');
            doc.text('Article 3- Dispositions financières :', margin, y);
            const a3w = doc.getTextWidth('Article 3- Dispositions financières :');
            doc.line(margin, y + 0.5, margin + a3w, y + 0.5);
            y += 7;

            const amount = formation.total_amount || 0;
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin + 8, y, 'a) Le client, en contrepartie des actions de formation réalisées, s\'engage à verser à l\'organisme de formation, une somme correspondant aux frais de formation de :', { maxWidth: maxW - 8 });
            // Montant en bold sur la ligne suivante
            doc.setFont('helvetica', 'bold');
            doc.text(`${amount} € nets.`, margin + 8, y);
            const amountW = doc.getTextWidth(`${amount} € nets. `);
            doc.setFont('helvetica', 'normal');
            doc.text('S\'y ajoutent des frais de déplacement.', margin + 8 + amountW, y);
            y += 4.5;
            y += 1;
            y = this._writeText(doc, margin + 8, y, 'b) L\'organisme de formation, en contrepartie des sommes reçues, s\'engage à réaliser toutes les actions prévues dans le cadre de la présente convention ainsi qu\'à fournir tout document et pièce de nature à justifier la réalité et la validité des dépenses de formation engagées à ce titre.', { maxWidth: maxW - 8 });
            y += 1;
            y = this._writeText(doc, margin + 8, y, 'c) Modalités de règlement : la facture est réglable à l\'issue de la formation par chèque à l\'ordre de la SAS NJM Conseil.', { maxWidth: maxW - 8 });
            y += 4;

            // Article 4
            doc.setFont('helvetica', 'bold');
            doc.text('Article 4- Dédit ou abandon :', margin, y);
            const a4w = doc.getTextWidth('Article 4- Dédit ou abandon :');
            doc.line(margin, y + 0.5, margin + a4w, y + 0.5);
            y += 7;

            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin + 8, y, 'a) En cas de résiliation de la présente convention par le client à moins de 10 jours francs avant le début d\'une des actions mentionnées à l\'annexe, l\'organisme de formation retiendra sur le coût total 10 % de la somme, au titre de dédommagement.', { maxWidth: maxW - 8 });
            y += 1;
            y = this._writeText(doc, margin + 8, y, 'b) En cas de réalisation partielle de l\'action du fait du client, seule sera facturée au client la partie effectivement réalisée de l\'action, selon le prorata suivant : nombre d\'heures réalisées/nombre d\'heures prévues. En outre, l\'organisme de formation retiendra sur le coût correspondant à la partie non-réalisée un pourcentage de 10 %, au titre de dédommagement.', { maxWidth: maxW - 8 });
            y += 1;
            y = this._writeText(doc, margin + 8, y, 'c) Les montants versés par le client au titre de dédommagement ne pourront pas être imputés par le client sur son obligation définie à l\'article L6331-1 du code du travail ni faire l\'objet d\'une demande de remboursement ou de prise en charge par un OPCO.', { maxWidth: maxW - 8 });
            y += 1;
            y = this._writeText(doc, margin + 8, y, 'd) En cas de modification unilatérale par l\'organisme de formation de l\'un des éléments fixés à l\'article 1, le client se réserve le droit de mettre fin à la présente convention. Le délai d\'annulation étant toutefois limité à 30 jours francs avant la date prévue de commencement de l\'une des actions mentionnées à la présente convention, il sera, dans ce cas, procédé à une résorption anticipée de la convention.', { maxWidth: maxW - 8 });
            y += 4;

            // Article 5
            doc.setFont('helvetica', 'bold');
            doc.text('Article 5- Date d\'effet et durée de la convention :', margin, y);
            const a5w = doc.getTextWidth('Article 5- Date d\'effet et durée de la convention :');
            doc.line(margin, y + 0.5, margin + a5w, y + 0.5);
            y += 6;
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin, y, 'La présente convention prend effet à compter de la date de signature de la présente convention pour s\'achever à la fin de la période de formation objet de la présente convention.', { maxWidth: maxW });
            y += 4;

            // Article 6
            doc.setFont('helvetica', 'bold');
            doc.text('Article 6- Différends éventuels :', margin, y);
            const a6w = doc.getTextWidth('Article 6- Différends éventuels :');
            doc.line(margin, y + 0.5, margin + a6w, y + 0.5);
            y += 6;
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin, y, 'Si une contestation ou un différend ne peuvent être réglés à l\'amiable, le Tribunal de commerce du lieu de résidence du client sera seul compétent pour se prononcer sur le litige.', { maxWidth: maxW });
            y += 8;

            // Fait à...
            doc.text(`Fait en double exemplaire, à Rodez, le ${currentDate}`, 195, y, { align: 'right' });
            y += 10;

            // Signatures
            doc.text('Pour le client,', margin + 10, y);
            doc.text('Pour l\'organisme de formation,', 120, y);
            y += 5;
            doc.text(formation.company_director_name || '', margin + 10, y);
            doc.text('Nathalie JOULIE MORAND, gérante', 120, y);
            y += 5;
            doc.text(formation.company_name || formation.client_name || '', margin + 10, y);

            // Image signature sous le nom de la gérante
            if (this.SIGNATURE_DATA) {
                doc.addImage(this.SIGNATURE_DATA, 'PNG', 120, y + 2, 40, 20);
            }

            this.addNJMFooter(doc);

            const fileName = `Convention - ${formation.company_name || formation.client_name || 'Client'} - ${formation.formation_name || 'Formation'}`;
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');

            return { success: true, name: fileName, blob: pdfBlob, url: pdfUrl };
        } catch (error) {
            console.error('Erreur génération convention:', error);
            alert('Erreur: ' + error.message);
            return { success: false, message: error.message };
        }
    },

    // ==================== CONVENTION DOCX (docxtemplater) ====================

    async generateConventionDocx(formation) {
        try {
            // 1. Charger le template depuis Supabase Storage
            const { data, error } = await supabaseClient.storage
                .from('templates')
                .download('convention_template.docx');

            if (error) throw new Error('Template introuvable dans Supabase Storage : ' + error.message);

            const arrayBuffer = await data.arrayBuffer();
            const zip = new PizZip(arrayBuffer);
            const doc = new window.docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true
            });

            // 2. Préparer les variables
            const startDate = formation.start_date ? new Date(formation.start_date).toLocaleDateString('fr-FR') : '';
            const endDate = formation.end_date ? new Date(formation.end_date).toLocaleDateString('fr-FR') : '';

            let dates = formation.custom_dates || '';
            if (!dates) {
                let sheets = formation.attendance_sheets || [];
                if (typeof sheets === 'string') {
                    try { sheets = JSON.parse(sheets); } catch (e) { sheets = []; }
                }
                if (sheets.length > 0) {
                    const realDates = sheets
                        .filter(s => s.date)
                        .map(s => new Date(s.date).toLocaleDateString('fr-FR'))
                        .sort((a, b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));
                    if (realDates.length > 0) dates = realDates.join(', ');
                }
                if (!dates) {
                    dates = startDate === endDate ? startDate : `${startDate} au ${endDate}`;
                }
            }

            const learnersData = this.parseLearners(formation);
            const learnersList = learnersData.map(l => this.getLearnerName(l)).filter(n => n).join(', ');
            const today = new Date().toLocaleDateString('fr-FR');

            // 3. Remplir le template
            doc.render({
                company_name: formation.company_name || formation.client_name || '',
                company_address: formation.company_address || '',
                company_postal_code: formation.company_postal_code || '',
                company_director_name: formation.company_director_name || '',
                company_director_title: formation.company_director_title || 'dirigeant(e)',
                formation_name: formation.formation_name || '',
                objectives: (formation.objectives || '').replace(/\n/g, '\n'),
                module_content: formation.module_1 || '',
                methods: formation.methods_tools || '',
                trainer: this.getFormateurText(formation),
                dates: dates,
                duration: `${formation.hours_per_learner || formation.total_hours || 0}`,
                training_location: formation.training_location || '',
                learner_count: String(learnersData.length || 1),
                learners: learnersList,
                total_amount: String(formation.total_amount || 0),
                signature_date: today,
            });

            // 4. Générer et télécharger le .docx
            const output = doc.getZip().generate({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });

            const fileName = `Convention - ${formation.company_name || formation.client_name || 'Client'} - ${formation.formation_name || 'Formation'}`;

            const url = URL.createObjectURL(output);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('Convention générée (.docx) !', 'success');
            return { success: true, name: fileName };
        } catch (error) {
            console.error('Erreur génération convention docx:', error);
            showToast('Erreur génération convention : ' + error.message, 'error');
            return { success: false, message: error.message };
        }
    },

    // ==================== CONTRAT DE SOUS-TRAITANCE ====================

    async generateContratSousTraitance(formation) {
        try {
            await this.loadLogo();
            const doc = this.createDoc();
            const margin = 20;
            const maxW = 170;

            const startDate = this.formatDate(formation.start_date);
            const endDate = this.formatDate(formation.end_date);
            const dates = formation.start_date && formation.end_date ? `du ${startDate} au ${endDate}` : '';
            const totalHours = parseFloat(formation.hours_per_learner) || 0;
            const clientName = formation.company_name || formation.client_name || '';

            // ===== PAGE 1 =====
            let y = this.addNJMHeader(doc);

            // Titre
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.COLORS.darkGray);
            doc.text('CONTRAT DE SOUS-TRAITANCE FORMATION', 105, y, { align: 'center' });
            y += 10;

            // Entre les soussignés
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Entre les soussignés :', margin, y); y += 7;

            // 1 - NJM Conseil
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin, y, '1 – NJM Conseil,  1 Le Cassan 12330 Clairvaux d\'Aveyron, 534 935 473 000 15, organisme de formation enregistré sous le numéro 73 12 00 635 12 auprès du Préfet de la région Occitanie,', { maxWidth: maxW });
            doc.text('ci-après « le donneur d\'ordre »', margin, y); y += 8;

            // Et
            doc.setFont('helvetica', 'bold');
            doc.text('Et', margin, y); y += 7;

            // 2 - Sous-traitant (Quentin Durand hardcodé)
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin, y, '2 – Quentin DURAND, 49, rue de la vieille gare 12 850 Onet le Château 89868143200016, organisme de formation enregistré sous le numéro 76120102812 auprès du Préfet de la région Occitanie,', { maxWidth: maxW });
            doc.text('ci-après « le sous-traitant »', margin, y); y += 8;

            doc.text('Il a été convenu ce qui suit :', margin, y); y += 7;

            // Article 1
            doc.setFont('helvetica', 'bold');
            doc.text('Article premier : Nature du contrat', margin, y); y += 6;
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin, y, 'Le présent contrat est conclu dans le cadre d\'une prestation de formation ponctuelle réalisée par le sous-traitant au bénéfice du donneur d\'ordre.', { maxWidth: maxW });
            y += 3;

            // Article 2
            doc.setFont('helvetica', 'bold');
            doc.text('Article 2 : Objet du contrat', margin, y); y += 6;
            doc.setFont('helvetica', 'normal');
            doc.text(`La formation, objet du contrat, est la suivante : « ${formation.formation_name || ''} », pour ${clientName}`, margin, y, { maxWidth: maxW }); y += 5;
            doc.setTextColor(...this.COLORS.orange);
            doc.text(`Date(s) : ${dates}`, margin, y); y += 5;
            doc.setTextColor(...this.COLORS.darkGray);
            doc.text(`Heures :  ${totalHours}h`, margin, y); y += 7;

            // Article 3
            doc.setFont('helvetica', 'bold');
            doc.text('Article 3 : Durée du contrat', margin, y); y += 6;
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin, y, 'Le présent contrat est strictement limité à la prestation de formation visée à l\'article 2. Il cesse de plein droit à son terme.', { maxWidth: maxW });
            y += 3;

            // Article 4
            doc.setFont('helvetica', 'bold');
            doc.text('Article 4 : Obligations du sous-traitant', margin, y); y += 6;
            doc.setFont('helvetica', 'normal');
            doc.text('Le sous-traitant s\'engage à :', margin, y); y += 5;

            const obligations = [
                'Communiquer au donneur d\'ordre une copie de son extrait K-bis / de son immatriculation avant le début de la formation ;',
                'Animer la formation dans le respect des objectifs fixés par le donneur d\'ordre ;',
                'Animer personnellement la formation, sauf en cas de situation exceptionnelle, et uniquement après accord du donneur d\'ordre ;',
                'Communiquer au donneur d\'ordre ses besoins en matériel (projecteur, tableau, photocopies de supports...) au moins 10 jours avant le début de la formation ;',
                'Assurer l\'évaluation des stagiaires à l\'issue de l\'action de formation, afin de permettre au donneur d\'ordre d\'établir les attestations de fin de formation prévues à l\'article L.6353-1 du Code du travail ;',
                'Participer, en tant que de besoin, aux réunions de préparation',
                'Rédiger et diffuser les documents Qualiopi auprès du client et les transmettre au donneur d\'ordre.',
                'Respecter la confidentialité et l\'éthique liée à la formation',
                'Respecter la charte de sous traitance signée avec NJM Conseil',
                'Agir avec loyauté vis-à-vis de NJM Conseil'
            ];
            obligations.forEach(o => {
                y = this._writeText(doc, margin, y, `-${o}`, { maxWidth: maxW });
            });

            this.addNJMFooter(doc);

            // ===== PAGE 2 =====
            doc.addPage();
            y = this.addNJMHeader(doc);

            // Article 5
            doc.setFontSize(9);
            doc.setTextColor(...this.COLORS.darkGray);
            doc.setFont('helvetica', 'bold');
            doc.text('Article 5 : Obligations du donneur d\'ordre', margin, y); y += 6;
            doc.setFont('helvetica', 'normal');
            doc.text('Le donneur d\'ordre s\'engage à :', margin, y); y += 5;

            const obligationsDO = [
                'Confier au sous-traitant la formation prévue à l\'article 2 ;',
                'Prendre en charge la gestion administrative et logistique de la formation ;',
                'Transmettre au sous-traitant une copie des feuilles de présence à faire signer par les stagiaires ;',
                'Transmettre au sous-traitant une copie des questionnaires de satisfaction à faire remplir par les stagiaires à l\'issue de la formation',
                'Prévenir le sous-traitant au moins 3 jours à l\'avance en cas d\'annulation ou de report de la formation'
            ];
            obligationsDO.forEach(o => {
                y = this._writeText(doc, margin, y, `-${o}`, { maxWidth: maxW });
            });
            y += 4;

            // Article 6
            doc.setFont('helvetica', 'bold');
            doc.text('Article 6 : Modalités financières', margin, y); y += 6;
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin, y, 'Le sous-traitant percevra une rémunération de 600 euros nets par journée de formation (7 heures) et remboursement des frais d\'hébergement, de restauration et de déplacement.', { maxWidth: maxW });
            doc.text('Le paiement sera effectué à réception de la facture.', margin, y); y += 7;

            // Article 7
            doc.setFont('helvetica', 'bold');
            doc.text('Article 7 : Dispositions diverses', margin, y); y += 6;
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin, y, '-Le présent contrat ne crée entre les parties aucun lien de subordination, le sous-traitant demeurant libre et responsable du contenu de la formation ;', { maxWidth: maxW });
            y = this._writeText(doc, margin, y, '-Le sous-traitant déclare avoir souscrit une police d\'assurance responsabilité civile professionnelle (RCP) ALLIANZ ASSURANCES', { maxWidth: maxW });
            y = this._writeText(doc, margin, y, '-Le sous-traitant dispose d\'une propriété intellectuelle et/ou artistique sur le contenu de sa formation. Le donneur d\'ordre s\'engage à ne pas reproduire ni diffuser ce contenu sans l\'accord du sous-traitant.', { maxWidth: maxW });
            y = this._writeText(doc, margin, y, '-Le donneur d\'ordre crée et facture les profils Arc En Ciel DISC. Le sous-traitant débriefe les profils Arc En Ciel DISC.', { maxWidth: maxW });
            y += 6;

            // Signatures
            doc.text('Fait à Cassan, le', margin, y); y += 10;
            doc.text('Le donneur d\'ordre,', margin, y);
            doc.text('Le sous-traitant,', 120, y); y += 5;
            doc.setFont('helvetica', 'bold');
            doc.text('Nathalie JOULIE MORAND', margin, y);
            doc.text('Quentin DURAND', 120, y); y += 8;
            doc.setFont('helvetica', 'normal');
            doc.text('NJM Conseil', margin, y);

            this.addNJMFooter(doc);

            const fileName = `Contrat sous-traitance - ${clientName || 'Client'} - ${formation.formation_name || 'Formation'}`;
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');

            return { success: true, name: fileName, blob: pdfBlob, url: pdfUrl };
        } catch (error) {
            console.error('Erreur génération contrat:', error);
            alert('Erreur: ' + error.message);
            return { success: false, message: error.message };
        }
    },

    // ==================== FEUILLE DE PRÉSENCE ====================

    async generateAttendanceSheet(formation) {
        try {
            await this.loadLogo();
            const doc = this.createDoc();
            const margin = 20;
            const pinkColor = this.COLORS.pink;

            let attendanceSheets = [];
            if (formation.attendance_sheets && Array.isArray(formation.attendance_sheets)) {
                attendanceSheets = formation.attendance_sheets;
            } else if (typeof formation.attendance_sheets === 'string') {
                try { attendanceSheets = JSON.parse(formation.attendance_sheets); } catch (e) { }
            }

            const learnersData = this.parseLearners(formation);
            const numDays = attendanceSheets.length || 1;

            for (let jour = 0; jour < numDays; jour++) {
                if (jour > 0) doc.addPage();
                const dayData = attendanceSheets[jour] || {};

                let y = this.addNJMHeader(doc);
                y += 5;

                // Titre "FORMATION : [nom]" centré en orange+bold (comme le modèle)
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...this.COLORS.orange);
                doc.text(`FORMATION : ${formation.formation_name || 'Formation'}`, 105, y, { align: 'center' });
                y += 15;

                // "Feuille de présence- Date [date]"
                const dateStr = dayData.date ? this.formatDate(dayData.date) : '';
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...this.COLORS.darkGray);
                doc.text(`Feuille de présence- Date ${dateStr}`, margin, y);
                y += 5;
                doc.text(`Lieu de la formation : ${formation.training_location || ''}`, margin, y);
                y += 7;

                // Tableau avec bordures ROSES (pink)
                const colWidths = [45, 35, 35, 45];
                const headers = ['NOM  et prénom de\nl\'apprenant', 'Matin\n9h00 à 12h30', 'Après-midi\n14h00 à 17h30', 'Nombre d\'heures par\napprenant'];
                const startX = margin;
                const totalWidth = colWidths.reduce((a, b) => a + b, 0);
                const headerHeight = 12;
                const rowHeight = 14;

                // En-tête
                doc.setDrawColor(...pinkColor);
                doc.setLineWidth(0.4);
                doc.rect(startX, y, totalWidth, headerHeight);
                let xPos = startX;
                headers.forEach((header, i) => {
                    if (i > 0) doc.line(xPos, y, xPos, y + headerHeight);
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...this.COLORS.darkGray);
                    const lines = doc.splitTextToSize(header, colWidths[i] - 4);
                    doc.text(lines, xPos + 2, y + 4);
                    xPos += colWidths[i];
                });
                y += headerHeight;

                // Lignes apprenants (6 lignes minimum)
                const maxLearners = Math.max(learnersData.length, 6);
                for (let i = 0; i < maxLearners; i++) {
                    doc.setDrawColor(...pinkColor);
                    doc.rect(startX, y, totalWidth, rowHeight);

                    let learnerName = '';
                    let hours = '';
                    if (dayData.learners_hours && dayData.learners_hours[i]) {
                        learnerName = dayData.learners_hours[i].learner_name || '';
                        hours = dayData.learners_hours[i].hours ? `${dayData.learners_hours[i].hours}h` : '';
                    } else if (learnersData[i]) {
                        learnerName = this.getLearnerName(learnersData[i]);
                    }

                    xPos = startX;
                    // Nom
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...this.COLORS.darkGray);
                    doc.text(learnerName, xPos + 3, y + 5);
                    xPos += colWidths[0];
                    // Matin (vide pour signature)
                    doc.line(xPos, y, xPos, y + rowHeight);
                    xPos += colWidths[1];
                    // Après-midi (vide pour signature)
                    doc.line(xPos, y, xPos, y + rowHeight);
                    xPos += colWidths[2];
                    // Heures
                    doc.line(xPos, y, xPos, y + rowHeight);
                    doc.text(hours, xPos + 3, y + 5);

                    y += rowHeight;
                }

                // Zone signature formatrice (dans le tableau)
                doc.setDrawColor(...pinkColor);
                doc.rect(startX, y, totalWidth, 30);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text('Nathalie JOULIE-MORAND', startX + 3, y + 6);
                doc.text('Formatrice', startX + 3, y + 11);
                y += 35;

                // Texte règlement intérieur
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text('J\'atteste avoir pris connaissance du règlement intérieur de NJM Conseil.', margin, y);

                this.addNJMFooter(doc);
            }

            const fileName = `Feuille de présence - ${formation.formation_name || 'Formation'}`;
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');

            return { success: true, name: fileName, blob: pdfBlob, url: pdfUrl };
        } catch (error) {
            console.error('Erreur génération feuille de présence:', error);
            alert('Erreur: ' + error.message);
            return { success: false, message: error.message };
        }
    },

    // ==================== CERTIFICAT DE RÉALISATION ====================

    async generateCertificate(formation) {
        try {
            await this.loadLogo();
            await this.loadSignature();
            await this.loadCachet();
            const doc = this.createDoc();
            const margin = 20;
            const maxW = 170;

            const learnersData = this.parseLearners(formation);
            const startDate = this.formatDate(formation.start_date);
            const endDate = this.formatDate(formation.end_date);
            // Priorité : custom_dates > attendance_sheets > fallback start/end
            let dates;
            if (formation.custom_dates) {
                dates = formation.custom_dates;
            } else {
                let sheets = formation.attendance_sheets || [];
                if (typeof sheets === 'string') {
                    try { sheets = JSON.parse(sheets); } catch (e) { sheets = []; }
                }
                if (sheets.length > 0) {
                    const realDates = sheets
                        .filter(s => s.date)
                        .map(s => new Date(s.date).toLocaleDateString('fr-FR'))
                        .sort((a, b) => new Date(a.split('/').reverse().join('-'))
                            - new Date(b.split('/').reverse().join('-')));
                    dates = realDates.length > 0 ? realDates.join(', ') : startDate;
                } else {
                    dates = startDate === endDate ? startDate : `${startDate} au ${endDate}`;
                }
            }
            const lastDate = endDate || startDate || new Date().toLocaleDateString('fr-FR');
            const companyName = formation.company_name || formation.client_name || '';

            let totalHours = learnersData.length > 0
                ? (parseFloat(learnersData[0].hours) || 0)
                : (parseFloat(formation.hours_per_learner) || 0);

            const learners = learnersData.length > 0 ? learnersData : [{ first_name: '', last_name: '' }];

            learners.forEach((learner, index) => {
                const learnerName = this.getLearnerName(learner);
                const learnerHours = learner.hours ? learner.hours : totalHours;

                // ===== PAGE 1 : CERTIFICAT DE REALISATION =====
                if (index > 0) doc.addPage();
                let y = this.addNJMHeader(doc);

                // Titre
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...this.COLORS.darkGray);
                doc.text('CERTIFICAT DE REALISATION', 105, y, { align: 'center' });
                y += 10;

                // Texte attestation
                doc.setFontSize(9);
                doc.setTextColor(...this.COLORS.darkGray);
                doc.setFont('helvetica', 'normal');
                y = this._writeText(doc, margin, y, `Je soussignée, Mme Nathalie JOULIE-MORAND, agissant en qualité de directrice de NJM Conseil, formatrice indépendante sous le numéro SIRET 534 935 473 000 15 et sous le numéro de formateur 73 12 00 635 12 atteste que :`, { maxWidth: maxW });

                // Nom apprenant + formation en bold
                doc.setFont('helvetica', 'normal');
                const certText = `${learnerName}, salarié(e) de l'entreprise ${companyName} a suivi la formation `;
                const formNameBold = formation.formation_name || '';
                const certText2 = `, qui s'est déroulée ${dates.includes(',') ? 'les' : 'du'} ${dates}, pour une durée de ${learnerHours}h.`;

                // Écrire avec formation_name en bold
                y = this._writeText(doc, margin, y, certText + formNameBold + certText2, { maxWidth: maxW });
                y += 4;

                // Assiduité
                doc.setFont('helvetica', 'bold');
                doc.text('Assiduité du stagiaire :', margin, y); y += 5;
                doc.setFont('helvetica', 'normal');
                doc.text(`Durée effectivement suivie par le/la stagiaire : ${learnerHours}h, soit un taux de réalisation de 100%.`, margin, y);
                y += 8;

                // Nature de l'action
                doc.text('Nature de l\'action concourant au développement des compétences :', margin, y); y += 6;
                doc.setDrawColor(...this.COLORS.darkGray);
                doc.rect(margin + 3, y - 3, 3.5, 3.5);
                doc.line(margin + 3.2, y - 1.5, margin + 4.5, y - 0.2);
                doc.line(margin + 4.5, y - 0.2, margin + 6.5, y - 3.5);
                doc.text('Action de formation', margin + 9, y); y += 5;
                doc.rect(margin + 3, y - 3, 3.5, 3.5);
                doc.text('Bilan de compétences', margin + 9, y);
                y += 8;

                // Texte conservation
                y = this._writeText(doc, margin, y, 'Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m\'engage à conserver l\'ensemble des pièces justificatives qui ont permis d\'établir le présent certificat, pendant une durée de 3 ans à compter de la fin de l\'année du dernier paiement.', { maxWidth: maxW });
                y = this._writeText(doc, margin, y, 'En cas de cofinancement des fonds européens, la durée de conservation est étendue conformément aux obligations conventionnelles spécifiques.', { maxWidth: maxW });
                y += 8;

                // Fait à Rodez
                doc.text(`Fait à Rodez, ${lastDate}`, 195, y, { align: 'right' });
                y += 12;

                // Signature
                doc.text('Cachet et signature de la responsable de l\'organisme de formation NJM Conseil', 105, y, { align: 'center' });
                y += 5;
                doc.text('Nathalie JOULIE MORAND', 105, y, { align: 'center' });
                y += 3;

                // Images : signature à gauche, cachet à droite
                if (this.SIGNATURE_DATA) {
                    doc.addImage(this.SIGNATURE_DATA, 'PNG', 55, y, 40, 20);
                }
                if (this.CACHET_DATA) {
                    doc.addImage(this.CACHET_DATA, 'PNG', 115, y, 30, 20);
                }

                this.addNJMFooter(doc);

                // ===== PAGE 2 : ATTESTATION DE FIN DE FORMATION =====
                doc.addPage();
                y = this.addNJMHeader(doc);

                // Titre
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...this.COLORS.orange);
                doc.text('ATTESTATION DE FIN DE FORMATION', 105, y, { align: 'center' });
                y += 6;
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...this.COLORS.darkGray);
                doc.text('Article .6353-1 du Code du Travail', 105, y, { align: 'center' });
                y += 8;

                // Texte attestation
                doc.setFontSize(9);
                y = this._writeText(doc, margin, y, `Je soussignée, Mme Nathalie JOULIE-MORAND, agissant en qualité de directrice de NJM Conseil, formatrice indépendante sous le numéro SIRET 534 935 473 000 15 et sous le numéro de formateur 73 12 00 635 12 atteste que :`, { maxWidth: maxW });

                doc.text(`Le salarié de l'entreprise : ${learnerName} pour ${companyName}.`, margin, y); y += 6;

                y = this._writeText(doc, margin, y, 'A suivi dans le cadre d\'une action de formation professionnelle continue, relevant de l\'article L 6313-1 du code du travail, la formation suivante :', { maxWidth: maxW });
                y += 3;

                // Titre formation centré orange bold dans un rectangle bordure orange
                const formTitle = `Formation : ${formation.formation_name || ''}`;
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                const titleWidth = doc.getTextWidth(formTitle);
                const rectX = 105 - titleWidth / 2 - 4;
                const rectW = titleWidth + 8;
                const rectH = 8;
                doc.setDrawColor(...this.COLORS.orange);
                doc.setLineWidth(0.5);
                doc.rect(rectX, y - 5, rectW, rectH);
                doc.setTextColor(...this.COLORS.orange);
                doc.text(formTitle, 105, y, { align: 'center' });
                y += 12;

                // Bullets
                doc.setFontSize(9);
                doc.setTextColor(...this.COLORS.darkGray);

                // Nature de l'action
                doc.setFillColor(...this.COLORS.darkGray);
                doc.circle(margin + 1.5, y - 1, 1, 'F');
                doc.setFont('helvetica', 'normal');
                doc.text('Nature de l\'action (article L.6313-1 du Code du Travail)', margin + 5, y); y += 5;
                doc.text('-Action d\'acquisition, d\'entretien ou de perfectionnement des connaissances', margin + 5, y); y += 5;

                // Objectifs
                doc.setFillColor(...this.COLORS.darkGray);
                doc.circle(margin + 1.5, y - 1, 1, 'F');
                doc.text('Rappel des objectifs pédagogiques', margin + 5, y); y += 5;
                doc.text('A l\'issue de la formation, le stagiaire sera en capacité d\' :', margin + 5, y); y += 5;
                const objLines = doc.splitTextToSize(formation.objectives || 'RAS', maxW - 10);
                objLines.forEach(line => { doc.text(line, margin + 5, y); y += 4.5; });
                y += 3;

                // Lieu/dates
                doc.setFillColor(...this.COLORS.darkGray);
                doc.circle(margin + 1.5, y - 1, 1, 'F');
                doc.text(`L'action s'est déroulée à ${formation.training_location || ''}, les ${dates},`, margin + 5, y); y += 5;
                doc.text(`-durée de la formation : ${learnerHours} heures`, margin + 5, y); y += 5;
                doc.text(`-durée suivie par le stagiaire : ${learnerHours} heures/stagiaire`, margin + 5, y); y += 5;

                // Résultats évaluation
                doc.setFillColor(...this.COLORS.darkGray);
                doc.circle(margin + 1.5, y - 1, 1, 'F');
                doc.text('Résultats de l\'évaluation des acquis au regard des objectifs de la formation :', margin + 5, y); y += 7;

                // Parser les objectifs individuels
                const objRaw = formation.objectives || 'RAS';
                const objItems = objRaw.split(/\n/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0);

                // Layout : objectifs à GAUCHE, tableau à DROITE (fidèle au modèle)
                const objColW = 100;
                const tblStartX = margin + objColW + 1;
                const evalColW = [23, 23, 24];
                const evalTblW = evalColW.reduce((a, b) => a + b, 0);

                doc.setDrawColor(...this.COLORS.darkGray);
                doc.setLineWidth(0.3);
                doc.setFontSize(8);

                // Header du tableau (à droite)
                let xPos = tblStartX;
                ['Acquis', 'En cours', 'Non acquis'].forEach((label, i) => {
                    doc.rect(xPos, y, evalColW[i], 6);
                    doc.text(label, xPos + 2, y + 4);
                    xPos += evalColW[i];
                });
                y += 6;

                // Lignes : objectif à gauche + cellules à droite (X si acquis renseigné)
                objItems.forEach((obj, objIndex) => {
                    const lines = doc.splitTextToSize(obj, objColW - 5);
                    const rowH = Math.max(8, lines.length * 4 + 2);

                    // Texte objectif à gauche (sans bordure)
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...this.COLORS.darkGray);
                    lines.forEach((line, li) => {
                        doc.text(line, margin + 5, y + 4 + li * 4);
                    });

                    // Cellules à droite (avec bordures + X si acquis renseigné)
                    const acqResult = learner.acquis?.[objIndex] || '';
                    xPos = tblStartX;
                    ['acquis', 'en_cours', 'non_acquis'].forEach((val, i) => {
                        const w = evalColW[i];
                        doc.rect(xPos, y, w, rowH);
                        if (acqResult === val) {
                            doc.setFontSize(10);
                            doc.text('X', xPos + w / 2 - 2, y + rowH / 2 + 1);
                            doc.setFontSize(8);
                        }
                        xPos += w;
                    });

                    y += rowH;
                });
                y += 8;

                // Signature : gauche/droite (fidèle au modèle)
                doc.setFontSize(9);
                doc.text('La formatrice et directrice de', margin, y);
                doc.text(`Fait à Rodez, le ${lastDate}`, 195, y, { align: 'right' });
                y += 5;
                doc.text('NJM Conseil', margin, y);
                y += 3;

                // Image signature (sans cachet sur l'attestation)
                if (this.SIGNATURE_DATA) {
                    doc.addImage(this.SIGNATURE_DATA, 'PNG', margin, y, 40, 20);
                }
                y += 22;
                doc.text('Nathalie Joulié Morand', margin, y);

                // Mention conservation (en rose, comme le modèle)
                const conservY = doc.internal.pageSize.height - 22;
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bolditalic');
                doc.setTextColor(...this.COLORS.pink);
                doc.text('Document à conserver par le stagiaire. Aucun duplicata ne sera délivré.', 105, conservY, { align: 'center' });

                this.addNJMFooter(doc);
            });

            const fileName = `Certificat - ${formation.formation_name || 'Formation'} - ${formation.client_name || 'Client'}`;
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');

            return { success: true, name: fileName, blob: pdfBlob, url: pdfUrl };
        } catch (error) {
            console.error('Erreur génération certificat:', error);
            alert('Erreur: ' + error.message);
            return { success: false, message: error.message };
        }
    },

    /**
     * Convertit un blob PDF en base64
     */
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
};

// Exposer globalement
window.PdfGenerator = PdfGenerator;
