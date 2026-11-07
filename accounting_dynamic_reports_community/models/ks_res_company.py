# -*- coding: utf-8 -*-
from odoo import models


class ResCompany(models.Model):
    _inherit = "res.company"

    def ks_get_choosed_default_tax_report(self):
        """Hook returning the tax report template selected by default.

        Odoo 16 Community has no per-country ``account.tax.report`` templates
        (tax grids moved to ``account.report``), so the dynamic tax report always
        groups lines by tax. Localisation modules may override this hook.
        """
        self.ensure_one()
        available_reports = self.ks_get_existing_tax_report()
        return available_reports[:1] or None

    def ks_get_existing_tax_report(self):
        """Return the tax report templates available for the company (none by default)."""
        self.ensure_one()
        return self.env['ks.dynamic.financial.reports'].browse()
