// CRM Data Management
const CRMData = {
    // Initialize data structure
    init() {
        if (!localStorage.getItem('njm_crm_data')) {
            const initialData = {
                learners: [],
                formations: [],
                veille: { formation: [], metier: [], legal: [] },
                bpf: [],
                pedagogical_library: { vente: [], marketing: [], reseaux_sociaux: [] },
                templates_library: {
                    pedagogiques: [],
                    competences: [],
                    formateurs: []
                },
                users: [
                    { id: 1, name: 'Admin', email: 'admin@njm.fr', role: 'admin', created: new Date().toISOString() }
                ],
                settings: {
                    company: { name: 'NJM Conseil', siret: '', nda: '', address: '', contact: '' },
                    logo: 'logo-njm.png',
                    theme: 'default',
                    cgv: ''
                }
            };
            localStorage.setItem('njm_crm_data', JSON.stringify(initialData));
        }
    },

    // Get all data
    getData() {
        return JSON.parse(localStorage.getItem('njm_crm_data') || '{}');
    },

    // Save data
    saveData(data) {
        localStorage.setItem('njm_crm_data', JSON.stringify(data));
    },

    // Get current fiscal year (Oct - Sep)
    getFiscalYear() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        return currentMonth >= 10 ? currentYear : currentYear - 1;
    },

    // Get learners count for current fiscal year
    get LearnersCount() {
        const data = this.getData();
        const fiscalYear = this.getFiscalYear();
        const startDate = new Date(fiscalYear, 9, 1); // Oct 1
        const endDate = new Date(fiscalYear + 1, 8, 30); // Sep 30
        
        return data.learners.filter(learner => {
            const learnerDate = new Date(learner.enrollmentDate);
            return learnerDate >= startDate && learnerDate <= endDate;
        }).length;
    },

    // Add learner
    addLearner(learner) {
        const data = this.getData();
        learner.id = Date.now();
        learner.enrollmentDate = new Date().toISOString();
        data.learners.push(learner);
        this.saveData(data);
    },

    // Add formation
    addFormation(formation) {
        const data = this.getData();
        formation.id = Date.now();
        formation.createdAt = new Date().toISOString();
        formation.documents = [];
        data.formations.push(formation);
        this.saveData(data);
        return formation.id;
    },

    // Add document to formation
    addFormationDocument(formationId, document) {
        const data = this.getData();
        const formation = data.formations.find(f => f.id === formationId);
        if (formation) {
            document.id = Date.now();
            document.uploadedAt = new Date().toISOString();
            formation.documents.push(document);
            this.saveData(data);
        }
    },

    // Add veille
    addVeille(type, item) {
        const data = this.getData();
        item.id = Date.now();
        item.createdAt = new Date().toISOString();
        item.read = false;
        data.veille[type].push(item);
        this.saveData(data);
    },

    // Toggle veille read status
    toggleVeilleRead(type, id) {
        const data = this.getData();
        const item = data.veille[type].find(v => v.id === id);
        if (item) {
            item.read = !item.read;
            this.saveData(data);
        }
    },

    // Add BPF
    addBPF(bpf) {
        const data = this.getData();
        bpf.id = Date.now();
        bpf.createdAt = new Date().toISOString();
        data.bpf.push(bpf);
        this.saveData(data);
    },

    // Add to pedagogical library
    addToPedagogicalLibrary(category, item) {
        const data = this.getData();
        item.id = Date.now();
        item.uploadedAt = new Date().toISOString();
        data.pedagogical_library[category].push(item);
        this.saveData(data);
    },

    // Transfer to client space
    transferToClientSpace(documentId, clientId) {
        // This would integrate with client space system
        console.log(`Transferring document ${documentId} to client ${clientId}`);
        return true;
    },

    // Add template
    addTemplate(category, template) {
        const data = this.getData();
        template.id = Date.now();
        template.uploadedAt = new Date().toISOString();
        if (category === 'formateurs' && template.expiryDate) {
            template.reminderSet = true;
        }
        data.templates_library[category].push(template);
        this.saveData(data);
    },

    // Check expiring documents
    getExpiringDocuments() {
        const data = this.getData();
        const now = new Date();
        const oneMonthFromNow = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

        return data.templates_library.formateurs.filter(doc => {
            if (doc.expiryDate) {
                const expiryDate = new Date(doc.expiryDate);
                return expiryDate <= oneMonthFromNow && expiryDate >= now;
            }
            return false;
        });
    },

    // Add user
    addUser(user) {
        const data = this.getData();
        user.id = Date.now();
        user.created = new Date().toISOString();
        data.users.push(user);
        this.saveData(data);
    },

    // Update settings
    updateSettings(newSettings) {
        const data = this.getData();
        data.settings = { ...data.settings, ...newSettings };
        this.saveData(data);
    },

    // Get dashboard stats
    getDashboardStats() {
        const data = this.getData();
        const fiscalYear = this.getFiscalYear();
        
        return {
            learnersCount: this.LearnersCount || 0,
            formationsCompleted: data.formations.filter(f => f.status === 'completed').length,
            formationsInProgress: data.formations.filter(f => f.status === 'in_progress').length,
            clientAccesses: data.users.filter(u => u.role === 'client' && u.lastLogin).length
        };
    }
};

// Initialize on load
CRMData.init();
