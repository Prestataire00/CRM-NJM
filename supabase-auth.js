// Supabase Authentication System
// Remplace auth-system.js avec Supabase Auth

const SupabaseAuth = {
    // Configuration
    config: {
        passwordMinLength: 8,
        sessionTimeout: 3600000, // 1 hour in milliseconds
        maxLoginAttempts: 5,
        lockoutDuration: 900000 // 15 minutes in milliseconds
    },

    // Initialize authentication system
    async init() {
        await this.checkSession();
        this.setupSessionRefresh();
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

    // Login user with Supabase Auth
    async login(email, password) {
        try {
            // Sign in with Supabase
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('Login error:', error);
                return { success: false, message: 'Email ou mot de passe incorrect.' };
            }

            // Get user profile
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError) {
                console.error('Profile error:', profileError);
                return { success: false, message: 'Erreur lors de la récupération du profil.' };
            }

            if (!profile.active) {
                await this.logout();
                return { success: false, message: 'Compte désactivé. Contactez l\'administrateur.' };
            }

            // Update last login
            await supabaseClient
                .from('profiles')
                .update({ last_login: new Date().toISOString() })
                .eq('id', data.user.id);

            return {
                success: true,
                user: {
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    role: profile.role,
                    mustChangePassword: profile.must_change_password
                },
                session: data.session
            };
        } catch (error) {
            console.error('Login exception:', error);
            return { success: false, message: 'Une erreur est survenue lors de la connexion.' };
        }
    },

    // Check current session
    async checkSession() {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();

            if (error || !session) {
                return null;
            }

            // Get user profile
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profileError || !profile || !profile.active) {
                await this.logout();
                return null;
            }

            return {
                id: profile.id,
                name: profile.name,
                email: profile.email,
                role: profile.role,
                mustChangePassword: profile.must_change_password
            };
        } catch (error) {
            console.error('Session check error:', error);
            return null;
        }
    },

    // Setup automatic session refresh
    setupSessionRefresh() {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                window.location.reload();
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('Session refreshed');
            }
        });
    },

    // Logout
    async logout() {
        try {
            await supabaseClient.auth.signOut();
            localStorage.removeItem('njm_crm_logged_in');
            localStorage.removeItem('njm_crm_user_email');
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, message: 'Erreur lors de la déconnexion.' };
        }
    },

    // Register new user (admin only)
    async registerUser(adminUserId, userData) {
        if (!await this.isAdmin(adminUserId)) {
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

        try {
            // Create user with Supabase Auth (requires admin privileges)
            // Note: This needs to be done server-side with service_role key
            // For now, we'll use the client method with proper setup

            const { data, error } = await supabaseClient.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true,
                user_metadata: {
                    name: name,
                    role: role
                }
            });

            if (error) {
                console.error('User creation error:', error);
                if (error.message.includes('already registered')) {
                    return { success: false, message: 'Un utilisateur avec cet email existe déjà.' };
                }
                return { success: false, message: 'Erreur lors de la création de l\'utilisateur.' };
            }

            return {
                success: true,
                message: 'Utilisateur créé avec succès.',
                user: { id: data.user.id, name, email, role }
            };
        } catch (error) {
            console.error('Registration exception:', error);
            return { success: false, message: 'Une erreur est survenue lors de la création de l\'utilisateur.' };
        }
    },

    // Get all users (admin only)
    async getAllUsers(requestingUserId) {
        if (!await this.isAdmin(requestingUserId)) {
            return { success: false, message: 'Accès refusé.' };
        }

        try {
            const { data: users, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Get users error:', error);
                return { success: false, message: 'Erreur lors de la récupération des utilisateurs.' };
            }

            return {
                success: true,
                users: users.map(u => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    active: u.active,
                    created: u.created_at,
                    lastLogin: u.last_login,
                    mustChangePassword: u.must_change_password
                }))
            };
        } catch (error) {
            console.error('Get users exception:', error);
            return { success: false, message: 'Une erreur est survenue.' };
        }
    },

    // Update user (admin only)
    async updateUser(requestingUserId, userId, updates) {
        if (!await this.isAdmin(requestingUserId)) {
            return { success: false, message: 'Accès refusé.' };
        }

        try {
            // Get current user
            const { data: user, error: fetchError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (fetchError || !user) {
                return { success: false, message: 'Utilisateur non trouvé.' };
            }

            // Prevent disabling the last admin
            if (updates.active === false && user.role === 'admin') {
                const { data: admins } = await supabaseClient
                    .from('profiles')
                    .select('id')
                    .eq('role', 'admin')
                    .eq('active', true);

                if (admins && admins.length <= 1) {
                    return { success: false, message: 'Impossible de désactiver le dernier administrateur.' };
                }
            }

            // Build update object
            const updateData = {};
            if (updates.name) updateData.name = updates.name;
            if (updates.email) updateData.email = updates.email;
            if (updates.role) updateData.role = updates.role;
            if (updates.active !== undefined) updateData.active = updates.active;

            // Update profile
            const { error: updateError } = await supabaseClient
                .from('profiles')
                .update(updateData)
                .eq('id', userId);

            if (updateError) {
                console.error('Update user error:', updateError);
                return { success: false, message: 'Erreur lors de la mise à jour de l\'utilisateur.' };
            }

            return { success: true, message: 'Utilisateur mis à jour avec succès.' };
        } catch (error) {
            console.error('Update user exception:', error);
            return { success: false, message: 'Une erreur est survenue.' };
        }
    },

    // Delete user (admin only)
    async deleteUser(requestingUserId, userId) {
        if (!await this.isAdmin(requestingUserId)) {
            return { success: false, message: 'Accès refusé.' };
        }

        try {
            // Get user to delete
            const { data: user, error: fetchError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (fetchError || !user) {
                return { success: false, message: 'Utilisateur non trouvé.' };
            }

            // Prevent deleting yourself
            if (user.id === requestingUserId) {
                return { success: false, message: 'Vous ne pouvez pas supprimer votre propre compte.' };
            }

            // Prevent deleting the last admin
            if (user.role === 'admin') {
                const { data: admins } = await supabaseClient
                    .from('profiles')
                    .select('id')
                    .eq('role', 'admin')
                    .eq('active', true);

                if (admins && admins.length <= 1) {
                    return { success: false, message: 'Impossible de supprimer le dernier administrateur.' };
                }
            }

            // Delete user from Supabase Auth (requires admin)
            const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId);

            if (deleteError) {
                console.error('Delete user error:', deleteError);
                return { success: false, message: 'Erreur lors de la suppression de l\'utilisateur.' };
            }

            return { success: true, message: 'Utilisateur supprimé avec succès.' };
        } catch (error) {
            console.error('Delete user exception:', error);
            return { success: false, message: 'Une erreur est survenue.' };
        }
    },

    // Change password
    async changePassword(currentPassword, newPassword) {
        try {
            // Validate new password
            const passwordValidation = this.validatePassword(newPassword);
            if (!passwordValidation.valid) {
                return { success: false, message: passwordValidation.message };
            }

            // Update password with Supabase
            const { error } = await supabaseClient.auth.updateUser({
                password: newPassword
            });

            if (error) {
                console.error('Change password error:', error);
                return { success: false, message: 'Erreur lors du changement de mot de passe.' };
            }

            // Update must_change_password flag
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) {
                await supabaseClient
                    .from('profiles')
                    .update({ must_change_password: false })
                    .eq('id', user.id);
            }

            return { success: true, message: 'Mot de passe changé avec succès.' };
        } catch (error) {
            console.error('Change password exception:', error);
            return { success: false, message: 'Une erreur est survenue.' };
        }
    },

    // Reset password (admin only)
    async resetPassword(requestingUserId, userId, newPassword) {
        if (!await this.isAdmin(requestingUserId)) {
            return { success: false, message: 'Accès refusé.' };
        }

        try {
            // Validate new password
            const passwordValidation = this.validatePassword(newPassword);
            if (!passwordValidation.valid) {
                return { success: false, message: passwordValidation.message };
            }

            // Reset password (requires admin privileges)
            const { error } = await supabaseClient.auth.admin.updateUserById(
                userId,
                { password: newPassword }
            );

            if (error) {
                console.error('Reset password error:', error);
                return { success: false, message: 'Erreur lors de la réinitialisation du mot de passe.' };
            }

            // Set must_change_password flag
            await supabaseClient
                .from('profiles')
                .update({ must_change_password: true })
                .eq('id', userId);

            return { success: true, message: 'Mot de passe réinitialisé. L\'utilisateur devra le changer à sa prochaine connexion.' };
        } catch (error) {
            console.error('Reset password exception:', error);
            return { success: false, message: 'Une erreur est survenue.' };
        }
    },

    // Check if user is admin
    async isAdmin(userId) {
        try {
            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            return !error && profile && profile.role === 'admin';
        } catch (error) {
            console.error('isAdmin check error:', error);
            return false;
        }
    },

    // Check if user has permission
    async hasPermission(userId, permission) {
        try {
            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            if (error || !profile) return false;

            // Admin has all permissions
            if (profile.role === 'admin') return true;

            // Define permissions per role
            const permissions = {
                formateur: ['view_formations', 'edit_formations', 'view_veille', 'view_library'],
                client: ['view_own_data']
            };

            return permissions[profile.role]?.includes(permission) || false;
        } catch (error) {
            console.error('Permission check error:', error);
            return false;
        }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    await SupabaseAuth.init();
});
