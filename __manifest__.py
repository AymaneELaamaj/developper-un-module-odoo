{
    'name': 'POS Spring Connector',
    'version': '18.0.1.0.0',
    'summary': 'Integration between Odoo POS and Spring Boot API',
    'description': """
        This module provides integration between Odoo Point of Sale 
        and Spring Boot API for payment validation.
    """,
    'author': 'Votre Nom',
    'website': 'https://www.votre-site.com',
    'category': 'Point of Sale',
    'depends': ['base', 'point_of_sale', 'web'],
    'external_dependencies': {
        'python': ['requests'],
    },
    'data': [
        'security/ir.model.access.csv',
        'views/pos_assets.xml',  # Fichier vide maintenant
    ],
    'assets': {
        'point_of_sale._assets_pos': [  # Testons cette version
            'pos_spring_connector/static/src/js/pos_extension.js',
            'pos_spring_connector/static/src/css/pos_spring.css',
            'pos_spring_connector/static/src/xml/pos_templates.xml',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
}