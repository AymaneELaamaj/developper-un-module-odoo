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
            // CORRECTION: Vérifier différentes propriétés possibles
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
                
                // CORRECTION: Tester différentes propriétés
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
     * Afficher une erreur dans l'interface
     */
    showError(errorMessage, errorType = 'error') {
        const title = this.getErrorTitle(errorType);
        
        this.dialog.add(AlertDialog, {
            title: title,
            body: errorMessage,
            confirmLabel: _t('OK'),
        });

        // Notification supplémentaire
        this.notification.add(errorMessage, {
            type: 'danger',
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
     * Afficher une erreur avec détails Spring Boot
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
     * Afficher le succès
     */
    showSuccess(message) {
        this.notification.add(message || _t('Validation successful'), {
            type: 'success'
        });
    }
}

/**
 * Extension du ProductScreen pour ajouter le bouton Spring Boot
 */
patch(ProductScreen.prototype, {
    setup() {
        super.setup();
        this.springBootApi = new SpringBootApiService(this.env);
        
        // Créer le bouton Spring Boot dynamiquement
        this.createSpringBootButton();
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
                    <span style="font-size: 11px; font-weight: bold;">Spring Validate</span>
                `;
                springButton.addEventListener('click', () => this.validateWithSpringBoot());
                controlButtons.appendChild(springButton);
                console.log('✅ Bouton Spring Boot ajouté dynamiquement');
            }
        }, 1000);
    },

    /**
     * Valider la commande avec Spring Boot
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
                this.springBootApi.showSuccess(result.message, result.spring_response);
                // Optionnel: passer automatiquement au paiement
                // this.pos.showScreen('PaymentScreen');
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
 * Extension du PaymentScreen pour validation automatique
 */
patch(PaymentScreen.prototype, {
    setup() {
        super.setup();
        this.springBootApi = new SpringBootApiService(this.env);
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
                this.springBootApi.showSuccess(result.message, result.spring_response);
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