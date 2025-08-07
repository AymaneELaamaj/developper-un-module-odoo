import json
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class POSSpringController(http.Controller):
    """Contrôleur pour les interactions POS avec Spring Boot API"""
    
    @http.route('/pos_spring/validate', type='json', auth='user', methods=['POST'])
    def validate_order(self, order_data, connector_id=None):
        """
        Endpoint JSON-RPC pour valider une commande POS avec Spring Boot
        Utilisé comme alternative à l'appel direct ORM depuis le JavaScript
        
        Args:
            order_data (dict): Données de la commande POS
            connector_id (int, optional): ID du connecteur à utiliser
            
        Returns:
            dict: Résultat de la validation Spring Boot
        """
        try:
            # Vérification des permissions POS
            if not request.env.user.has_group('point_of_sale.group_pos_user'):
                _logger.warning(f"Accès refusé pour validation Spring Boot - Utilisateur: {request.env.user.name}")
                return {
                    'success': False,
                    'error': 'Access denied - POS user rights required',
                    'error_type': 'access_denied'
                }

            PaymentConnector = request.env['payment.connector']
            
            # Trouver le connecteur approprié
            if connector_id:
                connector = PaymentConnector.browse(connector_id)
                if not connector.exists():
                    _logger.error(f"Connecteur Spring Boot non trouvé: ID {connector_id}")
                    return {
                        'success': False,
                        'error': f'Connector not found: {connector_id}',
                        'error_type': 'not_found'
                    }
            else:
                # Chercher le premier connecteur actif
                connector = PaymentConnector.search([('is_active', '=', True)], limit=1)
                if not connector:
                    _logger.error("Aucun connecteur Spring Boot actif trouvé")
                    return {
                        'success': False,
                        'error': 'No active Spring Boot connector found',
                        'error_type': 'no_connector'
                    }

            # Log de la requête
            _logger.info(f"Validation Spring Boot via contrôleur - Connecteur: {connector.name} (v{connector.api_version})")
            _logger.debug(f"Données ordre: {json.dumps(order_data, indent=2)}")

            # Valider la commande avec Spring Boot
            result = connector.validate_payment(order_data)
            
            # Log du résultat  
            success_status = "✅ SUCCÈS" if result.get('success') else "❌ ÉCHEC"
            _logger.info(f"Résultat validation Spring Boot: {success_status}")
            
            if not result.get('success'):
                _logger.warning(f"Erreur Spring Boot: {result.get('error_type', 'unknown')} - {result.get('error')}")
            
            return result

        except Exception as e:
            _logger.error(f"Exception dans le contrôleur POS Spring Boot: {e}", exc_info=True)
            return {
                'success': False,
                'error': f'Controller error: {str(e)}',
                'error_type': 'controller_error'
            }

    @http.route('/pos_spring/test', type='http', auth='user', methods=['GET'])
    def test_endpoint(self):
        """
        Endpoint de test pour vérifier que le module est bien chargé
        Accessible via navigateur pour diagnostics rapides
        """
        try:
            connectors = request.env['payment.connector'].search([])
            active_connectors = connectors.filtered('is_active')
            
            # Informations sur les connecteurs
            connector_info = []
            for conn in connectors:
                connector_info.append({
                    'id': conn.id,
                    'name': conn.name,
                    'api_url': conn.api_url,
                    'api_version': conn.api_version,
                    'is_active': conn.is_active,
                    'timeout': conn.timeout,
                    'endpoint_url': conn._get_endpoint_url()
                })
            
            response_data = {
                'status': '✅ OK',
                'module': 'pos_spring_connector',
                'version': '18.0.2.0.0',
                'timestamp': str(request.env.cr.now()),
                'database': request.env.cr.dbname,
                'user': {
                    'name': request.env.user.name,
                    'login': request.env.user.login,
                    'has_pos_access': request.env.user.has_group('point_of_sale.group_pos_user'),
                    'has_pos_manager': request.env.user.has_group('point_of_sale.group_pos_manager')
                },
                'connectors': {
                    'total_count': len(connectors),
                    'active_count': len(active_connectors),
                    'details': connector_info
                },
                'system_params': {
                    'auto_validate': request.env['ir.config_parameter'].sudo().get_param('pos_spring_connector.auto_validate', 'False'),
                    'default_timeout': request.env['ir.config_parameter'].sudo().get_param('pos_spring_connector.default_timeout', '30')
                }
            }
            
            # Headers pour une belle présentation JSON
            headers = {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache'
            }
            
            return request.make_response(
                json.dumps(response_data, indent=2, ensure_ascii=False),
                headers=headers
            )
            
        except Exception as e:
            _logger.error(f"Erreur endpoint test Spring Boot: {e}", exc_info=True)
            error_response = {
                'status': '❌ ERROR',
                'module': 'pos_spring_connector',
                'error': str(e),
                'timestamp': str(request.env.cr.now())
            }
            return request.make_response(
                json.dumps(error_response, indent=2),
                headers={'Content-Type': 'application/json'}
            )

    @http.route('/pos_spring/connectors', type='json', auth='user', methods=['POST'])
    def get_connectors(self):
        """
        Récupérer la liste des connecteurs actifs pour le JavaScript POS
        """
        try:
            if not request.env.user.has_group('point_of_sale.group_pos_user'):
                return {
                    'success': False, 
                    'error': 'Access denied - POS user rights required'
                }

            connectors = request.env['payment.connector'].search_read(
                [('is_active', '=', True)],
                ['id', 'name', 'api_url', 'api_version', 'timeout']
            )
            
            # Enrichir avec les URLs d'endpoint
            for conn in connectors:
                connector_obj = request.env['payment.connector'].browse(conn['id'])
                conn['endpoint_url'] = connector_obj._get_endpoint_url()
            
            _logger.debug(f"Connecteurs Spring Boot récupérés: {len(connectors)}")
            
            return {
                'success': True,
                'connectors': connectors,
                'total_count': len(connectors)
            }
            
        except Exception as e:
            _logger.error(f"Erreur récupération connecteurs Spring Boot: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }

    @http.route('/pos_spring/health', type='http', auth='none', methods=['GET'])
    def health_check(self):
        """
        Endpoint de santé pour monitoring externe
        Accessible sans authentification pour les outils de monitoring
        """
        try:
            health_data = {
                'status': 'healthy',
                'module': 'pos_spring_connector',
                'timestamp': str(request.env.cr.now()),
                'database_status': 'connected'
            }
            
            return request.make_response(
                json.dumps(health_data),
                headers={'Content-Type': 'application/json'}
            )
            
        except Exception as e:
            error_data = {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': str(request.env.cr.now())
            }
            return request.make_response(
                json.dumps(error_data),
                headers={'Content-Type': 'application/json'},
                status=500
            )