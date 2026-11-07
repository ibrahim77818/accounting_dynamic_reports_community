/** @odoo-module **/

import { KsAmountMixin } from "@accounting_dynamic_reports_community/js/ks_utils";
import { Component, useState, onWillStart, onMounted, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { getCurrency } from "@accounting_dynamic_reports_community/js/ks_utils";
import { formatMonetary } from "@web/views/fields/formatters";
const { DateTime } = luxon;

export class KsOtherReports extends Component {

     static props = {
        action: { type: Object, optional: true },
        ks_report_lines : { type: Object, optional: true },
        ks_df_report_opt: { type: Object, optional: true },
        ksFormatCurrencySign: { type: Function, optional: true },
        ksgetaction: { type: Function, optional: true },
        ksSetReportCurrencyConfig: { type: Function, optional: true },
        ks_initial_balance : { type: Number, optional: true },
        ks_current_balance : { type: Number, optional: true },
        ks_ending_balance : { type: Number, optional: true },
        showesreport : { type: Boolean, optional: true },
     };

     static defaultProps = {

     };

    static template = "accounting_dynamic_reports_community.ks_df_other_reports";

    setup() {
        this.orm = useService("orm");
        this.state = useState({
            count: 0,
            account_data: [],
            sorted_lines: [],
        });
        const order = {
            "Gross Profit": 1,
            "Total Income": 2,
            "Expense": 3,
            "Net Profit": 4,
        };

        function subtractBalanceCmp(obj1, obj2) {
            let result = {};
            const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
            keys.forEach(key => {
                result[key] = (obj1?.[key] || 0) - (obj2?.[key] || 0);
            });
            return result;
        }

        function calculateNetProfit(reportLines) {
            let totalIncomeLine = reportLines.find(line => line.ks_name === "Total Income");
            let expenseLine = reportLines.find(line => line.ks_name === "Expense");
            let netProfitLine = reportLines.find(line => line.ks_name === "Net Profit");

            if (totalIncomeLine && expenseLine && netProfitLine) {
                netProfitLine.debit = (totalIncomeLine.debit || 0) - (expenseLine.debit || 0);
                netProfitLine.credit = (totalIncomeLine.credit || 0) - (expenseLine.credit || 0);
                netProfitLine.balance = (totalIncomeLine.balance || 0) - (expenseLine.balance || 0);

                netProfitLine.balance_cmp = subtractBalanceCmp(totalIncomeLine.balance_cmp, expenseLine.balance_cmp);
            }
        }

        this.props.ks_report_lines = this.props.ks_report_lines.sort((a, b) => {
            return (order[a.ks_name] || 999) - (order[b.ks_name] || 999);
        });

        onWillStart(()=>{
            let operating = {
                debit: 0,
                credit: 0,
                balance: 0
            }
            let netIncrease_balance = 0;
            let netIncrease_debit = 0;
            let netIncrease_credit = 0;

            let cashBeginningPeriod_balance = 0;
            let cashBeginningPeriod_debit = 0;
            let cashBeginningPeriod_credit = 0;

            let targetSections = [
              "Cash flows from operating activities",
              "Cash flows from investing and extraordinary activities",
              "Cash flows from financing activities",
              "Cash flows from unclassified activities"
            ];

            var reportLines= this.props.ks_report_lines;

            for (let i = 0; i < reportLines.length; i++) {
                if(reportLines[i].ks_name === "Net increase in cash and cash equivalents") {
                    let total = {
                      debit: 0,
                      credit: 0,
                      balance: 0
                    };
                    let required_line = reportLines[i]
                    for (let j = 0; j < required_line.children.length; j++) {
                        let child = required_line.children[j];

                        if (targetSections.includes(child.ks_name)) {
                           total.debit += child.debit || 0;
                           total.credit += child.credit || 0;
                           total.balance += child.balance || 0;
                        }
                    }
                    required_line['debit'] = total.debit
                    required_line['credit'] = total.credit
                    required_line['balance'] = total.balance

                    netIncrease_balance = required_line.balance
                    netIncrease_debit = required_line.debit
                    netIncrease_credit = required_line.credit
                }
                if (reportLines[i].ks_name === "Cash and cash equivalents, beginning period") {
                    let line = reportLines[i]
                    function sumNestedValues(line) {
                        let total = { balance: 0, debit: 0, credit: 0 };
                        if (line.children && line.children.length) {
                            for (let child of line.children) {
                                let childTotals = sumNestedValues(child);
                                total.balance += childTotals.balance;
                                total.debit += childTotals.debit;
                                total.credit += childTotals.credit;
                            }
                        } else {
                            total.balance += line.balance || 0;
                            total.debit += line.debit || 0;
                            total.credit += line.credit || 0;
                        }
                        return total;
                    }
                    let totals = sumNestedValues(line);
                    cashBeginningPeriod_debit = totals.debit;
                    cashBeginningPeriod_credit = totals.credit;
                    cashBeginningPeriod_balance = totals.balance;
                    line.debit = cashBeginningPeriod_debit
                    line.credit = cashBeginningPeriod_credit
                    line.balance = cashBeginningPeriod_balance

                    reportLines[i].children[0].debit = line.debit
                    reportLines[i].children[0].credit = line.credit
                    reportLines[i].children[0].balance = line.balance
                }
                for (let line of reportLines) {
                    if (line.ks_name === "Cash and cash equivalents, closing balance") {
                        line.balance = netIncrease_balance + cashBeginningPeriod_balance;
                        line.debit = netIncrease_debit + cashBeginningPeriod_debit;
                        line.credit = netIncrease_credit + cashBeginningPeriod_credit;
                    }
                }
            }
            calculateNetProfit(this.props.ks_report_lines);
        });
        onMounted(()=>{
            var self = this;
            if (parseFloat(String(self.props.ks_initial_balance)) > 0 || parseFloat(String(self.props.ks_current_balance)) > 0 ||
            parseFloat(String(self.props.ks_ending_balance)) > 0) {
                this.showesreport = true
            } else {
                this.showesreport = false
            }
        });
        onWillUpdateProps((nextProps) => {
            const order = {
                "Gross Profit": 1,
                "Total Income": 2,
                "Expense": 3,
                "Net Profit": 4,
            };

            this.props.ks_report_lines = nextProps.ks_report_lines.sort((a, b) => {
                return (order[a.ks_name] || 999) - (order[b.ks_name] || 999);
            });
            let total = {
              debit: 0,
              credit: 0,
              balance: 0
            };

            let operating = {
                debit: 0,
                credit: 0,
                balance: 0
            }
            let netIncrease_balance = 0;
            let netIncrease_debit = 0;
            let netIncrease_credit = 0;

            let cashBeginningPeriod_balance = 0;
            let cashBeginningPeriod_debit = 0;
            let cashBeginningPeriod_credit = 0;

            let targetSections = [
              "Cash flows from operating activities",
              "Cash flows from investing and extraordinary activities",
              "Cash flows from financing activities",
              "Cash flows from unclassified activities"
            ];

            var reportLines= this.props.ks_report_lines;
            for (let i = 0; i < reportLines.length; i++) {
                if(reportLines[i].ks_name === "Net increase in cash and cash equivalents") {
                    let required_line = reportLines[i]
                    for (let j = 0; j < required_line.children.length; j++) {
                        let child = required_line.children[j];

                        if (targetSections.includes(child.ks_name)) {
                           total.debit += child.debit || 0;
                           total.credit += child.credit || 0;
                           total.balance += child.balance || 0;
                        }
                    }
                    required_line['debit'] = total.debit
                    required_line['credit'] = total.credit
                    required_line['balance'] = total.balance

                    netIncrease_balance = required_line.balance
                    netIncrease_debit = required_line.debit
                    netIncrease_credit = required_line.credit
                }
                if (reportLines[i].ks_name === "Cash and cash equivalents, beginning period") {
                    let line = reportLines[i]
                    function sumNestedValues(line) {
                        let total = { balance: 0, debit: 0, credit: 0 };
                        if (line.children && line.children.length) {
                            for (let child of line.children) {
                                let childTotals = sumNestedValues(child);
                                total.balance += childTotals.balance;
                                total.debit += childTotals.debit;
                                total.credit += childTotals.credit;
                            }
                        } else {
                            total.balance += line.balance || 0;
                            total.debit += line.debit || 0;
                            total.credit += line.credit || 0;
                        }
                        return total;
                    }
                    let totals = sumNestedValues(line);
                    cashBeginningPeriod_debit = totals.debit;
                    cashBeginningPeriod_credit = totals.credit;
                    cashBeginningPeriod_balance = totals.balance;
                    line.debit = cashBeginningPeriod_debit
                    line.credit = cashBeginningPeriod_credit
                    line.balance = cashBeginningPeriod_balance

                    reportLines[i].children[0].debit = line.debit
                    reportLines[i].children[0].credit = line.credit
                    reportLines[i].children[0].balance = line.balance
                }
            }
            for (let line of reportLines) {
                if (line.ks_name === "Cash and cash equivalents, closing balance") {
                    line.balance = netIncrease_balance + cashBeginningPeriod_balance;
                    line.debit = netIncrease_debit + cashBeginningPeriod_debit;
                    line.credit = netIncrease_credit + cashBeginningPeriod_credit;
                }
            }
            calculateNetProfit(this.props.ks_report_lines);
        });
    }

}

Object.assign(KsOtherReports.prototype, KsAmountMixin);
