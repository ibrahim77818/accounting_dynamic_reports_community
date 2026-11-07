# -*- coding: utf-8 -*-
import json

from odoo import fields
from odoo.exceptions import AccessError
from odoo.tests import tagged

from odoo.addons.account.tests.common import AccountTestInvoicingCommon

REPORTS = {
    'ks_df_pnl0': 'get_xlsx',
    'ks_dynamic_financial_balancesheet': 'get_xlsx',
    'ks_df_report_cash_flow0': 'get_xlsx',
    'ks_df_es0': 'get_xlsx',
    'ks_df_tax_report': 'ks_dynamic_tax_xlsx',
    'ks_df_tb0': 'ks_get_xlsx_trial_balance',
    'ks_df_gl0': 'ks_get_xlsx_general_ledger',
    'ks_df_partner_ledger0': 'ks_get_xlsx_partner_ledger',
    'ks_df_receivable0': 'ks_get_xlsx_Aging',
    'ks_df_payable0': 'ks_get_xlsx_Aging',
    'ks_df_cj0': 'ks_dynamic_consolidate_xlsx',
}

PDF_ACTIONS = {
    'ks_df_pnl0': 'ks_dynamic_financial_report_action',
    'ks_dynamic_financial_balancesheet': 'ks_dynamic_financial_report_action',
    'ks_df_report_cash_flow0': 'ks_dynamic_financial_report_action',
    'ks_df_es0': 'ks_dynamic_financial_executive_action',
    'ks_df_tax_report': 'ks_dynamic_financial_tax_action',
    'ks_df_tb0': 'ks_dynamic_financial_trial_bal_action',
    'ks_df_gl0': 'ks_dynamic_financial_gel_bal_action',
    'ks_df_partner_ledger0': 'ks_dynamic_financial_partner_led_action',
    'ks_df_receivable0': 'ks_dynamic_financial_age_rec_action',
    'ks_df_payable0': 'ks_dynamic_financial_age_pay_action',
    'ks_df_cj0': 'ks_dynamic_financial_cons_journal_action',
}


def _jsonable(value):
    return json.loads(json.dumps(value, default=lambda o: o.ids if hasattr(o, '_name') else str(o)))


@tagged('post_install', '-at_install', 'accounting_dynamic_reports_community')
class TestDynamicReports(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        today = fields.Date.today()
        cls.year_start = today.replace(month=1, day=1)
        cls.inv_1 = cls.init_invoice('out_invoice', invoice_date=cls.year_start, post=True, amounts=[1000.0])
        cls.inv_2 = cls.init_invoice('out_invoice', partner=cls.partner_b, invoice_date=today, post=True,
                                     amounts=[500.0])
        cls.bill_1 = cls.init_invoice('in_invoice', invoice_date=cls.year_start, post=True, amounts=[400.0])
        cls.refund = cls.init_invoice('out_refund', invoice_date=today, post=True, amounts=[100.0])
        cls.draft = cls.init_invoice('out_invoice', invoice_date=today, post=False, amounts=[777.0])
        cls.env['account.payment.register'].with_context(
            active_model='account.move', active_ids=cls.inv_1.ids).create({'payment_date': today})._create_payments()

    # ------------------------------------------------------------------ helpers
    def _report(self, xmlid, user=None):
        rec = self.env.ref('accounting_dynamic_reports_community.' + xmlid)
        env_user = user or self.env.user
        return rec.with_user(env_user).with_context(
            allowed_company_ids=self.company_data['company'].ids,
            model='ks.dynamic.financial.reports', id=rec.id)

    def _info(self, xmlid, options=None, user=None):
        report = self._report(xmlid, user=user)
        info = report.ks_get_dynamic_fin_info(options or False)
        return _jsonable(info)

    def _posted_only(self, xmlid):
        opts = self._info(xmlid)['ks_df_informations']
        opts['ks_posted_entries'] = True
        opts['ks_unposted_entries'] = False
        return self._info(xmlid, opts)

    def _aml_sum(self, domain):
        lines = self.env['account.move.line'].search(
            domain + [('company_id', '=', self.company_data['company'].id), ('parent_state', '=', 'posted')])
        return sum(lines.mapped('debit')), sum(lines.mapped('credit'))

    # ------------------------------------------------------------------ tests
    def test_01_all_reports_compute(self):
        for xmlid in REPORTS:
            with self.subTest(report=xmlid):
                info = self._info(xmlid)
                self.assertIn('ks_report_lines', info)
                # second round trip with the returned options, as the web client does
                info2 = self._info(xmlid, info['ks_df_informations'])
                self.assertEqual(info2['new_ks_df_reports_ids'], info['new_ks_df_reports_ids'])

    def test_02_trial_balance_is_balanced(self):
        info = self._posted_only('ks_df_tb0')
        subtotal = list(info['ks_subtotal'].values())[0]
        self.assertAlmostEqual(subtotal['debit'], subtotal['credit'], places=2)
        debit, credit = self._aml_sum([('date', '<=', fields.Date.today())])
        self.assertAlmostEqual(subtotal['ending_debit'], debit, places=2)
        self.assertAlmostEqual(subtotal['ending_credit'], credit, places=2)

    def test_03_balance_sheet_balances(self):
        info = self._posted_only('ks_dynamic_financial_balancesheet')
        by_name = {l['ks_name']: l for l in info['ks_report_lines'] if l['ks_df_report_account_type'] == 'report'}
        self.assertAlmostEqual(by_name['ASSETS']['balance'], by_name['EQUITY + LIABILITIES']['balance'], places=2)

    def test_04_no_duplicate_account_rows(self):
        info = self._posted_only('ks_dynamic_financial_balancesheet')
        keys = [(l['parent'], l['self_id']) for l in info['ks_report_lines']
                if l['ks_df_report_account_type'] == 'account']
        self.assertEqual(len(keys), len(set(keys)), "An account is listed twice under the same section")

    def test_05_profit_and_loss_net_profit(self):
        info = self._posted_only('ks_df_pnl0')
        net = [l for l in info['ks_report_lines'] if l['ks_name'] == 'Net Profit'][0]
        inc_d, inc_c = self._aml_sum([('account_id.account_type', 'in', ('income', 'income_other'))])
        exp_d, exp_c = self._aml_sum([('account_id.account_type', 'in',
                                       ('expense', 'expense_depreciation', 'expense_direct_cost'))])
        self.assertAlmostEqual(net['balance'], (inc_c - inc_d) - (exp_d - exp_c), places=2)

    def test_06_general_ledger_matches_journal_items(self):
        info = self._posted_only('ks_df_gl0')
        receivable = self.company_data['default_account_receivable']
        line = info['ks_report_lines'][receivable.code]
        debit, credit = self._aml_sum([('account_id', '=', receivable.id), ('date', '<=', fields.Date.today())])
        self.assertAlmostEqual(line['debit'], debit, places=2)
        self.assertAlmostEqual(line['credit'], credit, places=2)

    def test_07_draft_filter(self):
        opts = self._info('ks_df_gl0')['ks_df_informations']
        opts.update(ks_posted_entries=False, ks_unposted_entries=True)
        info = self._info('ks_df_gl0', opts)
        revenue = self.company_data['default_account_revenue']
        self.assertAlmostEqual(info['ks_report_lines'][revenue.code]['credit'], 777.0, places=2)

    def test_08_aged_receivable_total(self):
        info = self._posted_only('ks_df_receivable0')
        total = info['ks_partner_dict']['Total']['total']
        open_amls = self.env['account.move.line'].search([
            ('company_id', '=', self.company_data['company'].id), ('parent_state', '=', 'posted'),
            ('account_id.account_type', '=', 'asset_receivable'), ('reconciled', '=', False)])
        self.assertAlmostEqual(total, sum(open_amls.mapped('amount_residual')), places=2)

    def test_09_tax_report(self):
        info = self._posted_only('ks_df_tax_report')
        sale = [l for l in info['ks_report_lines'] if l.get('id') == 'sale']
        self.assertTrue(sale, "Sales section missing from the tax report")

    def test_10_xlsx_exports(self):
        for xmlid, method in REPORTS.items():
            with self.subTest(report=xmlid):
                report = self._report(xmlid)
                opts = self._info(xmlid)['ks_df_informations']
                content = getattr(report, method)(opts)
                self.assertTrue(content.startswith(b'PK'), "Not an xlsx file")
                opts['ks_report_with_lines'] = True
                self.assertTrue(getattr(report, method)(opts).startswith(b'PK'))

    def test_11_pdf_templates_render(self):
        for xmlid, action in PDF_ACTIONS.items():
            with self.subTest(report=xmlid):
                info = self._info(xmlid)
                info['ks_df_informations']['ks_report_with_lines'] = True
                report = self.env.ref('accounting_dynamic_reports_community.' + action)
                rec = self.env.ref('accounting_dynamic_reports_community.' + xmlid)
                html, _ = report._render_qweb_html(report.report_name, rec.ids, data={'js_data': info})
                html = html.decode()
                self.assertIn('ks-pdf-table', html)
                self.assertIn('ks-pdf-header', html)

    def test_12_comparison_periods(self):
        opts = self._info('ks_df_pnl0')['ks_df_informations']
        opts['ks_differ'].update(ks_differentiate_filter='earlier_interval', ks_no_of_interval=2)
        opts['ks_diff_filter'].update(ks_diff_filter_enablity=True, ks_debit_credit_visibility=False)
        info = self._info('ks_df_pnl0', opts)
        self.assertEqual(len(info['ks_df_informations']['ks_differ']['ks_intervals']), 2)

    def test_13_access_rights(self):
        billing = self.env['res.users'].create({
            'name': 'Billing', 'login': 'dfr_billing', 'company_id': self.company_data['company'].id,
            'company_ids': [(6, 0, self.company_data['company'].ids)],
            'groups_id': [(6, 0, [self.env.ref('account.group_account_invoice').id])],
        })
        self.assertTrue(self._info('ks_df_pnl0', user=billing)['ks_report_lines'])
        portal = self.env['res.users'].create({
            'name': 'Portal', 'login': 'dfr_portal', 'company_id': self.company_data['company'].id,
            'company_ids': [(6, 0, self.company_data['company'].ids)],
            'groups_id': [(6, 0, [self.env.ref('base.group_portal').id])],
        })
        with self.assertRaises(AccessError):
            self.env.ref('accounting_dynamic_reports_community.ks_df_pnl0').with_user(portal).read(['ks_name'])

    def test_14_multi_company_isolation(self):
        company_2 = self.setup_other_company()['company']
        self.init_invoice('out_invoice', invoice_date=self.year_start, post=True, amounts=[9999.0],
                          company=company_2)
        info = self._posted_only('ks_df_tb0')
        subtotal = list(info['ks_subtotal'].values())[0]
        debit, _credit = self._aml_sum([('date', '<=', fields.Date.today())])
        self.assertAlmostEqual(subtotal['ending_debit'], debit, places=2,
                               msg="Another company's entries leaked into the trial balance")

    def test_15_send_by_email(self):
        report = self._report('ks_df_pnl0')
        self.env.user.email = 'dfr@example.com'
        info = self._info('ks_df_pnl0')
        mails_before = self.env['mail.mail'].search_count([])
        report.ks_action_send_email(
            info, 'accounting_dynamic_reports_community.ks_dynamic_financial_report_action')
        self.assertEqual(self.env['mail.mail'].search_count([]), mails_before + 1)

    def _period_pnl_sql(self, date_from, date_to):
        dom = [('date', '>=', date_from), ('date', '<=', date_to)]
        inc_d, inc_c = self._aml_sum(dom + [('account_id.account_type', 'in', ('income', 'income_other'))])
        exp_d, exp_c = self._aml_sum(dom + [('account_id.account_type', 'in',
                                             ('expense', 'expense_depreciation', 'expense_direct_cost'))])
        return inc_c - inc_d, exp_d - exp_c

    def test_16_executive_summary_matches_period_pnl(self):
        info = self._posted_only('ks_df_es0')
        opts = info['ks_df_informations']
        key = 'comp_bal_' + opts['date']['ks_string']
        lines = {l['ks_name']: l for l in info['ks_report_lines']}
        income, expense = self._period_pnl_sql(opts['date']['ks_start_date'], opts['date']['ks_end_date'])
        self.assertAlmostEqual(lines['Total Income']['balance'][key], income, places=2)
        self.assertAlmostEqual(lines['Expense']['balance'][key], expense, places=2)
        self.assertAlmostEqual(lines['Net Profit']['balance'][key], income - expense, places=2)

    def test_17_profit_and_loss_date_range(self):
        self.env.ref('accounting_dynamic_reports_community.ks_df_pnl0').ks_comparison_range = True
        opts = self._info('ks_df_pnl0')['ks_df_informations']
        opts.update(ks_posted_entries=True, ks_unposted_entries=False)
        opts['date'].update(ks_filter='this_year')
        info = self._info('ks_df_pnl0', opts)
        date = info['ks_df_informations']['date']
        self.assertEqual(date['ks_process'], 'range')
        income, expense = self._period_pnl_sql(date['ks_start_date'], date['ks_end_date'])
        net = [l for l in info['ks_report_lines'] if l['ks_name'] == 'Net Profit'][0]
        self.assertAlmostEqual(net['balance'], income - expense, places=2)

    def test_18_comparison_total_income_not_doubled(self):
        self.env.ref('accounting_dynamic_reports_community.ks_df_pnl0').ks_comparison_range = True
        opts = self._info('ks_df_pnl0')['ks_df_informations']
        opts.update(ks_posted_entries=True, ks_unposted_entries=False)
        opts['date'].update(ks_filter='this_year')
        opts['ks_differ'].update(ks_differentiate_filter='earlier_interval', ks_no_of_interval=1)
        opts['ks_diff_filter'].update(ks_diff_filter_enablity=True, ks_debit_credit_visibility=False)
        info = self._info('ks_df_pnl0', opts)
        lines = {l['ks_name']: l for l in info['ks_report_lines'] if l.get('ks_df_report_account_type') != 'account'}
        interval = info['ks_df_informations']['ks_differ']['ks_intervals'][0]
        key = 'comp_bal_' + interval['ks_string']
        income, expense = self._period_pnl_sql(interval['ks_start_date'], interval['ks_end_date'])
        self.assertAlmostEqual(lines['Total Income']['balance_cmp'][key], income, places=2)
        self.assertAlmostEqual(lines['Net Profit']['balance_cmp'][key], income - expense, places=2)
        cur_income, cur_expense = self._period_pnl_sql(info['ks_df_informations']['date']['ks_start_date'],
                                                      info['ks_df_informations']['date']['ks_end_date'])
        self.assertAlmostEqual(lines['Total Income']['balance'], cur_income, places=2)
