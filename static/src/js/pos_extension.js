/** @odoo-module **/

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

/**
 * ✅ Service d'authentification caissier - VERSION SIMPLIFIÉE
 */
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

    /**
     * Authentifier le caissier
     */
    async authenticateCashier(email, password) {
        try {
            console.log('🔐 ÉTAPE 1/4 : Login caissier...', email);
            
            // ÉTAPE 1 : Login avec debug détaillé
            console.log('🌐 Envoi requête vers:', 'http://localhost:8080/api/auth/login');
            console.log('📤 Données envoyées:', { email, password: '***' });
            
            // ✅ NOUVEAU : Headers explicites identiques à la console
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
            
            console.log('📋 Headers envoyés:', headers);
            
            const requestBody = JSON.stringify({ email, password });
            console.log('📦 Body exact:', requestBody);
            
            const loginResponse = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST',
                headers: headers,
                body: requestBody,
                mode: 'cors',
                credentials: 'omit'  // ✅ Pas de cookies/credentials
            });

            console.log('📥 Réponse reçue - Status:', loginResponse.status);
            console.log('📥 Réponse reçue - OK:', loginResponse.ok);
            
            const loginResult = await loginResponse.json();
            console.log('📋 Données JSON:', loginResult);

            if (!loginResponse.ok || loginResult.status !== 200) {
                console.error('❌ Erreur dans la réponse:', loginResult);
                throw new Error(loginResult.message || 'Authentification échouée');
            }

            const tempJWT = loginResult.token;
            console.log('✅ ÉTAPE 1/4 : JWT récupéré');

            // ÉTAPE 2 : Vérification compte
            console.log('🔍 ÉTAPE 2/4 : Vérification du rôle...');
            const accountResponse = await fetch('http://localhost:8080/api/utilisateurs/account', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tempJWT}`,
                    'Content-Type': 'application/json'
                }
            });

            const accountResult = await accountResponse.json();

            if (!accountResponse.ok || accountResult.status !== 200) {
                throw new Error('Erreur vérification du compte');
            }

            console.log('✅ ÉTAPE 2/4 : Données compte récupérées');

            // ÉTAPE 3 : Vérifier rôle
            const userRole = accountResult.data.role;
            const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'CAISSIER'];
            
            if (!allowedRoles.includes(userRole)) {
                throw new Error(`Accès refusé - Rôle "${userRole}" non autorisé`);
            }

            console.log(`✅ ÉTAPE 3/4 : Rôle "${userRole}" autorisé`);

            // ÉTAPE 4 : Stocker
            this.jwtToken = tempJWT;
            this.currentCashier = accountResult.data;
            this.isAuthenticated = true;
            this.tokenExpiration = Date.now() + (8 * 60 * 60 * 1000);

            sessionStorage.setItem('pos_jwt_token', this.jwtToken);
            sessionStorage.setItem('pos_cashier', JSON.stringify(this.currentCashier));
            sessionStorage.setItem('pos_token_expiration', this.tokenExpiration.toString());

            console.log('🎉 ÉTAPE 4/4 : Authentification complète réussie');

            return {
                success: true,
                cashier: this.currentCashier,
                token: this.jwtToken
            };

        } catch (error) {
            console.error('❌ Erreur authentification:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Vérifier token existant
     */
    async verifyExistingToken() {
        try {
            const token = sessionStorage.getItem('pos_jwt_token');
            const expiration = sessionStorage.getItem('pos_token_expiration');
            
            if (!token || !expiration) {
                console.log('❌ Pas de token stocké');
                return false;
            }

            if (Date.now() > parseInt(expiration)) {
                console.log('❌ Token expiré (8H)');
                this.logout();
                return false;
            }

            console.log('🔍 Vérification token...');
            const response = await fetch('http://localhost:8080/api/utilisateurs/account', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (response.ok && result.status === 200) {
                const userRole = result.data.role;
                const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'CAISSIER'];
                
                if (allowedRoles.includes(userRole)) {
                    this.jwtToken = token;
                    this.currentCashier = result.data;
                    this.isAuthenticated = true;
                    this.tokenExpiration = parseInt(expiration);
                    
                    sessionStorage.setItem('pos_cashier', JSON.stringify(this.currentCashier));
                    
                    console.log('✅ Token valide pour:', result.data.nom);
                    return true;
                }
            }
            
            console.log('❌ Token invalide');
            this.logout();
            return false;

        } catch (error) {
            console.error('❌ Erreur vérification:', error);
            this.logout();
            return false;
        }
    }

    async loadStoredAuth() {
        return await this.verifyExistingToken();
    }

    logout() {
        this.jwtToken = null;
        this.currentCashier = null;
        this.isAuthenticated = false;
        this.tokenExpiration = null;
        
        sessionStorage.removeItem('pos_jwt_token');
        sessionStorage.removeItem('pos_cashier');
        sessionStorage.removeItem('pos_token_expiration');
        
        console.log('🚪 Déconnexion effectuée');
    }

    getJWTToken() { return this.jwtToken; }
    getCurrentCashier() { return this.currentCashier; }
    isTokenValid() { 
        return this.isAuthenticated && this.tokenExpiration && Date.now() < this.tokenExpiration; 
    }
}

/**
 * ✅ Service de gestion des badges - VERSION SIMPLIFIÉE
 */
class BadgeService {
    constructor(env, authService) {
        this.env = env;
        this.authService = authService;
        this.notification = env.services.notification;
    }

    async validateBadge(badgeCode) {
        try {
            const jwt = this.authService.getJWTToken();
            if (!jwt || !this.authService.isTokenValid()) {
                throw new Error('Session expirée');
            }

            console.log('🔍 Validation badge:', badgeCode);
            
            const response = await fetch(`http://localhost:8080/api/utilisateurs/badge?codeBadge=${badgeCode}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (response.ok && result.status === 200) {
                console.log('✅ Badge valide pour:', result.data.nom);
                return {
                    success: true,
                    customer: result.data
                };
            } else {
                console.log('❌ Badge invalide:', result.message);
                return {
                    success: false,
                    error: result.message || 'Badge non valide'
                };
            }

        } catch (error) {
            console.error('❌ Erreur badge:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

/**
 * ✅ Interface badge - VERSION SIMPLIFIÉE
 */
class SimpleBadgeInterface {
    constructor(springBootApi) {
        this.springBootApi = springBootApi;
        this.currentCustomer = null;
    }

    create() {
        console.log('🎨 Création interface badge...');
        this.replaceCashierHeader();
        this.createBadgeArea();
    }

    /**
     * ✅ CORRIGÉ : Remplacer l'en-tête Mitchell Admin ET supprimer "med kacha"
     */
    replaceCashierHeader() {
        setTimeout(() => {
            // ✅ CORRECTION 1 : Remplacer Mitchell Admin en haut à droite
            const userMenuSelectors = [
                '.o_user_menu',
                '.navbar .dropdown',
                '.o_main_navbar .dropdown',
                '.o_navbar_apps_menu + .dropdown'
            ];

            let userMenu = null;
            for (const selector of userMenuSelectors) {
                userMenu = document.querySelector(selector);
                if (userMenu) break;
            }

            if (userMenu) {
                const cashier = this.springBootApi.authService.getCurrentCashier();
                const cashierName = cashier ? `${cashier.nom} ${cashier.prenom}` : 'Caissier';
                
                console.log('✅ Remplacement en-tête Mitchell Admin pour:', cashierName);
                
                userMenu.innerHTML = `
                    <div style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-weight: bold;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    " onclick="window.posLogout()">
                        <i class="fa fa-user-circle"></i>
                        <span>${cashierName}</span>
                        <i class="fa fa-sign-out" title="Déconnexion"></i>
                    </div>
                `;

                // Fonction de déconnexion globale
                window.posLogout = () => {
                    if (confirm('Voulez-vous vous déconnecter ?')) {
                        this.springBootApi.authService.logout();
                        window.location.reload();
                    }
                };
            } else {
                console.log('⚠️ En-tête Mitchell Admin non trouvé');
            }

            // ✅ CORRECTION 2 : Supprimer "med kacha" en bas à gauche
            this.hideCustomerButton();
        }, 2000);
    }

    /**
     * ✅ NOUVEAU : Supprimer le bouton client "med kacha"
     */
    hideCustomerButton() {
        setTimeout(() => {
            const customerButtonSelectors = [
                '.partner-button',
                '.customer-button', 
                '.client-button',
                '[data-bs-original-title*="Customer"]',
                '.o_partner_button'
            ];

            for (const selector of customerButtonSelectors) {
                const customerBtn = document.querySelector(selector);
                if (customerBtn && customerBtn.textContent.includes('med kacha')) {
                    customerBtn.style.display = 'none';
                    console.log('✅ Bouton "med kacha" supprimé');
                    break;
                }
            }

            // Alternative : chercher par contenu texte
            const allButtons = document.querySelectorAll('button, .btn, div[role="button"]');
            allButtons.forEach(btn => {
                if (btn.textContent && btn.textContent.toLowerCase().includes('med kacha')) {
                    btn.style.display = 'none';
                    console.log('✅ Élément "med kacha" supprimé par contenu');
                }
            });
        }, 1000);
    }

    /**
     * ✅ Créer zone badge simple
     */
    createBadgeArea() {
        setTimeout(() => {
            // Rechercher zone à remplacer
            const targetSelectors = [
                '.partner-button',
                '.customer-display',
                '.o_partner_button'
            ];

            let targetArea = null;
            for (const selector of targetSelectors) {
                targetArea = document.querySelector(selector);
                if (targetArea) break;
            }

            if (targetArea) {
                console.log('✅ Zone client trouvée, remplacement...');
                targetArea.innerHTML = this.getBadgeHTML();
                this.setupBadgeEvents();
            } else {
                console.log('⚠️ Zone client non trouvée, création nouvelle zone...');
                this.createNewBadgeArea();
            }
        }, 1500);
    }

    getBadgeHTML() {
        return `
            <div id="pos-badge-interface" style="
                background: white;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                padding: 12px;
                margin: 4px 0;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                font-size: 13px;
            ">
                <!-- Affichage client compact -->
                <div id="customer-display" style="
                    background: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 4px;
                    padding: 8px 12px;
                    margin-bottom: 8px;
                    text-align: center;
                    min-height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <div style="color: #6c757d; font-size: 12px;">
                        <i class="fa fa-user-o" style="margin-right: 6px;"></i>
                        <span>Aucun client</span>
                    </div>
                </div>

                <!-- Zone scan compacte -->
                <div style="display: flex; gap: 8px; align-items: center;">
                    <label style="
                        font-weight: 500;
                        color: #495057;
                        font-size: 12px;
                        white-space: nowrap;
                    ">
                        🏷️ Badge:
                    </label>
                    
                    <input 
                        type="text" 
                        id="badge-input" 
                        placeholder="Scanner badge..."
                        style="
                            flex: 1;
                            padding: 6px 8px;
                            border: 1px solid #ced4da;
                            border-radius: 3px;
                            font-size: 12px;
                            min-width: 120px;
                        "
                    />
                    
                    <button 
                        id="validate-badge"
                        style="
                            padding: 6px 10px;
                            background: #28a745;
                            color: white;
                            border: none;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 11px;
                            font-weight: 500;
                        "
                    >
                        ✓
                    </button>
                </div>
                
                <div id="badge-status" style="
                    margin-top: 4px;
                    font-size: 10px;
                    color: #6c757d;
                    text-align: center;
                ">
                    Prêt
                </div>
            </div>
        `;
    }

    createNewBadgeArea() {
        const badgeContainer = document.createElement('div');
        badgeContainer.innerHTML = this.getBadgeHTML();
        
        // ✅ NOUVEAU : Positionner de manière professionnelle
        const posContent = document.querySelector('.pos-content, .o_pos_content, .point-of-sale');
        if (posContent) {
            // Chercher la zone gauche du POS (zone panier/total)
            const leftPanel = posContent.querySelector('.leftpane, .order-summary, .pos-leftpane');
            
            if (leftPanel) {
                // Insérer en haut de la zone gauche
                leftPanel.insertBefore(badgeContainer, leftPanel.firstChild);
                console.log('✅ Interface badge intégrée dans panneau gauche');
            } else {
                // Fallback : en haut du contenu principal
                posContent.insertBefore(badgeContainer, posContent.firstChild);
                console.log('✅ Interface badge en haut du contenu');
            }
            
            this.setupBadgeEvents();
        }
    }

    setupBadgeEvents() {
        const badgeInput = document.getElementById('badge-input');
        const validateBtn = document.getElementById('validate-badge');

        if (badgeInput && validateBtn) {
            console.log('✅ Events badge configurés');
            
            // Validation sur Entrée
            badgeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.validateBadge();
                }
            });

            // Validation sur bouton
            validateBtn.addEventListener('click', () => {
                this.validateBadge();
            });

            // Focus automatique
            badgeInput.focus();
        } else {
            console.log('❌ Éléments badge non trouvés');
        }
    }

    async validateBadge() {
        const badgeInput = document.getElementById('badge-input');
        const statusDiv = document.getElementById('badge-status');
        const customerDisplay = document.getElementById('customer-display');
        
        const badgeCode = badgeInput.value.trim();

        if (!badgeCode) {
            this.updateStatus('⚠️ Code badge requis', '#ffc107');
            return;
        }

        try {
            this.updateStatus('🔄 Validation...', '#17a2b8');
            
            const result = await this.springBootApi.badgeService.validateBadge(badgeCode);

            if (result.success) {
                // Succès
                this.currentCustomer = result.customer;
                this.updateStatus('✅ Badge valide', '#28a745');
                
                // Afficher client compact
                customerDisplay.innerHTML = `
                    <div style="text-align: center;">
                        <div style="
                            background: #28a745;
                            color: white;
                            padding: 4px 8px;
                            border-radius: 12px;
                            display: inline-flex;
                            align-items: center;
                            font-size: 11px;
                            font-weight: 500;
                        ">
                            <i class="fa fa-user" style="margin-right: 4px; font-size: 10px;"></i>
                            ${result.customer.nom} ${result.customer.prenom}
                        </div>
                        <div style="font-size: 10px; color: #666; margin-top: 2px;">
                            Solde: ${result.customer.solde ? result.customer.solde.toFixed(2) + '€' : 'N/A'}
                        </div>
                    </div>
                `;

                // Notification
                this.springBootApi.notification.add(
                    `Client: ${result.customer.nom} ${result.customer.prenom}`,
                    { type: 'success' }
                );

                // Vider champ
                badgeInput.value = '';

            } else {
                // Échec - garder client précédent
                this.updateStatus(`❌ ${result.error}`, '#dc3545');
                
                this.springBootApi.notification.add(
                    `Badge invalide: ${result.error}`,
                    { type: 'warning' }
                );
            }

            // Focus pour prochain scan
            setTimeout(() => badgeInput.focus(), 1000);

        } catch (error) {
            console.error('❌ Erreur validation:', error);
            this.updateStatus('❌ Erreur connexion', '#dc3545');
        }
    }

    updateStatus(message, color = '#6c757d') {
        const statusDiv = document.getElementById('badge-status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.style.color = color;
        }
    }
}

/**
 * ✅ Service principal - VERSION SIMPLIFIÉE
 */
class SpringBootApiService {
    constructor(env) {
        this.env = env;
        this.orm = env.services.orm;
        this.dialog = env.services.dialog;
        this.notification = env.services.notification;
        
        this.authService = new CashierAuthService(env);
        this.badgeService = new BadgeService(env, this.authService);
        this.badgeInterface = null;
    }

    initializeInterface() {
        console.log('🎨 Initialisation interface...');
        this.badgeInterface = new SimpleBadgeInterface(this);
        this.badgeInterface.create();
    }

    isAuthenticated() {
        return this.authService.isAuthenticated && this.authService.isTokenValid();
    }

    // ============= VOS MÉTHODES EXISTANTES COMPLÈTES =============
    
    prepareOrderData(order) {
        try {
            // ✅ CORRECTION : Utiliser l'email du badge scanné pour les subventions
            let customerEmail = 'unknown@pos.com';
            
            // Priorité 1 : Email du badge scanné (pour les subventions)
            if (this.badgeInterface && this.badgeInterface.currentCustomer) {
                customerEmail = this.badgeInterface.currentCustomer.email || 'unknown@pos.com';
                console.log('✅ Utilisation email badge pour subventions:', customerEmail);
            } else {
                // Priorité 2 : Client Odoo standard
                const customer = order.get_partner();
                customerEmail = customer ? (customer.email || 'unknown@pos.com') : 'unknown@pos.com';
                console.log('⚠️ Utilisation email Odoo standard:', customerEmail);
            }
            
            const orderData = {
                order_id: order.name || order.uid,
                customer_email: customerEmail,
                lines: []
            };

            const lines = order.orderlines || order.lines || order.get_orderlines() || [];
            
            if (!lines || lines.length === 0) {
                throw new Error('No order lines found');
            }

            for (const line of lines) {
                const product = line.product || line.product_id;
                const quantity = line.quantity || line.qty || 1;
                
                if (product && quantity > 0) {
                    const productId = typeof product === 'object' ? product.id : product;
                    orderData.lines.push({
                        product_id: productId,
                        qty: quantity
                    });
                }
            }

            if (orderData.lines.length === 0) {
                throw new Error('No valid order lines processed');
            }

            console.log('📤 Données envoyées à Spring Boot:', orderData);
            return orderData;

        } catch (error) {
            console.error('Erreur préparation:', error);
            throw new Error(_t('Failed to prepare order data: ') + error.message);
        }
    }

    async validateOrder(order, connectorId = null) {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Session expirée');
            }

            const orderData = this.prepareOrderData(order);
            
            let connector = connectorId;
            if (!connector) {
                const connectors = await this.orm.searchRead(
                    'payment.connector',
                    [['is_active', '=', true]],
                    ['id'],
                    { limit: 1 }
                );
                
                if (connectors.length === 0) {
                    throw new Error(_t('No active payment connector found'));
                }
                
                connector = connectors[0].id;
            }

            const result = await this.orm.call(
                'payment.connector',
                'validate_payment',
                [connector, orderData]
            );

            return result;

        } catch (error) {
            console.error('Erreur validation:', error);
            return {
                success: false,
                error: error.message || _t('Validation failed'),
                error_type: 'client_error'
            };
        }
    }

    /**
     * ✅ CORRIGÉ : Afficher la pop-up avec les données du badge scanné
     */
    showSuccessPopup(springResponse) {
        console.log('🔍 DEBUG - Données Spring Boot reçues:', springResponse);
        
        const data = springResponse.spring_response || springResponse.data || springResponse;
        console.log('🔍 DEBUG - Data extraite:', data);
        
        const numeroTicket = this.generateTicketNumber();
        const date = new Date().toLocaleDateString('fr-FR');
        const heureTransaction = new Date().toLocaleTimeString('fr-FR');
        const montantTotal = data.montantTotal || 0;
        const partSalariale = data.partSalariale || 0;
        const partPatronale = data.partPatronale || 0;

        // ✅ CORRECTION : Utiliser les données du badge scanné au lieu du serveur
        let utilisateurNomComplet = 'Client non identifié';
        let utilisateurEmail = '';
        let utilisateurCategorie = '';

        if (this.badgeInterface && this.badgeInterface.currentCustomer) {
            const customer = this.badgeInterface.currentCustomer;
            utilisateurNomComplet = `${customer.nom} ${customer.prenom}`;
            utilisateurEmail = customer.email || '';
            
            if (customer.role && customer.role !== 'EMPLOYE') {
                utilisateurCategorie = customer.role;
                utilisateurNomComplet += ` - ${customer.role}`;
            }
            
            console.log('✅ Utilisation données badge scanné:', { utilisateurNomComplet, utilisateurEmail, utilisateurCategorie });
        } else {
            // Fallback vers les données serveur si pas de badge
            utilisateurNomComplet = data.utilisateurNomComplet || 'Client non identifié';
            utilisateurEmail = data.utilisateurEmail || '';
            utilisateurCategorie = data.utilisateurCategorie || '';
            
            console.log('⚠️ Fallback données serveur:', { utilisateurNomComplet, utilisateurEmail, utilisateurCategorie });
        }

        const articles = data.articles || [];
        console.log('🔍 DEBUG - Articles extraits:', articles);

        let message = `🎉 TRANSACTION RÉUSSIE

👤 Client: ${utilisateurNomComplet}`;

        if (utilisateurEmail && utilisateurEmail.trim() !== '') {
            message += `
📧 Email: ${utilisateurEmail}`;
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
            message += `
• Aucun détail d'article disponible`;
        }

        message += `

💰 RÉSUMÉ FINANCIER:
• Prix total: ${montantTotal.toFixed(2)}€
• Subvention entreprise: ${partPatronale.toFixed(2)}€
• Votre part: ${partSalariale.toFixed(2)}€

✅ Montant déduit de votre badge avec succès`;

        if (partPatronale > 0) {
            message += `
🎯 Vous avez économisé ${partPatronale.toFixed(2)}€ grâce à la subvention !`;
        }

        // ✅ POPUP AVEC BOUTON IMPRIMER
        this.dialog.add(ConfirmationDialog, {
            title: _t('✅ Paiement Validé avec Succès'),
            body: message,
            confirmLabel: _t('🖨️ Imprimer'),
            cancelLabel: _t('Fermer'),
            confirm: () => {
                console.log('🖨️ Bouton Imprimer cliqué');
                this.printTicket(data, numeroTicket, date, heureTransaction);
            },
            cancel: () => {
                console.log('Pop-up de succès fermée');
            }
        });

        // Notification de succès avec bon nom
        this.notification.add(
            _t('Paiement validé pour ') + utilisateurNomComplet.split(' - ')[0] + 
            _t(' - ') + articles.length + _t(' article(s) - Subvention: ') + partPatronale.toFixed(2) + '€',
            {
                type: 'success',
                sticky: false
            }
        );
    }

    /**
     * ✅ REMIS : Fonction d'impression du ticket
     */
    printTicket(springData, numeroTicket, date, heureTransaction) {
        console.log('🖨️ Impression ticket démarrée');
        
        const ticketContent = this.generateTicketContent(springData, numeroTicket, date, heureTransaction);
        
        const printWindow = window.open('', 'TicketPrint', 'width=400,height=600');
        printWindow.document.write(ticketContent);
        printWindow.document.close();
        
        printWindow.focus();
        printWindow.print();
        
        console.log("✅ Ticket envoyé à l'imprimante");
    }

    /**
     * ✅ CORRIGÉ : Utiliser les données du badge dans le ticket
     */
    generateTicketContent(data, numeroTicket, date, heureTransaction) {
        const articles = data.articles || [];
        const montantTotal = data.montantTotal || 0;
        const partSalariale = data.partSalariale || 0;
        const partPatronale = data.partPatronale || 0;
        
        // ✅ CORRECTION : Utiliser les données du client badge
        let utilisateurNomComplet = 'Client';
        if (this.badgeInterface && this.badgeInterface.currentCustomer) {
            const customer = this.badgeInterface.currentCustomer;
            utilisateurNomComplet = `${customer.nom} ${customer.prenom}`;
            if (customer.role && customer.role !== 'EMPLOYE') {
                utilisateurNomComplet += ` - ${customer.role}`;
            }
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
                <td style="text-align: left;">${nom} x${quantite}</td>
                <td style="text-align: right;">${montantArticle.toFixed(2)}€</td>
            </tr>
            <tr>
                <td style="text-align: right; font-size: 10px; color: #666;">
                    Prix: ${prixUnitaire.toFixed(2)}€ | Subv: ${subvention.toFixed(2)}€
                </td>
                <td style="text-align: right; font-size: 10px; color: #666;">
                    Votre part: ${partClient.toFixed(2)}€
                </td>
            </tr>
            `;
        });
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Ticket Cantine</title>
            <style>
                body { 
                    font-family: 'Courier New', monospace; 
                    font-size: 12px; 
                    margin: 0; 
                    padding: 10px;
                    width: 300px;
                }
                .center { text-align: center; }
                .right { text-align: right; }
                .bold { font-weight: bold; }
                .separator { 
                    border-top: 1px dashed #333; 
                    margin: 8px 0; 
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                }
                td { 
                    padding: 2px 0; 
                    vertical-align: top; 
                }
                .total-line { 
                    border-top: 1px solid #333; 
                    font-weight: bold; 
                }
            </style>
        </head>
        <body>
            <div class="center bold">
                ================================<br>
                CANTINE ENTREPRISE<br>
                ================================
            </div>
            
            <div class="separator"></div>
            
            <div>
                <strong>Ticket:</strong> ${numeroTicket}<br>
                <strong>Date:</strong> ${date}<br>
                <strong>Heure:</strong> ${heureTransaction}<br>
                <strong>Client:</strong> ${utilisateurNomComplet}
            </div>
            
            <div class="separator"></div>
            
            <div class="bold">ARTICLES:</div>
            <table>
                ${articlesHtml}
            </table>
            
            <div class="separator"></div>
            
            <table>
                <tr>
                    <td>Sous-total:</td>
                    <td class="right">${montantTotal.toFixed(2)}€</td>
                </tr>
                <tr>
                    <td>Subvention entreprise:</td>
                    <td class="right">-${partPatronale.toFixed(2)}€</td>
                </tr>
                <tr class="total-line">
                    <td><strong>À PAYER:</strong></td>
                    <td class="right"><strong>${partSalariale.toFixed(2)}€</strong></td>
                </tr>
            </table>
            
            <div class="separator"></div>
            
            <div class="center">
                ✅ Montant débité de votre badge<br>
                ${partPatronale > 0 ? `🎯 Économie: ${partPatronale.toFixed(2)}€` : ''}<br><br>
                Merci et bon appétit !
            </div>
            
            <div class="center">
                ================================
            </div>
        </body>
        </html>
        `;
    }

    /**
     * ✅ REMIS : Générer un numéro de ticket unique
     */
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
                fullMessage += `\n\nDétails:\n`;
                fullMessage += `• Montant requis: ${springResponse.required_amount}€\n`;
                fullMessage += `• Solde actuel: ${springResponse.current_balance}€`;
            }
            if (springResponse.transactionId) {
                fullMessage += `\n• Transaction ID: ${springResponse.transactionId}`;
            }
        }
        
        this.dialog.add(AlertDialog, {
            title: title,
            body: fullMessage,
            confirmLabel: _t('OK'),
        });

        const notifType = errorType === 'validation_error' ? 'warning' : 'danger';
        this.notification.add(errorMessage, {
            type: notifType,
            sticky: false
        });
    }

    getErrorTitle(errorType, springResponse = null) {
        if (springResponse && springResponse.message) {
            if (springResponse.message.includes('Solde insuffisant')) {
                return _t('Insufficient Balance');
            }
            if (springResponse.message.includes('Product not found')) {
                return _t('Product Not Found');
            }
        }

        const titles = {
            'timeout': _t('Connection Timeout'),
            'connection': _t('Connection Error'),
            'client_error': _t('Validation Error'),
            'server_error': _t('Server Error'),
            'validation_error': _t('Payment Validation Failed'),
            'insufficient_funds': _t('Insufficient Funds'),
            'invalid_product': _t('Invalid Product'),
            'processing_error': _t('Processing Error'),
            'unexpected': _t('Unexpected Error')
        };

        return titles[errorType] || _t('Error');
    }

    /**
     * ✅ MODIFIÉ : Afficher le succès avec pop-up détaillée
     */
    showSuccess(message, springResponse = null) {
        if (springResponse) {
            // ✅ POPUP DÉTAILLÉE avec bouton imprimer
            this.showSuccessPopup(springResponse);
        } else {
            // Fallback simple
            this.notification.add(message || _t('Validation successful'), {
                type: 'success'
            });
        }
    }
}

/**
 * ✅ PATCH PRINCIPAL - VERSION SIMPLIFIÉE
 */
patch(ProductScreen.prototype, {
    setup() {
        super.setup();
        console.log('🚀 Setup ProductScreen...');
        
        this.springBootApi = new SpringBootApiService(this.env);
        
        // Vérification auth asynchrone
        this.checkAuthenticationAsync();
    },

    async checkAuthenticationAsync() {
        console.log('🔍 Vérification authentification POS...');
        
        const hasValidAuth = await this.springBootApi.authService.loadStoredAuth();
        
        if (!hasValidAuth) {
            console.log('❌ Authentification requise');
            this.showSimpleLoginDialog();
            return;
        }
        
        console.log('✅ Authentification valide');
        this.initializePOSInterface();
    },

    initializePOSInterface() {
        console.log('🎨 Initialisation interface POS...');
        
        // Interface badge
        this.springBootApi.initializeInterface();
        
        // Autres éléments
        this.createSpringBootButton();
        this.hidePaymentButton();
        
        // Message bienvenue
        const cashier = this.springBootApi.authService.getCurrentCashier();
        if (cashier) {
            this.springBootApi.notification.add(
                `Session POS: ${cashier.nom} ${cashier.prenom}`,
                { type: 'success' }
            );
        }
    },

    /**
     * ✅ LOGIN SIMPLIFIÉ - Texte simple seulement
     */
    showSimpleLoginDialog() {
        // Créer inputs temporaires
        let emailInput, passwordInput;
        
        this.springBootApi.dialog.add(ConfirmationDialog, {
            title: _t('Authentification Caissier'),
            body: _t('Connexion requise pour accéder au Point de Vente.\n\nRôles autorisés: ADMIN, SUPER_ADMIN, CAISSIER\n\nVeuillez saisir vos identifiants:'),
            confirmLabel: _t('Se connecter'),
            cancelLabel: _t('Annuler'),
            confirm: () => this.showInputDialog(),
            cancel: () => {
                window.location.href = '/web';
            }
        });
    },

    showInputDialog() {
        // Créer une div temporaire pour les inputs
        const inputContainer = document.createElement('div');
        inputContainer.innerHTML = `
            <div style="padding: 20px;">
                <div style="margin-bottom: 15px;">
                    <label>Email:</label>
                    <input type="email" id="temp-email" style="width: 100%; padding: 8px; margin-top: 5px;" placeholder="aymane@gmail.com">
                </div>
                <div style="margin-bottom: 15px;">
                    <label>Mot de passe:</label>
                    <input type="password" id="temp-password" style="width: 100%; padding: 8px; margin-top: 5px;">
                </div>
            </div>
        `;
        
        document.body.appendChild(inputContainer);
        
        this.springBootApi.dialog.add(ConfirmationDialog, {
            title: _t('Identifiants'),
            body: _t('Veuillez remplir les champs ci-dessus et cliquer sur Valider'),
            confirmLabel: _t('Valider'),
            cancelLabel: _t('Annuler'),
            confirm: () => {
                const email = document.getElementById('temp-email')?.value;
                const password = document.getElementById('temp-password')?.value;
                document.body.removeChild(inputContainer);
                this.processSimpleLogin(email, password);
            },
            cancel: () => {
                document.body.removeChild(inputContainer);
                window.location.href = '/web';
            }
        });
        
        // Focus sur email
        setTimeout(() => {
            document.getElementById('temp-email')?.focus();
        }, 100);
    },

    async processSimpleLogin(email, password) {
        if (!email || !password) {
            this.springBootApi.notification.add('Champs requis', { type: 'warning' });
            this.showInputDialog();
            return;
        }

        try {
            this.springBootApi.notification.add('Connexion...', { type: 'info' });

            const result = await this.springBootApi.authService.authenticateCashier(email, password);

            if (result.success) {
                this.springBootApi.notification.add(
                    `Bienvenue ${result.cashier.nom}`, 
                    { type: 'success' }
                );
                
                setTimeout(() => {
                    this.initializePOSInterface();
                }, 500);

            } else {
                this.springBootApi.notification.add(result.error, { type: 'danger' });
                setTimeout(() => {
                    this.showSimpleLoginDialog();
                }, 1500);
            }

        } catch (error) {
            console.error('Erreur login:', error);
            this.springBootApi.notification.add('Erreur connexion', { type: 'danger' });
        }
    },

    /**
     * ✅ MASQUAGE PAYMENT - Version robuste
     */
    hidePaymentButton() {
        console.log('🎯 Masquage Payment...');
        
        // CSS global
        const style = document.createElement('style');
        style.textContent = `
            .actionpad .validation .btn-primary:last-child,
            .o_pos_actionpad .o_pos_validation .payment,
            .pos-actionpad .payment-button,
            .control-buttons .payment,
            [data-bs-original-title="Payment"],
            .payment-screen-button {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
        
        // Masquage direct
        setTimeout(() => {
            const selectors = [
                '.actionpad .validation .btn-primary:last-child',
                '.payment-button',
                '[data-bs-original-title="Payment"]'
            ];
            
            selectors.forEach(selector => {
                const btn = document.querySelector(selector);
                if (btn) {
                    btn.style.display = 'none';
                    console.log('✅ Payment masqué:', selector);
                }
            });
        }, 1000);
    },

    createSpringBootButton() {
        setTimeout(() => {
            const controlButtons = document.querySelector('.control-buttons');
            if (controlButtons && !document.querySelector('.spring-validate-btn')) {
                const springButton = document.createElement('div');
                springButton.className = 'control-button spring-validate-btn';
                springButton.innerHTML = `
                    <i class="fa fa-server" style="color: #28a745; font-size: 18px;"></i>
                    <br/>
                    <span style="font-size: 11px; font-weight: bold;">SPRING<br/>VALIDATE</span>
                `;
                springButton.addEventListener('click', () => this.validateWithSpringBoot());
                controlButtons.appendChild(springButton);
                console.log('✅ Bouton Spring Boot ajouté');
            }
        }, 1000);
    },

    async validateWithSpringBoot() {
        console.log('🚀 Validation Spring Boot...');
        
        const order = this.pos.get_order();
        
        if (!order) {
            this.springBootApi.showError(_t('Commande non trouvée'));
            return;
        }

        const lines = order.orderlines || order.lines || order.get_orderlines() || [];
        
        if (!lines || lines.length === 0) {
            this.springBootApi.showError(_t('Panier vide - Ajoutez des articles'));
            return;
        }

        // Utiliser le client du badge si disponible
        const customer = order.badge_customer || order.get_partner();
        
        if (!customer) {
            const confirmed = confirm(_t('Aucun client sélectionné. Continuer ?'));
            if (!confirmed) return;
        }

        try {
            this.springBootApi.notification.add('Validation en cours...', { type: 'info' });

            const result = await this.springBootApi.validateOrder(order);

            if (result.success) {
                this.springBootApi.showSuccess('Transaction réussie', result);
            } else {
                this.springBootApi.showError(result.error, result.error_type);
            }

        } catch (error) {
            console.error('Erreur validation:', error);
            this.springBootApi.showError('Erreur: ' + error.message);
        }
    }
});

/**
 * ✅ PATCH PAYMENT SCREEN - Simplifié
 */
patch(PaymentScreen.prototype, {
    setup() {
        super.setup();
        this.springBootApi = new SpringBootApiService(this.env);
    }
});

/**
 * ✅ COMPOSANT BOUTON - Simplifié
 */
export class SpringBootValidateButton extends Component {
    static template = "pos_spring_connector.SpringBootValidateButton";
    
    setup() {
        this.springBootApi = new SpringBootApiService(this.env);
        this.pos = useService("pos");
    }

    async onClick() {
        const order = this.pos.get_order();
        
        if (!order || order.orderlines.length === 0) {
            this.springBootApi.showError(_t('Panier vide'));
            return;
        }

        try {
            this.springBootApi.notification.add('Validation...', { type: 'info' });

            const result = await this.springBootApi.validateOrder(order);
            
            if (result.success) {
                this.springBootApi.showSuccess('Validé', result);
            } else {
                this.springBootApi.showError(result.error);
            }

        } catch (error) {
            console.error('Erreur:', error);
            this.springBootApi.showError('Erreur validation');
        }
    }
}

export { SpringBootApiService, CashierAuthService, BadgeService, SimpleBadgeInterface };