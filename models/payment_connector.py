import json
import logging
import requests
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError, UserError

_logger = logging.getLogger(__name__)


class PaymentConnector(models.Model):
    _name = 'payment.connector'
    _description = 'Payment Connector for Spring Boot API'

    name = fields.Char(string='Name', required=True)
    api_url = fields.Char(string='API URL', required=True, 
                         default='http://localhost:8080/api/payments')
    api_version = fields.Selection([
        ('v2', 'Version v2 (/v2/validate)')
    ], string='API Version', default='v2', required=True)
    timeout = fields.Integer(string='Timeout (seconds)', default=30)
    is_active = fields.Boolean(string='Active', default=True)
    
    def _get_endpoint_url(self):
        """Construire l'URL complète pour l'API v2"""
        self.ensure_one()
        return f"{self.api_url.rstrip('/')}/v2/validate"

    def _prepare_payment_data(self, order_data):
        """Préparer les données au format attendu par Spring Boot"""
        try:
            # Validation des données d'entrée
            if not order_data.get('order_id'):
                raise ValidationError(_("Order ID is required"))
            
            if not order_data.get('lines'):
                raise ValidationError(_("Order lines are required"))

            # Construction des données avec orderId au lieu de order_id
            payment_data = {
                'orderId': str(order_data['order_id']),
                'customer': {
                    'email': order_data.get('customer_email', 'unknown@example.com')
                },
                'items': []
            }

            # Traitement des lignes de commande (format v2 uniquement)
            for line in order_data.get('lines', []):
                if not line.get('product_id'):
                    _logger.warning(f"Ligne sans product_id ignorée: {line}")
                    continue
                
                # Format v2: productId (camelCase)
                item = {
                    'productId': int(line['product_id']),
                    'quantity': float(line.get('qty', 1))
                }
                
                payment_data['items'].append(item)

            if not payment_data['items']:
                raise ValidationError(_("No valid items found in order"))

            return payment_data

        except Exception as e:
            _logger.error(f"Erreur lors de la préparation des données: {e}")
            raise ValidationError(_("Failed to prepare payment data: %s") % str(e))

    def validate_payment(self, order_data):
        """Valider le paiement via l'API Spring Boot"""
        self.ensure_one()
        
        if not self.is_active:
            raise UserError(_("Payment connector is not active"))

        try:
            # Préparer les données
            payment_data = self._prepare_payment_data(order_data)
            
            # URL de l'endpoint
            endpoint_url = self._get_endpoint_url()
            
            _logger.info(f"Appel API Spring Boot: {endpoint_url}")
            _logger.debug(f"Données envoyées: {json.dumps(payment_data, indent=2)}")

            # Headers
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Odoo-POS-Connector/1.0'
            }

            # Appel API avec timeout
            response = requests.post(
                endpoint_url,
                json=payment_data,
                headers=headers,
                timeout=self.timeout
            )

            # Log de la réponse
            _logger.info(f"Réponse Spring Boot: Status {response.status_code}")
            _logger.debug(f"Contenu réponse: {response.text}")

            # Traitement de la réponse
            return self._process_api_response(response)

        except requests.exceptions.Timeout:
            error_msg = _("API timeout after %d seconds") % self.timeout
            _logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'error_type': 'timeout'
            }

        except requests.exceptions.ConnectionError:
            error_msg = _("Cannot connect to Spring Boot API")
            _logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'error_type': 'connection'
            }

        except requests.exceptions.RequestException as e:
            error_msg = _("API request failed: %s") % str(e)
            _logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'error_type': 'request'
            }

        except Exception as e:
            error_msg = _("Unexpected error: %s") % str(e)
            _logger.error(f"Erreur inattendue dans validate_payment: {e}", exc_info=True)
            return {
                'success': False,
                'error': error_msg,
                'error_type': 'unexpected'
            }

    def _process_api_response(self, response):
        """Traiter la réponse de l'API Spring Boot"""
        try:
            # Statut HTTP 200-299 = succès
            if response.status_code >= 200 and response.status_code < 300:
                try:
                    response_data = response.json()
                    # Vérifier le statut dans la réponse (v2 retourne toujours 200 même pour les erreurs)
                    if response_data.get('status') == 'error':
                        return {
                            'success': False,
                            'error': response_data.get('message', _('Payment validation failed')),
                            'error_type': 'validation_error',
                            'spring_response': response_data
                        }
                    else:
                        return {
                            'success': True,
                            'data': response_data,
                            'message': response_data.get('message', _('Payment validated successfully')),
                            'spring_response': response_data
                        }
                except json.JSONDecodeError:
                    # Succès mais pas de JSON valide
                    return {
                        'success': True,
                        'message': _('Payment validated successfully')
                    }

            # Erreurs client (400-499)
            elif response.status_code >= 400 and response.status_code < 500:
                try:
                    error_data = response.json()
                    error_message = error_data.get('message', error_data.get('error', 
                                                 _('Client error: %s') % response.status_code))
                except json.JSONDecodeError:
                    error_message = _('Client error: %s') % response.status_code

                return {
                    'success': False,
                    'error': error_message,
                    'error_type': 'client_error',
                    'status_code': response.status_code
                }

            # Erreurs serveur (500+)
            else:
                try:
                    error_data = response.json()
                    error_message = error_data.get('message', error_data.get('error',
                                                 _('Server error: %s') % response.status_code))
                except json.JSONDecodeError:
                    error_message = _('Server error: %s') % response.status_code

                return {
                    'success': False,
                    'error': error_message,
                    'error_type': 'server_error',
                    'status_code': response.status_code
                }

        except Exception as e:
            _logger.error(f"Erreur lors du traitement de la réponse API: {e}", exc_info=True)
            return {
                'success': False,
                'error': _("Failed to process API response: %s") % str(e),
                'error_type': 'processing_error'
            }

    @api.model
    def test_connection(self, connector_id):
        """Tester la connexion à l'API (méthode appelée depuis le JS)"""
        try:
            connector = self.browse(connector_id)
            if not connector.exists():
                return {
                    'success': False,
                    'error': _('Connector not found')
                }

            # Test avec des données factices adaptées au format Spring Boot
            test_data = {
                'order_id': 'TEST_CONNECTION',
                'customer_email': 'test@odoo.com',
                'lines': [{
                    'product_id': 1,
                    'qty': 1
                }]
            }

            result = connector.validate_payment(test_data)
            
            # Même si l'API rejette les données de test, la connexion fonctionne
            if result.get('error_type') in ['timeout', 'connection']:
                return result
            else:
                # Connexion OK, même si validation échoue (normal avec données de test)
                return {
                    'success': True,
                    'message': _('Connection successful'),
                    'test_result': result
                }

        except Exception as e:
            _logger.error(f"Erreur test de connexion: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }