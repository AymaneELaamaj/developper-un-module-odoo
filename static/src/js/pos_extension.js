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
 * Service pour gérer les appels API Spring Boot
 */
class SpringBootApiService {
    constructor(env) {
        this.env = env;
        this.orm = env.services.orm;
        this.dialog = env.services.dialog;
        this.notification = env.services.notification;
    }

    /**
     * Préparer les données de commande pour l'API Spring Boot
     */
    prepareOrderData(order) {
        try {
            // Récupérer le client sélectionné dans le POS
            const customer = order.get_partner();
            const customerEmail = customer ? customer.email || 'unknown@pos.com' : 'unknown@pos.com';
            
            const orderData = {
                order_id: order.name || order.uid,
                customer_email: customerEmail,
                lines: []
            };

            // Traiter les lignes de commande (articles dans le panier)
            const lines = order.orderlines || order.lines || order.get_orderlines() || [];
            
            console.log('Order object:', order);
            console.log('Order lines:', lines);
            console.log('Lines length:', lines.length);
            
            if (!lines || lines.length === 0) {
                throw new Error('No order lines found');
            }

            for (const line of lines) {
                console.log('Processing line:', line);
                console.log('Line product:', line.product);
                console.log('Line qty/quantity:', line.qty, line.quantity);
                
                const product = line.product || line.product_id;
                const quantity = line.quantity || line.qty || 1;
                
                if (product && quantity > 0) {
                    const productId = typeof product === 'object' ? product.id : product;
                    orderData.lines.push({
                        product_id: productId,
                        qty: quantity
                    });
                    console.log('Added line:', { product_id: productId, qty: quantity });
                }
            }

            console.log('Final orderData.lines:', orderData.lines);
            
            if (orderData.lines.length === 0) {
                throw new Error('No valid order lines processed');
            }

            console.log('Données préparées pour Spring Boot:', orderData);
            return orderData;

        } catch (error) {
            console.error('Erreur préparation données commande:', error);
            throw new Error(_t('Failed to prepare order data: ') + error.message);
        }
    }

    /**
     * Valider la commande via Spring Boot API
     */
    async validateOrder(order, connectorId = null) {
        try {
            // Préparer les données
            const orderData = this.prepareOrderData(order);
            
            // Si pas de connector spécifique, prendre le premier actif
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

            console.log('Validation commande Spring Boot:', orderData);

            // Appeler la méthode Python
            const result = await this.orm.call(
                'payment.connector',
                'validate_payment',
                [connector, orderData]
            );

            return result;

        } catch (error) {
            console.error('Erreur validation Spring Boot:', error);
            return {
                success: false,
                error: error.message || _t('Validation failed'),
                error_type: 'client_error'
            };
        }
    }

    /**
     * ✅ NOUVEAU : Afficher la pop-up de succès avec détails de subvention
     */
    /**
     * ✅ CORRIGÉ : Afficher la pop-up de succès avec debug et version simple
     */
    /**
     * ✅ CORRIGÉ : Afficher la pop-up de succès avec debug et version simple
     */
    // ✅ REMPLACEZ votre méthode showSuccessPopup par celle-ci :

showSuccessPopup(springResponse) {
    console.log('🔍 DEBUG - Données Spring Boot reçues:', springResponse);
    
    // Récupérer les données de la réponse Spring Boot
    const data = springResponse.spring_response || springResponse.data || springResponse;
    
    console.log('🔍 DEBUG - Data extraite:', data);
    
    // Extraire les informations
    const numeroTicket = this.generateTicketNumber();
    const date = new Date().toLocaleDateString('fr-FR');
    const heureTransaction = new Date().toLocaleTimeString('fr-FR');
    const montantTotal = data.montantTotal || 0;
    const partSalariale = data.partSalariale || 0;
    const partPatronale = data.partPatronale || 0;

    // ✅ NOUVEAU : Extraire les informations utilisateur
    const utilisateurNomComplet = data.utilisateurNomComplet || 'Client non identifié';
    const utilisateurEmail = data.utilisateurEmail || '';
    const utilisateurCategorie = data.utilisateurCategorie || '';

    console.log('🔍 DEBUG - Utilisateur:', { utilisateurNomComplet, utilisateurEmail, utilisateurCategorie });

    // Extraire les articles de la réponse
    const articles = data.articles || [];
    console.log('🔍 DEBUG - Articles extraits:', articles);

    // ✅ VERSION AVEC NOM UTILISATEUR
    let message = `🎉 TRANSACTION RÉUSSIE

👤 Client: ${utilisateurNomComplet}`;

    // Ajouter l'email si disponible
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

    // Ajouter chaque article
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

    // Afficher la pop-up avec message complet
    // Remplacer cette partie dans votre fonction showSuccessPopup()
    // Afficher la pop-up avec bouton imprimer
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

    // Notification de succès avec nom utilisateur
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
 * ✅ NOUVEAU : Fonction d'impression du ticket
 */
printTicket(springData, numeroTicket, date, heureTransaction) {
    console.log('🖨️ Impression ticket démarrée');
    
    // Générer le contenu du ticket format reçu
    const ticketContent = this.generateTicketContent(springData, numeroTicket, date, heureTransaction);
    
    // Ouvrir fenêtre d'impression
    const printWindow = window.open('', 'TicketPrint', 'width=400,height=600');
    printWindow.document.write(ticketContent);
    printWindow.document.close();
    
    // Déclencher l'impression automatiquement
    printWindow.focus();
    printWindow.print();
    
    console.log("✅ Ticket envoyé à l'imprimante");
}

/**
 * ✅ NOUVEAU : Générer le contenu du ticket format reçu
 */
generateTicketContent(data, numeroTicket, date, heureTransaction) {
    const articles = data.articles || [];
    const montantTotal = data.montantTotal || 0;
    const partSalariale = data.partSalariale || 0;
    const partPatronale = data.partPatronale || 0;
    const utilisateurNomComplet = data.utilisateurNomComplet || 'Client';
    
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
     * ✅ NOUVEAU : Construire le contenu HTML de la pop-up de succès
     */
    buildSuccessPopupContent({ numeroTicket, date, heureTransaction, montantTotal, partSalariale, partPatronale }) {
        return `
            <div style="font-family: Arial, sans-serif; padding: 15px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h3 style="color: #28a745; margin: 0;">🎉 TRANSACTION RÉUSSIE</h3>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>N° Ticket:</strong>
                        <span style="font-family: monospace;">${numeroTicket}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong>Date:</strong>
                        <span>${date}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <strong>Heure:</strong>
                        <span>${heureTransaction}</span>
                    </div>
                </div>

                <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff;">
                    <h4 style="margin: 0 0 12px 0; color: #007bff;">💰 Détail Financier</h4>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Prix total articles:</span>
                        <strong style="color: #333;">${montantTotal.toFixed(2)}€</strong>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #28a745;">🏢 Subvention entreprise:</span>
                        <strong style="color: #28a745;">-${partPatronale.toFixed(2)}€</strong>
                    </div>
                    
                    <hr style="margin: 12px 0; border: none; border-top: 1px solid #ccc;">
                    
                    <div style="display: flex; justify-content: space-between; font-size: 16px;">
                        <span><strong>👤 Votre part payée:</strong></span>
                        <strong style="color: #dc3545; font-size: 18px;">${partSalariale.toFixed(2)}€</strong>
                    </div>
                </div>

                <div style="background: #d4edda; padding: 12px; border-radius: 6px; margin-top: 15px; text-align: center;">
                    <span style="color: #155724; font-weight: bold;">
                        ✅ Montant déduit de votre badge avec succès
                    </span>
                </div>

                ${partPatronale > 0 ? `
                    <div style="background: #fff3cd; padding: 10px; border-radius: 6px; margin-top: 10px; text-align: center;">
                        <span style="color: #856404; font-size: 14px;">
                            🎯 Vous avez économisé ${partPatronale.toFixed(2)}€ grâce à la subvention !
                        </span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * ✅ NOUVEAU : Générer un numéro de ticket unique
     */
    generateTicketNumber() {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `TK${timestamp.slice(-6)}${random}`;
    }

    /**
     * Afficher une erreur dans l'interface
     */
    showError(errorMessage, errorType = 'error', springResponse = null) {
        const title = this.getErrorTitle(errorType, springResponse);
        
        // Ajouter des détails Spring Boot si disponibles
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

        // Notification avec couleur selon le type
        const notifType = errorType === 'validation_error' ? 'warning' : 'danger';
        this.notification.add(errorMessage, {
            type: notifType,
            sticky: false
        });
    }

    /**
     * Obtenir le titre d'erreur selon le type et le message Spring Boot
     */
    getErrorTitle(errorType, springResponse = null) {
        // Messages spécifiques basés sur les réponses Spring Boot
        if (springResponse && springResponse.message) {
            if (springResponse.message.includes('Solde insuffisant')) {
                return _t('Insufficient Balance');
            }
            if (springResponse.message.includes('Product not found')) {
                return _t('Product Not Found');
            }
        }

        // Titres par défaut selon le type d'erreur
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
            // Afficher la pop-up détaillée avec les informations de subvention
            this.showSuccessPopup(springResponse);
        } else {
            // Fallback : notification simple
            this.notification.add(message || _t('Validation successful'), {
                type: 'success'
            });
        }
    }
}

/**
 * ✅ NOUVEAU : Patch pour désactiver les taxes dans le POS
 */
patch(ProductScreen.prototype, {
    setup() {
        super.setup();
        this.springBootApi = new SpringBootApiService(this.env);
        
        // ✅ Désactiver les taxes au niveau POS
        this.disablePOSTaxes();
        
        // Créer le bouton Spring Boot dynamiquement
        this.createSpringBootButton();
       this.hidePaymentButton();

    },
    /**
     * ✅ APPROCHE EXPERTE : Ciblage direct du bouton Payment
     */
    hidePaymentButton() {
        console.log('🎯 Masquage expert du bouton Payment');
        
        // ✅ MÉTHODE 1 : CSS direct par sélecteur précis Odoo POS
        const style = document.createElement('style');
        style.textContent = `
            /* Cibler directement la structure POS d'Odoo */
            .point-of-sale .actionpad .validation .button.payment,
            .o-main-components-container .actionpad .validation .payment-button,
            .pos-content .actionpad .button[data-bs-original-title="Payment"],
            .actionpad .validation .btn-primary:last-child,
            
            /* Structure spécifique Odoo v18 POS */
            .o_pos_content .o_pos_actionpad .o_pos_validation .payment,
            .pos-actionpad .pos-payment-button,
            
            /* Sélecteur par position (dernier bouton en bas) */
            .actionpad .validation > .btn:last-child,
            .pos .control-buttons > button:last-child {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
        
        // ✅ MÉTHODE 2 : Sélecteur Odoo POS spécifique
        setTimeout(() => {
            // Cibler la structure exacte d'Odoo POS
            const paymentButton = document.querySelector('.actionpad .validation .btn-primary:last-child');
            if (paymentButton) {
                paymentButton.style.display = 'none';
                console.log('✅ Bouton Payment masqué par sélecteur Odoo');
                return;
            }
            
            // Alternative : cibler par data attribute Odoo
            const paymentByData = document.querySelector('[data-bs-original-title="Payment"]');
            if (paymentByData) {
                paymentByData.style.display = 'none';
                console.log('✅ Bouton Payment masqué par data attribute');
                return;
            }
            
            // Alternative : structure POS classique
            const posPayment = document.querySelector('.pos-content .payment-button');
            if (posPayment) {
                posPayment.style.display = 'none';
                console.log('✅ Bouton Payment masqué par structure POS');
                return;
            }
            
            console.log('⚠️ Bouton Payment non trouvé avec sélecteurs directs');
        }, 1000);
        
        // ✅ MÉTHODE 3 : Override de la méthode Odoo directement
        if (this.env && this.env.services && this.env.services.pos) {
            const pos = this.env.services.pos;
            
            // Désactiver la fonction de paiement au niveau service
            if (pos.showScreen) {
                const originalShowScreen = pos.showScreen.bind(pos);
                pos.showScreen = function(screenName, props) {
                    if (screenName === 'PaymentScreen') {
                        console.log('🚫 PaymentScreen bloqué au niveau service');
                        return;
                    }
                    return originalShowScreen(screenName, props);
                };
            }
        }
        
        console.log('✅ Masquage expert Payment activé');
    },
    
    /**
     * ✅ ALTERNATIVE : Override du composant Odoo directement
     */
    disablePaymentComponent() {
        // Patch du composant PaymentScreen pour le désactiver
        if (typeof PaymentScreen !== 'undefined') {
            const originalSetup = PaymentScreen.prototype.setup;
            PaymentScreen.prototype.setup = function() {
                console.log('🚫 PaymentScreen désactivé à la source');
                // Ne pas appeler setup() = composant inactif
            };
        }
        
        // Patch du bouton Payment dans ActionPad
        if (typeof ActionpadWidget !== 'undefined') {
            const originalRender = ActionpadWidget.prototype._renderElement;
            ActionpadWidget.prototype._renderElement = function() {
                const result = originalRender.call(this);
                // Masquer le bouton Payment après render
                const paymentBtn = this.el.querySelector('.payment-button, .btn-payment');
                if (paymentBtn) {
                    paymentBtn.style.display = 'none';
                }
                return result;
            };
        }
    },

    /**
     * ✅ NOUVEAU : Désactiver le calcul automatique des taxes dans le POS
     */
    disablePOSTaxes() {
        // Override des méthodes de calcul de taxes si elles existent
        if (this.pos && this.pos.config) {
            // Forcer la configuration pour ignorer les taxes
            this.pos.config.module_account = false;
            console.log('✅ Taxes POS désactivées');
        }
        
        // Patch des méthodes de calcul de taxes au niveau des orderlines
        setTimeout(() => {
            const order = this.pos.get_order();
            if (order && order.orderlines) {
                order.orderlines.forEach(line => {
                    if (line && typeof line.set_unit_price === 'function') {
                        // Override pour que le prix affiché soit le prix final sans taxes
                        const originalSetUnitPrice = line.set_unit_price;
                        line.set_unit_price = function(price) {
                            // Appeler la méthode originale
                            originalSetUnitPrice.call(this, price);
                            // Mais forcer les taxes à 0
                            if (this.price_subtotal_incl !== undefined) {
                                this.price_subtotal_incl = this.price_subtotal;
                            }
                        };
                    }
                });
            }
        }, 500);
    },

    /**
     * Créer le bouton Spring Boot et l'ajouter à l'interface
     */
    createSpringBootButton() {
        // Attendre que le DOM soit prêt
        setTimeout(() => {
            const controlButtons = document.querySelector('.control-buttons');
            if (controlButtons && !document.querySelector('.spring-validate-btn')) {
                const springButton = document.createElement('div');
                springButton.className = 'control-button spring-validate-btn';
                springButton.title = 'Validate order with Spring Boot API';
                springButton.innerHTML = `
                    <i class="fa fa-server" style="color: #28a745; font-size: 18px;"></i>
                    <br/>
                    <span style="font-size: 11px; font-weight: bold;">SPRING<br/>VALIDATE</span>
                `;
                springButton.addEventListener('click', () => this.validateWithSpringBoot());
                controlButtons.appendChild(springButton);
                console.log('✅ Bouton Spring Boot ajouté dynamiquement');
            }
        }, 1000);
    },
    /**
     * ✅ VERSION CONSERVATIVE : Masquer seulement le bouton Payment sans casser l'interface
     */
    
    /**
     * ✅ MODIFIÉ : Valider la commande avec Spring Boot et afficher pop-up de succès
     */
    async validateWithSpringBoot() {
        console.log('🚀 validateWithSpringBoot appelé');
        
        const order = this.pos.get_order();
        console.log('Order récupéré:', order);
        
        if (!order) {
            this.springBootApi.showError(_t('No active order found'));
            return;
        }

        // Vérification améliorée des lignes de commande
        const lines = order.orderlines || order.lines || order.get_orderlines() || [];
        console.log('Lines found:', lines, 'Length:', lines.length);
        
        if (!lines || lines.length === 0) {
            this.springBootApi.showError(_t('Order is empty - please add products first'));
            return;
        }

        // Vérifier qu'un client est sélectionné (optionnel mais recommandé)
        const customer = order.get_partner();
        console.log('Customer:', customer);
        
        if (!customer) {
            // Demander confirmation pour continuer sans client
            const confirmed = confirm(_t('No customer selected. Continue with default email?'));
            if (!confirmed) return;
        }

        try {
            // Afficher le loading
            this.springBootApi.notification.add(_t('Validating order with Spring Boot...'), {
                type: 'info'
            });

            console.log('Avant appel validateOrder');
            const result = await this.springBootApi.validateOrder(order);
            console.log('Résultat validation:', result);

            if (result.success) {
                // ✅ MODIFIÉ : Afficher la pop-up de succès avec détails
                this.springBootApi.showSuccess(result.message, result);
                
                // ✅ Optionnel: Vider le panier après validation réussie
                // order.finalize();
                
            } else {
                this.springBootApi.showError(
                    result.error, 
                    result.error_type, 
                    result.spring_response
                );
            }

        } catch (error) {
            console.error('Erreur validation:', error);
            this.springBootApi.showError(
                _t('Validation failed: ') + error.message,
                'unexpected'
            );
        }
    }
});

/**
 * ✅ NOUVEAU : Patch PaymentScreen pour désactiver aussi les taxes
 */
patch(PaymentScreen.prototype, {
    setup() {
        super.setup();
        this.springBootApi = new SpringBootApiService(this.env);
        
        // Désactiver les taxes ici aussi
        this.disablePaymentTaxes();
    },

    /**
     * ✅ NOUVEAU : Désactiver les taxes dans l'écran de paiement
     */
    disablePaymentTaxes() {
        if (this.currentOrder) {
            // Forcer le total sans taxes
            const originalGetTotal = this.currentOrder.get_total_with_tax;
            if (originalGetTotal) {
                this.currentOrder.get_total_with_tax = function() {
                    return this.get_total_without_tax();
                };
            }
        }
    },

    /**
     * Validation avant paiement (optionnel)
     */
    async validatePayment() {
        const order = this.currentOrder;
        
        if (!order) {
            return false;
        }

        try {
            const result = await this.springBootApi.validateOrder(order);
            
            if (!result.success) {
                this.springBootApi.showError(result.error, result.error_type);
                return false;
            }

            return true;

        } catch (error) {
            console.error('Erreur validation paiement:', error);
            this.springBootApi.showError(
                _t('Payment validation failed'),
                'unexpected'
            );
            return false;
        }
    }
});

/**
 * Composant bouton de validation Spring Boot
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
            this.springBootApi.showError(_t('No items in order'));
            return;
        }

        // Vérifier le client sélectionné
        const customer = order.get_partner();
        console.log('Client sélectionné:', customer ? customer.name : 'Aucun client');

        try {
            // Afficher loading avec détails
            this.springBootApi.notification.add(
                _t('Validating ') + order.orderlines.length + _t(' item(s) with Spring Boot...'), 
                { type: 'info' }
            );

            const result = await this.springBootApi.validateOrder(order);
            
            if (result.success) {
                this.springBootApi.showSuccess(result.message, result);
            } else {
                this.springBootApi.showError(
                    result.error, 
                    result.error_type, 
                    result.spring_response
                );
            }

        } catch (error) {
            console.error('Erreur validation bouton:', error);
            this.springBootApi.showError(
                _t('Validation error: ') + error.message,
                'unexpected'
            );
        }
    }
}

/**
 * Export du service pour utilisation externe
 */
export { SpringBootApiService };