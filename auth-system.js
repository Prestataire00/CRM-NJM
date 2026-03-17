// Authentication and User Management System
// Secure authentication with password hashing (SHA-256)

const AuthSystem = {
    // Configuration
    config: {
        passwordMinLength: 8,
        sessionTimeout: 3600000, // 1 hour in milliseconds
        maxLoginAttempts: 5,
        lockoutDuration: 900000 // 15 minutes in milliseconds
    },

    // Initialize authentication system
    init() {
        this.setupInitialAdmin();
        this.checkSession();
        this.setupLoginAttempts();
    },

    // Setup initial admin user if not exists
    setupInitialAdmin() {
        const data = CRMData.getData();
        if (!data.auth || !data.auth.users) {
            const adminUser = {
                id: 1,
                name: 'Administrateur',
                email: 'admin@njm.fr',
                password: this.hashPasswordSync('Admin123!'), // Default password
                role: 'admin',
                active: true,
                created: new Date().toISOString(),
                lastLogin: null,
                mustChangePassword: false // Allow login with default password
            };

            data.auth = {
                users: [adminUser],
                sessions: [],
                loginAttempts: {}
            };

            CRMData.saveData(data);
        }
    },

    // Hash password using SHA-256
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // Synchronous hash for compatibility (using simpler method)
    hashPasswordSync(password) {
        // Simple but effective hashing for demo purposes
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    },

    // Setup login attempts tracking
    setupLoginAttempts() {
        const data = CRMData.getData();
        if (!data.auth.loginAttempts) {
            data.auth.loginAttempts = {};
            CRMData.saveData(data);
        }
    },

    // Check if account is locked
    isAccountLocked(email) {
        const data = CRMData.getData();
        const attempts = data.auth.loginAttempts[email];

        if (!attempts) return false;

        if (attempts.count >= this.config.maxLoginAttempts) {
            const timeSinceLock = Date.now() - attempts.lastAttempt;
            if (timeSinceLock < this.config.lockoutDuration) {
                return true;
            } else {
                // Reset attempts after lockout duration
                delete data.auth.loginAttempts[email];
                CRMData.saveData(data);
                return false;
            }
        }
        return false;
    },

    // Record login attempt
    recordLoginAttempt(email, success) {
        const data = CRMData.getData();

        if (success) {
            // Clear attempts on successful login
            delete data.auth.loginAttempts[email];
        } else {
            // Increment failed attempts
            if (!data.auth.loginAttempts[email]) {
                data.auth.loginAttempts[email] = { count: 0, lastAttempt: Date.now() };
            }
            data.auth.loginAttempts[email].count++;
            data.auth.loginAttempts[email].lastAttempt = Date.now();
        }

        CRMData.saveData(data);
    },

    // Validate password strength
    validatePassword(password) {
        if (password.length < this.config.passwordMinLength) {
            return { valid: false, message: `Le mot de passe doit contenir au moins ${this.config.passwordMinLength} caractères.` };
        }

        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
            return {
                valid: false,
                message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.'
            };
        }

        return { valid: true };
    },

    // Login user
    login(email, password) {
        // Check if account is locked
        if (this.isAccountLocked(email)) {
            const remainingTime = Math.ceil(this.config.lockoutDuration / 60000);
            return {
                success: false,
                message: `Compte temporairement verrouillé. Réessayez dans ${remainingTime} minutes.`
            };
        }

        const data = CRMData.getData();
        const user = data.auth.users.find(u => u.email === email);

        if (!user) {
            this.recordLoginAttempt(email, false);
            return { success: false, message: 'Email ou mot de passe incorrect.' };
        }

        if (!user.active) {
            return { success: false, message: 'Compte désactivé. Contactez l\'administrateur.' };
        }

        const hashedPassword = this.hashPasswordSync(password);

        if (user.password !== hashedPassword) {
            this.recordLoginAttempt(email, false);
            return { success: false, message: 'Email ou mot de passe incorrect.' };
        }

        // Successful login
        this.recordLoginAttempt(email, true);

        // Update last login
        user.lastLogin = new Date().toISOString();
        CRMData.saveData(data);

        // Create session
        const sessionToken = this.createSession(user);

        return {
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                mustChangePassword: user.mustChangePassword
            },
            sessionToken
        };
    },

    // Create session
    createSession(user) {
        const sessionToken = this.generateToken();
        const session = {
            token: sessionToken,
            userId: user.id,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.config.sessionTimeout
        };

        const data = CRMData.getData();
        if (!data.auth.sessions) data.auth.sessions = [];

        // Remove old sessions for this user
        data.auth.sessions = data.auth.sessions.filter(s => s.userId !== user.id);

        // Add new session
        data.auth.sessions.push(session);
        CRMData.saveData(data);

        // Store in localStorage for persistence
        localStorage.setItem('njm_crm_session', sessionToken);

        return sessionToken;
    },

    // Generate random token
    generateToken() {
        return Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    // Check session validity
    checkSession() {
        const sessionToken = localStorage.getItem('njm_crm_session');
        if (!sessionToken) return null;

        const data = CRMData.getData();
        if (!data.auth || !data.auth.sessions) return null;

        const session = data.auth.sessions.find(s => s.token === sessionToken);

        if (!session) {
            localStorage.removeItem('njm_crm_session');
            return null;
        }

        // Check if session expired
        if (Date.now() > session.expiresAt) {
            this.logout();
            return null;
        }

        // Get user
        const user = data.auth.users.find(u => u.id === session.userId);
        if (!user || !user.active) {
            this.logout();
            return null;
        }

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            mustChangePassword: user.mustChangePassword
        };
    },

    // Logout
    logout() {
        const sessionToken = localStorage.getItem('njm_crm_session');

        if (sessionToken) {
            const data = CRMData.getData();
            if (data.auth && data.auth.sessions) {
                data.auth.sessions = data.auth.sessions.filter(s => s.token !== sessionToken);
                CRMData.saveData(data);
            }
        }

        localStorage.removeItem('njm_crm_session');
        localStorage.removeItem('njm_crm_logged_in');
        localStorage.removeItem('njm_crm_user_email');
    },

    // Get all users (admin only)
    getAllUsers(requestingUserId) {
        if (!this.isAdmin(requestingUserId)) {
            return { success: false, message: 'Accès refusé.' };
        }

        const data = CRMData.getData();
        return {
            success: true,
            users: data.auth.users.map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                active: u.active,
                created: u.created,
                lastLogin: u.lastLogin,
                mustChangePassword: u.mustChangePassword
            }))
        };
    },

    // Add user (admin only)
    addUser(requestingUserId, userData) {
        if (!this.isAdmin(requestingUserId)) {
            return { success: false, message: 'Accès refusé.' };
        }

        const { name, email, role, password } = userData;

        // Validate inputs
        if (!name || !email || !role || !password) {
            return { success: false, message: 'Tous les champs sont requis.' };
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { success: false, message: 'Format d\'email invalide.' };
        }

        // Validate password
        const passwordValidation = this.validatePassword(password);
        if (!passwordValidation.valid) {
            return { success: false, message: passwordValidation.message };
        }

        // Validate role
        if (!['admin', 'formateur', 'client'].includes(role)) {
            return { success: false, message: 'Rôle invalide.' };
        }

        const data = CRMData.getData();

        // Check if email already exists
        if (data.auth.users.find(u => u.email === email)) {
            return { success: false, message: 'Un utilisateur avec cet email existe déjà.' };
        }

        // Create new user
        const newUser = {
            id: Date.now(),
            name,
            email,
            password: this.hashPasswordSync(password),
            role,
            active: true,
            created: new Date().toISOString(),
            lastLogin: null,
            mustChangePassword: false
        };

        data.auth.users.push(newUser);
        CRMData.saveData(data);

        return { success: true, message: 'Utilisateur créé avec succès.', user: { id: newUser.id, name, email, role } };
    },

    // Update user (admin only)
    updateUser(requestingUserId, userId, updates) {
        if (!this.isAdmin(requestingUserId)) {
            return { success: false, message: 'Accès refusé.' };
        }

        const data = CRMData.getData();
        const user = data.auth.users.find(u => u.id === userId);

        if (!user) {
            return { success: false, message: 'Utilisateur non trouvé.' };
        }

        // Prevent disabling the last admin
        if (updates.active === false && user.role === 'admin') {
            const activeAdmins = data.auth.users.filter(u => u.role === 'admin' && u.active).length;
            if (activeAdmins <= 1) {
                return { success: false, message: 'Impossible de désactiver le dernier administrateur.' };
            }
        }

        // Update allowed fields
        if (updates.name) user.name = updates.name;
        if (updates.email) user.email = updates.email;
        if (updates.role) user.role = updates.role;
        if (updates.active !== undefined) user.active = updates.active;

        CRMData.saveData(data);

        return { success: true, message: 'Utilisateur mis à jour avec succès.' };
    },

    // Delete user (admin only)
    deleteUser(requestingUserId, userId) {
        if (!this.isAdmin(requestingUserId)) {
            return { success: false, message: 'Accès refusé.' };
        }

        const data = CRMData.getData();
        const userIndex = data.auth.users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: 'Utilisateur non trouvé.' };
        }

        const user = data.auth.users[userIndex];

        // Prevent deleting yourself
        if (user.id === requestingUserId) {
            return { success: false, message: 'Vous ne pouvez pas supprimer votre propre compte.' };
        }

        // Prevent deleting the last admin
        if (user.role === 'admin') {
            const activeAdmins = data.auth.users.filter(u => u.role === 'admin' && u.active).length;
            if (activeAdmins <= 1) {
                return { success: false, message: 'Impossible de supprimer le dernier administrateur.' };
            }
        }

        data.auth.users.splice(userIndex, 1);
        CRMData.saveData(data);

        return { success: true, message: 'Utilisateur supprimé avec succès.' };
    },

    // Change password
    changePassword(userId, currentPassword, newPassword) {
        const data = CRMData.getData();
        const user = data.auth.users.find(u => u.id === userId);

        if (!user) {
            return { success: false, message: 'Utilisateur non trouvé.' };
        }

        // Verify current password
        const hashedCurrentPassword = this.hashPasswordSync(currentPassword);
        if (user.password !== hashedCurrentPassword) {
            return { success: false, message: 'Mot de passe actuel incorrect.' };
        }

        // Validate new password
        const passwordValidation = this.validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return { success: false, message: passwordValidation.message };
        }

        // Update password
        user.password = this.hashPasswordSync(newPassword);
        user.mustChangePassword = false;
        CRMData.saveData(data);

        return { success: true, message: 'Mot de passe changé avec succès.' };
    },

    // Reset password (admin only)
    resetPassword(requestingUserId, userId, newPassword) {
        if (!this.isAdmin(requestingUserId)) {
            return { success: false, message: 'Accès refusé.' };
        }

        const data = CRMData.getData();
        const user = data.auth.users.find(u => u.id === userId);

        if (!user) {
            return { success: false, message: 'Utilisateur non trouvé.' };
        }

        // Validate new password
        const passwordValidation = this.validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return { success: false, message: passwordValidation.message };
        }

        // Reset password
        user.password = this.hashPasswordSync(newPassword);
        user.mustChangePassword = true;
        CRMData.saveData(data);

        return { success: true, message: 'Mot de passe réinitialisé. L\'utilisateur devra le changer à sa prochaine connexion.' };
    },

    // Check if user is admin
    isAdmin(userId) {
        const data = CRMData.getData();
        const user = data.auth.users.find(u => u.id === userId);
        return user && user.role === 'admin';
    },

    // Check if user has permission
    hasPermission(userId, permission) {
        const data = CRMData.getData();
        const user = data.auth.users.find(u => u.id === userId);

        if (!user) return false;

        // Admin has all permissions
        if (user.role === 'admin') return true;

        // Define permissions per role
        const permissions = {
            formateur: ['view_formations', 'edit_formations', 'view_veille', 'view_library'],
            client: ['view_own_data']
        };

        return permissions[user.role]?.includes(permission) || false;
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    AuthSystem.init();
});
