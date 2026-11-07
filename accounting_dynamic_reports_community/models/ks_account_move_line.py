import ast

from odoo import api, models


def ks_query_parts(query):
    """(FROM, WHERE, params) of a Query: ``get_sql()`` was removed in Odoo 18,
    the clauses are ``SQL`` objects since then."""
    if hasattr(query, 'get_sql'):
        return query.get_sql()
    from_clause, where_clause = query.from_clause, query.where_clause
    return from_clause.code, where_clause.code, list(from_clause.params) + list(where_clause.params)


class KsAccountMoveLine(models.Model):
    _inherit = "account.move.line"

    @api.model
    def _ks_query_get(self, domain=None):
        """Build the (FROM, WHERE, params) triplet used by the dynamic reports.

        Filters are read from the context (date_from, date_to, state, journal_ids,
        company_ids, account_ids, partner_ids, ...). Record rules are applied so a
        user never sees journal items they could not read through the UI.
        """
        self.check_access_rights('read')

        context = dict(self.env.context or {})
        domain = domain or []
        if not isinstance(domain, (list, tuple)):
            domain = ast.literal_eval(domain)
        domain = list(domain)

        date_field = 'date_maturity' if context.get('aged_balance') else 'date'

        if context.get('date_to'):
            domain.append((date_field, '<=', context['date_to']))
        if context.get('date_from'):
            if not context.get('strict_range'):
                domain += ['|', (date_field, '>=', context['date_from']),
                           ('account_id.include_initial_balance', '=', True)]
            elif context.get('initial_bal'):
                domain.append((date_field, '<', context['date_from']))
            else:
                domain.append((date_field, '>=', context['date_from']))

        if context.get('journal_ids'):
            domain.append(('journal_id', 'in', context['journal_ids']))
        if context.get('state') and context['state'].lower() != 'all':
            domain.append(('parent_state', '=', context['state']))

        if context.get('company_ids'):
            domain.append(('company_id', 'in', context['company_ids']))
        else:
            domain.append(('company_id', 'in', self.env.companies.ids))

        if context.get('reconcile_date'):
            domain += [
                '|', ('reconciled', '=', False),
                '|', ('matched_debit_ids.max_date', '>', context['reconcile_date']),
                ('matched_credit_ids.max_date', '>', context['reconcile_date']),
            ]

        if context.get('account_tag_ids'):
            domain.append(('account_id.tag_ids', 'in', context['account_tag_ids'].ids))
        if context.get('account_ids'):
            domain.append(('account_id', 'in', context['account_ids'].ids))
        if context.get('partner_ids'):
            domain.append(('partner_id', 'in', context['partner_ids'].ids))
        if context.get('partner_categories'):
            domain.append(('partner_id.category_id', 'in', context['partner_categories'].ids))

        domain += [
            ('display_type', 'not in', ('line_section', 'line_note')),
            ('parent_state', '!=', 'cancel'),
        ]

        query = self._where_calc(domain)
        self._apply_ir_rules(query, 'read')
        return ks_query_parts(query)
