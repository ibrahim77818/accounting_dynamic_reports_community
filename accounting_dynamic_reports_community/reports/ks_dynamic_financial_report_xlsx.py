# -*- coding: utf-8 -*-
import io
from odoo import models, _
from .ks_xlsx_style import ks_workbook
import datetime
from datetime import date
import collections
from odoo.exceptions import ValidationError


class KsDynamicFinancialXlsxAR(models.Model):
    _inherit = 'ks.dynamic.financial.base'

    def round_nested_values(self, data):
        """Recursively round all float/int values in nested dicts, lists, or tuples."""
        if isinstance(data, dict):
            return {k: self.round_nested_values(v) for k, v in data.items()}
        elif isinstance(data, (list, tuple)):
            return type(data)(self.round_nested_values(v) for v in data)
        elif isinstance(data, (int, float)):
            return round(data, 2)
        return data

    def get_xlsx(self, ks_df_informations, response=None):
        if self.ks_name in ('Executive Summary', 'Balance Sheet', 'Profit and Loss', 'Cash Flow Statement'):
            if (ks_df_informations['date']['ks_start_date'] == False and
                    ks_df_informations['date']['ks_end_date'] == False):
                raise ValidationError(_('Sorry,Export file will not get download without date.'))
            output = io.BytesIO()
            workbook = ks_workbook(output)
            sheet = workbook.add_worksheet(self.display_name[:31])
            if self.display_name == "Profit and Loss":
                lines, ks_initial_balance, ks_current_balance, ks_ending_balance = self.with_context(no_format=True,
                                                                                                     print_mode=True,
                                                                                                     prefetch_fields=False).ks_fetch_report_account_lines(
                    ks_df_informations)
                lines = self.round_nested_values(lines)
                lines = self.order_data(lines)
                lines = self.build_hierarchy(lines)
                lines = self.flatten_hierarchy(lines)

                net_profit = total_income = expense = None

                for item in lines:
                    if item.get("ks_name") == "Net Profit":
                        net_profit = item
                    elif item.get("ks_name") == "Total Income":
                        total_income = item
                    elif item.get("ks_name") == "Expense":
                        expense = item

                if net_profit and total_income and expense:
                    net_profit["debit"] = round(total_income.get("debit", 0.0) - expense.get("debit", 0.0), 2)
                    net_profit["credit"] = round(total_income.get("credit", 0.0) - expense.get("credit", 0.0), 2)
                    net_profit["balance"] = round(total_income.get("balance", 0.0) - expense.get("balance", 0.0), 2)

                    net_profit["balance_cmp"] = {}
                    for key in total_income.get("balance_cmp", {}):
                        net_profit["balance_cmp"][key] = round(
                            total_income["balance_cmp"].get(key, 0.0) - expense["balance_cmp"].get(key, 0.0), 2
                        )

            elif self.display_name == "Cash Flow Statement":
                lines, ks_initial_balance, ks_current_balance, ks_ending_balance = self.with_context(no_format=True,
                                                                                                     print_mode=True,
                                                                                                     prefetch_fields=False).ks_fetch_report_account_lines(
                    ks_df_informations)
                lines = self.round_nested_values(lines)
                lines = self.maintain_hierarchy(lines)

                def sum_children_totals(node):
                    if not node.get("children"):
                        return {
                            "debit": node.get("debit", 0.0),
                            "credit": node.get("credit", 0.0),
                            "balance": node.get("balance", 0.0),
                        }

                    total_debit = 0.0
                    total_credit = 0.0
                    total_balance = 0.0

                    for child in node["children"]:
                        child_totals = sum_children_totals(child)
                        total_debit += child_totals["debit"]
                        total_credit += child_totals["credit"]
                        total_balance += child_totals["balance"]

                    node["debit"] = round(total_debit, 2)
                    node["credit"] = round(total_credit, 2)
                    node["balance"] = round(total_balance, 2)

                    return {
                        "debit": node["debit"],
                        "credit": node["credit"],
                        "balance": node["balance"],
                    }

                for root in lines:
                    name = root.get("ks_name", "")
                    if name not in [
                        "Cash and cash equivalents, beginning period",
                        "Cash and cash equivalents,beginning period"
                    ]:
                        sum_children_totals(root)

                net_increase = None
                beginning_balance = None
                closing_balance = None

                for line in lines:
                    name = line.get("ks_name", "")
                    if name == "Net increase in cash and cash equivalents":
                        net_increase = line
                    elif name in (
                    "Cash and cash equivalents,beginning period", "Cash and cash equivalents, beginning period"):
                        beginning_balance = line
                    elif name in ("Cash and cash equivalents, closing balance"):
                        closing_balance = line

                if beginning_balance:
                    totals = sum_children_totals(beginning_balance)
                    beginning_balance["debit"] = totals["debit"]
                    beginning_balance["credit"] = totals["credit"]
                    beginning_balance["balance"] = totals["balance"]

                if net_increase and beginning_balance and closing_balance:
                    closing_balance["debit"] = round(
                        net_increase.get("debit", 0.0) + beginning_balance.get("debit", 0.0), 2)
                    closing_balance["credit"] = round(
                        net_increase.get("credit", 0.0) + beginning_balance.get("credit", 0.0), 2)
                    closing_balance["balance"] = round(
                        net_increase.get("balance", 0.0) + beginning_balance.get("balance", 0.0), 2)

                lines = self.flatten_hierarchy(lines)

            elif self.display_name == "Balance Sheet":
                lines, ks_initial_balance, ks_current_balance, ks_ending_balance = self.with_context(no_format=True,
                                                                                                     print_mode=True,
                                                                                                     prefetch_fields=False).ks_fetch_report_account_lines(
                    ks_df_informations)
                lines = lines[1:]
                lines = self.round_nested_values(lines)
                ks_bal_sum = 0
                ks_debit_sum = 0
                ks_credit_sum = 0
                ks_curr_l = {}
                ks_curr_el = {}
                ks_curr_e = {}
                ks_curr_sum = {}
                bal1 = {}
                bal2 = {}
                debit1 = {}
                debit2 = {}
                credit1 = {}
                credit2 = {}
                bal_sum = {}
                debit_sum = {}
                credit_sum = {}
                debit_equity_liability = {}
                credit_equity_liability = {}
                balance_equity_liability = {}

                for line in lines:
                    if line.get('ks_name') in ['LIABILITIES', 'EQUITY']:
                        if len(ks_df_informations['ks_differ']['ks_intervals']):
                            date_key = 'comp_bal_' + ks_df_informations['date']['ks_string']

                            if line.get('ks_name') == 'LIABILITIES':
                                bal1[date_key] = line.get('balance')
                                debit1[date_key] = line.get('debit', 0)
                                credit1[date_key] = line.get('credit', 0)

                                for rec_inter in ks_df_informations['ks_differ']['ks_intervals']:
                                    inter_key = 'comp_bal_' + rec_inter['ks_string']
                                    ks_curr_l[inter_key] = line['balance_cmp'][inter_key]

                            if line.get('ks_name') == 'EQUITY':
                                bal2[date_key] = line.get('balance')
                                debit2[date_key] = line.get('debit', 0)
                                credit2[date_key] = line.get('credit', 0)

                                for rec_inter in ks_df_informations['ks_differ']['ks_intervals']:
                                    inter_key = 'comp_bal_' + rec_inter['ks_string']
                                    ks_curr_e[inter_key] = line['balance_cmp'][inter_key]

                                bal_sum[date_key] = bal1[date_key] + bal2[date_key]
                                debit_sum[date_key] = debit1[date_key] + debit2[date_key]
                                credit_sum[date_key] = credit1[date_key] + credit2[date_key]


                        else:
                            ks_bal_sum += line.get('balance', 0)
                            ks_debit_sum += line.get('debit', 0)
                            ks_credit_sum += line.get('credit', 0)
                        debit_equity_liability = ks_debit_sum
                        credit_equity_liability = ks_credit_sum
                        balance_equity_liability = ks_bal_sum

                    if line.get('ks_name') == 'EQUITY + LIABILITIES':
                        date_key = 'comp_bal_' + ks_df_informations['date']['ks_string']

                        line['balance'] = round(balance_equity_liability, 2)
                        line['debit'] = round(debit_equity_liability, 2)
                        line['credit'] = round(credit_equity_liability, 2)

                        if len(ks_df_informations['ks_differ']['ks_intervals']):
                            bal_sum[date_key] = bal1[date_key] + bal2[date_key]
                            debit_sum[date_key] = debit1[date_key] + debit2[date_key]
                            credit_sum[date_key] = credit1[date_key] + credit2[date_key]

                            for rec_inter in ks_df_informations['ks_differ']['ks_intervals']:
                                inter_key = 'comp_bal_' + rec_inter['ks_string']
                                ks_curr_sum[inter_key] = ks_curr_l[inter_key] + ks_curr_e[inter_key]

                    if line.get('ks_name') == 'Previous Years Unallocated Earnings' and self.ks_date_filter.get(
                            'ks_process') == 'range':
                        ks_bal_sum -= line.get('balance', 0)
                        ks_debit_sum -= line.get('debit', 0)
                        ks_credit_sum -= line.get('credit', 0)

                if len(ks_df_informations['ks_differ']['ks_intervals']):
                    lines[len(lines) - 1]['balance'] = bal_sum[
                        'comp_bal_' + ks_df_informations['date']['ks_string']]
                    for rec_inter in ks_df_informations['ks_differ']['ks_intervals']:
                        lines[len(lines) - 1]['balance_cmp'][
                            'comp_bal_' + rec_inter['ks_string']] = ks_curr_sum[
                            'comp_bal_' + rec_inter['ks_string']]
                else:
                    lines[len(lines) - 1]['balance'] = ks_bal_sum

            elif self.display_name != "Executive Summary":
                lines, ks_initial_balance, ks_current_balance, ks_ending_balance = self.with_context(no_format=True,
                                                                                                     print_mode=True,
                                                                                                     prefetch_fields=False).ks_fetch_report_account_lines(
                    ks_df_informations)
                lines = self.round_nested_values(lines)
            else:
                lines = self.ks_process_executive_summary(ks_df_informations)
                lines = self.round_nested_values(lines)

                net_profit = None
                total_income = None
                expense = None
                net_assets = None
                net_profit_margin_line = None
                roi_line = None
                gross_profit_margin_line = None

                def get_dict_value(entry, field, key, default=0.0):
                    """Helper to safely get value whether entry[field] is dict or float"""
                    value = entry.get(field, {})
                    if isinstance(value, dict):
                        return value.get(key, default)
                    base_key = 'comp_bal_' + ks_df_informations['date']['ks_string']
                    if key == base_key:
                        return value if isinstance(value, (int, float)) else default
                    return default

                for item in lines:
                    if item.get("ks_name") == "Net Profit":
                        net_profit = item
                    elif item.get("ks_name") == "Total Income":
                        total_income = item
                    elif item.get("ks_name") == "Expense":
                        expense = item
                    elif item.get("ks_name") == "Net Assets":
                        net_assets = item
                    elif item.get("ks_name") == _("Net profit margin (net profit /income)"):
                        net_profit_margin_line = item
                    elif item.get("ks_name") == _("Return on Investments (net profit /net assets)"):
                        roi_line = item
                    elif item.get("ks_name") == _("Gross profit margin (gross profit / operating income)"):
                        gross_profit_margin_line = item

                if net_profit and total_income and expense:
                    all_period_keys = [
                                          'comp_bal_' + ks_df_informations['date']['ks_string']
                                      ] + [
                                          'comp_bal_' + rec_inter['ks_string']
                                          for rec_inter in ks_df_informations['ks_differ']['ks_intervals']
                                      ]

                    net_profit_balance_temp = collections.defaultdict(float)
                    net_profit_debit_temp = collections.defaultdict(float)
                    net_profit_credit_temp = collections.defaultdict(float)

                    for key in all_period_keys:
                        income_balance = get_dict_value(total_income, "balance", key, 0.0)
                        expense_balance = get_dict_value(expense, "balance", key, 0.0)
                        net_profit_balance_temp[key] = round(income_balance - expense_balance, 2)

                        income_debit = get_dict_value(total_income, "debit", key, 0.0)
                        expense_debit = get_dict_value(expense, "debit", key, 0.0)
                        net_profit_debit_temp[key] = round(income_debit - expense_debit, 2)

                        income_credit = get_dict_value(total_income, "credit", key, 0.0)
                        expense_credit = get_dict_value(expense, "credit", key, 0.0)
                        net_profit_credit_temp[key] = round(income_credit - expense_credit, 2)

                    net_profit["balance"] = dict(net_profit_balance_temp)
                    net_profit["debit"] = dict(net_profit_debit_temp)
                    net_profit["credit"] = dict(net_profit_credit_temp)

                if net_profit_margin_line and net_profit and total_income:
                    for key in net_profit["balance"]:
                        income_val = get_dict_value(total_income, "balance", key)
                        net_val = get_dict_value(net_profit, "balance", key)
                        net_profit_margin_line["balance"][key] = round((net_val / income_val) * 100,
                                                                       2) if income_val else 0.0

                        income_debit = get_dict_value(total_income, "debit", key)
                        net_debit = get_dict_value(net_profit, "debit", key)
                        net_profit_margin_line["debit"][key] = round((net_debit / income_debit) * 100,
                                                                     2) if income_debit else 0.0

                        income_credit = get_dict_value(total_income, "credit", key)
                        net_credit = get_dict_value(net_profit, "credit", key)
                        net_profit_margin_line["credit"][key] = round((net_credit / income_credit) * 100,
                                                                      2) if income_credit else 0.0

                if roi_line and net_profit and net_assets:
                    for key in net_profit["balance"]:
                        asset_val = get_dict_value(net_assets, "balance", key)
                        net_val = get_dict_value(net_profit, "balance", key)
                        roi_line["balance"][key] = round((net_val / asset_val) * 100, 2) if asset_val else 0.0

                        asset_debit = get_dict_value(net_assets, "debit", key)
                        net_debit = get_dict_value(net_profit, "debit", key)
                        roi_line["debit"][key] = round((net_debit / asset_debit) * 100, 2) if asset_debit else 0.0

                        asset_credit = get_dict_value(net_assets, "credit", key)
                        net_credit = get_dict_value(net_profit, "credit", key)
                        roi_line["credit"][key] = round((net_credit / asset_credit) * 100, 2) if asset_credit else 0.0

                total_debit_profitability = collections.defaultdict(float)
                total_credit_profitability = collections.defaultdict(float)
                total_balance_profitability = collections.defaultdict(float)

                profitability_parent_line = None
                current_level_1_found = False

                for line in lines:
                    if line.get('ks_name') == _('Profitability'):
                        profitability_parent_line = line
                        current_level_1_found = True
                        continue

                    if current_level_1_found and line.get('ks_level') == 1 and line.get('ks_name') != _(
                            'Profitability'):
                        current_level_1_found = False
                        break

                    if current_level_1_found and line.get('ks_level') == 2:
                        balance_val = line.get('balance', {})
                        debit_val = line.get('debit', {})
                        credit_val = line.get('credit', {})

                        if not isinstance(balance_val, dict):
                            continue  # skip this line if balance is not a dict

                        for key in balance_val:
                            total_balance_profitability[key] += get_dict_value(line, 'balance', key)
                            total_debit_profitability[key] += get_dict_value(line, 'debit', key)
                            total_credit_profitability[key] += get_dict_value(line, 'credit', key)

                if profitability_parent_line:
                    if ks_df_informations['ks_diff_filter']['ks_debit_credit_visibility']:
                        base_key = 'comp_bal_' + ks_df_informations['date']['ks_string']
                        profitability_parent_line['debit'] = round(total_debit_profitability.get(base_key, 0.0), 2)
                        profitability_parent_line['credit'] = round(total_credit_profitability.get(base_key, 0.0), 2)
                        profitability_parent_line['balance'] = round(total_balance_profitability.get(base_key, 0.0), 2)
                    else:
                        profitability_parent_line['debit'] = {
                            k: round(v, 2) for k, v in total_debit_profitability.items()
                        }
                        profitability_parent_line['credit'] = {
                            k: round(v, 2) for k, v in total_credit_profitability.items()
                        }
                        profitability_parent_line['balance'] = {
                            k: round(v, 2) for k, v in total_balance_profitability.items()
                        }

                total_balance_performance = collections.defaultdict(float)
                total_debit_performance = collections.defaultdict(float)
                total_credit_performance = collections.defaultdict(float)

                performance_parent_line = None
                current_level_1_found = False

                for line in lines:
                    if line.get('ks_name') == _('Performance'):
                        performance_parent_line = line
                        current_level_1_found = True
                        continue

                    if current_level_1_found and line.get('ks_level') == 1 and line.get('ks_name') != _('Performance'):
                        current_level_1_found = False
                        break

                    if current_level_1_found and line.get('ks_level') == 2:
                        for key in line.get('balance', {}):
                            total_balance_performance[key] += get_dict_value(line, 'balance', key)
                            total_debit_performance[key] += get_dict_value(line, 'debit', key)
                            total_credit_performance[key] += get_dict_value(line, 'credit', key)

                if performance_parent_line:
                    performance_parent_line['balance'] = dict(total_balance_performance)
                    performance_parent_line['debit'] = dict(total_debit_performance)
                    performance_parent_line['credit'] = dict(total_credit_performance)

                # Recalculate Position
                total_balance_position = collections.defaultdict(float)
                total_debit_position = collections.defaultdict(float)
                total_credit_position = collections.defaultdict(float)

                position_parent_line = None
                current_level_1_found = False

                for line in lines:
                    if line.get('ks_name') == _('Position'):
                        position_parent_line = line
                        current_level_1_found = True
                        continue

                    if current_level_1_found and line.get('ks_level') == 1 and line.get('ks_name') != _('Position'):
                        current_level_1_found = False
                        break

                    if current_level_1_found and line.get('ks_level') == 2:
                        for key in line.get('balance', {}):
                            total_balance_position[key] += get_dict_value(line, 'balance', key)
                            total_debit_position[key] += get_dict_value(line, 'debit', key)
                            total_credit_position[key] += get_dict_value(line, 'credit', key)

                if position_parent_line:
                    position_parent_line['balance'] = dict(total_balance_position)
                    position_parent_line['debit'] = dict(total_debit_position)
                    position_parent_line['credit'] = dict(total_credit_position)

            sheet.freeze_panes(4, 1)
            row_pos = 0
            row_pos_2 = 0
            number_format = '#,##0.00'
            format_title = workbook.add_format({
                'bold': True,
                'align': 'center',
                'font_size': 12,
                'border': False,
                'font': 'Arial',
            })
            format_header = workbook.add_format({
                'bold': True,
                'font_size': 10,
                'align': 'center',
                'font': 'Arial',
                'bottom': False,
            })
            content_header = workbook.add_format({
                'bold': False,
                'font_size': 10,
                'align': 'center',
                'font': 'Arial',
            })
            content_header_date = workbook.add_format({
                'bold': False,
                'font_size': 10,
                'align': 'center',
                'font': 'Arial',
            })
            line_header = workbook.add_format({
                'bold': False,
                'font_size': 10,
                'align': 'right',
                'font': 'Arial',
                'bottom': True,
            })

            line_header_bold = workbook.add_format({
                'bold': True,
                'font_size': 10,
                'align': 'right',
                'font': 'Arial',
                'bottom': True,
            })

            line_header_string = workbook.add_format({
                'bold': False,
                'font_size': 10,
                'align': 'left',
                'font': 'Arial',
                'bottom': True,
            })
            line_header_string_bold = workbook.add_format({
                'bold': True,
                'font_size': 10,
                'align': 'left',
                'font': 'Arial',
                'bottom': True,
            })
            # Date from
            lang = self.env.user.lang
            lang_id = self.env['res.lang'].search([('code', '=', lang)])['date_format'].replace('/', '-')
            f_s_date = ks_df_informations['date'].get('ks_start_date') if ks_df_informations['date'].get(
                'ks_start_date') else date.today()
            f_e_date = ks_df_informations['date'].get('ks_end_date') if ks_df_informations['date'].get(
                'ks_end_date') else date.today()
            ks_new_start_date = (datetime.datetime.strptime(
                str(f_s_date), '%Y-%m-%d').date()).strftime(lang_id)
            ks_new_end_date = (datetime.datetime.strptime(
                str(f_e_date), '%Y-%m-%d').date()).strftime(lang_id)

            if ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                if not ks_df_informations['ks_differ'].get('ks_intervals'):
                    f_start_date = date.today()
                    f_end_date = date.today()
                    ks_new_start_comp_date = (datetime.datetime.strptime(
                        str(f_start_date), '%Y-%m-%d').date()).strftime(
                        lang_id)
                    ks_new_end_comp_date = (datetime.datetime.strptime(
                        str(f_end_date), '%Y-%m-%d').date()).strftime(
                        lang_id)
                else:
                    for_s_start_comp_date = ks_df_informations['ks_differ'].get('ks_intervals')[-1][
                        'ks_start_date'] if \
                        ks_df_informations['ks_differ'].get('ks_intervals')[-1]['ks_start_date'] else date.today()
                    for_e_end_comp_date = ks_df_informations['ks_differ'].get('ks_intervals')[-1]['ks_end_date'] if \
                        ks_df_informations['ks_differ'].get('ks_intervals')[-1]['ks_end_date'] else date.today()
                    ks_new_start_comp_date = (datetime.datetime.strptime(
                        str(for_s_start_comp_date), '%Y-%m-%d').date()).strftime(
                        lang_id)
                    ks_new_end_comp_date = (datetime.datetime.strptime(
                        str(for_e_end_comp_date), '%Y-%m-%d').date()).strftime(
                        lang_id)
            if self.display_name != 'Executive Summary':
                if not ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                    if ks_df_informations['date']['ks_process'] == 'range':
                        sheet.write_string(row_pos_2, 0, _('Date From'), format_header)
                        if ks_df_informations['date'].get('ks_start_date'):
                            sheet.write_string(row_pos_2, 1, ks_new_start_date,
                                               content_header_date)
                        row_pos_2 += 1
                        # Date to
                        sheet.write_string(row_pos_2, 0, _('Date To'), format_header)

                        if ks_df_informations['date'].get('ks_end_date'):
                            sheet.write_string(row_pos_2, 1, ks_new_end_date,
                                               content_header_date)
                    else:
                        sheet.write_string(row_pos_2, 0, _('As of Date'), format_header)
                        if ks_df_informations['date'].get('ks_end_date'):
                            sheet.write_string(row_pos_2 + 1, row_pos_2, ks_new_end_date,
                                               content_header_date)
                    # Accounts
                    row_pos_2 += 1
                    if ks_df_informations.get('analytic_accounts'):
                        sheet.write_string(row_pos_2, 0, _('Analytic Accounts'), format_header)
                        a_list = ', '.join(lt or '' for lt in ks_df_informations['selected_analytic_account_names'])
                        sheet.write_string(row_pos_2, 1, a_list, content_header)
                    # Tags
                    row_pos_2 += 1
                    if ks_df_informations.get('analytic_tags'):
                        sheet.write_string(row_pos_2, 0, _('Tags'), format_header)
                        a_list = ', '.join(lt or '' for lt in ks_df_informations['selected_analytic_tag_names'])
                        sheet.write_string(row_pos_2, 1, a_list, content_header)

                # Comparison filter
                if ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                    sheet.write_string(row_pos_2, 0, _('Comparison Date From'),
                                       format_header)

                    sheet.write_string(row_pos_2, 1,
                                       ks_new_start_comp_date,
                                       content_header_date)
                    row_pos_2 += 1
                    # Date to
                    sheet.write_string(row_pos_2, 0, _('Comparison Date To'),
                                       format_header)

                    sheet.write_string(row_pos_2, 1,
                                       ks_new_end_comp_date,
                                       content_header_date)

                row_pos_2 += 0
                sheet.write_string(0, 2, _('Journals'), format_header)
                j_list = ', '.join(
                    journal.get('code') or '' for journal in ks_df_informations['journals'] if journal.get('selected'))
                sheet.write_string(1, 2, j_list,
                                   content_header)

                # Account
                row_pos_2 += 0
                sheet.write_string(0, 3, _('Accounts'), format_header)
                j_list = ', '.join(
                    journal.get('name') or '' for journal in ks_df_informations['account'] if journal.get('selected'))
                sheet.write_string(1, 3, j_list,
                                   content_header)

                row_pos += 3
                if ks_df_informations['ks_diff_filter']['ks_debit_credit_visibility']:

                    sheet.set_column(0, 0, 90)
                    sheet.set_column(1, 1, 15)
                    sheet.set_column(2, 3, 15)
                    sheet.set_column(3, 3, 15)

                    sheet.write_string(row_pos, 1, _('Debit'),
                                       format_header)
                    sheet.write_string(row_pos, 2, _('Credit'),
                                       format_header)
                    sheet.write_string(row_pos, 3, _('Balance'),
                                       format_header)

                    for a in lines:
                        if a['ks_level'] == 2:
                            row_pos += 1
                        row_pos += 1
                        if a.get('account', False):
                            tmp_style_str = line_header_string
                            tmp_style_num = line_header
                        else:
                            tmp_style_str = line_header_string_bold
                            tmp_style_num = line_header_bold
                        sheet.write_string(row_pos, 0, '   ' * len(a.get('list_len', [])) + a.get('ks_name'),
                                           tmp_style_str)
                        sheet.write_number(row_pos, 1, float(a.get('debit', 0.0)), tmp_style_num)
                        sheet.write_number(row_pos, 2, float(a.get('credit', 0.0)), tmp_style_num)
                        sheet.write_number(row_pos, 3, float(a.get('balance', 0.0)), tmp_style_num)

                if not ks_df_informations['ks_diff_filter']['ks_debit_credit_visibility']:
                    sheet.set_column(0, 0, 105)
                    sheet.set_column(1, 1, 20)
                    sheet.set_column(2, 2, 20)
                    sheet.write_string(row_pos, 0, _('Name'),
                                       format_header)
                    if ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                        col_pos = 0
                        for i in (lines[0].get('balance_cmp') or {}):
                            sheet.write_string(row_pos, col_pos + 1, i.split('comp_bal_')[1],
                                               format_header),
                            sheet.write_string(row_pos, (col_pos + 1) + 1, _('Balance'),
                                               format_header)
                            col_pos = col_pos + 1
                    else:
                        sheet.write_string(row_pos, 1, _('Balance'),
                                           format_header)

                    for a in lines:
                        if a['ks_level'] == 2:
                            row_pos += 1
                        row_pos += 1
                        if a.get('account', False):
                            tmp_style_str = line_header_string
                            tmp_style_num = line_header
                        else:
                            tmp_style_str = line_header_string_bold
                            tmp_style_num = line_header_bold
                        sheet.write_string(row_pos, 0, '   ' * len(a.get('list_len', [])) + a.get('ks_name'),
                                           tmp_style_str)
                        if ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                            col_pos = 0
                            for i in (a.get('balance_cmp') or {}):
                                sheet.write_number(row_pos, col_pos + 1, float(a['balance_cmp'][i]), tmp_style_num)
                                sheet.write_number(row_pos, (col_pos + 1) + 1, float(a['balance']), tmp_style_num)
                                col_pos += 1
            else:
                if not ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                    if ks_df_informations['date']['ks_process'] == 'range':
                        sheet.write_string(row_pos_2, 0, _('Date From'),
                                           format_header)
                        if ks_df_informations['date'].get('ks_start_date'):
                            sheet.write_string(row_pos_2, 1, ks_new_start_date,
                                               content_header_date)
                        row_pos_2 += 1
                        # Date to
                        sheet.write_string(row_pos_2, 0, _('Date To'),
                                           format_header)

                        if ks_df_informations['date'].get('ks_end_date'):
                            sheet.write_string(row_pos_2, 1, ks_new_end_date,
                                               content_header_date)
                    else:
                        sheet.write_string(row_pos_2, 0, _('As of Date'),
                                           format_header)
                        if ks_df_informations['date'].get('ks_end_date'):
                            sheet.write_string(row_pos_2, 1, ks_new_end_date,
                                               content_header_date)

                if ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                    sheet.write_string(row_pos_2, 0, _('Comparison Date From'),
                                       format_header)

                    sheet.write_string(row_pos_2, 1,
                                       ks_new_start_comp_date,
                                       content_header_date)
                    row_pos_2 += 1
                    # Date to
                    sheet.write_string(row_pos_2, 0, _('Comparison Date To'),
                                       format_header)

                    sheet.write_string(row_pos_2, 1,
                                       ks_new_end_comp_date,
                                       content_header_date)

                row_pos += 3
                sheet.write_string(0, 3, _('Accounts'), format_header)
                j_list = ', '.join(
                    journal.get('name') or '' for journal in ks_df_informations['account'] if journal.get('selected'))
                sheet.write_string(2 - 1, 3, j_list,
                                   content_header)
                if ks_df_informations['ks_diff_filter']['ks_debit_credit_visibility']:

                    sheet.set_column(0, 0, 90)
                    sheet.set_column(1, 1, 20)
                    sheet.set_column(2, 3, 20)
                    sheet.set_column(3, 3, 20)

                    sheet.write_string(row_pos, 0, _('Name'),
                                       format_header)
                    sheet.write_string(row_pos, 1, _('Debit'),
                                       format_header)
                    sheet.write_string(row_pos, 2, _('Credit'),
                                       format_header)
                    sheet.write_string(row_pos, 3, _('Balance'),
                                       format_header)

                    main_key = 'comp_bal_' + ks_df_informations['date']['ks_string']

                    for a in lines:
                        if a['ks_level'] == 2:
                            row_pos += 1
                        row_pos += 1
                        if a.get('account', False):
                            tmp_style_str = line_header_string
                            tmp_style_num = line_header
                        else:
                            tmp_style_str = line_header_string_bold
                            tmp_style_num = line_header_bold
                        sheet.write_string(row_pos, 0, '   ' * len(a.get('list_len', [])) + a.get('ks_name'),
                                           tmp_style_str)

                        debit_val = 0.0
                        if isinstance(a.get('debit'), dict):
                            debit_val = float(a['debit'].get(main_key, 0.0))
                        else:
                            debit_val = float(a.get('debit', 0.0))

                        sheet.write_number(row_pos, 1, debit_val, tmp_style_num)

                        credit_val = 0.0
                        if isinstance(a.get('credit'), dict):
                            credit_val = float(a['credit'].get(main_key, 0.0))
                        else:
                            credit_val = float(a.get('credit', 0.0))

                        sheet.write_number(row_pos, 2, credit_val, tmp_style_num)

                        balance_val = 0.0
                        if isinstance(a.get('balance'), dict):
                            balance_val = float(a['balance'].get(main_key, 0.0))
                        else:
                            balance_val = float(a.get('balance', 0.0))

                        sheet.write_number(row_pos, 3, balance_val, tmp_style_num)

                if not ks_df_informations['ks_diff_filter']['ks_debit_credit_visibility']:

                    sheet.set_column(0, 0, 50)
                    sheet.set_column(1, 1, 20)
                    sheet.set_column(2, 3, 20)
                    sheet.set_column(3, 3, 20)
                    sheet.write_string(row_pos, 0, _('Name'),
                                       format_header)

                    sheet.write_string(row_pos, 1, ks_df_informations['date']['ks_string'],
                                       format_header)
                    ks_col = 2
                    # for x in range(3):
                    for i in ks_df_informations['ks_differ']['ks_intervals']:
                        sheet.write_string(row_pos, ks_col, i['ks_string'],
                                           format_header)
                        sheet.set_column(ks_col, ks_col, 20)
                        ks_col += 1

                    ks_col_line = 0
                    for line in lines:
                        sheet.write(row_pos + 1, 0, line['ks_name'],
                                    line_header_string)
                        if line.get('balance'):
                            for ks in line.get('balance'):
                                sheet.write(row_pos + 1, ks_col_line + 1, line.get('balance')[ks],
                                            line_header)
                                ks_col_line += 1
                        ks_col_line = 0
                        row_pos += 1

            workbook.close()
            output.seek(0)
            generated_file = output.read()
            output.close()

            return generated_file
        else:
            if ks_df_informations['date']['ks_start_date'] == False and ks_df_informations['date'][
                'ks_end_date'] == False:
                raise ValidationError(_('Sorry,Export file will not get download without date.'))
            output = io.BytesIO()
            workbook = ks_workbook(output)
            sheet = workbook.add_worksheet(self.display_name[:31])
            if self.display_name != "Executive Summary":
                all_lines, ks_initial_balance, ks_current_balance, ks_ending_balance = self.with_context(no_format=True,
                                                                                                     print_mode=True,
                                                                                                     prefetch_fields=False).ks_fetch_report_account_lines(
                    ks_df_informations)
                lines = all_lines
            else:
                lines = self.ks_process_executive_summary(ks_df_informations)
            if self.display_name == self.env.ref(
                    'accounting_dynamic_reports_community.ks_dynamic_financial_balancesheet').display_name:
                ks_bal_sum = 0
                for line in lines:

                    if line.get('ks_name') == 'Previous Years Unallocated Earnings' and \
                            ks_df_informations['date']['ks_process'] == 'range':
                        ks_bal_sum -= line.get('balance', 0)
                lines[len(lines) - 1]['balance'] = ks_bal_sum

            ks_company_id = self.env['res.company'].sudo().browse(ks_df_informations.get('company_id'))

            sheet.freeze_panes(4, 1)
            row_pos = 0
            row_pos_2 = 0
            format_title = workbook.add_format({
                'bold': True,
                'align': 'center',
                'font_size': 12,
                'border': False,
                'font': 'Arial',
            })
            format_header = workbook.add_format({
                'bold': True,
                'font_size': 10,
                'align': 'center',
                'font': 'Arial',
                'bottom': False
            })
            content_header = workbook.add_format({
                'bold': False,
                'font_size': 10,
                'align': 'center',
                'font': 'Arial',
            })
            content_header_date = workbook.add_format({
                'bold': False,
                'font_size': 10,
                'align': 'center',
                'font': 'Arial',
                # 'num_format': 'dd/mm/yyyy',
            })
            line_header = workbook.add_format({
                'bold': False,
                'font_size': 10,
                'align': 'right',
                'font': 'Arial',
                'bottom': True
            })
            line_header.set_num_format(
                '#,##0.' + '0' * ks_company_id.currency_id.decimal_places or 2)
            line_header_bold = workbook.add_format({
                'bold': True,
                'font_size': 10,
                'align': 'right',
                'font': 'Arial',
                'bottom': True
            })
            line_header_bold.set_num_format(
                '#,##0.' + '0' * ks_company_id.currency_id.decimal_places or 2)
            line_header_string = workbook.add_format({
                'bold': False,
                'font_size': 10,
                'align': 'left',
                'font': 'Arial',
                'bottom': True
            })
            line_header_string_bold = workbook.add_format({
                'bold': True,
                'font_size': 10,
                'align': 'left',
                'font': 'Arial',
                'bottom': True
            })
            # Date from
            lang = self.env.user.lang
            lang_id = self.env['res.lang'].search([('code', '=', lang)])['date_format'].replace('/', '-')
            f_s_date = ks_df_informations['date'].get('ks_start_date') if ks_df_informations['date'].get(
                'ks_start_date') else date.today()
            f_e_date = ks_df_informations['date'].get('ks_end_date') if ks_df_informations['date'].get(
                'ks_end_date') else date.today()
            ks_new_start_date = (datetime.datetime.strptime(
                str(f_s_date), '%Y-%m-%d').date()).strftime(lang_id)
            ks_new_end_date = (datetime.datetime.strptime(
                str(f_e_date), '%Y-%m-%d').date()).strftime(lang_id)

            if ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                if not ks_df_informations['ks_differ'].get('ks_intervals'):
                    f_start_date = date.today()
                    f_end_date = date.today()
                    ks_new_start_comp_date = (datetime.datetime.strptime(
                        str(f_start_date), '%Y-%m-%d').date()).strftime(
                        lang_id)
                    ks_new_end_comp_date = (datetime.datetime.strptime(
                        str(f_end_date), '%Y-%m-%d').date()).strftime(
                        lang_id)
                else:
                    for_s_start_comp_date = ks_df_informations['ks_differ'].get('ks_intervals')[-1][
                        'ks_start_date'] if \
                        ks_df_informations['ks_differ'].get('ks_intervals')[-1]['ks_start_date'] else date.today()
                    for_e_end_comp_date = ks_df_informations['ks_differ'].get('ks_intervals')[-1]['ks_end_date'] if \
                        ks_df_informations['ks_differ'].get('ks_intervals')[-1]['ks_end_date'] else date.today()
                    ks_new_start_comp_date = (datetime.datetime.strptime(
                        str(for_s_start_comp_date), '%Y-%m-%d').date()).strftime(
                        lang_id)
                    ks_new_end_comp_date = (datetime.datetime.strptime(
                        str(for_e_end_comp_date), '%Y-%m-%d').date()).strftime(
                        lang_id)
            if self.display_name != 'Executive Summary':
                if not ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                    if ks_df_informations['date']['ks_process'] == 'range':
                        sheet.write_string(row_pos_2, 0, _('Date From'), format_header)
                        if ks_df_informations['date'].get('ks_start_date'):
                            sheet.write_string(row_pos_2, 1, ks_new_start_date,
                                               content_header_date)
                        row_pos_2 += 1
                        # Date to
                        sheet.write_string(row_pos_2, 0, _('Date To'), format_header)

                        if ks_df_informations['date'].get('ks_end_date'):
                            sheet.write_string(row_pos_2, 1, ks_new_end_date,
                                               content_header_date)
                    else:
                        sheet.write_string(row_pos_2, 0, _('As of Date'), format_header)
                        if ks_df_informations['date'].get('ks_end_date'):
                            sheet.write_string(row_pos_2 + 1, row_pos_2, ks_new_end_date,
                                               content_header_date)
                    # Accounts
                    row_pos_2 += 1
                    if ks_df_informations.get('analytic_accounts'):
                        sheet.write_string(row_pos_2, 0, _('Analytic Accounts'), format_header)
                        a_list = ', '.join(lt or '' for lt in ks_df_informations['selected_analytic_account_names'])
                        sheet.write_string(row_pos_2, 1, a_list, content_header)
                    # Tags
                    row_pos_2 += 1
                    if ks_df_informations.get('analytic_tags'):
                        sheet.write_string(row_pos_2, 0, _('Tags'), format_header)
                        a_list = ', '.join(lt or '' for lt in ks_df_informations['selected_analytic_tag_names'])
                        sheet.write_string(row_pos_2, 1, a_list, content_header)

                # Comparison filter
                if ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                    sheet.write_string(row_pos_2, 0, _('Comparison Date From'),
                                       format_header)

                    sheet.write_string(row_pos_2, 1,
                                       ks_new_start_comp_date,
                                       content_header_date)
                    row_pos_2 += 1
                    # Date to
                    sheet.write_string(row_pos_2, 0, _('Comparison Date To'),
                                       format_header)

                    sheet.write_string(row_pos_2, 1,
                                       ks_new_end_comp_date,
                                       content_header_date)

                row_pos_2 += 0
                sheet.write_string(0, 2, _('Journals'), format_header)
                j_list = ', '.join(
                    journal.get('code') or '' for journal in ks_df_informations['journals'] if journal.get('selected'))
                sheet.write_string(1, 2, j_list,
                                   content_header)

                # Account
                row_pos_2 += 0
                sheet.write_string(0, 3, _('Accounts'), format_header)
                j_list = ', '.join(
                    journal.get('name') or '' for journal in ks_df_informations['account'] if journal.get('selected'))
                sheet.write_string(1, 3, j_list,
                                   content_header)

                row_pos += 3
                if ks_df_informations['ks_diff_filter']['ks_debit_credit_visibility']:

                    sheet.set_column(0, 0, 90)
                    sheet.set_column(1, 1, 20)
                    sheet.set_column(2, 3, 20)
                    sheet.set_column(3, 3, 20)

                    sheet.write_string(row_pos, 1, _('Debit'),
                                       format_header)
                    sheet.write_string(row_pos, 2, _('Credit'),
                                       format_header)
                    sheet.write_string(row_pos, 3, _('Balance'),
                                       format_header)

                    for a in lines:
                        if a['ks_level'] == 2:
                            row_pos += 1
                        row_pos += 1
                        if a.get('account', False):
                            tmp_style_str = line_header_string
                            tmp_style_num = line_header
                        else:
                            tmp_style_str = line_header_string_bold
                            tmp_style_num = line_header_bold
                        sheet.write_string(row_pos, 0, '   ' * len(a.get('list_len', [])) + a.get('ks_name'),
                                           tmp_style_str)
                        sheet.write_number(row_pos, 1, float(a.get('debit', 0.0)), tmp_style_num)
                        sheet.write_number(row_pos, 2, float(a.get('credit', 0.0)), tmp_style_num)
                        sheet.write_number(row_pos, 3, float(a.get('balance', 0.0)), tmp_style_num)

                if not ks_df_informations['ks_diff_filter']['ks_debit_credit_visibility']:
                    sheet.set_column(0, 0, 105)
                    sheet.set_column(1, 1, 20)
                    sheet.set_column(2, 2, 20)
                    sheet.write_string(row_pos, 0, _('Name'),
                                       format_header)
                    if ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                        col_pos = 0
                        for i in (lines[0].get('balance_cmp') or {}):
                            sheet.write_string(row_pos, col_pos + 1, i.split('comp_bal_')[1],
                                               format_header),
                            sheet.write_string(row_pos, (col_pos + 1) + 1, _('Balance'),
                                               format_header)
                            col_pos = col_pos + 1
                    else:
                        sheet.write_string(row_pos, 1, _('Balance'),
                                           format_header)

                    for a in lines:
                        if a['ks_level'] == 2:
                            row_pos += 1
                        row_pos += 1
                        if a.get('account', False):
                            tmp_style_str = line_header_string
                            tmp_style_num = line_header
                        else:
                            tmp_style_str = line_header_string_bold
                            tmp_style_num = line_header_bold
                        sheet.write_string(row_pos, 0, '   ' * len(a.get('list_len', [])) + a.get('ks_name'),
                                           tmp_style_str)
                        if ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                            col_pos = 0
                            for i in (a.get('balance_cmp') or {}):
                                sheet.write_number(row_pos, col_pos + 1, float(a['balance_cmp'][i]), tmp_style_num)
                                sheet.write_number(row_pos, (col_pos + 1) + 1, float(a['balance']), tmp_style_num)
                                col_pos += 1
            else:
                if not ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                    if ks_df_informations['date']['ks_process'] == 'range':
                        sheet.write_string(row_pos_2, 0, _('Date From'),
                                           format_header)
                        if ks_df_informations['date'].get('ks_start_date'):
                            sheet.write_string(row_pos_2, 1, ks_new_start_date,
                                               content_header_date)
                        row_pos_2 += 1
                        # Date to
                        sheet.write_string(row_pos_2, 0, _('Date To'),
                                           format_header)

                        if ks_df_informations['date'].get('ks_end_date'):
                            sheet.write_string(row_pos_2, 1, ks_new_end_date,
                                               content_header_date)
                    else:
                        sheet.write_string(row_pos_2, 0, _('As of Date'),
                                           format_header)
                        if ks_df_informations['date'].get('ks_end_date'):
                            sheet.write_string(row_pos_2, 1, ks_new_end_date,
                                               content_header_date)

                if ks_df_informations['ks_diff_filter']['ks_diff_filter_enablity']:
                    sheet.write_string(row_pos_2, 0, _('Comparison Date From'),
                                       format_header)

                    sheet.write_string(row_pos_2, 1,
                                       ks_new_start_comp_date,
                                       content_header_date)
                    row_pos_2 += 1
                    # Date to
                    sheet.write_string(row_pos_2, 0, _('Comparison Date To'),
                                       format_header)

                    sheet.write_string(row_pos_2, 1,
                                       ks_new_end_comp_date,
                                       content_header_date)

                row_pos += 3
                sheet.write_string(0, 3, _('Accounts'), format_header)
                j_list = ', '.join(
                    journal.get('name') or '' for journal in ks_df_informations['account'] if journal.get('selected'))
                sheet.write_string(2 - 1, 3, j_list,
                                   content_header)
                if ks_df_informations['ks_diff_filter']['ks_debit_credit_visibility']:

                    sheet.set_column(0, 0, 90)
                    sheet.set_column(1, 1, 15)
                    sheet.set_column(2, 3, 15)
                    sheet.set_column(3, 3, 15)

                    sheet.write_string(row_pos, 0, _('Name'),
                                       format_header)
                    sheet.write_string(row_pos, 1, _('Debit'),
                                       format_header)
                    sheet.write_string(row_pos, 2, _('Credit'),
                                       format_header)
                    sheet.write_string(row_pos, 3, _('Balance'),
                                       format_header)

                    for a in lines:
                        if a['ks_level'] == 2:
                            row_pos += 1
                        row_pos += 1
                        if a.get('account', False):
                            tmp_style_str = line_header_string
                            tmp_style_num = line_header
                        else:
                            tmp_style_str = line_header_string_bold
                            tmp_style_num = line_header_bold
                        sheet.write_string(row_pos, 0, '   ' * len(a.get('list_len', [])) + a.get('ks_name'),
                                           tmp_style_str)
                        if a.get('debit'):
                            for i in a.get('debit'):
                                sheet.write_number(row_pos, 1, float(a.get('debit', 0.0)[i]), tmp_style_num)
                        if a.get('credit'):
                            for i in a.get('credit'):
                                sheet.write_number(row_pos, 2, float(a.get('credit', 0.0)[i]), tmp_style_num)
                        if a.get('balance'):
                            for i in a.get('balance'):
                                sheet.write_number(row_pos, 3, float(a.get('balance', 0.0)[i]), tmp_style_num)

                if not ks_df_informations['ks_diff_filter']['ks_debit_credit_visibility']:

                    sheet.set_column(0, 0, 50)
                    sheet.set_column(1, 1, 20)
                    sheet.set_column(2, 3, 20)
                    sheet.set_column(3, 3, 20)
                    sheet.write_string(row_pos, 0, _('Name'),
                                       format_header)

                    sheet.write_string(row_pos, 1, ks_df_informations['date']['ks_string'],
                                       format_header)
                    ks_col = 2
                    # for x in range(3):
                    for i in ks_df_informations['ks_differ']['ks_intervals']:
                        sheet.write_string(row_pos, ks_col, i['ks_string'],
                                           format_header)
                        sheet.set_column(ks_col, ks_col, 20)
                        ks_col += 1

                    ks_col_line = 0
                    for line in lines:
                        sheet.write(row_pos + 1, 0, line['ks_name'],
                                    line_header_string)
                        if line.get('balance'):
                            for ks in line.get('balance'):
                                sheet.write(row_pos + 1, ks_col_line + 1, line.get('balance')[ks],
                                            line_header)
                                ks_col_line += 1
                        ks_col_line = 0
                        row_pos += 1

            workbook.close()
            output.seek(0)
            generated_file = output.read()
            output.close()

            return generated_file

    def order_data(self, report_lines):
        """
        Sort report lines based on predefined order for `ks_name` field.
        """
        order = {
            "Gross Profit": 1,
            "Total Income": 2,
            "Expense": 3,
            "Net Profit": 4,
        }

        def sort_hierarchy(nodes):
            nodes.sort(key=lambda x: order.get(x['ks_name'], 999))
            for node in nodes:
                if 'children' in node and node['children']:
                    node['children'] = sort_hierarchy(node['children'])
            return nodes

        return sort_hierarchy(report_lines)

    def build_hierarchy(self, report_lines):
        """
        Build a hierarchical structure of report lines and aggregate debit, credit, and balance for parent nodes.
        """
        nodes = {item['self_id']: item for item in report_lines}

        for node in nodes.values():
            node['children'] = []
            # Initialize debit, credit, and balance if not present
            node['debit'] = node.get('debit', 0.0) if not isinstance(node.get('debit'), dict) else node.get('debit', {})
            node['credit'] = node.get('credit', 0.0) if not isinstance(node.get('credit'), dict) else node.get('credit',
                                                                                                               {})
            node['balance'] = node.get('balance', 0.0) if not isinstance(node.get('balance'), dict) else node.get(
                'balance', {})
            node['balance_cmp'] = node.get('balance_cmp', {})

        top_level_names = ['Gross Profit', 'Total Income', 'Expense', 'Net Profit']
        root_nodes = []

        # Build hierarchy
        for node in nodes.values():
            if node['ks_name'] in top_level_names:
                root_nodes.append(node)
            elif node.get('parent') in nodes:
                parent_node = nodes[node['parent']]
                parent_node['children'].append(node)

        # Aggregate debit, credit, and balance for parent nodes
        def aggregate_totals(node):
            if not node.get('children'):
                return {
                    'debit': node['debit'] if not isinstance(node['debit'], dict) else node['debit'],
                    'credit': node['credit'] if not isinstance(node['credit'], dict) else node['credit'],
                    'balance': node['balance'] if not isinstance(node['balance'], dict) else node['balance'],
                    'balance_cmp': node['balance_cmp']
                }

            total_debit = 0.0 if not isinstance(node['debit'], dict) else {}
            total_credit = 0.0 if not isinstance(node['credit'], dict) else {}
            total_balance = 0.0 if not isinstance(node['balance'], dict) else {}
            total_balance_cmp = {}

            for child in node['children']:
                child_totals = aggregate_totals(child)
                if isinstance(child_totals['debit'], dict):
                    for key in child_totals['debit']:
                        total_debit[key] = total_debit.get(key, 0.0) + child_totals['debit'][key]
                        total_credit[key] = total_credit.get(key, 0.0) + child_totals['credit'][key]
                        total_balance[key] = total_balance.get(key, 0.0) + child_totals['balance'][key]
                else:
                    total_debit += child_totals['debit']
                    total_credit += child_totals['credit']
                    total_balance += child_totals['balance']
                for key in child_totals['balance_cmp']:
                    total_balance_cmp[key] = total_balance_cmp.get(key, 0.0) + child_totals['balance_cmp'][key]

            node['debit'] = total_debit
            node['credit'] = total_credit
            node['balance'] = total_balance
            node['balance_cmp'] = total_balance_cmp

            return {
                'debit': node['debit'],
                'credit': node['credit'],
                'balance': node['balance'],
                'balance_cmp': node['balance_cmp']
            }

        for root in root_nodes:
            aggregate_totals(root)

        return root_nodes

    def flatten_hierarchy(self, lines):
        """
        Flatten the hierarchical structure into a simple list.
        """
        result = []

        def recurse(line):
            result.append(line)
            for child in line.get('children', []):
                recurse(child)

        for line in lines:
            recurse(line)

        return result

    def maintain_hierarchy(self, report_lines):
        tree = {}
        items = {}
        has_hierarchy = False

        filtered_lines = [line for line in report_lines if line.get('ks_level') != 0]
        cloned_lines = [{**line, 'children': []} for line in filtered_lines]

        for line in cloned_lines:
            self_id = line['self_id']
            parent_id = line.get('parent')
            ks_level = line['ks_level']

            items[self_id] = line

            if ks_level == 1:
                tree[self_id] = line
                has_hierarchy = True
            else:
                if parent_id in items:
                    items[parent_id].setdefault('children', []).append(line)
                else:
                    items[parent_id] = {'children': [line]}

        return list(tree.values()) if has_hierarchy else filtered_lines

