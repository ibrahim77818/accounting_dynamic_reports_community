/** @odoo-module **/

import { KsAmountMixin } from "@accounting_dynamic_reports_community/js/ks_utils";
import { Component, useState, onWillStart, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { getCurrency } from "@accounting_dynamic_reports_community/js/ks_utils";
import { registry } from "@web/core/registry";
import { formatMonetary } from "@web/views/fields/formatters";
const { DateTime } = luxon;

export class KsTaxReport extends Component {

     static props = {
        action: { type: Object, optional: true },
        ks_report_lines : { type: Object, optional: true },
        ks_df_report_opt: { type: Object, optional: true },
        ksFormatCurrencySign: { type: Function, optional: true },
        ksgetaction: { type: Function, optional: true },

     };

     static defaultProps = {

     };

    static template = "accounting_dynamic_reports_community.ks_df_tax_report_action";

    setup() {
        function formatToTwoDecimals(value) {
            return typeof value === 'number' ? value.toFixed(2) : value;
        }

        function formatKsReportLines(lines) {
            return lines.map(line => {
                ['ks_net_amount', 'tax'].forEach(key => {
                    if (key in line) line[key] = formatToTwoDecimals(line[key]);
                });
                if (Array.isArray(line.balance_cmp)) {
                    line.balance_cmp = line.balance_cmp.map(group =>
                        group.map(obj => {
                            ['ks_com_net', 'ks_com_tax'].forEach(key => {
                                if (key in obj) obj[key] = formatToTwoDecimals(obj[key]);
                            });
                            return obj;
                        })
                    );
                }
                if (Array.isArray(line.children) && line.children.length > 0) {
                    line.children = formatKsReportLines(line.children);
                }

                return line;
            });
        }
        let formattedLines = formatKsReportLines(this.props.ks_report_lines);

         onWillUpdateProps((nextProps) => {
            function formatToTwoDecimals(value) {
                return typeof value === 'number' ? value.toFixed(2) : value;
            }
            function formatKsReportLines(lines) {
                return lines.map(line => {
                    ['ks_net_amount', 'tax'].forEach(key => {
                        if (key in line) line[key] = formatToTwoDecimals(line[key]);
                    });
                    if (Array.isArray(line.balance_cmp)) {
                        line.balance_cmp = line.balance_cmp.map(group =>
                            group.map(obj => {
                                ['ks_com_net', 'ks_com_tax'].forEach(key => {
                                    if (key in obj) obj[key] = formatToTwoDecimals(obj[key]);
                                });
                                return obj;
                            })
                        );
                    }
                    if (Array.isArray(line.children) && line.children.length > 0) {
                        line.children = formatKsReportLines(line.children);
                    }

                    return line;
                });
            }
            let formattedLines = formatKsReportLines(nextProps.ks_report_lines);
         });
    }


    async ksGetMoveLines(event) {
        let account = Object.values(this.props.ks_report_lines)
        return account;
    }

}
registry.category("components").add("KsTaxReport", KsTaxReport);

Object.assign(KsTaxReport.prototype, KsAmountMixin);
