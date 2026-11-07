# -*- coding: utf-8 -*-
"""Colour theme shared by every Excel export of the dynamic reports.

The exporters were written with plain black-and-white formats. Instead of
editing hundreds of format dictionaries, ``KsStyledWorkbook`` classifies each
format when it is created (title, column header, label, group/section row,
total row, initial-balance row, detail row) and adds the matching colours and
number format. When the workbook is closed, a conditional format paints every
negative number red on all sheets, so Excel, the PDF and the web view share the
same colour rules.
"""
import xlsxwriter

NAVY = '#1F3A5F'
NAVY_SOFT = '#E8EEF6'
NAVY_MID = '#C9D4E3'
TEAL = '#2A9D8F'
TEXT = '#2B2F36'
MUTED = '#6B7785'
BORDER = '#DDE3EA'
NEG = '#C0392B'
TOTAL_BG = '#D6E2F0'
AMOUNT_FORMAT = '#,##0.00;-#,##0.00;"-"'


class KsStyledWorkbook(xlsxwriter.Workbook):

    def __init__(self, filename=None, options=None):
        options = dict(options or {})
        options.setdefault('in_memory', True)
        options.setdefault('strings_to_numbers', False)
        super().__init__(filename, options)
        self._ks_negative_format = None

    # ------------------------------------------------------------------
    @staticmethod
    def _ks_classify(props):
        bold = bool(props.get('bold'))
        italic = bool(props.get('italic'))
        size = props.get('font_size') or 10
        align = props.get('align')
        boxed = any(props.get(k) for k in ('border', 'left', 'right'))
        top_bottom = bool(props.get('top')) and bool(props.get('bottom'))
        if bold and size >= 12:
            return 'title'
        if italic:
            return 'initial'
        if bold and top_bottom:
            return 'total'
        if bold and align == 'center' and (boxed or size >= 11):
            return 'header'
        if bold and align == 'center':
            return 'label'
        if bold:
            return 'group'
        if top_bottom:
            return 'total_light'
        if align == 'center':
            return 'value'
        return 'detail'

    def add_format(self, properties=None):
        props = dict(properties or {})
        kind = self._ks_classify(props)
        props.setdefault('font_name', props.pop('font', None) or 'Arial')
        props.setdefault('valign', 'vcenter')
        props.setdefault('font_color', TEXT)
        if kind == 'title':
            props.update({'font_color': NAVY, 'font_size': 15, 'bottom': 2, 'bottom_color': TEAL})
        elif kind == 'header':
            props.update({'bg_color': NAVY, 'font_color': '#FFFFFF', 'border': 1, 'border_color': NAVY,
                          'text_wrap': True})
        elif kind == 'label':
            props.update({'bg_color': NAVY, 'font_color': '#FFFFFF', 'border': 1, 'border_color': NAVY})
        elif kind == 'group':
            props.update({'bg_color': NAVY_SOFT, 'font_color': NAVY, 'bottom': 1, 'bottom_color': NAVY_MID})
        elif kind == 'total':
            props.update({'bg_color': TOTAL_BG, 'font_color': NAVY, 'top': 2, 'top_color': NAVY,
                          'bottom': 6, 'bottom_color': NAVY})
        elif kind == 'total_light':
            props.update({'bg_color': TOTAL_BG, 'top': 1, 'top_color': NAVY, 'bottom': 1, 'bottom_color': NAVY})
        elif kind == 'initial':
            props.update({'font_color': MUTED, 'bg_color': '#FAFBFC', 'bottom': 1, 'bottom_color': BORDER})
        elif kind == 'detail':
            props.update({'bottom': 1, 'bottom_color': BORDER})
        else:  # value / filter values
            props.setdefault('bottom', 1)
            props.setdefault('bottom_color', BORDER)
        # Right-aligned cells hold amounts: thousands separator, dash for zero.
        if props.get('align') == 'right' and 'num_format' not in props:
            props['num_format'] = AMOUNT_FORMAT
        return super().add_format(props)

    def _ks_color_negatives(self):
        if self._ks_negative_format is None:
            self._ks_negative_format = super().add_format({'font_color': NEG})
        for sheet in self.worksheets():
            last_row, last_col = sheet.dim_rowmax, sheet.dim_colmax
            if last_row is None or last_col is None:
                continue
            sheet.conditional_format(0, 0, last_row, last_col, {
                'type': 'cell', 'criteria': '<', 'value': 0, 'format': self._ks_negative_format,
            })
            sheet.hide_gridlines(2)
            sheet.set_default_row(17)
            sheet.set_landscape()
            sheet.set_paper(9)  # A4
            sheet.fit_to_pages(1, 0)
            sheet.set_margins(left=0.4, right=0.4, top=0.5, bottom=0.5)

    def close(self):
        self._ks_color_negatives()
        return super().close()


def ks_workbook(output):
    """Return a themed in-memory workbook writing to ``output``."""
    return KsStyledWorkbook(output, {'in_memory': True})
