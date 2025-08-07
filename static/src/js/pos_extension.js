/** @odoo-module **/

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

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
    showSuccessPopup(springResponse) {
        // ✅ DEBUG : Vérifier les données reçues
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

        console.log('🔍 DEBUG - Montants extraits:', { montantTotal, partSalariale, partPatronale });

        // ✅ VERSION SIMPLE : Message texte au lieu de HTML complexe
        const message = `🎉 TRANSACTION RÉUSSIE

📋 Détails:
• N° Ticket: ${numeroTicket}
• Date: ${date}
• Heure: ${heureTransaction}

💰 Détail Financier:
• Prix total: ${montantTotal.toFixed(2)}€
• Subvention entreprise: ${partPatronale.toFixed(2)}€
• Votre part: ${partSalariale.toFixed(2)}€

✅ Montant déduit de votre badge avec succès
${partPatronale > 0 ? `🎯 Vous avez économisé ${partPatronale.toFixed(2)}€ !` : ''}`;

        // Afficher la pop-up avec message simple
        this.dialog.add(AlertDialog, {
            title: _t('✅ Paiement Validé avec Succès'),
            body: message,
            confirmLabel: _t('OK'),
            confirm: () => {
                console.log('Pop-up de succès fermée');
            }
        });

        // Notification de succès supplémentaire
        this.notification.add(
            _t('Paiement validé - Subvention entreprise: ') + partPatronale.toFixed(2) + '€',
            {
                type: 'success',
                sticky: false
            }
        );
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