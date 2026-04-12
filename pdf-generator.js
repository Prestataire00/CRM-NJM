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
     * Charge la signature (cachet+signature) depuis Supabase, fallback fichier local
     */
    async loadSignature() {
        const result = await SupabaseData.getSetting('signature');
        this.SIGNATURE_DATA = (result.success && result.data) ? result.data : localStorage.getItem('njm_signature');
        if (!this.SIGNATURE_DATA) {
            try {
                const response = await fetch('cachet-njm.png');
                const blob = await response.blob();
                this.SIGNATURE_DATA = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            } catch (e) { console.warn('Signature non chargee:', e); }
        }
        return this.SIGNATURE_DATA;
    },

    /**
     * Charge le cachet depuis Supabase, fallback fichier local
     */
    async loadCachet() {
        const result = await SupabaseData.getSetting('cachet');
        this.CACHET_DATA = (result.success && result.data) ? result.data : localStorage.getItem('njm_cachet');
        if (!this.CACHET_DATA) {
            try {
                const response = await fetch('cachet-njm.png');
                const blob = await response.blob();
                this.CACHET_DATA = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            } catch (e) { console.warn('Cachet non charge:', e); }
        }
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
    _drawTableHeader(doc, startX, y, headers, colWidths, cellPadding) {
        const totalWidth = colWidths.reduce((a, b) => a + b, 0);
        const rowHeight = 8;
        doc.setDrawColor(...this.COLORS.tableOrange);
        doc.setLineWidth(0.4);
        doc.setFillColor(255, 248, 240);
        doc.rect(startX, y, totalWidth, rowHeight * 2, 'FD');
        let xPos = startX;
        headers.forEach((header, i) => {
            if (i > 0) doc.line(xPos, y, xPos, y + rowHeight * 2);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.COLORS.darkGray);
            const lines = doc.splitTextToSize(header, colWidths[i] - cellPadding * 2);
            doc.text(lines, xPos + cellPadding, y + 4, { maxWidth: colWidths[i] - cellPadding * 2 });
            xPos += colWidths[i];
        });
        return y + rowHeight * 2;
    },

    drawTable(doc, startY, headers, rows, colWidths) {
        const startX = 15;
        const cellPadding = 1.5;
        const lineH = 4;
        const totalWidth = colWidths.reduce((a, b) => a + b, 0);
        const pageH = doc.internal.pageSize.height;
        const bottomMargin = 25;
        const maxContentY = pageH - bottomMargin;

        // Header du tableau
        let y = this._drawTableHeader(doc, startX, startY, headers, colWidths, cellPadding);

        // Pour chaque ligne du tableau
        rows.forEach(row => {
            // Preparer les lignes wrappees par cellule
            const cellLines = row.map((cell, i) =>
                doc.splitTextToSize(String(cell || ''), colWidths[i] - cellPadding * 2)
            );
            const maxLineCount = Math.max(...cellLines.map(l => l.length), 1);

            // Ecrire le contenu ligne par ligne avec gestion de saut de page
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...this.COLORS.darkGray);

            let lineIndex = 0;

            while (lineIndex < maxLineCount) {
                // Combien de lignes de texte tiennent sur cette page ?
                const availableH = maxContentY - y;
                const linesPerPage = Math.max(1, Math.floor(availableH / lineH));
                const endLine = Math.min(lineIndex + linesPerPage, maxLineCount);

                // Dessiner le bloc de contenu
                const blockH = Math.max(8, (endLine - lineIndex) * lineH + 4);

                // Bordures du bloc
                doc.setDrawColor(...this.COLORS.tableOrange);
                doc.setLineWidth(0.4);
                doc.rect(startX, y, totalWidth, blockH);
                let xPos = startX;
                colWidths.forEach((w, ci) => {
                    if (ci > 0) doc.line(xPos, y, xPos, y + blockH);
                    // Ecrire les lignes de cette cellule pour ce bloc
                    const lines = cellLines[ci];
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...this.COLORS.darkGray);
                    for (let li = lineIndex; li < endLine && li < lines.length; li++) {
                        doc.text(lines[li], xPos + cellPadding, y + 4 + (li - lineIndex) * lineH);
                    }
                    xPos += w;
                });

                y += blockH;
                lineIndex = endLine;

                // Si on a encore des lignes et qu'on est en bas de page, saut
                if (lineIndex < maxLineCount) {
                    this.addNJMFooter(doc);
                    doc.addPage();
                    y = this.addNJMHeader(doc);
                    // Redessiner le header du tableau sur la nouvelle page
                    y = this._drawTableHeader(doc, startX, y, headers, colWidths, cellPadding);
                }
            }
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
            y = this._writeText(doc, 15, y, `Public : ${formation.target_audience || 'RAS'}`, { maxWidth: 170, font: 'bold' });
            y += 1;
            y = this._writeText(doc, 15, y, `Pré requis : ${formation.prerequisites || 'RAS'}`, { maxWidth: 170, font: 'bold' });
            y += 3;

            // Tableau principal (comme le modèle)
            const headers = [
                'Durée\n(en heures)',
                'Objectifs pédagogiques mesurables\n(aptitudes et compétences)',
                'Contenu pédagogique\npar module',
                'Méthodes, moyens et outils\npédagogiques'
            ];

            const colWidths = [15, 35, 80, 50];

            const rows = [[
                `${formation.hours_per_learner || 0}h\n\n${formation.number_of_days || 0} ${(formation.number_of_days || 0) <= 1 ? 'jour' : 'jours'}`,
                formation.objectives || 'RAS',
                formation.module_1 || 'Commerce',
                formation.methods_tools || 'RAS'
            ]];

            y = this.drawTable(doc, y, headers, rows, colWidths);
            y += 5;

            // Méthodologie, Le + apporté, Délais d'accès (besoin ~25mm)
            y = this._checkPageBreak(doc, y, 25);
            doc.setFontSize(9);
            doc.setTextColor(...this.COLORS.darkGray);

            // Méthodologie d'évaluation (label bold + valeur normal)
            doc.setFont('helvetica', 'bold');
            const lblMethodo = 'M\u00E9thodologie d\'\u00E9valuation : ';
            doc.text(lblMethodo, 15, y);
            const wMethodo = doc.getTextWidth(lblMethodo);
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, 15 + wMethodo, y, formation.evaluation_methodology || 'RAS', { maxWidth: 170 - wMethodo });
            y += 1;

            // Le + apporté
            doc.setFont('helvetica', 'bold');
            const lblPlus = 'Le + apport\u00E9 : ';
            doc.text(lblPlus, 15, y);
            const wPlus = doc.getTextWidth(lblPlus);
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, 15 + wPlus, y, formation.added_value || 'RAS', { maxWidth: 170 - wPlus });
            y += 1;

            // Délais d'accès
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, 15, y, `D\u00E9lais d'acc\u00E8s : ${formation.access_delays || 'les dates disponibles le sont \u00E0 partir du 6 mois'}`, { maxWidth: 170 });

            this.addNJMFooter(doc);

            const fileName = `Fiche Pédagogique - ${formation.formation_name || 'Formation'}`;
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a'); a.href = pdfUrl; a.download = `${fileName}.pdf`; a.click(); URL.revokeObjectURL(pdfUrl);

            return { success: true, name: fileName, blob: pdfBlob };
        } catch (error) {
            console.error('Erreur génération fiche pédagogique:', error);
            alert('Erreur: ' + error.message);
            return { success: false, message: error.message };
        }
    },

    // ==================== HELPERS COMMUNS ====================

    /**
     * Verifie si on a assez d'espace, sinon saut de page avec footer/header
     * @param {number} needed - espace minimum requis en mm
     * @returns {number} nouvelle position y
     */
    _checkPageBreak(doc, y, needed) {
        const bottomMargin = 25;
        if (y + needed > doc.internal.pageSize.height - bottomMargin) {
            this.addNJMFooter(doc);
            doc.addPage();
            y = this.addNJMHeader(doc);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...this.COLORS.darkGray);
            doc.setDrawColor(...this.COLORS.darkGray);
        }
        return y;
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
                // Reset font/color apres le header (qui laisse la couleur orange)
                doc.setFontSize(fontSize);
                doc.setFont('helvetica', font);
                doc.setTextColor(...(options.color || this.COLORS.darkGray));
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

        // Respecter les \n dans la valeur : splitter d'abord par \n, puis par largeur
        const rawLines = String(value || 'RAS').split('\n');
        const isMultiLine = rawLines.length > 1;
        const allLines = [];
        rawLines.forEach((raw, idx) => {
            const w = (!isMultiLine && idx === 0 && remaining > 30) ? remaining : maxWidth - 5;
            const trimmed = raw.trim();
            if (trimmed) {
                const wrapped = doc.splitTextToSize(trimmed, w);
                wrapped.forEach(l => allLines.push(l));
            }
        });

        if (isMultiLine) {
            // Multi-ligne : contenu en dessous du label
            y += 4.5;
            for (let i = 0; i < allLines.length; i++) {
                if (y > doc.internal.pageSize.height - bottomMargin) {
                    this.addNJMFooter(doc);
                    doc.addPage();
                    y = this.addNJMHeader(doc);
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...this.COLORS.darkGray);
                }
                doc.text(allLines[i], x + 5, y);
                y += 4.5;
            }
        } else {
            // Mono-ligne : valeur a cote du label
            if (allLines.length > 0) {
                doc.text(allLines[0], x + 5 + labelW, y);
            }
            y += 4.5;
            for (let i = 1; i < allLines.length; i++) {
                if (y > doc.internal.pageSize.height - bottomMargin) {
                    this.addNJMFooter(doc);
                    doc.addPage();
                    y = this.addNJMHeader(doc);
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...this.COLORS.darkGray);
                }
                doc.text(allLines[i], x + 5, y);
                y += 4.5;
            }
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
            doc.text(`Repr\u00E9sent\u00E9 par ${formation.contact_title || 'M.'} ${formation.company_director_name || formation.contact_name || ''} agissant en qualit\u00E9 de ${formation.contact_role || 'dirigeant'}`, margin, y); y += 6;
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
            y = this._writeBullet(doc, margin, y, 'Contenus:', formation.content_summary || formation.program_summary || 'RAS', maxW);
            y = this._writeBullet(doc, margin, y, 'Méthodes et moyens pédagogiques:', formation.methods_tools || 'RAS', maxW);
            y = this._writeBullet(doc, margin, y, 'Formateur:', this.getFormateurText(formation), maxW);
            y = this._writeBullet(doc, margin, y, 'Date(s):', dates, maxW);
            y = this._writeBullet(doc, margin, y, 'Durée:', `${formation.hours_per_learner || 0} heures.`, maxW);
            y = this._writeBullet(doc, margin, y, 'Lieu:', formation.training_location || '', maxW);
            y = this._writeBullet(doc, margin, y, 'Effectif formé:', `${learnersData.length} personne(s), ${learnersNames || ''}`, maxW);
            y += 1;
            y = this._writeBullet(doc, margin, y, 'Modalités de suivi et appréciation des résultats:', 'fiche de présence émargée, accompagnement rectificatif et évaluation des productions de l\'apprenant.', maxW);

            y += 6;

            // Article 2 (besoin ~20mm minimum pour titre + premier contenu)
            y = this._checkPageBreak(doc, y, 20);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.COLORS.darkGray);
            doc.setDrawColor(...this.COLORS.darkGray);
            doc.text('Article 2- Description de la formation:', margin, y);
            const a2w = doc.getTextWidth('Article 2- Description de la formation:');
            doc.line(margin, y + 0.5, margin + a2w, y + 0.5);
            y += 5;

            // Objectifs (besoin ~15mm pour sous-titre + au moins 1 ligne)
            y = this._checkPageBreak(doc, y, 15);
            doc.setFont('helvetica', 'normal');
            doc.text('Objectifs :', margin, y); y += 4;
            (formation.objectives || 'RAS').split('\n').filter(l => l.trim()).forEach(line => {
                const t = line.trim();
                const prefix = t.startsWith('-') ? '   ' : '-   ';
                y = this._writeText(doc, margin + 3, y, `${prefix}${t}`, { maxWidth: maxW - 3 });
            });
            y += 2;

            // Contenus (besoin ~15mm)
            y = this._checkPageBreak(doc, y, 15);
            doc.setFont('helvetica', 'normal');
            doc.text('Contenus :', margin, y); y += 4;
            (formation.module_1 || 'RAS').split('\n').filter(l => l.trim()).forEach(line => {
                const t = line.trim();
                const prefix = t.startsWith('-') ? '   ' : '-   ';
                y = this._writeText(doc, margin + 3, y, `${prefix}${t}`, { maxWidth: maxW - 3 });
            });
            y += 2;

            // Modalites (besoin ~15mm)
            y = this._checkPageBreak(doc, y, 15);
            doc.setFont('helvetica', 'normal');
            doc.text('Modalit\u00E9s :', margin, y); y += 4;
            (formation.methods_tools || 'RAS').split('\n').filter(l => l.trim()).forEach(line => {
                const t = line.trim();
                const prefix = t.startsWith('-') ? '   ' : '-   ';
                y = this._writeText(doc, margin + 3, y, `${prefix}${t}`, { maxWidth: maxW - 3 });
            });
            y += 2;

            // Mode d'evaluation (besoin ~15mm)
            y = this._checkPageBreak(doc, y, 15);
            doc.setFont('helvetica', 'normal');
            doc.text('Mode d\'évaluation des acquis :', margin, y); y += 4;
            doc.text('-   Questionnaire individuel en ligne en fin de formation', margin + 3, y); y += 8;

            // Article 3 (besoin ~20mm)
            y = this._checkPageBreak(doc, y, 20);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.COLORS.darkGray);
            doc.setDrawColor(...this.COLORS.darkGray);
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

            // Article 4 (besoin ~20mm)
            y = this._checkPageBreak(doc, y, 20);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.COLORS.darkGray);
            doc.setDrawColor(...this.COLORS.darkGray);
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

            // Article 5 (besoin ~20mm)
            y = this._checkPageBreak(doc, y, 20);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.COLORS.darkGray);
            doc.setDrawColor(...this.COLORS.darkGray);
            doc.text('Article 5- Date d\'effet et durée de la convention :', margin, y);
            const a5w = doc.getTextWidth('Article 5- Date d\'effet et durée de la convention :');
            doc.line(margin, y + 0.5, margin + a5w, y + 0.5);
            y += 6;
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin, y, 'La présente convention prend effet à compter de la date de signature de la présente convention pour s\'achever à la fin de la période de formation objet de la présente convention.', { maxWidth: maxW });
            y += 4;

            // Article 6 (besoin ~20mm)
            y = this._checkPageBreak(doc, y, 20);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...this.COLORS.darkGray);
            doc.setDrawColor(...this.COLORS.darkGray);
            doc.text('Article 6- Différends éventuels :', margin, y);
            const a6w = doc.getTextWidth('Article 6- Différends éventuels :');
            doc.line(margin, y + 0.5, margin + a6w, y + 0.5);
            y += 6;
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin, y, 'Si une contestation ou un différend ne peuvent être réglés à l\'amiable, le Tribunal de commerce du lieu de résidence du client sera seul compétent pour se prononcer sur le litige.', { maxWidth: maxW });
            y += 8;

            // Fait à... (besoin ~50mm pour signatures)
            y = this._checkPageBreak(doc, y, 50);
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

            const fileName = `Convention - ${formation.formation_name || 'Formation'}`;
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a'); a.href = pdfUrl; a.download = `${fileName}.pdf`; a.click(); URL.revokeObjectURL(pdfUrl);

            return { success: true, name: fileName, blob: pdfBlob };
        } catch (error) {
            console.error('Erreur génération convention:', error);
            alert('Erreur: ' + error.message);
            return { success: false, message: error.message };
        }
    },

    // ==================== CONTRAT DE SOUS-TRAITANCE ====================

    async generateContratSousTraitance(formation) {
        try {
            await this.loadLogo();
            await this.loadSignature();
            const doc = this.createDoc();
            const margin = 20;
            const maxW = 170;

            const startDate = this.formatDate(formation.start_date);
            const endDate = this.formatDate(formation.end_date);
            const dates = formation.custom_dates || (formation.start_date && formation.end_date ? `du ${startDate} au ${endDate}` : '');
            const totalHours = parseFloat(formation.hours_per_learner) || 0;
            const clientName = formation.company_name || formation.client_name || '';
            const subName = `${formation.subcontractor_first_name || ''} ${formation.subcontractor_last_name || ''}`.trim() || 'Sous-traitant';
            const subAddress = formation.subcontractor_address || '';
            const subSiret = formation.subcontractor_siret || '';
            const subNda = formation.subcontractor_nda || '';
            const signatureDate = new Date().toLocaleDateString('fr-FR');

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

            // 2 - Sous-traitant (dynamique)
            doc.setFont('helvetica', 'normal');
            y = this._writeText(doc, margin, y, `2 \u2013 ${subName}, ${subAddress} ${subSiret}, organisme de formation enregistr\u00E9 sous le num\u00E9ro ${subNda} aupr\u00E8s du Pr\u00E9fet de la r\u00E9gion Occitanie,`, { maxWidth: maxW });
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
            y = this._writeText(doc, margin, y, `La formation, objet du contrat, est la suivante : \u00AB ${formation.formation_name || ''} \u00BB, pour ${clientName}`, { maxWidth: maxW });
            doc.text(`Date(s) : ${dates}`, margin, y); y += 5;
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
            const subPrice = formation.subcontractor_price || formation.price || '600';
            y = this._writeText(doc, margin, y, `Le sous-traitant percevra une r\u00E9mun\u00E9ration de ${subPrice} euros nets par journ\u00E9e de formation (7 heures) et remboursement des frais d'h\u00E9bergement, de restauration et de d\u00E9placement.`, { maxWidth: maxW });
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

            // Signatures (besoin ~60mm pour signature + cachet)
            y = this._checkPageBreak(doc, y, 60);
            doc.text(`Fait \u00E0 Cassan, le ${signatureDate}`, margin, y); y += 10;
            doc.text('Le donneur d\'ordre,', margin, y);
            doc.text('Le sous-traitant,', 120, y); y += 5;
            doc.setFont('helvetica', 'bold');
            doc.text('Nathalie JOULIE MORAND', margin, y);
            doc.text(subName, 120, y); y += 8;
            doc.setFont('helvetica', 'normal');
            doc.text('NJM Conseil', margin, y);

            // Cachet/signature NJM
            if (this.SIGNATURE_DATA) {
                doc.addImage(this.SIGNATURE_DATA, 'PNG', margin, y + 3, 40, 28);
            }

            this.addNJMFooter(doc);

            const fileName = `Contrat sous-traitance - ${formation.formation_name || 'Formation'}`;
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a'); a.href = pdfUrl; a.download = `${fileName}.pdf`; a.click(); URL.revokeObjectURL(pdfUrl);

            return { success: true, name: fileName, blob: pdfBlob };
        } catch (error) {
            console.error('Erreur génération contrat:', error);
            alert('Erreur: ' + error.message);
            return { success: false, message: error.message };
        }
    },

    // ==================== HELPERS FEUILLE DE PRÉSENCE ====================

    parseCustomDates(formation) {
        if (formation.custom_dates) {
            const parts = formation.custom_dates.split(/[,;]/).map(s => s.trim()).filter(Boolean);
            const dates = parts.map(p => {
                const match = p.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
                return null;
            }).filter(Boolean);
            if (dates.length > 0) return dates;
        }
        let numDays = parseInt(formation.number_of_days) || 0;
        if (!numDays && formation.start_date && formation.end_date) {
            const start = new Date(formation.start_date);
            const end = new Date(formation.end_date);
            const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
            numDays = diffDays > 0 ? diffDays : 1;
        }
        if (!numDays) numDays = 1;
        if (formation.start_date) {
            const start = new Date(formation.start_date);
            return Array.from({ length: numDays }, (_, i) => {
                const d = new Date(start);
                d.setDate(d.getDate() + i);
                return d.toISOString().split('T')[0];
            });
        }
        return [''];
    },

    buildAttendanceSheets(formation) {
        let sheets = formation.attendance_sheets || [];
        if (typeof sheets === 'string') { try { sheets = JSON.parse(sheets); } catch (e) { sheets = []; } }
        if (sheets.length > 0) return sheets;

        const learners = this.parseLearners(formation);
        const totalH = parseFloat(formation.hours_per_learner) || 0;
        const dates = this.parseCustomDates(formation);
        const hPerDay = dates.length > 0 ? Math.round(totalH / dates.length) : totalH;

        return dates.map((d, i) => ({
            day: i + 1,
            date: d,
            learners_hours: learners.map(l => ({
                learner_name: this.getLearnerName(l),
                hours: hPerDay
            }))
        }));
    },

    // ==================== FEUILLE DE PRÉSENCE ====================

    async generateAttendanceSheet(formation) {
        try {
            await this.loadLogo();
            await this.loadSignature();
            const doc = this.createDoc();
            const margin = 20;
            const pinkColor = this.COLORS.pink;

            const attendanceSheets = this.buildAttendanceSheets(formation);
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
                    // Check saut de page — si declenche, redessiner le header tableau
                    const prevY = y;
                    y = this._checkPageBreak(doc, y, rowHeight);
                    if (y !== prevY) {
                        // Redessiner le header du tableau sur la nouvelle page
                        doc.setDrawColor(...pinkColor);
                        doc.setLineWidth(0.4);
                        doc.rect(startX, y, totalWidth, headerHeight);
                        let hxPos = startX;
                        headers.forEach((header, hi) => {
                            if (hi > 0) doc.line(hxPos, y, hxPos, y + headerHeight);
                            doc.setFontSize(8);
                            doc.setFont('helvetica', 'bold');
                            doc.setTextColor(...this.COLORS.darkGray);
                            const hLines = doc.splitTextToSize(header, colWidths[hi] - 4);
                            doc.text(hLines, hxPos + 2, y + 4);
                            hxPos += colWidths[hi];
                        });
                        y += headerHeight;
                    }
                    doc.setDrawColor(...pinkColor);
                    doc.setLineWidth(0.4);
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

                // Zone signature formatrice (besoin ~35mm)
                y = this._checkPageBreak(doc, y, 35);
                const sigHeight = 30;
                doc.setDrawColor(...pinkColor);
                doc.rect(startX, y, totalWidth, sigHeight);
                // Separateurs de colonnes
                xPos = startX + colWidths[0];
                doc.line(xPos, y, xPos, y + sigHeight);
                xPos += colWidths[1];
                doc.line(xPos, y, xPos, y + sigHeight);
                xPos += colWidths[2];
                doc.line(xPos, y, xPos, y + sigHeight);
                // Texte dans la 1ere colonne
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...this.COLORS.darkGray);
                doc.text('Nathalie JOULIE-MORAND', startX + 3, y + 6);
                doc.text('Formatrice', startX + 3, y + 11);
                // Signature dans les colonnes Matin et Apres-midi
                if (this.SIGNATURE_DATA) {
                    const matinX = startX + colWidths[0] + 2;
                    const apremX = startX + colWidths[0] + colWidths[1] + 2;
                    doc.addImage(this.SIGNATURE_DATA, 'PNG', matinX, y + 2, 30, 22);
                    doc.addImage(this.SIGNATURE_DATA, 'PNG', apremX, y + 2, 30, 22);
                }
                y += sigHeight + 5;

                // Texte règlement intérieur
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text('J\'atteste avoir pris connaissance du règlement intérieur de NJM Conseil.', margin, y);

                this.addNJMFooter(doc);
            }

            const fileName = `Feuille de présence - ${formation.formation_name || 'Formation'}`;
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a'); a.href = pdfUrl; a.download = `${fileName}.pdf`; a.click(); URL.revokeObjectURL(pdfUrl);

            return { success: true, name: fileName, blob: pdfBlob };
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

                // Fait à Rodez (besoin ~45mm pour signature + cachet)
                y = this._checkPageBreak(doc, y, 45);
                doc.text(`Fait à Rodez, ${lastDate}`, 195, y, { align: 'right' });
                y += 12;

                // Signature
                doc.text('Cachet et signature de la responsable de l\'organisme de formation NJM Conseil', 105, y, { align: 'center' });
                y += 5;
                doc.text('Nathalie JOULIE MORAND', 105, y, { align: 'center' });
                y += 3;

                // Cachet+signature (image unique)
                if (this.SIGNATURE_DATA) {
                    doc.addImage(this.SIGNATURE_DATA, 'PNG', 75, y, 50, 28);
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
                const objText = formation.objectives || 'RAS';
                objText.split('\n').filter(l => l.trim().length > 0).forEach(objLine => {
                    const wrapped = doc.splitTextToSize(objLine.trim(), maxW - 10);
                    wrapped.forEach(line => {
                        if (y > doc.internal.pageSize.height - 25) {
                            this.addNJMFooter(doc);
                            doc.addPage();
                            y = this.addNJMHeader(doc);
                            doc.setFontSize(9);
                            doc.setFont('helvetica', 'normal');
                            doc.setTextColor(...this.COLORS.darkGray);
                        }
                        doc.text(line, margin + 5, y);
                        y += 4.5;
                    });
                });
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
                    y = this._checkPageBreak(doc, y, rowH + 2);

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

                // Signature : gauche/droite (besoin ~45mm)
                y = this._checkPageBreak(doc, y, 45);
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

            const fileName = `Certificat - ${formation.formation_name || 'Formation'}`;
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a'); a.href = pdfUrl; a.download = `${fileName}.pdf`; a.click(); URL.revokeObjectURL(pdfUrl);

            return { success: true, name: fileName, blob: pdfBlob };
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
