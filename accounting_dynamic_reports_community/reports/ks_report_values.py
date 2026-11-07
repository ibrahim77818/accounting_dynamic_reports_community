# -*- coding: utf-8 -*-
import datetime

from odoo import api, models


class KsDfrReportBase(models.AbstractModel):
    """Shared rendering values for the dynamic financial PDF reports.

    The web client posts the report payload as ``data['js_data']``. This model
    resolves the company/currency once and provides a locale-aware date
    formatter so every template renders consistently.
    """
    _name = 'report.accounting_dynamic_reports_community.ks_dfr_base'
    _description = 'Dynamic Financial Reports - PDF values'

    @api.model
    def _get_report_values(self, docids, data=None):
        js_data = (data or {}).get('js_data') or {}
        options = js_data.get('ks_df_informations') or {}
        company = self.env['res.company'].browse(options.get('company_id') or self.env.company.id).exists()
        company = company or self.env.company
        lang = self.env['res.lang']._lang_get(self.env.lang or 'en_US')
        date_format = lang.date_format if lang else '%m/%d/%Y'

        def ks_fmt_date(value):
            if not value or value in ('-', False):
                return ''
            try:
                return datetime.datetime.strptime(str(value)[:10], '%Y-%m-%d').strftime(date_format)
            except ValueError:
                return str(value)

        def ks_period_value(value, key=None):
            """Executive summary values are either a float or a {period_key: float} dict."""
            if isinstance(value, dict):
                if key:
                    return value.get(key) or 0.0
                return next(iter(value.values()), 0.0) or 0.0
            return value or 0.0

        return {
            'doc_ids': docids,
            'ks_period_value': ks_period_value,
            'doc_model': 'ks.dynamic.financial.reports',
            'docs': self.env['ks.dynamic.financial.reports'].browse(docids),
            'js_data': js_data,
            'company': company,
            'currency': company.currency_id,
            'ks_fmt_date': ks_fmt_date,
            'ks_date_format': date_format,
            'ks_printed_on': self.env['ir.qweb.field.datetime'].value_to_html(
                datetime.datetime.now(), {'format': 'short'}),
        }


class KsDfrReportLines(models.AbstractModel):
    _name = 'report.accounting_dynamic_reports_community.ks_pdf_statement'
    _inherit = 'report.accounting_dynamic_reports_community.ks_dfr_base'
    _description = 'Dynamic Financial Reports - Financial statements PDF'


class KsDfrReportExecutive(models.AbstractModel):
    _name = 'report.accounting_dynamic_reports_community.ks_pdf_executive'
    _inherit = 'report.accounting_dynamic_reports_community.ks_dfr_base'
    _description = 'Dynamic Financial Reports - Executive Summary PDF'


class KsDfrReportTrialBalance(models.AbstractModel):
    _name = 'report.accounting_dynamic_reports_community.ks_pdf_trial_bal'
    _inherit = 'report.accounting_dynamic_reports_community.ks_dfr_base'
    _description = 'Dynamic Financial Reports - Trial Balance PDF'


class KsDfrReportGeneralLedger(models.AbstractModel):
    _name = 'report.accounting_dynamic_reports_community.ks_pdf_gen_ledger'
    _inherit = 'report.accounting_dynamic_reports_community.ks_dfr_base'
    _description = 'Dynamic Financial Reports - General Ledger PDF'


class KsDfrReportPartnerLedger(models.AbstractModel):
    _name = 'report.accounting_dynamic_reports_community.ks_pdf_partner_led'
    _inherit = 'report.accounting_dynamic_reports_community.ks_dfr_base'
    _description = 'Dynamic Financial Reports - Partner Ledger PDF'


class KsDfrReportAgedReceivable(models.AbstractModel):
    _name = 'report.accounting_dynamic_reports_community.ks_pdf_aged_rec'
    _inherit = 'report.accounting_dynamic_reports_community.ks_dfr_base'
    _description = 'Dynamic Financial Reports - Aged Receivable PDF'


class KsDfrReportAgedPayable(models.AbstractModel):
    _name = 'report.accounting_dynamic_reports_community.ks_pdf_aged_pay'
    _inherit = 'report.accounting_dynamic_reports_community.ks_dfr_base'
    _description = 'Dynamic Financial Reports - Aged Payable PDF'


class KsDfrReportConsolidatedJournal(models.AbstractModel):
    _name = 'report.accounting_dynamic_reports_community.ks_pdf_journals'
    _inherit = 'report.accounting_dynamic_reports_community.ks_dfr_base'
    _description = 'Dynamic Financial Reports - Consolidated Journals PDF'


class KsDfrReportTax(models.AbstractModel):
    _name = 'report.accounting_dynamic_reports_community.ks_pdf_tax'
    _inherit = 'report.accounting_dynamic_reports_community.ks_dfr_base'
    _description = 'Dynamic Financial Reports - Tax Report PDF'
