# models/pos_order.py
import logging
from odoo import api, fields, models, _

_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = 'pos.order'

    spring_validated = fields.Boolean(
        string='Spring Boot Validated',
        default=False,
        help='Indicates if this order was validated through Spring Boot API'
    )
    spring_validation_result = fields.Text(
        string='Spring Validation Result',
        help='Result returned by Spring Boot API'
    )
    spring_connector_id = fields.Many2one(
        'payment.connector',
        string='Used Spring Connector',
        help='Payment connector used for validation'
    )

    def validate_with_spring(self, connector_id=None):
        """
        Valider la commande avec Spring Boot
        Cette méthode peut être appelée depuis d'autres modules
        """
        self.ensure_one()
        
        try:
            PaymentConnector = self.env['payment.connector']
            
            # Trouver le connecteur
            if connector_id:
                connector = PaymentConnector.browse(connector_id)
            else:
                connector = PaymentConnector.search([('is_active', '=', True)], limit=1)
                
            if not connector:
                return {
                    'success': False,
                    'error': _('No active payment connector found')
                }

            # Préparer les données de la commande au format Spring Boot
            order_data = {
                'order_id': self.pos_reference or self.name,
                'customer_email': self.partner_id.email if self.partner_id else 'unknown@pos.com',
                'lines': []
            }

            for line in self.lines:
                order_data['lines'].append({
                    'product_id': line.product_id.id,  # ID Odoo du produit
                    'qty': line.qty                    # Quantité
                })

            # Appeler l'API
            result = connector.validate_payment(order_data)
            
            # Sauvegarder le résultat
            self.write({
                'spring_validated': result.get('success', False),
                'spring_validation_result': str(result),
                'spring_connector_id': connector.id
            })
            
            _logger.info(f"Commande {self.name} validée Spring Boot: {result.get('success', False)}")
            
            return result
            
        except Exception as e:
            _logger.error(f"Erreur validation Spring Boot pour commande {self.name}: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    @api.model
    def create_from_ui(self, orders, draft=False):
        """
        Override pour potentiellement valider automatiquement avec Spring Boot
        """
        # Appeler la méthode parent d'abord
        result = super().create_from_ui(orders, draft=draft)
        
        # Optionnel: validation automatique si configurée
        # (peut être activée via un paramètre système)
        auto_validate = self.env['ir.config_parameter'].sudo().get_param(
            'pos_spring_connector.auto_validate', False
        )
        
        if auto_validate:
            try:
                for order_data in orders:
                    if 'id' in result:
                        order = self.browse(result['id'])
                        if order.exists():
                            validation_result = order.validate_with_spring()
                            if not validation_result.get('success'):
                                _logger.warning(f"Auto-validation Spring Boot échouée pour {order.name}: {validation_result.get('error')}")
            except Exception as e:
                _logger.error(f"Erreur auto-validation Spring Boot: {e}")
        
        return result