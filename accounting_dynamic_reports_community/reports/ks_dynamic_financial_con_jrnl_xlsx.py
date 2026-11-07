# -*- coding: utf-8 -*-
import io
from odoo import models, api, _
from .ks_xlsx_style import ks_workbook
import datetime
from datetime import date


class KsDynamicFinancialXlsxCJ(models.Model):
    _inherit = 'ks.dynamic.financial.base'

    @api.model
    def ks_dynamic_consolidate_xlsx(self, ks_df_informations):
        output = io.BytesIO()
        workbook = ks_workbook(output)
        move_lines = self._get_lines(ks_df_informations)
        move_lines = self.merge_report_lines(move_lines)
        move_lines = self.round_nested_values(move_lines)
        sheet = workbook.add_worksheet('Consolidate Journal Report')
        row_pos = 0
        row_pos_2 = 0
        sheet.set_column(0, 0, 12)
        sheet.set_column(1, 1, 12)
        sheet.set_column(2, 2, 30)
        sheet.set_column(3, 3, 18)
        sheet.set_column(4, 4, 30)
        sheet.set_column(5, 5, 10)
        sheet.set_column(6, 6, 10)
        sheet.set_column(7, 7, 10)

        format_title = workbook.add_format({
            'bold': True,
            'align': 'center',
            'font_size': 12,
            'font': 'Arial',
            'border': False
        })

        format_header = workbook.add_format({
            'bold': True,
            'font_size': 10,
            'font': 'Arial',
            'align': 'center',
            # 'border': True
        })
        content_header = workbook.add_format({
            'bold': False,
            'font_size': 10,
            'align': 'center',
            'font': 'Arial',
            'border': True,
            'text_wrap': True,
        })
        content_header_date = workbook.add_format({
            'bold': False,
            'font_size': 10,
            'border': True,
            'align': 'center',
            'font': 'Arial',
        })
        line_header = workbook.add_format({
            'bold': True,
            'font_size': 10,
            'align': 'center',
            'top': True,
            'font': 'Arial',
            'bottom': True,
        })
        line_header.set_num_format(
            '#,##0.' + '0' * self.ks_company_id.currency_id.decimal_places or 2)
        line_header_left = workbook.add_format({
            'bold': True,
            'font_size': 10,
            'align': 'left',
            'top': True,
            'font': 'Arial',
            'bottom': True,
        })
        line_header_light = workbook.add_format({
            'bold': False,
            'font_size': 10,
            'align': 'center',
            # 'top': True,
            # 'bottom': True,
            'font': 'Arial',
            'text_wrap': True,
            'valign': 'top'
        })
        line_header_light.set_num_format(
            '#,##0.' + '0' * self.ks_company_id.currency_id.decimal_places or 2)
        line_header_light_date = workbook.add_format({
            'bold': False,
            'font_size': 10,
            'top': True,
            # 'bottom': True,
            'font': 'Arial',
            'align': 'center',
            'num_format': 'mm/dd/yyyy'
        })

        row_pos_2 += 0
        lang = self.env.user.lang
        lang_id = self.env['res.lang'].search([('code', '=', lang)])['date_format'].replace('/', '-')
        ks_new_start_date = (datetime.datetime.strptime(
            ks_df_informations['date'].get('ks_start_date'), '%Y-%m-%d').date()).strftime(lang_id)
        f_cj_end_date = ks_df_informations['date'].get('ks_end_date') if ks_df_informations['date'].get('ks_end_date') else date.today()
        ks_new_end_date = (datetime.datetime.strptime(
            str(f_cj_end_date), '%Y-%m-%d').date()).strftime(lang_id)

        if ks_df_informations:
            # Date from
            if ks_df_informations['date']['ks_process'] == 'range':
                sheet.write_string(row_pos_2, 0, _('Date From'),
                                   format_header)
                sheet.write_string(row_pos_2 + 1, row_pos_2, ks_new_start_date,
                                   content_header_date)

                sheet.write_string(row_pos_2, row_pos_2 + 1, _('Date To'),
                                   format_header)

                sheet.write_string(row_pos_2 + 1, row_pos_2 + 1, ks_new_end_date,
                                   content_header_date)
            else:

                sheet.write_string(row_pos_2, 0, _('As of Date'),
                                   format_header)

                sheet.write_string(row_pos_2 + 1, row_pos_2, ks_new_end_date,
                                   content_header_date)

            # Journals
            row_pos_2 += 0
            sheet.write_string(row_pos_2, 3, _('Journals'), format_header)
            j_list = ', '.join(
                journal.get('code') or '' for journal in ks_df_informations['journals'] if journal.get('selected'))
            sheet.write_string(row_pos_2 + 1, 3, j_list,
                               content_header)

            # Account
            row_pos_2 += 0
            sheet.write_string(row_pos_2, 4, _('Accounts'), format_header)
            j_list = ', '.join(
                journal.get('name') or '' for journal in ks_df_informations['account'] if journal.get('selected'))
            sheet.write_string(row_pos_2 + 1, 4, j_list,
                               content_header)

        row_pos += 5
        if ks_df_informations.get('ks_report_with_lines', False):
            sheet.merge_range(row_pos, 0, row_pos, 2, _('Account'),
                              format_header)
            sheet.write_string(row_pos, 3, _('Debit'),
                               format_header)
            sheet.write_string(row_pos, 4, _('Credit'),
                               format_header)
            sheet.write_string(row_pos, 5, _('Balance'),
                               format_header)

        else:
            sheet.merge_range(row_pos, 0, row_pos, 2, _('Journal'), format_header)

            sheet.write_string(row_pos, 3, _('Debit'),
                               format_header)
            sheet.write_string(row_pos, 4, _('Credit'),
                               format_header)
            sheet.write_string(row_pos, 5, _('Balance'),
                               format_header)
        if move_lines:
            for line in move_lines:
                # line = line[0]
                row_pos += 1
                if not line['id'] == "Details_":
                    sheet.merge_range(row_pos, 0, row_pos, 2, (line.get('name').get(self.env.context.get('lang')) if isinstance(line.get('name'), dict) else line.get('name')),
                                      line_header_left)
                    sheet.write_number(row_pos, 3, float(line.get('debit')), line_header)
                    sheet.write_number(row_pos, 4, float(line.get('credit')), line_header)
                    sheet.write_number(row_pos, 5, float(line.get('balance')), line_header)
                else:
                    sheet.merge_range(row_pos, 0, row_pos, 2, (line.get('name').get(self.env.context.get('lang')) if isinstance(line.get('name'), dict) else line.get('name')),
                                      line_header_left)
                    sheet.write(row_pos, 3, line.get('debit'), line_header)
                    sheet.write(row_pos, 4, line.get('credit'), line_header)
                    sheet.write(row_pos, 5, line.get('balance'), line_header)

                if ks_df_informations.get('ks_report_with_lines', False):
                    if not line['id'] == 'total' and not line['id'] == 'Details_':
                        for sub_line in line.get('lines'):
                            row_pos += 1
                            sheet.merge_range(row_pos, 0, row_pos, 2, sub_line.get('account_name').get(lang) if isinstance(sub_line.get('account_name'),dict) else sub_line.get('account_name'),
                                              line_header_light_date)
                            sheet.write_number(row_pos, 3, sub_line.get('debit'),
                                               line_header_light)
                            sheet.write_number(row_pos, 4, sub_line.get('credit'),
                                               line_header_light)

                            sheet.write_number(row_pos, 5, sub_line.get('balance'),
                                               line_header_light)


        workbook.close()
        output.seek(0)
        generated_file = output.read()
        output.close()

        return generated_file

    def merge_report_lines(self, ks_report_lines):
        merged_map = {}
        for item in ks_report_lines:
            if item.get('id') == 'total':
                continue
            key = item['name']
            if key not in merged_map:
                merged_map[key] = {
                    **item,
                    'lines': item['lines'][:],
                }
            else:
                existing = merged_map[key]
                existing['debit'] += item['debit']
                existing['credit'] += item['credit']
                existing['balance'] += item['balance']
                existing['lines'].extend(item['lines'])

        for journal in merged_map.values():
            lines_map = {}
            for line in journal['lines']:
                account_key = line['account_name']
                if account_key not in lines_map:
                    lines_map[account_key] = {**line}
                else:
                    existing_line = lines_map[account_key]
                    existing_line['debit'] += line['debit']
                    existing_line['credit'] += line['credit']
                    existing_line['balance'] += line['balance']
            journal['lines'] = list(lines_map.values())
        merged_list = list(merged_map.values())

        total = next((item for item in ks_report_lines if item.get('id') == 'total'), None)
        if total:
            total_lines_map = {}
            for line in total.get('lines', []):
                account_key = line['account_name']
                if account_key not in total_lines_map:
                    total_lines_map[account_key] = {**line}
                else:
                    existing_line = total_lines_map[account_key]
                    existing_line['debit'] += line['debit']
                    existing_line['credit'] += line['credit']
                    existing_line['balance'] += line['balance']
            merged_list.append({
                **total,
                'lines': list(total_lines_map.values()),
            })

        return merged_list
