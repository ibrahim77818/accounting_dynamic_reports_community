# -*- coding: utf-8 -*-
{
    'name': 'Dynamic Financial Reports (Community)',
    'summary': 'Interactive Balance Sheet, Profit and Loss, Cash Flow, Executive Summary, '
               'General Ledger, Trial Balance, Partner Ledger, Aged Receivable/Payable, '
               'Consolidated Journals and Tax Report with PDF and Excel export',
    'description': """
Dynamic Financial Reports for Odoo 16
=====================================
Interactive accounting reports with date ranges, period comparison, journal,
account, partner and analytic filters, drill-down to journal items, and
colour-coded PDF / Excel exports.
    """,
    'author': 'Ibrahim Yahia',
    'website': 'https://www.linkedin.com/in/ibrahim-yahia',
    'maintainer': 'Ibrahim Yahia',
    'support': 'ibrahim.yahiah@gmail.com',
    'category': 'Accounting/Accounting',
    'version': '16.0.1.0.0',
    'license': 'LGPL-3',
    'images': ['static/description/banner.png'],
    'depends': ['account'],
    'external_dependencies': {'python': ['xlsxwriter']},
    'data': [
        'security/ir.model.access.csv',
        'data/ks_dfr_account_data.xml',
        'data/ks_dynamic_financial_report.xml',
        'views/ks_mail_template.xml',
        'reports/ks_report_layout.xml',
        'views/ks_base_template.xml',
        'views/ks_dfr_account_type.xml',
        'views/ks_res_config_settings.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'accounting_dynamic_reports_community/static/src/scss/ks_dynamic_financial_report.scss',
            'accounting_dynamic_reports_community/static/src/scss/ks_pdf.scss',
            'accounting_dynamic_reports_community/static/src/js/ks_utils.js',
            'accounting_dynamic_reports_community/static/src/js/ks_dynamic_action_manager.js',
            'accounting_dynamic_reports_community/static/src/components/**/*',
            'accounting_dynamic_reports_community/static/src/js/ks_dynamic_financial_report.js',
            'accounting_dynamic_reports_community/static/src/xml/ks_dynamic_financial_report.xml',
        ],
        'web.report_assets_common': [
            'accounting_dynamic_reports_community/static/src/scss/ks_pdf_report.scss',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
