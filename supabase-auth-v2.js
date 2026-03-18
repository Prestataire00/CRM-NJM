// Supabase Authentication System - Version Simplifiée
// Compatible avec l'utilisation côté client

const SupabaseAuth = {
    config: {
        passwordMinLength: 8
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
            console.log('Tentative de connexion pour:', email);

            // Sign in with Supabase
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('Erreur de connexion Supabase:', error);
                return { success: false, message: 'Email ou mot de passe incorrect.' };
            }

            console.log('Connexion Supabase réussie:', data.user.email);

            // Get user profile from profiles table
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError) {
                console.error('Erreur lors de la récupération du profil:', profileError);

                // Si le profil n'existe pas, on le crée
                if (profileError.code === 'PGRST116') {
                    console.log('Profil inexistant, création...');
                    const { data: newProfile, error: createError } = await supabaseClient
                        .from('profiles')
                        .insert([{
                            id: data.user.id,
                            name: data.user.email.split('@')[0],
                            email: data.user.email,
                            role: 'admin',
                            active: true,
                            must_change_password: false
                        }])
                        .select()
                        .single();

                    if (createError) {
                        console.error('Erreur création profil:', createError);
                        return { success: false, message: 'Erreur lors de la création du profil.' };
                    }

                    return {
                        success: true,
                        user: {
                            id: newProfile.id,
                            name: newProfile.name,
                            email: newProfile.email,
                            role: newProfile.role,
                            mustChangePassword: newProfile.must_change_password
                        },
                        session: data.session
                    };
                }

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

            console.log('Connexion réussie pour:', profile.name);

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
            console.error('Exception lors de la connexion:', error);
            return { success: false, message: 'Une erreur est survenue lors de la connexion: ' + error.message };
        }
    },

    // Check current session
    async checkSession() {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();

            if (error || !session) {
                console.log('Aucune session active');
                return null;
            }

            // Get user profile
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profileError) {
                console.error('Erreur récupération profil:', profileError);

                // Si le profil n'existe pas, on le crée
                if (profileError.code === 'PGRST116') {
                    const { data: newProfile } = await supabaseClient
                        .from('profiles')
                        .insert([{
                            id: session.user.id,
                            name: session.user.email.split('@')[0],
                            email: session.user.email,
                            role: 'admin',
                            active: true,
                            must_change_password: false
                        }])
                        .select()
                        .single();

                    if (newProfile) {
                        return {
                            id: newProfile.id,
                            name: newProfile.name,
                            email: newProfile.email,
                            role: newProfile.role,
                            mustChangePassword: newProfile.must_change_password
                        };
                    }
                }

                await this.logout();
                return null;
            }

            if (!profile || !profile.active) {
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
            console.error('Erreur checkSession:', error);
            return null;
        }
    },

    // Setup automatic session refresh
    setupSessionRefresh() {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
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
            console.error('Erreur logout:', error);
            return { success: false, message: 'Erreur lors de la déconnexion.' };
        }
    },

    // Get all users (admin only) - VERSION SIMPLIFIÉE
    async getAllUsers(requestingUserId) {
        try {
            const { data: users, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erreur récupération utilisateurs:', error);
                return { success: false, message: 'Erreur lors de la récupération des utilisateurs.' };
            }

            // Fetch multi-client links from junction table
            const clientUserIds = users.filter(u => u.role === 'client').map(u => u.id);
            let profileClientsMap = {};
            if (clientUserIds.length > 0) {
                const { data: pcData } = await supabaseClient
                    .from('profile_clients')
                    .select('profile_id, client_id')
                    .in('profile_id', clientUserIds);
                if (pcData) {
                    pcData.forEach(pc => {
                        if (!profileClientsMap[pc.profile_id]) profileClientsMap[pc.profile_id] = [];
                        profileClientsMap[pc.profile_id].push(pc.client_id);
                    });
                }
            }

            // Récupérer les noms des clients
            const allClientIds = [...new Set(Object.values(profileClientsMap).flat())];
            const clientNamesMap = {};
            if (allClientIds.length > 0) {
                const { data: clientsData } = await supabaseClient
                    .from('clients')
                    .select('id, company_name')
                    .in('id', allClientIds);
                if (clientsData) {
                    clientsData.forEach(c => { clientNamesMap[c.id] = c.company_name; });
                }
            }

            return {
                success: true,
                users: users.map(u => {
                    const cIds = profileClientsMap[u.id] || (u.client_id ? [u.client_id] : []);
                    return {
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        role: u.role,
                        active: u.active,
                        created: u.created_at,
                        lastLogin: u.last_login,
                        mustChangePassword: u.must_change_password,
                        subcontractor_id: u.subcontractor_id,
                        client_id: u.client_id,
                        client_ids: cIds,
                        client_names: cIds.map(id => clientNamesMap[id] || 'Entreprise #' + id),
                        initial_password: u.initial_password
                    };
                })
            };
        } catch (error) {
            console.error('Exception getAllUsers:', error);
            return { success: false, message: 'Une erreur est survenue.' };
        }
    },

    // Update user (admin only)
    async updateUser(requestingUserId, userId, updates) {
        try {
            // Get old values first
            const { data: oldProfile } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            const updateData = {};
            if (updates.name) updateData.name = updates.name;
            if (updates.email) updateData.email = updates.email;
            if (updates.role) updateData.role = updates.role;
            if (updates.active !== undefined) updateData.active = updates.active;

            const { error } = await supabaseClient
                .from('profiles')
                .update(updateData)
                .eq('id', userId);

            if (error) {
                console.error('Erreur mise à jour utilisateur:', error);
                return { success: false, message: 'Erreur lors de la mise à jour.' };
            }

            // Log the action
            if (typeof SupabaseData !== 'undefined' && SupabaseData.logAdminAction) {
                // Determine specific action type
                let actionType = 'user_updated';
                let description = `Modification de l'utilisateur ${oldProfile?.name || userId}`;

                if (updates.role && updates.role !== oldProfile?.role) {
                    actionType = 'role_changed';
                    description = `Changement de rôle pour ${oldProfile?.name}: ${oldProfile?.role} → ${updates.role}`;
                } else if (updates.active === true && !oldProfile?.active) {
                    actionType = 'user_activated';
                    description = `Activation du compte de ${oldProfile?.name}`;
                } else if (updates.active === false && oldProfile?.active) {
                    actionType = 'user_deactivated';
                    description = `Désactivation du compte de ${oldProfile?.name}`;
                }

                await SupabaseData.logAdminAction({
                    action_type: actionType,
                    description: description,
                    target_type: 'user',
                    target_id: userId,
                    target_name: `${oldProfile?.name || updates.name} (${oldProfile?.email || updates.email})`,
                    old_values: oldProfile ? {
                        name: oldProfile.name,
                        email: oldProfile.email,
                        role: oldProfile.role,
                        active: oldProfile.active
                    } : null,
                    new_values: updateData
                });
            }

            return { success: true, message: 'Utilisateur mis à jour avec succès.' };
        } catch (error) {
            console.error('Exception updateUser:', error);
            return { success: false, message: 'Une erreur est survenue.' };
        }
    },

    // Delete user (admin only)
    async deleteUser(requestingUserId, userId) {
        try {
            // Get user info before deletion
            const { data: userProfile } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            // Supprimer le profil de la table profiles
            const { error } = await supabaseClient
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) {
                console.error('Erreur suppression utilisateur:', error);
                return { success: false, message: 'Erreur lors de la suppression.' };
            }

            // Log the action
            if (typeof SupabaseData !== 'undefined' && SupabaseData.logAdminAction) {
                await SupabaseData.logAdminAction({
                    action_type: 'user_deleted',
                    description: `Suppression de l'utilisateur ${userProfile?.name || userId}`,
                    target_type: 'user',
                    target_id: userId,
                    target_name: userProfile ? `${userProfile.name} (${userProfile.email})` : userId,
                    old_values: userProfile ? {
                        name: userProfile.name,
                        email: userProfile.email,
                        role: userProfile.role,
                        active: userProfile.active
                    } : null,
                    new_values: null
                });
            }

            return { success: true, message: 'Utilisateur supprimé avec succès.' };
        } catch (error) {
            console.error('Exception deleteUser:', error);
            return { success: false, message: 'Une erreur est survenue.' };
        }
    },

    // Change password
    async changePassword(currentPassword, newPassword) {
        try {
            const passwordValidation = this.validatePassword(newPassword);
            if (!passwordValidation.valid) {
                return { success: false, message: passwordValidation.message };
            }

            const { error } = await supabaseClient.auth.updateUser({
                password: newPassword
            });

            if (error) {
                console.error('Erreur changement mot de passe:', error);
                return { success: false, message: 'Erreur lors du changement de mot de passe.' };
            }

            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) {
                // Effacer le mot de passe initial et le flag must_change_password
                await supabaseClient
                    .from('profiles')
                    .update({
                        must_change_password: false,
                        initial_password: null  // Effacer le mot de passe initial
                    })
                    .eq('id', user.id);
            }

            return { success: true, message: 'Mot de passe changé avec succès.' };
        } catch (error) {
            console.error('Exception changePassword:', error);
            return { success: false, message: 'Une erreur est survenue.' };
        }
    },

    // Reset password (admin only)
    // Note: Cette fonction stocke le nouveau mot de passe de référence
    // L'utilisateur devra utiliser le lien de réinitialisation envoyé par email
    async resetPassword(requestingUserId, userId, newPassword) {
        try {
            // Valider le nouveau mot de passe
            const passwordValidation = this.validatePassword(newPassword);
            if (!passwordValidation.valid) {
                return { success: false, message: passwordValidation.message };
            }

            // Récupérer l'email de l'utilisateur
            const { data: userProfile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('email, name')
                .eq('id', userId)
                .single();

            if (profileError || !userProfile) {
                return { success: false, message: 'Utilisateur non trouvé.' };
            }

            // Stocker le nouveau mot de passe de référence dans initial_password
            const { error: updateError } = await supabaseClient
                .from('profiles')
                .update({ initial_password: newPassword })
                .eq('id', userId);

            if (updateError) {
                console.error('Erreur mise à jour mot de passe:', updateError);
                return { success: false, message: 'Erreur lors de la mise à jour.' };
            }

            // Envoyer un email de réinitialisation
            const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(
                userProfile.email,
                { redirectTo: window.location.origin }
            );

            if (resetError) {
                console.warn('Email de réinitialisation non envoyé:', resetError);
                // On continue quand même car le mot de passe de référence est stocké
            }

            // Log de l'action
            if (typeof SupabaseData !== 'undefined' && SupabaseData.logAdminAction) {
                await SupabaseData.logAdminAction({
                    action_type: 'user_password_reset',
                    description: `Réinitialisation du mot de passe pour ${userProfile.name}`,
                    target_type: 'user',
                    target_id: userId,
                    target_name: `${userProfile.name} (${userProfile.email})`
                });
            }

            return {
                success: true,
                message: `Mot de passe mis à jour. Le nouveau mot de passe "${newPassword}" est maintenant visible dans la liste. Un email de réinitialisation a été envoyé à ${userProfile.email}.`
            };
        } catch (error) {
            console.error('Exception resetPassword:', error);
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
            console.error('Erreur isAdmin:', error);
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

            if (profile.role === 'admin') return true;

            const permissions = {
                formateur: ['view_formations', 'edit_formations', 'view_veille', 'view_library'],
                client: ['view_own_data']
            };

            return permissions[profile.role]?.includes(permission) || false;
        } catch (error) {
            console.error('Erreur hasPermission:', error);
            return false;
        }
    },

    // Register new user - Version avec signUp
    async registerUser(adminUserId, userData) {
        try {
            console.log('Création utilisateur:', userData);

            // Validation des données
            if (!userData.email || !userData.password) {
                return { success: false, message: 'Email et mot de passe requis.' };
            }

            if (!userData.name) {
                return { success: false, message: 'Le nom est requis.' };
            }

            // Valider le mot de passe
            const passwordValidation = this.validatePassword(userData.password);
            if (!passwordValidation.valid) {
                return { success: false, message: passwordValidation.message };
            }

            // Créer l'utilisateur avec signUp
            const { data, error } = await supabaseClient.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        name: userData.name,
                        role: userData.role || 'client'
                    },
                    emailRedirectTo: window.location.origin
                }
            });

            if (error) {
                console.error('Erreur signUp:', error);
                return { success: false, message: 'Erreur lors de la création : ' + error.message };
            }

            // Supabase peut retourner un user existant sans erreur (identities vide = email déjà pris)
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                return { success: false, message: 'User already registered' };
            }

            console.log('Utilisateur créé dans auth:', data.user.id);

            // Attendre un court instant pour que le trigger Supabase puisse créer le profil
            await new Promise(resolve => setTimeout(resolve, 500));

            // Vérifier si le profil existe déjà (créé par le trigger on_auth_user_created)
            const { data: existingProfile } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('id', data.user.id)
                .single();

            let profileError = null;

            if (existingProfile) {
                // Le profil existe déjà (créé par le trigger), on le met à jour
                console.log('Profil existant trouvé, mise à jour...');
                const { error: updateError } = await supabaseClient
                    .from('profiles')
                    .update({
                        name: userData.name,
                        email: userData.email,
                        role: userData.role || 'client',
                        active: true,
                        must_change_password: userData.mustChangePassword || false,
                        initial_password: userData.password // Stocker le mot de passe initial pour l'admin
                    })
                    .eq('id', data.user.id);
                profileError = updateError;
            } else {
                // Le profil n'existe pas encore, on essaie de le créer
                // Note: Cela peut échouer si la confirmation email est requise
                console.log('Profil non trouvé, tentative de création...');
                const { error: insertError } = await supabaseClient
                    .from('profiles')
                    .insert({
                        id: data.user.id,
                        name: userData.name,
                        email: userData.email,
                        role: userData.role || 'client',
                        active: true,
                        must_change_password: userData.mustChangePassword || false,
                        initial_password: userData.password // Stocker le mot de passe initial pour l'admin
                    });

                if (insertError && insertError.code === '23503') {
                    // Erreur de clé étrangère - l'utilisateur doit confirmer son email
                    console.log('L\'utilisateur doit confirmer son email avant que le profil puisse être créé');
                    // On ne retourne pas d'erreur, le profil sera créé quand l'utilisateur confirmera son email
                    profileError = null;
                } else {
                    profileError = insertError;
                }
            }

            if (profileError) {
                console.error('Erreur création/mise à jour profil:', profileError);
                return { success: false, message: 'Utilisateur créé mais erreur profil : ' + profileError.message };
            }

            // Log the action
            if (typeof SupabaseData !== 'undefined' && SupabaseData.logAdminAction) {
                await SupabaseData.logAdminAction({
                    action_type: 'user_created',
                    description: `Création de l'utilisateur ${userData.name} (${userData.email}) avec le rôle ${userData.role || 'client'}`,
                    target_type: 'user',
                    target_id: data.user.id,
                    target_name: `${userData.name} (${userData.email})`,
                    new_values: {
                        name: userData.name,
                        email: userData.email,
                        role: userData.role || 'client',
                        active: true
                    }
                });
            }

            return {
                success: true,
                message: 'Utilisateur créé avec succès. Un email de confirmation a été envoyé.',
                user: {
                    id: data.user.id,
                    email: userData.email,
                    name: userData.name,
                    role: userData.role || 'client'
                }
            };
        } catch (error) {
            console.error('Exception registerUser:', error);
            return { success: false, message: 'Une erreur est survenue : ' + error.message };
        }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initialisation SupabaseAuth...');
    await SupabaseAuth.init();
});
