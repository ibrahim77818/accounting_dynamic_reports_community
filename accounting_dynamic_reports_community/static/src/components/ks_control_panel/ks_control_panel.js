/** @odoo-module **/

import { Component, useSubEnv } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
const { DateTime } = luxon;
import { _t } from "@web/core/l10n/translation";
import { KsReportFilters } from '@accounting_dynamic_reports_community/components/ks_report_filters/ks_report_filters';

export class KsControlPanel extends Component {

     static props = {
        action : { type: Object, optional: true },
        ks_df_report_opt : { type: Object, optional: true },
        ks_df_informations : { type: Object, optional: true },
        new_ks_df_reports_ids : { type: String, optional: true },
        ks_df_context: { type: Object, optional: true },
        _ksRenderBody : { type: Function, optional: true },
        setReportValues : { type: Function, optional: true },
        ks_master_value : { type: Object, optional: true },
        ksSetReportInfo : { type: Function, optional: true },
        date_from_cmp: { type: String, optional: true },
        date_to_cmp: { type: String, optional: true },
     };

     static defaultProps = {

     };

    static template = "accounting_dynamic_reports_community.ks_control_panel";

    static components = { ControlPanel, DropdownItem, Dropdown, KsReportFilters }

    setup() {
        // Odoo 16's ControlPanel reads env.config.viewSwitcherEntries, which
        // client actions do not provide.
        useSubEnv({
            config: Object.assign({}, this.env.config, {
                viewSwitcherEntries: (this.env.config && this.env.config.viewSwitcherEntries) || [],
            }),
        });
        this.orm = useService("orm");
        this.action = useService("action");
        this.notificationService = useService("notification");
    }

    async OnPrintPdf() {
        var self = this;
        this.orm.call("ks.dynamic.financial.reports", 'ks_get_dynamic_fin_info', [this.props.action.context.id, this.props.ks_df_report_opt], {
            context: this.props.action.context
        }).then((data) => {
            if (data && data.ks_report_lines && data.new_ks_df_reports_ids === 'Cash Flow Statement') {
                data.ks_report_lines = self.buildHierarchy(data.ks_report_lines);
                data.ks_report_lines = self.flattenHierarchy(data.ks_report_lines);
                let getChildren = (parentId) => {
                    return data.ks_report_lines.filter(line => line.parent === parentId);
                };

                let sumNestedValues = (parentLine) => {
                    let children = getChildren(parentLine.self_id);
                    if (!children.length) {
                        return {
                            balance: parentLine.balance || 0,
                            debit: parentLine.debit || 0,
                            credit: parentLine.credit || 0
                        };
                    }

                    let total = { balance: 0, debit: 0, credit: 0 };
                    for (let child of children) {
                        let childTotals = sumNestedValues(child);
                        total.balance += childTotals.balance;
                        total.debit += childTotals.debit;
                        total.credit += childTotals.credit;
                    }
                    return total;
                };
                let operating = data.ks_report_lines.find(line => line.ks_name === "Cash flows from operating activities");
                let investing = data.ks_report_lines.find(line => line.ks_name === "Cash flows from investing and extraordinary activities");
                let financing = data.ks_report_lines.find(line => line.ks_name === "Cash flows from financing activities");
                let unclassified = data.ks_report_lines.find(line => line.ks_name === "Cash flows from unclassified activities");
                let netIncrease = data.ks_report_lines.find(line => line.ks_name === "Net increase in cash and cash equivalents");

                if (operating && investing && financing && unclassified && netIncrease) {
                    netIncrease.debit = operating.debit + investing.debit + financing.debit + unclassified.debit;
                    netIncrease.credit = operating.credit + investing.credit + financing.credit + unclassified.credit;
                    netIncrease.balance = operating.balance + investing.balance + financing.balance + unclassified.balance;
                }
                let beginningPeriod = data.ks_report_lines.find(line => line.ks_name === "Cash and cash equivalents, beginning period");
                if (beginningPeriod) {
                    let totals = sumNestedValues(beginningPeriod);
                    beginningPeriod.debit = totals.debit;
                    beginningPeriod.credit = totals.credit;
                    beginningPeriod.balance = totals.balance;
                }
                let beginning_period_child = data.ks_report_lines.find(line => line.ks_name === "Cash and cash equivalents,beginning period");
                if(beginning_period_child) {
                    beginning_period_child.debit = beginningPeriod.debit
                    beginning_period_child.credit = beginningPeriod.credit
                    beginning_period_child.balance = beginningPeriod.balance
                }
                let closingBalance = data.ks_report_lines.find(line => line.ks_name === "Cash and cash equivalents, closing balance");
                if (beginningPeriod && netIncrease && closingBalance) {
                    closingBalance.debit = beginningPeriod.debit + netIncrease.debit;
                    closingBalance.credit = beginningPeriod.credit + netIncrease.credit;
                    closingBalance.balance = beginningPeriod.balance + netIncrease.balance;
                }
            }
            if (data.new_ks_df_reports_ids === 'Profit and Loss') {
                let tree = self.buildHierarchy(data.ks_report_lines);
                let sortedTree = self.orderData(tree);
                let flattened = self.flattenHierarchy(sortedTree);
                data.ks_report_lines = self.calculateNetProfit(flattened);
            }
            if(data.new_ks_df_reports_ids === 'Consolidate Journal') {
                let mergedLines = self.merge_report_lines(data.ks_report_lines);
                data.ks_report_lines = mergedLines;
            }
            if(data.new_ks_df_reports_ids === 'Balance Sheet') {
                let lines = data.ks_report_lines.slice(1);
                data.ks_report_lines = lines;
            }
            var report_name = self.ksGetReportName();
            var action = self.ksGetReportAction(report_name, data);
            return self.action.doAction(action);
        });
    }

    async ksPrintReportXlsx() {
        var self = this;
        this.orm.call("ks.dynamic.financial.reports", 'ks_print_xlsx', [this.props.action.context.id, this.props.ks_df_report_opt], {
            context: this.props.action.context
        }).then((data) => {
            return self.action.doAction(data);
        });
    }

    async ksReportSendEmail(e) {
        e.preventDefault();
        var self = this;
        this.orm.call("ks.dynamic.financial.reports", 'ks_get_dynamic_fin_info', [this.props.action.context.id, this.props.ks_df_report_opt], {
            context: this.props.action.context
        }).then((data) => {
            var ks_report_action = self.ksGetReportActionName();
            this.orm.call("ks.dynamic.financial.reports", 'ks_action_send_email', [this.props.action.context.id, data, ks_report_action], {
                context: data['context']
            })
            this.notificationService.add(_t("Email Sent!"), { type: 'success' });
        });
    }

    merge_report_lines(ks_report_lines) {
        const merged_map = new Map();
        for (const item of ks_report_lines) {
            if (item.id === "total") continue;
            const key = item.name;
            if (!merged_map.has(key)) {
                merged_map.set(key, {
                    ...item,
                    lines: [...item.lines],
                });
            } else {
                const existing = merged_map.get(key);
                existing.debit += item.debit;
                existing.credit += item.credit;
                existing.balance += item.balance;
                existing.lines.push(...item.lines);
            }
        }

        for (const journal of merged_map.values()) {
            const linesMap = new Map();
            for (const line of journal.lines) {
                const accountKey = line.account_name;
                if (!linesMap.has(accountKey)) {
                    linesMap.set(accountKey, { ...line });
                } else {
                    const existingLine = linesMap.get(accountKey);
                    existingLine.debit += line.debit;
                    existingLine.credit += line.credit;
                    existingLine.balance += line.balance;
                }
            }
            journal.lines = Array.from(linesMap.values());
        }
        const mergedList = Array.from(merged_map.values());
        const total = ks_report_lines.find(item => item.id === "total");
        if (total) {
            const totalLinesMap = new Map();
            for (const line of total.lines || []) {
                const accountKey = line.account_name;
                if (!totalLinesMap.has(accountKey)) {
                    totalLinesMap.set(accountKey, { ...line });
                } else {
                    const existingLine = totalLinesMap.get(accountKey);
                    existingLine.debit += line.debit;
                    existingLine.credit += line.credit;
                    existingLine.balance += line.balance;
                }
            }
            mergedList.push({
                ...total,
                lines: Array.from(totalLinesMap.values()),
            });
        }

        return mergedList;
    }

    orderData(reportLines) {
        const order = {
            "Gross Profit": 1,
            "Total Income": 2,
            "Expense": 3,
            "Net Profit": 4,
        };

        function sortHierarchy(nodes) {
            nodes.sort((a, b) => {
                return (order[a.ks_name] || 999) - (order[b.ks_name] || 999);
            });
            nodes.forEach(node => {
                if (node.children && node.children.length > 0) {
                    node.children = sortHierarchy(node.children);
                }
            });

            return nodes;
        }

        return sortHierarchy(reportLines);
    }

    subtractBalanceCmp(obj1, obj2) {
        let result = {};
        const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
        keys.forEach(key => {
            result[key] = (obj1?.[key] || 0) - (obj2?.[key] || 0);
        });
        return result;
    }

    calculateNetProfit(reportLines) {
        let totalIncomeLine = reportLines.find(line => line.ks_name === "Total Income");
        let expenseLine = reportLines.find(line => line.ks_name === "Expense");
        let netProfitLine = reportLines.find(line => line.ks_name === "Net Profit");

        if (totalIncomeLine && expenseLine && netProfitLine) {
            netProfitLine.debit = (totalIncomeLine.debit || 0) - (expenseLine.debit || 0);
            netProfitLine.credit = (totalIncomeLine.credit || 0) - (expenseLine.credit || 0);
            netProfitLine.balance = (totalIncomeLine.balance || 0) - (expenseLine.balance || 0);

            netProfitLine.balance_cmp = this.subtractBalanceCmp(
                totalIncomeLine.balance_cmp,
                expenseLine.balance_cmp
            );
        }

        return reportLines;
    }

    buildHierarchy(reportLines) {
        let tree = {};
        let items = {};
        let hasHierarchy = false;

        let filteredLines = reportLines.filter(line => line.ks_level !== 0);
        let clonedLines = filteredLines.map(line => ({ ...line, children: [] }));

        clonedLines.forEach(line => {
            items[line.self_id] = line;

            if (line.ks_level === 1) {
                tree[line.self_id] = line;
                hasHierarchy = true;
            } else {
                if (items[line.parent]) {
                    items[line.parent].children.push(line);
                } else {
                    items[line.parent] = { children: [line] };
                }
            }
        });
        return Object.values(tree);
    }

    flattenHierarchy(lines) {
        let result = [];

        function recurse(line, level = 1) {
            result.push({ ...line, children: undefined });
            if (line.children && line.children.length) {
                line.children.forEach(child => recurse(child, level + 1));
            }
        }

        lines.forEach(line => recurse(line));
        return result;
    }

    ksGetReportName() {
        var self = this;
        if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_tb_action')) {
            return 'accounting_dynamic_reports_community.ks_pdf_trial_bal';
        } else if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_gl_action')) {
            return 'accounting_dynamic_reports_community.ks_pdf_gen_ledger';
        } else if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_pl_action')) {
            return 'accounting_dynamic_reports_community.ks_pdf_partner_led';
        } else if (self.props.action.xml_id == _t("accounting_dynamic_reports_community.ks_df_rec_action")) {
            return 'accounting_dynamic_reports_community.ks_pdf_aged_rec';
        } else if (self.props.action.xml_id == _t("accounting_dynamic_reports_community.ks_df_pay_action")) {
            return 'accounting_dynamic_reports_community.ks_pdf_aged_pay';
        } else if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_cj_action')) {
            return 'accounting_dynamic_reports_community.ks_pdf_journals';
        } else if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_tax_report_action')) {
            return 'accounting_dynamic_reports_community.ks_pdf_tax';
        } else if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_es_action')) {
            return 'accounting_dynamic_reports_community.ks_pdf_executive';
        } else {
            return 'accounting_dynamic_reports_community.ks_pdf_statement';
        }
    }

    ksGetReportAction(report_name, data) {
        var self = this;
        var new_date_format = 'yyyy-M-d';
        data.ks_df_informations.date.ks_end_date = DateTime.fromISO(data.ks_df_informations.date.ks_end_date).toISODate(new_date_format);
        data.ks_df_informations.date.ks_start_date = DateTime.fromISO(data.ks_df_informations.date.ks_start_date).toISODate(new_date_format);

        if (data['ks_df_informations']['ks_differ']['ks_intervals'].length !== 0) {
            data['ks_df_informations']['ks_differ']['ks_end_date'] = DateTime.fromISO(data['ks_df_informations']['ks_differ']['ks_end_date']).toISODate(new_date_format);
            data['ks_df_informations']['ks_differ']['ks_start_date'] = DateTime.fromISO(data['ks_df_informations']['ks_differ']['ks_start_date']).toISODate(new_date_format);
        }
        return {
            'type': 'ir.actions.report',
            'report_type': 'qweb-pdf',
            'report_name': report_name,
            'report_file': report_name,
            'data': {
                'js_data': data
            },
            'context': {
                'active_model': this.props.action.context.model,
                'from_js': true,
            },
            'display_name': self.props.action.name,
        };
    }

    ksGetReportActionName() {
        var self = this;
        if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_tb_action')) {
            return 'accounting_dynamic_reports_community.ks_dynamic_financial_trial_bal_action';
        } else if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_gl_action')) {
            return 'accounting_dynamic_reports_community.ks_dynamic_financial_gel_bal_action';
        } else if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_pl_action')) {
            return 'accounting_dynamic_reports_community.ks_dynamic_financial_partner_led_action';
        } else if (self.props.action.xml_id == _t("accounting_dynamic_reports_community.ks_df_rec_action")) {
            return 'accounting_dynamic_reports_community.ks_dynamic_financial_age_rec_action';
        } else if (self.props.action.xml_id == _t("accounting_dynamic_reports_community.ks_df_pay_action")) {
            return 'accounting_dynamic_reports_community.ks_dynamic_financial_age_pay_action';
        } else if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_cj_action')) {
            return 'accounting_dynamic_reports_community.ks_dynamic_financial_cons_journal_action';
        } else if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_tax_report_action')) {
            return 'accounting_dynamic_reports_community.ks_dynamic_financial_tax_action';
        } else if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_es_action')) {
            return 'accounting_dynamic_reports_community.ks_dynamic_financial_executive_action';
        } else {
            return 'accounting_dynamic_reports_community.ks_dynamic_financial_report_action';
        }
    }

}