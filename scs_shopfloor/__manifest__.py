# See LICENSE file for full copyright and licensing details.

{
    "name": "SCS ShopFloor",
    "version": "17.0.1.0.0",
    "depends": ["sale_management",'mrp','website'],
    "author": "Serpent Consulting Services Pvt. Ltd.",
    "category": "Tools",
    "license": "LGPL-3",
    "website": "http://www.serpentcs.com",
    "summary": """
    Odoo Docusign integration
    Odoo Digital Signature
    """,
    "data": [
        # "security/portal_shopfloor.xml",
        "views/workorder_template.xml",
        "views/sale_view.xml",
        "views/invoice_view.xml",
    ],
    'assets': {
        'web.assets_frontend': [
            'scs_shopfloor/static/src/js/shopfloor.js',
            'scs_shopfloor/static/src/css/style.scss',
        ]
    },
    "images": ["static/description/docubanner.png"],
    "installable": True,
    "application": True,
    "sequence": 2,
    "price": 299,
    "currency": "EUR",
}
