/** @odoo-module **/

import { KsAmountMixin } from "@accounting_dynamic_reports_community/js/ks_utils";
import { Component, useState, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { getCurrency } from "@accounting_dynamic_reports_community/js/ks_utils";
import { formatMonetary } from "@web/views/fields/formatters";
import { registry } from "@web/core/registry";
const { DateTime } = luxon;

export class KsConsolidatedJournal extends Component {

     static props = {
        action: { type: Object, optional: true },
        ks_report_lines : { type: Object, optional: true },
        ks_df_report_opt: { type: Object, optional: true },
        ks_df_context: { type: Object, optional: true },
        ksFormatCurrencySign: { type: Function, optional: true },
        ks_partner_dict: { type: Object, optional: true },
        ksgetaction: { type: Function, optional: true },
        ksSetReportCurrencyConfig: { type: Function, optional: true },
     };

     static defaultProps = {

     };

    static template = "accounting_dynamic_reports_community.ks_df_cj_action";

    setup() {
        this.ks_lang = this.props.ks_df_context.lang;

        function merge_report_lines(ks_report_lines) {
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

        let mergedLines = merge_report_lines(this.props.ks_report_lines);
        this.props.ks_report_lines = mergedLines;

        onWillUpdateProps((nextProps) => {
            let mergedAccountData = merge_report_lines(nextProps.ks_report_lines);
            nextProps.ks_report_lines = mergedAccountData;
            this.state.account_data = mergedAccountData;
        });

        this.state = useState({
            count: 0,
            account_data: this.props.ks_report_lines,
            period_list: [],
            visible: {},
        });
    }

}
registry.category("components").add("Consolidate Journal", KsConsolidatedJournal);

Object.assign(KsConsolidatedJournal.prototype, KsAmountMixin);
