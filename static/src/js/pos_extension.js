/** @odoo-module **/

import { Component, xml, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { CashierName } from "@point_of_sale/app/navbar/cashier_name/cashier_name";
import { patch } from "@web/core/utils/patch";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
/* ----------------------------------------------------------
 * ✅ POPUP DE LOGIN PROFESSIONNELLE (intégré)
 * ---------------------------------------------------------- */
class ProfessionalLoginPopup {
    constructor(springBootApi) {
        this.springBootApi = springBootApi;
        this.isVisible = false;
        this.overlay = null;
        this.popup = null;
        this.onSuccessCallback = null;
    }

    show(onSuccess) {
        if (this.isVisible) return;
        this.onSuccessCallback = onSuccess;
        this.createOverlay();
        this.createPopup();
        this.setupEvents();
        this.animateIn();
        this.isVisible = true;
        setTimeout(() => {
            const emailInput = document.getElementById('pro-login-email');
            if (emailInput) emailInput.focus();
        }, 300);
    }

    hide() {
        if (!this.isVisible) return;
        this.animateOut(() => {
            if (this.overlay) {
                document.body.removeChild(this.overlay);
            }
            this.isVisible = false;
            this.overlay = null;
            this.popup = null;
        });
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px);
            z-index: 10000; display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: all 0.3s ease;
        `;
        document.body.appendChild(this.overlay);
    }

    createPopup() {
        this.popup = document.createElement('div');
        this.popup.innerHTML = this.getPopupHTML();
        this.popup.style.cssText = `
            background: white; border-radius: 16px; box-shadow: 0 25px 50px rgba(0,0,0,0.3);
            width: 400px; height: 620px; overflow: hidden;
            transform: scale(0.8) translateY(50px);
            transition: all 0.4s cubic-bezier(0.175,0.885,0.32,1.275);
            position: relative; display: flex; flex-direction: column;
        `;
        this.overlay.appendChild(this.popup);
    }

    getPopupHTML() {
        return `
            <div style="
                background: linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                color: white; padding: 24px; text-align: center; flex-shrink: 0;">
                <div style="
                    width:64px;height:64px;background:rgba(255,255,255,0.2);
                    border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;
                    border:2px solid rgba(255,255,255,0.3);">
                    <i class="fa fa-building" style="font-size:28px;color:white;"></i>
                </div>
                <h2 style="margin:0 0 6px 0;font-size:20px;font-weight:700;">Connexion Caissier</h2>
                <p style="margin:0;opacity:0.9;font-size:13px;">Système de Cantine Entreprise</p>
                <div style="
                    position:absolute;top:12px;right:12px;background:rgba(255,255,255,0.2);
                    padding:4px 8px;border-radius:12px;font-size:10px;font-weight:600;">
                    🔒 SÉCURISÉ
                </div>
            </div>

            <div style="padding:24px;flex:1;display:flex;flex-direction:column;">
                <div style="
                    background: linear-gradient(135deg,#e3f2fd 0%,#bbdefb 100%);
                    border-left:3px solid #2196f3; padding:12px; border-radius:6px;
                    margin-bottom:20px; font-size:12px; color:#1565c0;">
                    <div style="font-weight:600;margin-bottom:3px;">
                        <i class="fa fa-info-circle" style="margin-right:6px;"></i>Accès autorisé
                    </div>
                    <div style="opacity:0.8;">Rôles: ADMIN, SUPER_ADMIN, CAISSIER</div>
                </div>

                <form id="pro-login-form" style="flex:1;display:flex;flex-direction:column;">
                    <div style="margin-bottom:16px;">
                        <label style="display:block;margin-bottom:6px;font-weight:600;color:#374151;font-size:13px;">
                            <i class="fa fa-envelope" style="margin-right:6px;color:#6b7280;"></i>Email
                        </label>
                        <input type="email" id="pro-login-email" placeholder="votre.email@entreprise.com" autocomplete="email"
                            style="width:100%;padding:12px;border:2px solid #e5e7eb;border-radius:6px;
                                   font-size:14px;transition:all .2s;background:#fafafa;box-sizing:border-box;"/>
                    </div>

                    <div style="margin-bottom:16px;">
                        <label style="display:block;margin-bottom:6px;font-weight:600;color:#374151;font-size:13px;">
                            <i class="fa fa-lock" style="margin-right:6px;color:#6b7280;"></i>Mot de passe
                        </label>
                        <div style="position:relative;">
                            <input type="password" id="pro-login-password" placeholder="••••••••••••" autocomplete="current-password"
                                style="width:100%;padding:12px 40px 12px 12px;border:2px solid #e5e7eb;border-radius:6px;
                                       font-size:14px;transition:all .2s;background:#fafafa;box-sizing:border-box;"/>
                            <button type="button" id="password-toggle" style="
                                position:absolute;right:8px;top:50%;transform:translateY(-50%);
                                background:none;border:none;color:#6b7280;cursor:pointer;padding:6px;">
                                <i class="fa fa-eye" id="password-toggle-icon"></i>
                            </button>
                        </div>
                    </div>

                    <div id="pro-login-status" style="height:20px;margin-bottom:16px;text-align:center;font-size:12px;font-weight:500;"></div>

                    <div style="display:flex;gap:10px;margin-top:auto;">
                        <button type="button" id="pro-login-cancel" style="
                            flex:1;padding:12px;background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;
                            border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;">
                            <i class="fa fa-times" style="margin-right:6px;"></i>ANNULER
                        </button>

                        <button type="submit" id="pro-login-submit" style="
                            flex:2;padding:12px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                            color:white;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;
                            transition:all .2s;box-shadow:0 3px 8px rgba(102,126,234,.3);">
                            <i class="fa fa-sign-in" style="margin-right:6px;"></i>
                            <span id="login-btn-text">SE CONNECTER</span>
                        </button>
                    </div>
                </form>
            </div>

            <div style="
                background:#f8fafc;padding:12px 24px;text-align:center;border-top:1px solid #e5e7eb;
                font-size:11px;color:#6b7280;flex-shrink:0;">
                <i class="fa fa-shield" style="margin-right:4px;color:#10b981;"></i>
                Connexion JWT sécurisée • Session 8h
            </div>
        `;
    }

    setupEvents() {
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.cancel(); });

        const cancelBtn = document.getElementById('pro-login-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancel());

        const loginForm = document.getElementById('pro-login-form');
        if (loginForm) loginForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleLogin(); });

        const passwordToggle = document.getElementById('password-toggle');
        if (passwordToggle) passwordToggle.addEventListener('click', this.togglePassword);

        const emailInput = document.getElementById('pro-login-email');
        const passwordInput = document.getElementById('pro-login-password');

        if (emailInput) {
            emailInput.addEventListener('focus', (e) => { e.target.style.borderColor = '#667eea'; e.target.style.background = 'white'; });
            emailInput.addEventListener('blur',  (e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#fafafa'; });
            emailInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && passwordInput) passwordInput.focus(); });
        }
        if (passwordInput) {
            passwordInput.addEventListener('focus', (e) => { e.target.style.borderColor = '#667eea'; e.target.style.background = 'white'; });
            passwordInput.addEventListener('blur',  (e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#fafafa'; });
            passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.handleLogin(); });
        }

        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.isVisible) this.cancel(); });
    }

    togglePassword() {
        const passwordInput = document.getElementById('pro-login-password');
        const toggleIcon = document.getElementById('password-toggle-icon');
        if (passwordInput && toggleIcon) {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.className = 'fa fa-eye-slash';
            } else {
                passwordInput.type = 'password';
                toggleIcon.className = 'fa fa-eye';
            }
        }
    }

    animateIn() {
        setTimeout(() => { this.overlay.style.opacity = '1'; }, 10);
        setTimeout(() => { this.popup.style.transform = 'scale(1) translateY(0)'; }, 100);
    }

    animateOut(callback) {
        this.popup.style.transform = 'scale(0.9) translateY(30px)';
        this.popup.style.opacity = '0';
        setTimeout(() => { this.overlay.style.opacity = '0'; }, 100);
        setTimeout(() => { if (callback) callback(); }, 300);
    }

    cancel() {
        this.hide();
        setTimeout(() => { window.location.href = '/web'; }, 400);
    }

    async handleLogin() {
        const emailInput = document.getElementById('pro-login-email');
        const passwordInput = document.getElementById('pro-login-password');
        const email = emailInput?.value?.trim();
        const password = passwordInput?.value?.trim();

        if (!email || !password) { this.updateStatus('⚠️ Champs requis', '#f59e0b'); return; }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) { this.updateStatus('📧 Email invalide', '#ef4444'); return; }

        try {
            this.setLoadingState(true);
            this.updateStatus('🔄 Connexion...', '#3b82f6');

            const result = await this.springBootApi.authService.authenticateCashier(email, password);

            if (result.success) {
                this.updateStatus('✅ Connexion réussie !', '#10b981');
                setTimeout(() => {
                    this.hide();
                    if (this.onSuccessCallback) this.onSuccessCallback(result);
                }, 800);
            } else {
                this.setLoadingState(false);
                this.updateStatus(`❌ ${result.error}`, '#ef4444');
                setTimeout(() => { emailInput?.focus(); }, 500);
            }
        } catch (error) {
            this.setLoadingState(false);
            this.updateStatus('❌ Erreur connexion', '#ef4444');
        }
    }

    setLoadingState(loading) {
        const submitBtn = document.getElementById('pro-login-submit');
        const btnText = document.getElementById('login-btn-text');
        const emailInput = document.getElementById('pro-login-email');
        const passwordInput = document.getElementById('pro-login-password');

        if (loading) {
            if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.7'; }
            if (btnText) { btnText.innerHTML = '<i class="fa fa-spinner fa-spin" style="margin-right:6px;"></i>CONNEXION...'; }
            if (emailInput) emailInput.disabled = true;
            if (passwordInput) passwordInput.disabled = true;
        } else {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
            if (btnText) { btnText.innerHTML = '<i class="fa fa-sign-in" style="margin-right:6px;"></i>SE CONNECTER'; }
            if (emailInput) emailInput.disabled = false;
            if (passwordInput) passwordInput.disabled = false;
        }
    }

    updateStatus(message, color = '#6b7280') {
        const statusDiv = document.getElementById('pro-login-status');
        if (statusDiv) { statusDiv.textContent = message; statusDiv.style.color = color; }
    }
}

/* ----------------------------------------------------------
 * ✅ SERVICE SPRING BOOT NAVBAR
 * ---------------------------------------------------------- */
class SpringBootAuthService {
    constructor() {
        this.currentCashier = null;
        this.isAuthenticated = false;
        this.loadFromStorage();
    }
    loadFromStorage() {
        try {
            const cashier = sessionStorage.getItem('pos_cashier');
            const token = sessionStorage.getItem('pos_jwt_token');
            const expiration = sessionStorage.getItem('pos_token_expiration');
            if (cashier && token && expiration && Date.now() < parseInt(expiration)) {
                this.currentCashier = JSON.parse(cashier);
                this.isAuthenticated = true;
                console.log('✅ Caissier Spring Boot chargé pour navbar:', this.currentCashier.nom);
            }
        } catch (error) {
            console.log('⚠️ Pas de caissier Spring Boot stocké pour navbar');
        }
    }
    getCurrentCashier() { return this.currentCashier; }
    isAuth() { return this.isAuthenticated && this.currentCashier; }
    logout() {
        this.currentCashier = null;
        this.isAuthenticated = false;
        sessionStorage.removeItem('pos_jwt_token');
        sessionStorage.removeItem('pos_cashier');
        sessionStorage.removeItem('pos_token_expiration');
        console.log('🚪 Déconnexion Spring Boot navbar');
    }
}

const springBootNavbarService = {
    dependencies: [],
    start(env) {
        console.log('🚀 Service SpringBoot Navbar démarré');
        return new SpringBootAuthService();
    },
};
registry.category("services").add("springBootNavbar", springBootNavbarService);

/* ----------------------------------------------------------
 * ✅ OVERRIDE CASHIER NAME (Navbar POS)
 * ---------------------------------------------------------- */
CashierName.template = xml`
    <t t-if="env.services.springBootNavbar?.isAuth()">
        <div class="spring-cashier-header"
             t-on-click="onSpringLogout"
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; cursor: pointer;
                    display: flex; align-items: center; gap: 8px; min-width: 200px; max-width: 280px;
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2); transition: all 0.3s ease;
                    border: 2px solid rgba(255, 255, 255, 0.2);"
             title="Cliquer pour se déconnecter">
            <div style="width:28px;height:28px;background:rgba(255,255,255,0.25);
                        border-radius:50%;display:flex;align-items:center;justify-content:center;">
                <i class="fa fa-user" style="font-size:14px;"/>
            </div>
            <div style="flex:1;text-align:left;overflow:hidden;">
                <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
                     t-esc="getSpringCashierName()"/>
                <div style="font-size:10px;opacity:0.85;">Caissier connecté</div>
            </div>
            <div style="width:24px;height:24px;background:rgba(255,255,255,0.2);
                        border-radius:50%;display:flex;align-items:center;justify-content:center;">
                <i class="fa fa-sign-out" style="font-size:11px;"/>
            </div>
        </div>
    </t>
    <t t-else="">
        <button t-att-class="cssClass"
                class="cashier-name btn btn-light btn-lg lh-lg d-flex align-items-center gap-2 flex-shrink-0 h-100">
            <img t-att-src="avatar" t-att-alt="username" class="avatar rounded-3"/>
            <span t-if="!ui.isSmall" t-esc="username" class="username d-none d-xl-inline-block text-truncate"/>
        </button>
    </t>
`;

patch(CashierName.prototype, {
    
    setup() { super.setup(); this.springAuth = this.env.services.springBootNavbar;this.setupAuthListener(); },
    
    setupAuthListener() {
        document.addEventListener('spring-auth-updated', (event) => {
            console.log('🔄 Event reçu: spring-auth-updated', event.detail);
            
            // Forcer la mise à jour du service navbar
            if (this.env.services.springBootNavbar) {
                this.env.services.springBootNavbar.loadFromStorage();
            }
            
            // Déclencher un re-render du composant
            if (this.__owl__) {
            this.__owl__.render();
            }
        });
    },
    getSpringCashierName() {
        const cashier = this.env.services.springBootNavbar?.getCurrentCashier();
        if (cashier) {
            const nom = cashier.nom || '', prenom = cashier.prenom || '', email = cashier.email || '';
            if (nom && prenom) return `${prenom} ${nom}`;
            if (nom) return nom;
            if (email) return email.split('@')[0];
        }
        return 'Caissier';
    },
    onSpringLogout() {
        const springAuth = this.env.services.springBootNavbar;
        const cashierName = this.getSpringCashierName();
        if (confirm(`Voulez-vous vous déconnecter ?\n\nUtilisateur: ${cashierName}`)) {
            springAuth.logout();
            this.env.services.notification.add(`Au revoir ${cashierName} !`, { type: 'info' });
            setTimeout(() => { window.location.href = '/web'; }, 1500);
        }
    }
});
/* ----------------------------------------------------------
 * ✅ SUPPRIMER LE BOUTON CUSTOMER EN MODE SPRING BOOT
 * ---------------------------------------------------------- */




/* ----------------------------------------------------------
 * ✅ Auth / Badge / API Services
 * ---------------------------------------------------------- */
class CashierAuthService {
    constructor(env) {
        this.env = env;
        this.dialog = env.services.dialog;
        this.notification = env.services.notification;
        this.jwtToken = null;
        this.currentCashier = null;
        this.isAuthenticated = false;
        this.tokenExpiration = null;
    }
    // Authentification offline avec PIN
    async authenticateOfflineWithPIN(email, pin) {
        const storedData = localStorage.getItem(`offline_pin_${email}`);
        
        if (!storedData) {
            return {
                success: false, 
                error: "PIN offline non configuré.\nConnexion internet requise pour première utilisation."
            };
        }
        
        const data = JSON.parse(storedData);
        
        if (data.pin !== pin) {
            return { success: false, error: "PIN incorrect" };
        }
        
        // Simuler structure de réponse comme online
        this.currentCashier = {
            email: data.email,
            nom: data.nom || "Caissier",
            prenom: data.prenom || "Offline", 
            role: data.role
        };
        this.isAuthenticated = true;
        
        console.log('✅ Authentification offline réussie');
        return { 
            success: true, 
            cashier: this.currentCashier, 
            mode: "offline",
            token: "offline_session" 
        };
    }

//  Proposer setup PIN après connexion online
    promptPINSetup(email, jwt) {
    // Vérifier si PIN déjà configuré
    if (localStorage.getItem(`offline_pin_${email}`)) {
        console.log('PIN offline déjà configuré pour', email);
        return;
    }
    
    // Afficher popup simple avec prompt (temporaire)
    const pin = prompt("Configurez votre PIN offline (4 chiffres):\n\nCe PIN vous permettra d'utiliser le POS sans internet.", "");
    
    if (!pin) {
        console.log('Configuration PIN ignorée');
        return;
    }
    
    if (!/^\d{4}$/.test(pin)) {
        alert("PIN invalide. Doit être 4 chiffres.");
        return;
    }
    
    // Sauver PIN
    const pinData = {
        email: email,
        pin: pin,
        setupDate: new Date().toLocaleString(),
        nom: this.currentCashier.nom,
        prenom: this.currentCashier.prenom,
        role: this.currentCashier.role
    };
    
    localStorage.setItem(`offline_pin_${email}`, JSON.stringify(pinData));
    console.log('✅ PIN offline configuré:', pin);
    alert("PIN offline configuré avec succès !\nVous pourrez vous connecter sans internet avec ce PIN.");
    }

    async authenticateCashier(email, password) {
        console.log('🔍 Test connexion direct...');
    
        let isOnline = false;
        try {
            const response = await fetch('http://localhost:8080/api/health', { timeout: 1000 });
            isOnline = true;
            console.log('✅ Connexion directe OK');
        } catch {
            console.log('❌ Connexion directe KO');
            isOnline = false;
        }
        console.log('DEBUG: isOnline =', isOnline, typeof isOnline);

        
        if (isOnline === false) {
            console.log('🔴 Mode OFFLINE - Authentification via PIN');
            return await this.authenticateOfflineWithPIN(email, password);
        }
        
        console.log('🟢 Mode ONLINE - Authentification Spring Boot');
        try {
            const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
            const loginResponse = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST', headers, body: JSON.stringify({ email, password }), mode: 'cors', credentials: 'omit'
            });
            

            const loginResult = await loginResponse.json();
            if (!loginResponse.ok || loginResult.status !== 200) throw new Error(loginResult.message || 'Authentification échouée');
        
            

            const tempJWT = loginResult.token;

            const accountResponse = await fetch('http://localhost:8080/api/utilisateurs/account', {
                method: 'GET', headers: { 'Authorization': `Bearer ${tempJWT}`, 'Content-Type': 'application/json' }
            });
            const accountResult = await accountResponse.json();
            if (!accountResponse.ok || accountResult.status !== 200) throw new Error('Erreur vérification du compte');

            const userRole = accountResult.data.role;
            const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'CAISSIER'];
            if (!allowedRoles.includes(userRole)) throw new Error(`Accès refusé - Rôle "${userRole}" non autorisé`);

            this.jwtToken = tempJWT;
            this.currentCashier = accountResult.data;
            this.isAuthenticated = true;
            this.tokenExpiration = Date.now() + (8 * 60 * 60 * 1000);

            sessionStorage.setItem('pos_jwt_token', this.jwtToken);
            sessionStorage.setItem('pos_cashier', JSON.stringify(this.currentCashier));
            sessionStorage.setItem('pos_token_expiration', this.tokenExpiration.toString());

            const navbarService = this.env.services.springBootNavbar;
            if (navbarService) {
                navbarService.currentCashier = this.currentCashier;
                navbarService.isAuthenticated = true;
                navbarService.loadFromStorage();
                console.log('✅ Navbar synchronisé immédiatement avec:', this.currentCashier.nom);

            }
            setTimeout(() => {
            const event = new CustomEvent('spring-auth-updated', {
                detail: { cashier: this.currentCashier }
            });
            document.dispatchEvent(event);
            }, 100);
            this.promptPINSetup(email, loginResult.token);//Après succès online, proposer setup PIN
            const pinSetupResult = await this.ensurePINSetup(email, tempJWT);
    
            if (!pinSetupResult.success) {
                // PIN setup échoué → FERMER session
                this.logout();
                return { success: false, error: pinSetupResult.error };
            }

            console.log('🎉  Authentification complète réussie');

            return { success: true, cashier: this.currentCashier, token: this.jwtToken };
        } catch (error) {
            console.error('❌ Erreur authentification ONLINE:', error.message);
            return { success: false, error: error.message };
        }
    }
    // ✅ NOUVEAU : Setup PIN OBLIGATOIRE
async ensurePINSetup(email, jwt) {
    // Vérifier si PIN déjà configuré
    if (localStorage.getItem(`offline_pin_${email}`)) {
        console.log('✅ PIN offline déjà configuré');
        return { success: true };
    }
    
    console.log('🔐 Configuration PIN offline OBLIGATOIRE');
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        const pin = prompt(`Configuration PIN offline OBLIGATOIRE (Tentative ${attempts + 1}/${maxAttempts})\n\nEntrez 4 chiffres pour mode offline:`, "");
        
        // Utilisateur annule
        if (pin === null) {
            return { 
                success: false, 
                error: "Configuration PIN obligatoire annulée. Session fermée pour sécurité." 
            };
        }
        
        // Validation PIN
        if (!/^\d{4}$/.test(pin)) {
            attempts++;
            alert(`PIN invalide (${attempts}/${maxAttempts}). Doit être 4 chiffres exactement.`);
            continue;
        }
        
        // PIN valide → Sauver
        const pinData = {
            email: email,
            pin: pin,
            setupDate: new Date().toLocaleString(),
            nom: this.currentCashier.nom,
            prenom: this.currentCashier.prenom,
            role: this.currentCashier.role
        };
        
        localStorage.setItem(`offline_pin_${email}`, JSON.stringify(pinData));
        console.log('✅ PIN offline configuré avec succès');
        return { success: true };
    }
    
    // Trop de tentatives
    return { 
        success: false, 
        error: `Trop de tentatives invalides (${maxAttempts}). Session fermée pour sécurité.` 
    };
}

    async verifyExistingToken() {
        try {
            const token = sessionStorage.getItem('pos_jwt_token');
            const expiration = sessionStorage.getItem('pos_token_expiration');
            if (!token || !expiration) return false;
            if (Date.now() > parseInt(expiration)) { this.logout(); return false; }

            const response = await fetch('http://localhost:8080/api/utilisateurs/account', {
                method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            const result = await response.json();

            if (response.ok && result.status === 200) {
                const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'CAISSIER'];
                if (allowedRoles.includes(userRole)) {
                    this.jwtToken = token;
                    this.currentCashier = result.data;
                    this.isAuthenticated = true;
                    this.tokenExpiration = parseInt(expiration);
                    
                    sessionStorage.setItem('pos_cashier', JSON.stringify(this.currentCashier));
                    
                    // ✅ CORRECTION : Synchronisation navbar améliorée
                    const navbarService = this.env.services.springBootNavbar;
                    if (navbarService) {
                        navbarService.currentCashier = this.currentCashier;
                        navbarService.isAuthenticated = true;
                        
                        // ✅ NOUVEAU : Forcer le rechargement
                        navbarService.loadFromStorage();
                        
                        console.log('✅ Navbar synchronisé lors de la vérification token');
                    }
                    
                    console.log('✅ Token valide pour navbar:', result.data.nom);
                    return true;
                }
            }
            this.logout();
            return false;
        } catch {
            this.logout();
            return false;
        }
    }

    async loadStoredAuth() { return await this.verifyExistingToken(); }
    logout() {
        this.jwtToken = null; this.currentCashier = null; this.isAuthenticated = false; this.tokenExpiration = null;
        sessionStorage.removeItem('pos_jwt_token');
        sessionStorage.removeItem('pos_cashier');
        sessionStorage.removeItem('pos_token_expiration');
        const navbarService = this.env.services.springBootNavbar;
        if (navbarService) navbarService.logout();
    }
    getJWTToken() { return this.jwtToken; }
    getCurrentCashier() { return this.currentCashier; }
    isTokenValid() { return this.isAuthenticated && this.tokenExpiration && Date.now() < this.tokenExpiration; }
}

class BadgeService {
    constructor(env, authService) { this.env = env; this.authService = authService; this.notification = env.services.notification; }
    async validateBadge(badgeCode) {
        try {
            const jwt = this.authService.getJWTToken();
            if (!jwt || !this.authService.isTokenValid()) throw new Error('Session expirée');
            const response = await fetch(`http://localhost:8080/api/utilisateurs/badge?codeBadge=${badgeCode}`, {
                method: 'GET', headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (response.ok && result.status === 200) return { success: true, customer: result.data };
            return { success: false, error: result.message || 'Badge non valide' };
        } catch (error) { return { success: false, error: error.message }; }
    }
}
class CashierCacheService {
    constructor(env, authService) {
        this.env = env;
        this.authService = authService;
        this.CACHE_KEY = 'pos_cashiers_cache';
        this.CACHE_EXPIRY_HOURS = 24; // 24h de validité
    }

    // Récupérer et cacher tous les caissiers
    async fetchAndCacheCashiers() {
        try {
            const jwt = this.authService.getJWTToken();
            if (!jwt) throw new Error('Pas de token JWT');

            console.log('🔄 Récupération des caissiers...');
            const response = await fetch('http://localhost:8080/api/utilisateurs/caissiers', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            
            if (response.ok && result.status === 200) {
                this.storeCashiers(result.data);
                console.log(`✅ ${result.data.length} caissiers mis en cache`);
                return true;
            } else {
                console.log('❌ Erreur récupération caissiers:', result.message);
                return false;
            }
        } catch (error) {
            console.log('❌ Impossible récupérer caissiers:', error.message);
            return false;
        }
    }

    // Stocker les caissiers localement
    storeCashiers(cashiers) {
        const cacheData = {
            cashiers: cashiers,
            timestamp: Date.now(),
            expiry: Date.now() + (this.CACHE_EXPIRY_HOURS * 60 * 60 * 1000)
        };
        
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
        console.log(`💾 Cache mis à jour: ${cashiers.length} caissiers`);
    }

    // Récupérer caissiers du cache
    getCachedCashiers() {
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            if (!cached) return null;

            const data = JSON.parse(cached);
            
            // Vérifier expiration
            if (Date.now() > data.expiry) {
                console.log('⏰ Cache expiré, suppression...');
                localStorage.removeItem(this.CACHE_KEY);
                return null;
            }

            return data.cashiers;
        } catch (error) {
            console.log('❌ Erreur lecture cache:', error);
            return null;
        }
    }

    // Authentification OFFLINE
    async authenticateOffline(email, password) {
        const cachedCashiers = this.getCachedCashiers();
        
        if (!cachedCashiers) {
            return { 
                success: false, 
                error: 'Cache caissiers manquant - Connexion internet requise' 
            };
        }

        // Chercher l'email dans le cache
        const cashier = cachedCashiers.find(c => c.email === email);
        
        if (!cashier) {
            return { 
                success: false, 
                error: 'Email non autorisé pour ce terminal' 
            };
        }

        // Pour JWT/bcrypt, on ne peut pas vérifier offline
        // On fait confiance au cache (sécurisé par expiration)
        console.log('✅ Authentification OFFLINE réussie:', cashier.nom);
        
        return { 
            success: true, 
            cashier: cashier,
            mode: 'offline'
        };
    }

    // Info sur le cache
    getCacheInfo() {
        const cached = this.getCachedCashiers();
        if (!cached) return { exists: false };
        
        const data = JSON.parse(localStorage.getItem(this.CACHE_KEY));
        return {
            exists: true,
            count: cached.length,
            createdAt: new Date(data.timestamp).toLocaleString(),
            expiresAt: new Date(data.expiry).toLocaleString()
        };
    }
}





class SimpleBadgeInterface {
    constructor(springBootApi) { this.springBootApi = springBootApi; this.currentCustomer = null; }
    create() { this.createBadgeArea();  }

    // hideCustomerButton() {
    //     setTimeout(() => {
    //         const sels = ['.partner-button','.customer-button','.client-button','[data-bs-original-title*="Customer"]','.o_partner_button'];
    //         for (const s of sels) {
    //             const el = document.querySelector(s);
    //             if (el && el.textContent.includes('med kacha')) { el.style.display = 'none'; break; }
    //         }
    //         document.querySelectorAll('button,.btn,div[role="button"]').forEach(btn=>{
    //             if (btn.textContent && btn.textContent.toLowerCase().includes('med kacha')) btn.style.display='none';
    //         });
    //     }, 1000);
    // }

    createBadgeArea() {
        setTimeout(() => {
            const target = ['.partner-button','.customer-display','.o_partner_button'].map(s=>document.querySelector(s)).find(Boolean);
            if (target) { target.innerHTML = this.getBadgeHTML(); this.setupBadgeEvents(); }
            else this.createNewBadgeArea();
        }, 1500);
    }

    getBadgeHTML() {
        return `
            <div id="pos-badge-interface" style="background:white;border:1px solid #e0e0e0;border-radius:6px;
                 padding:12px;margin:4px 0;box-shadow:0 1px 3px rgba(0,0,0,0.1);font-size:13px;">
                <div id="customer-display" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:4px;
                     padding:8px 12px;margin-bottom:8px;text-align:center;min-height:32px;display:flex;align-items:center;justify-content:center;">
                    <div style="color:#6c757d;font-size:12px;"><i class="fa fa-user-o" style="margin-right:6px;"></i><span>Aucun client</span></div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <label style="font-weight:500;color:#495057;font-size:12px;white-space:nowrap;">🏷️ Badge:</label>
                    <input type="text" id="badge-input" placeholder="Scanner badge..." style="flex:1;padding:6px 8px;border:1px solid #ced4da;border-radius:3px;font-size:12px;min-width:120px;"/>
                    <button id="validate-badge" style="padding:6px 10px;background:#28a745;color:white;border:none;border-radius:3px;cursor:pointer;font-size:11px;font-weight:500;">✓</button>
                </div>
                <div id="badge-status" style="margin-top:4px;font-size:10px;color:#6c757d;text-align:center;">Prêt</div>
            </div>
        `;
    }

    createNewBadgeArea() {
        const badgeContainer = document.createElement('div');
        badgeContainer.innerHTML = this.getBadgeHTML();
        const posContent = document.querySelector('.pos-content,.o_pos_content,.point-of-sale');
        if (posContent) {
            const leftPanel = posContent.querySelector('.leftpane,.order-summary,.pos-leftpane');
            if (leftPanel) leftPanel.insertBefore(badgeContainer, leftPanel.firstChild);
            else posContent.insertBefore(badgeContainer, posContent.firstChild);
            this.setupBadgeEvents();
        }
    }

    setupBadgeEvents() {
        const badgeInput = document.getElementById('badge-input');
        const validateBtn = document.getElementById('validate-badge');
        if (badgeInput && validateBtn) {
            badgeInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.validateBadge(); } });
            validateBtn.addEventListener('click', () => this.validateBadge());
            badgeInput.focus();
        }
    }

    async validateBadge() {
        const badgeInput = document.getElementById('badge-input');
        const customerDisplay = document.getElementById('customer-display');
        const code = badgeInput.value.trim();
        if (!code) { this.updateStatus('⚠️ Code badge requis', '#ffc107'); return; }

        try {
            this.updateStatus('🔄 Validation...', '#17a2b8');
            const result = await this.springBootApi.badgeService.validateBadge(code);
            if (result.success) {
                this.currentCustomer = result.customer;
                this.updateStatus('✅ Badge valide', '#28a745');
                customerDisplay.innerHTML = `
                    <div style="text-align:center;">
                        <div style="background:#28a745;color:white;padding:4px 8px;border-radius:12px;display:inline-flex;align-items:center;font-size:11px;font-weight:500;">
                            <i class="fa fa-user" style="margin-right:4px;font-size:10px;"></i>
                            ${result.customer.nom} ${result.customer.prenom}
                        </div>
                        <div style="font-size:10px;color:#666;margin-top:2px;">
                            Solde: ${result.customer.solde ? result.customer.solde.toFixed(2) + '€' : 'N/A'}
                        </div>
                    </div>`;
                this.springBootApi.notification.add(`Client: ${result.customer.nom} ${result.customer.prenom}`, { type: 'success' });
                badgeInput.value = '';
            } else {
                this.updateStatus(`❌ ${result.error}`, '#dc3545');
                this.springBootApi.notification.add(`Badge invalide: ${result.error}`, { type: 'warning' });
            }
            setTimeout(() => badgeInput.focus(), 1000);
        } catch {
            this.updateStatus('❌ Erreur connexion', '#dc3545');
        }
    }

    updateStatus(message, color = '#6c757d') {
        const statusDiv = document.getElementById('badge-status');
        if (statusDiv) { statusDiv.textContent = message; statusDiv.style.color = color; }
    }
}

/* ----------------------------------------------------------
 * ✅ Service principal Spring Boot
 * ---------------------------------------------------------- */
class SpringBootApiService {
    constructor(env) {
        this.env = env;
        this.orm = env.services.orm;
        this.dialog = env.services.dialog;
        this.notification = env.services.notification;

        this.authService = new CashierAuthService(env);
        this.badgeService = new BadgeService(env, this.authService);
        this.badgeInterface = null;

        this.loginPopup = null; // pour le popup pro
        
        this.isOnline = true;
        this.offlineTransactions = [];

        this.cashierCache = new CashierCacheService(env, this.authService);

    }

    showProfessionalLogin(onSuccess) {
        if (!this.loginPopup) this.loginPopup = new ProfessionalLoginPopup(this);
        this.loginPopup.show(onSuccess);
    }

    initializeInterface() {
        this.badgeInterface = new SimpleBadgeInterface(this);
        this.badgeInterface.create();
        this.createConnectionIndicator();
        this.startConnectionMonitoring();

    }
    // ✅ NOUVEAU : Démarrer surveillance automatique
    startConnectionMonitoring() {
        // Éviter les doublons
        if (this.connectionMonitor) {
            clearInterval(this.connectionMonitor);
        }
        
        // Vérifier toutes les 10 secondes
        this.connectionMonitor = setInterval(() => {
            this.checkConnection();
        }, 10000); // 10 secondes
        
        console.log('🔄 Surveillance connexion démarrée (10s)');
    }

    // ✅ NOUVEAU : Arrêter surveillance
    stopConnectionMonitoring() {
        if (this.connectionMonitor) {
            clearInterval(this.connectionMonitor);
            this.connectionMonitor = null;
            console.log('⏹️ Surveillance connexion arrêtée');
        }
    }
    
    async checkConnection() {
        try {
            

            const response = await fetch('http://localhost:8080/api/payments/health', {
                method: 'GET',
                timeout: 3000
            });
            this.isOnline = response.ok;
            console.log(this.isOnline ? '✅ ONLINE' : '❌ OFFLINE');
            this.updateConnectionIndicator();
            return this.isOnline;
        } catch (error) {
            this.isOnline = false;
            console.log('❌ OFFLINE');
            this.updateConnectionIndicator();
            return false;
        }
    }
    // ✅ NOUVEAU : Créer indicateur visuel
    createConnectionIndicator() {
        // Éviter les doublons
        if (document.getElementById('connection-indicator')) return;
        
        const indicator = document.createElement('div');
        indicator.id = 'connection-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 300px;
            z-index: 9999;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            color: white;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(indicator);
        this.updateConnectionIndicator();
    }

    // ✅ NOUVEAU : Mettre à jour l'indicateur
    updateConnectionIndicator() {
        const indicator = document.getElementById('connection-indicator');
        if (!indicator) return;
        
        if (this.isOnline) {
            indicator.innerHTML = '🟢 ONLINE';
            indicator.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        } else {
            indicator.innerHTML = '🔴 OFFLINE';
            indicator.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        }
    }

    isAuthenticated() { return this.authService.isAuthenticated && this.authService.isTokenValid(); }

    prepareOrderData(order) {
        try {
            let customerEmail = 'unknown@pos.com';
            if (this.badgeInterface && this.badgeInterface.currentCustomer) {
                customerEmail = this.badgeInterface.currentCustomer.email || 'unknown@pos.com';
            } else {
                const customer = order.get_partner();
                customerEmail = customer ? (customer.email || 'unknown@pos.com') : 'unknown@pos.com';
            }
            const orderData = { order_id: order.name || order.uid, customer_email: customerEmail, lines: [] };
            const lines = order.orderlines || order.lines || order.get_orderlines() || [];
            if (!lines || lines.length === 0) throw new Error('No order lines found');

            for (const line of lines) {
                const product = line.product || line.product_id;
                const quantity = line.quantity || line.qty || 1;
                if (product && quantity > 0) {
                    const productId = typeof product === 'object' ? product.id : product;
                    orderData.lines.push({ product_id: productId, qty: quantity });
                }
            }
            if (orderData.lines.length === 0) throw new Error('No valid order lines processed');
            return orderData;
        } catch (error) {
            throw new Error(_t('Failed to prepare order data: ') + error.message);
        }
    }

    async validateOrder(order, connectorId = null) {
        try {
            if (!this.isAuthenticated()) throw new Error('Session expirée');
            const orderData = this.prepareOrderData(order);

            let connector = connectorId;
            if (!connector) {
                const connectors = await this.orm.searchRead('payment.connector', [['is_active', '=', true]], ['id'], { limit: 1 });
                if (connectors.length === 0) throw new Error(_t('No active payment connector found'));
                connector = connectors[0].id;
            }

            const result = await this.orm.call('payment.connector','validate_payment',[connector, orderData]);
            return result;
        } catch (error) {
            return { success: false, error: error.message || _t('Validation failed'), error_type: 'client_error' };
        }
    }

    showSuccessPopup(springResponse) {
        const data = springResponse.spring_response || springResponse.data || springResponse;
        const numeroTicket = this.generateTicketNumber();
        const date = new Date().toLocaleDateString('fr-FR');
        const heureTransaction = new Date().toLocaleTimeString('fr-FR');
        const montantTotal = data.montantTotal || 0;
        const partSalariale = data.partSalariale || 0;
        const partPatronale = data.partPatronale || 0;

        let utilisateurNomComplet = 'Client non identifié';
        let utilisateurEmail = '';
        if (this.badgeInterface && this.badgeInterface.currentCustomer) {
            const customer = this.badgeInterface.currentCustomer;
            utilisateurNomComplet = `${customer.nom} ${customer.prenom}`;
            utilisateurEmail = customer.email || '';
            if (customer.role && customer.role !== 'EMPLOYE') utilisateurNomComplet += ` - ${customer.role}`;
        } else {
            utilisateurNomComplet = data.utilisateurNomComplet || 'Client non identifié';
            utilisateurEmail = data.utilisateurEmail || '';
        }

        const articles = data.articles || [];
        let message = `🎉 TRANSACTION RÉUSSIE

👤 Client: ${utilisateurNomComplet}`;
        if (utilisateurEmail && utilisateurEmail.trim() !== '') {
            message += `\n📧 Email: ${utilisateurEmail}`;
        }
        message += `

📋 Détails:
• N° Ticket: ${numeroTicket}
• Date: ${date}
• Heure: ${heureTransaction}

🛒 Articles achetés:`;

        if (articles && articles.length > 0) {
            articles.forEach((article, index) => {
                const nom = article.nom || article.nomArticle || `Article ${index + 1}`;
                const quantite = article.quantite || article.quantiteTotale || 1;
                const prixUnitaire = article.prixUnitaire || 0;
                const montantArticle = article.montantTotal || (prixUnitaire * quantite);
                const subvention = article.subventionTotale || 0;
                const partClient = article.partSalariale || (montantArticle - subvention);

                message += `
• ${nom} x${quantite}
  Prix: ${prixUnitaire.toFixed(2)}€ | Total: ${montantArticle.toFixed(2)}€
  Subvention: ${subvention.toFixed(2)}€ | Votre part: ${partClient.toFixed(2)}€`;
            });
        } else {
            message += `\n• Aucun détail d'article disponible`;
        }

        message += `

💰 RÉSUMÉ FINANCIER:
• Prix total: ${montantTotal.toFixed(2)}€
• Subvention entreprise: ${partPatronale.toFixed(2)}€
• Votre part: ${partSalariale.toFixed(2)}€

✅ Montant déduit de votre badge avec succès`;
        if (partPatronale > 0) message += `\n🎯 Vous avez économisé ${partPatronale.toFixed(2)}€ grâce à la subvention !`;

        // ✅ NOUVEAU : Impression automatique AVANT le popup
        this.printTicket(data, numeroTicket, date, heureTransaction);

        // ✅ POPUP SIMPLIFIÉ sans bouton imprimer
        this.dialog.add(AlertDialog, {
            title: _t('✅ Paiement Validé avec Succès'),
            body: message + '\n\n🖨️ Ticket imprimé automatiquement',
            confirmLabel: _t('OK')
        });

        this.notification.add(
            _t('Paiement validé pour ') + utilisateurNomComplet.split(' - ')[0] +
            _t(' - ') + articles.length + _t(' article(s) - Subvention: ') + partPatronale.toFixed(2) + '€',
            { type: 'success', sticky: false }
        );
    }

    printTicket(springData, numeroTicket, date, heureTransaction) {
        const ticketContent = this.generateTicketContent(springData, numeroTicket, date, heureTransaction);
        const printWindow = window.open('', 'TicketPrint', 'width=400,height=600');
        printWindow.document.write(ticketContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    generateTicketContent(data, numeroTicket, date, heureTransaction) {
        const articles = data.articles || [];
        const montantTotal = data.montantTotal || 0;
        const partSalariale = data.partSalariale || 0;
        const partPatronale = data.partPatronale || 0;

        let utilisateurNomComplet = 'Client';
        if (this.badgeInterface && this.badgeInterface.currentCustomer) {
            const customer = this.badgeInterface.currentCustomer;
            utilisateurNomComplet = `${customer.nom} ${customer.prenom}`;
            if (customer.role && customer.role !== 'EMPLOYE') utilisateurNomComplet += ` - ${customer.role}`;
        } else if (data.utilisateurNomComplet) {
            utilisateurNomComplet = data.utilisateurNomComplet;
        }

        let articlesHtml = '';
        articles.forEach(article => {
            const nom = article.nom || 'Article';
            const quantite = article.quantite || 1;
            const prixUnitaire = article.prixUnitaire || 0;
            const montantArticle = article.montantTotal || 0;
            const subvention = article.subventionTotale || 0;
            const partClient = article.partSalariale || 0;
            articlesHtml += `
            <tr>
                <td style="text-align:left;">${nom} x${quantite}</td>
                <td style="text-align:right;">${montantArticle.toFixed(2)}€</td>
            </tr>
            <tr>
                <td style="text-align:right;font-size:10px;color:#666;">
                    Prix: ${prixUnitaire.toFixed(2)}€ | Subv: ${subvention.toFixed(2)}€
                </td>
                <td style="text-align:right;font-size:10px;color:#666;">
                    Votre part: ${partClient.toFixed(2)}€
                </td>
            </tr>`;
        });

        return `
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket Cantine</title>
        <style>
            body { font-family: 'Courier New', monospace; font-size:12px; margin:0; padding:10px; width:300px; }
            .center { text-align:center; } .right { text-align:right; } .bold { font-weight:bold; }
            .separator { border-top:1px dashed #333; margin:8px 0; }
            table { width:100%; border-collapse:collapse; } td { padding:2px 0; vertical-align:top; }
            .total-line { border-top:1px solid #333; font-weight:bold; }
        </style></head><body>
            <div class="center bold">===============================<br>CANTINE ENTREPRISE<br>===============================</div>
            <div class="separator"></div>
            <div><strong>Ticket:</strong> ${numeroTicket}<br><strong>Date:</strong> ${date}<br><strong>Heure:</strong> ${heureTransaction}<br><strong>Client:</strong> ${utilisateurNomComplet}</div>
            <div class="separator"></div>
            <div class="bold">ARTICLES:</div>
            <table>${articlesHtml}</table>
            <div class="separator"></div>
            <table>
                <tr><td>Sous-total:</td><td class="right">${montantTotal.toFixed(2)}€</td></tr>
                <tr><td>Subvention entreprise:</td><td class="right">-${partPatronale.toFixed(2)}€</td></tr>
                <tr class="total-line"><td><strong>À PAYER:</strong></td><td class="right"><strong>${partSalariale.toFixed(2)}€</strong></td></tr>
            </table>
            <div class="separator"></div>
            <div class="center">✅ Montant débité de votre badge<br>${partPatronale > 0 ? `🎯 Économie: ${partPatronale.toFixed(2)}€` : ''}<br><br>Merci et bon appétit !</div>
            <div class="center">===============================</div>
        </body></html>`;
    }

    generateTicketNumber() {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `TK${timestamp.slice(-6)}${random}`;
    }

    showError(errorMessage, errorType = 'error', springResponse = null) {
        const title = this.getErrorTitle(errorType, springResponse);
        let fullMessage = errorMessage;
        if (springResponse) {
            if (springResponse.required_amount && springResponse.current_balance) {
                fullMessage += `\n\nDétails:\n• Montant requis: ${springResponse.required_amount}€\n• Solde actuel: ${springResponse.current_balance}€`;
            }
            if (springResponse.transactionId) fullMessage += `\n• Transaction ID: ${springResponse.transactionId}`;
        }
        this.dialog.add(AlertDialog, { title, body: fullMessage, confirmLabel: _t('OK') });
        const notifType = errorType === 'validation_error' ? 'warning' : 'danger';
        this.notification.add(errorMessage, { type: notifType, sticky: false });
    }

    getErrorTitle(errorType, springResponse = null) {
        if (springResponse && springResponse.message) {
            if (springResponse.message.includes('Solde insuffisant')) return _t('Insufficient Balance');
            if (springResponse.message.includes('Product not found')) return _t('Product Not Found');
        }
        const titles = {
            'timeout': _t('Connection Timeout'), 'connection': _t('Connection Error'),
            'client_error': _t('Validation Error'), 'server_error': _t('Server Error'),
            'validation_error': _t('Payment Validation Failed'), 'insufficient_funds': _t('Insufficient Funds'),
            'invalid_product': _t('Invalid Product'), 'processing_error': _t('Processing Error'), 'unexpected': _t('Unexpected Error')
        };
        return titles[errorType] || _t('Error');
    }

    showSuccess(message, springResponse = null) {
        if (springResponse) this.showSuccessPopup(springResponse);
        else this.notification.add(message || _t('Validation successful'), { type: 'success' });
    }
}

/* ----------------------------------------------------------
 * ✅ PATCH ProductScreen
 * ---------------------------------------------------------- */
patch(ProductScreen.prototype, {
    setup() {
        super.setup();
        this.springBootApi = new SpringBootApiService(this.env);
        this.checkAuthenticationAsync();
            // ✅ NOUVEAU : Rendre accessible globalement pour les tests
        window.springBootApi = this.springBootApi;

    },

    async checkAuthenticationAsync() {
        const hasValidAuth = await this.springBootApi.authService.loadStoredAuth();
        if (!hasValidAuth) {
            // ➜ Utilise le popup moderne
            this.springBootApi.showProfessionalLogin((result) => {
                this.springBootApi.notification.add(
                    `Bienvenue ${result.cashier.nom} ${result.cashier.prenom}`, { type: 'success' }
                );
                setTimeout(() => { this.initializePOSInterface(); }, 500);
            });
            return;
        }
        this.initializePOSInterface();
    },

    initializePOSInterface() {
        this.springBootApi.initializeInterface();
        this.createSpringBootButton();
        this.hidePaymentButton();
        this.hideCustomerButtonDefinitively(); // ← AJOUTEZ CETTE LIGNE


        const cashier = this.springBootApi.authService.getCurrentCashier();
        if (cashier) {
            this.springBootApi.notification.add(`Session POS: ${cashier.nom} ${cashier.prenom}`, { type: 'success' });
        }
    },
   hideCustomerButtonDefinitively() {
    // 🎯 SOLUTION ULTRA-PRÉCISE ET SÛRE
    
    // 1. CSS ciblé uniquement sur le bouton exact
    const style = document.createElement('style');
    style.id = 'spring-boot-hide-customer';
    style.textContent = `
        /* Cibler uniquement le bouton Customer exact d'Odoo 18 */
        button.set-partner.btn.btn-light.btn-lg.lh-lg.text-truncate.w-auto {
            display: none !important;
        }
        
        /* Backup pour d'autres structures possibles */
        .set-partner:has-text("Customer") {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
    
    // 2. JavaScript très précis
    const hideExactCustomerButton = () => {
        // Chercher UNIQUEMENT les boutons avec le texte exact "Customer"
        const customerButtons = document.querySelectorAll('button');
        customerButtons.forEach(btn => {
            // Vérifications multiples pour être 100% sûr
            if (btn.classList.contains('set-partner') && 
                btn.textContent.trim() === 'Customer') {
                btn.style.display = 'none';
                console.log('✅ Bouton Customer masqué par Spring Boot');
            }
        });
    };
    
    // 3. Exécuter immédiatement et avec délai
    hideExactCustomerButton();
    setTimeout(hideExactCustomerButton, 1000);
    setTimeout(hideExactCustomerButton, 3000);
    
    // 4. Observer TRÈS sélectif
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    // Chercher seulement dans les nouveaux éléments
                    const newCustomerBtn = node.querySelector?.('button.set-partner');
                    if (newCustomerBtn && newCustomerBtn.textContent.trim() === 'Customer') {
                        newCustomerBtn.style.display = 'none';
                        console.log('✅ Nouveau bouton Customer masqué');
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, { 
        childList: true, 
        subtree: true 
    });
    
    console.log('🎯 Système de masquage Customer activé - Ultra-précis');
 } , 

    hidePaymentButton() {
        const style = document.createElement('style');
        style.textContent = `
            .actionpad .validation .btn-primary:last-child,
            .o_pos_actionpad .o_pos_validation .payment,
            .pos-actionpad .payment-button,
            .control-buttons .payment,
            [data-bs-original-title="Payment"],
            .payment-screen-button { display: none !important; }
        `;
        document.head.appendChild(style);
        setTimeout(() => {
            ['.actionpad .validation .btn-primary:last-child','.payment-button','[data-bs-original-title="Payment"]']
                .forEach(sel => { const btn = document.querySelector(sel); if (btn) btn.style.display = 'none'; });
        }, 1000);
    },

    createSpringBootButton() {
        setTimeout(() => {
            const controlButtons = document.querySelector('.control-buttons');
            if (controlButtons && !document.querySelector('.spring-validate-btn')) {
                const springButton = document.createElement('div');
                springButton.className = 'control-button spring-validate-btn';
                springButton.innerHTML = `
                    <i class="fa fa-server" style="font-size:18px;"></i><br/>
                    <span style="font-size:11px;font-weight:bold;">SPRING<br/>VALIDATE</span>`;
                springButton.addEventListener('click', () => this.validateWithSpringBoot());
                controlButtons.appendChild(springButton);
            }
        }, 1000);
    },

    async validateWithSpringBoot() {
        const order = this.pos.get_order();
        if (!order) { this.springBootApi.showError(_t('Commande non trouvée')); return; }
        const lines = order.orderlines || order.lines || order.get_orderlines() || [];
        if (!lines || lines.length === 0) { this.springBootApi.showError(_t('Panier vide - Ajoutez des articles')); return; }

        const customer = order.badge_customer || order.get_partner();
        if (!customer) { const confirmed = confirm(_t('Aucun client sélectionné. Continuer ?')); if (!confirmed) return; }

        try {
            this.springBootApi.notification.add('Validation en cours...', { type: 'info' });
            const result = await this.springBootApi.validateOrder(order);
            if (result.success) this.springBootApi.showSuccess('Transaction réussie', result);
            else this.springBootApi.showError(result.error, result.error_type);
        } catch (error) {
            this.springBootApi.showError('Erreur: ' + error.message);
        }
    }
});

/* ----------------------------------------------------------
 * ✅ PATCH PaymentScreen
 * ---------------------------------------------------------- */
patch(PaymentScreen.prototype, {
    setup() { super.setup(); this.springBootApi = new SpringBootApiService(this.env); }
});

/* ----------------------------------------------------------
 * ✅ Composant bouton (optionnel)
 * ---------------------------------------------------------- */
export class SpringBootValidateButton extends Component {
    static template = "pos_spring_connector.SpringBootValidateButton";
    setup() { this.springBootApi = new SpringBootApiService(this.env); this.pos = useService("pos"); }
    async onClick() {
        const order = this.pos.get_order();
        if (!order || order.orderlines.length === 0) { this.springBootApi.showError(_t('Panier vide')); return; }
        try {
            this.springBootApi.notification.add('Validation...', { type: 'info' });
            const result = await this.springBootApi.validateOrder(order);
            if (result.success) this.springBootApi.showSuccess('Validé', result);
            else this.springBootApi.showError(result.error);
        } catch {
            this.springBootApi.showError('Erreur validation');
        }
    }

}

export { SpringBootApiService, CashierAuthService, BadgeService, SimpleBadgeInterface, ProfessionalLoginPopup };
