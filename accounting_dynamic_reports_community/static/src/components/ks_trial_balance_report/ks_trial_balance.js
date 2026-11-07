/** @odoo-module **/

import { KsAmountMixin } from "@accounting_dynamic_reports_community/js/ks_utils";
import { Component, useState, onWillStart, onMounted, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { getCurrency } from "@accounting_dynamic_reports_community/js/ks_utils";
import { formatMonetary } from "@web/views/fields/formatters";
import { registry } from "@web/core/registry";
const { DateTime } = luxon;

export class KsTrialBalance extends Component {

    static props = {
        action: { type: Object, optional: true },
        ks_report_lines : { type: Object, optional: true },
        ks_df_report_opt: { type: Object, optional: true },
        ks_df_informations: { type: Object, optional: true },
        ks_retained: { type: Boolean, optional: true },
        ks_subtotal: { type: Object, optional: true },
        ksFormatCurrencySign: { type: Function, optional: true },
        ksgetaction: { type: Function, optional: true },
        ksSetReportCurrencyConfig: { type: Function, optional: true },
    };

    static defaultProps = {

    };

    static template = "accounting_dynamic_reports_community.ks_df_tb_action";

    setup() {
        onWillStart(() => {
            this.ksRenderTrialBalance(this.props.ks_report_lines);
            this.props.ksSetReportCurrencyConfig();
        });
        onWillUpdateProps((nextProps) => {
            var self = this;
            nextProps.ks_df_new_start_report_opt = DateTime.fromISO(nextProps.ks_df_informations.date.ks_start_date).toFormat('yyyy-M-d');
            nextProps.ks_df_new_end_report_opt = DateTime.fromISO(nextProps.ks_df_informations.date.ks_end_date).toFormat('yyyy-M-d');
            function formatZeroToTwoDecimal(value) {
                var num = Number(value);
                if (isNaN(num)) {
                    return "0.00";
                }
                return num.toFixed(2);
            }

            Object.entries(nextProps.ks_report_lines).forEach(([v, k]) => {
                var ksFormatConfigurations = {
                    currency_id: k.company_currency_id,
                    noSymbol: true,
                };
                k.debit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.debit), ksFormatConfigurations, k.debit < 0 ? '-' : '');
                k.credit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.credit), ksFormatConfigurations, k.credit < 0 ? '-' : '');
                k.balance = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.balance), ksFormatConfigurations, k.balance < 0 ? '-' : '');
                k.initial_debit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_debit), ksFormatConfigurations, k.initial_debit < 0 ? '-' : '');
                k.initial_credit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_credit), ksFormatConfigurations, k.initial_credit < 0 ? '-' : '');
                k.initial_balance = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_balance), ksFormatConfigurations, k.initial_balance < 0 ? '-' : '');
                k.ending_debit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_debit), ksFormatConfigurations, k.ending_debit < 0 ? '-' : '');
                k.ending_credit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_credit), ksFormatConfigurations, k.ending_credit < 0 ? '-' : '');
                k.ending_balance = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_balance), ksFormatConfigurations, k.ending_balance < 0 ? '-' : '');
            });

            Object.entries(nextProps.ks_retained).forEach(([v, k]) => {
                var ksFormatConfigurations = {
                    currency_id: k.company_currency_id,
                    noSymbol: true,
                };
                k.debit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.debit), ksFormatConfigurations, k.debit < 0 ? '-' : '');
                k.credit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.credit), ksFormatConfigurations, k.credit < 0 ? '-' : '');
                k.balance = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.balance), ksFormatConfigurations, k.balance < 0 ? '-' : '');
                k.initial_debit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_debit), ksFormatConfigurations, k.initial_debit < 0 ? '-' : '');
                k.initial_credit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_credit), ksFormatConfigurations, k.initial_credit < 0 ? '-' : '');
                k.initial_balance = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_balance), ksFormatConfigurations, k.initial_balance < 0 ? '-' : '');
                k.ending_debit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_debit), ksFormatConfigurations, k.ending_debit < 0 ? '-' : '');
                k.ending_credit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_credit), ksFormatConfigurations, k.ending_credit < 0 ? '-' : '');
                k.ending_balance = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_balance), ksFormatConfigurations, k.ending_balance < 0 ? '-' : '');
            });

            Object.entries(nextProps.ks_subtotal).forEach(([v, k]) => {
                var ksFormatConfigurations = {
                    currency_id: k.company_currency_id,
                    noSymbol: true,
                };
                k.debit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.debit), ksFormatConfigurations, k.debit < 0 ? '-' : '');
                k.credit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.credit), ksFormatConfigurations, k.credit < 0 ? '-' : '');
                k.balance = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.balance), ksFormatConfigurations, k.balance < 0 ? '-' : '');
                k.initial_debit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_debit), ksFormatConfigurations, k.initial_debit < 0 ? '-' : '');
                k.initial_credit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_credit), ksFormatConfigurations, k.initial_credit < 0 ? '-' : '');
                k.initial_balance = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_balance), ksFormatConfigurations, k.initial_balance < 0 ? '-' : '');
                k.ending_debit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_debit), ksFormatConfigurations, k.ending_debit < 0 ? '-' : '');
                k.ending_credit = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_credit), ksFormatConfigurations, k.ending_credit < 0 ? '-' : '');
                k.ending_balance = nextProps.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_balance), ksFormatConfigurations, k.ending_balance < 0 ? '-' : '');
            });
            nextProps.account_data = nextProps.ks_report_lines
            nextProps.retained = nextProps.ks_retained
            nextProps.subtotal = nextProps.ks_subtotal

        });
    }

    get MoveLines() {
        let account_id = parseInt(event.currentTarget.dataset.bsAccountId);
        let account = Object.values(this.props.ks_report_lines).find(acc => acc.id === account_id);
        if(!account){
            return [];
        }
        else{
            return account.lines;
        }
    }

    async ksGetMoveLines(event) {
        if(this.MoveLines.length > 0){
            this.state.account_data = this.MoveLines;
        }
    }

    async ksRenderTrialBalance(report_lines) {
        var self = this;
        this.props.ks_df_new_start_report_opt = DateTime.fromISO(self.props.ks_df_informations.date.ks_start_date).toFormat('yyyy-M-d');
        this.props.ks_df_new_end_report_opt = DateTime.fromISO(self.props.ks_df_informations.date.ks_end_date).toFormat('yyyy-M-d');
        function formatZeroToTwoDecimal(value) {
            var num = Number(value);
            if (isNaN(num)) {
                return "0.00";
            }
            return num.toFixed(2);
        }

        Object.entries(report_lines).forEach(([v, k]) => {
            var ksFormatConfigurations = {
                currency_id: k.company_currency_id,
                noSymbol: true,
            };
            k.initial_debit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_debit), ksFormatConfigurations, k.initial_debit < 0 ? '-' : '');
            k.initial_credit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_credit), ksFormatConfigurations, k.initial_credit < 0 ? '-' : '');
            k.initial_balance = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_balance), ksFormatConfigurations, k.initial_balance < 0 ? '-' : '');
            k.ending_debit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_debit), ksFormatConfigurations, k.ending_debit < 0 ? '-' : '');
            k.ending_credit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_credit), ksFormatConfigurations, k.ending_credit < 0 ? '-' : '');
            k.ending_balance = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_balance), ksFormatConfigurations, k.ending_balance < 0 ? '-' : '');
        });

        Object.entries(self.props.ks_retained).forEach(([v, k]) => {
            var ksFormatConfigurations = {
                currency_id: k.company_currency_id,
                noSymbol: true,
            };
            k.debit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.debit), ksFormatConfigurations, k.debit < 0 ? '-' : '');
            k.credit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.credit), ksFormatConfigurations, k.credit < 0 ? '-' : '');
            k.balance = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.balance), ksFormatConfigurations, k.balance < 0 ? '-' : '');
            k.initial_debit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_debit), ksFormatConfigurations, k.initial_debit < 0 ? '-' : '');
            k.initial_credit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_credit), ksFormatConfigurations, k.initial_credit < 0 ? '-' : '');
            k.initial_balance = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_balance), ksFormatConfigurations, k.initial_balance < 0 ? '-' : '');
            k.ending_debit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_debit), ksFormatConfigurations, k.ending_debit < 0 ? '-' : '');
            k.ending_credit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_credit), ksFormatConfigurations, k.ending_credit < 0 ? '-' : '');
            k.ending_balance = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_balance), ksFormatConfigurations, k.ending_balance < 0 ? '-' : '');
        });

        Object.entries(self.props.ks_subtotal).forEach(([v, k]) => {
            var ksFormatConfigurations = {
                currency_id: k.company_currency_id,
                noSymbol: true,
            };
            k.debit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.debit), ksFormatConfigurations, k.debit < 0 ? '-' : '');
            k.credit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.credit), ksFormatConfigurations, k.credit < 0 ? '-' : '');
            k.balance = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.balance), ksFormatConfigurations, k.balance < 0 ? '-' : '');
            k.initial_debit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_debit), ksFormatConfigurations, k.initial_debit < 0 ? '-' : '');
            k.initial_credit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_credit), ksFormatConfigurations, k.initial_credit < 0 ? '-' : '');
            k.initial_balance = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.initial_balance), ksFormatConfigurations, k.initial_balance < 0 ? '-' : '');
            k.ending_debit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_debit), ksFormatConfigurations, k.ending_debit < 0 ? '-' : '');
            k.ending_credit = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_credit), ksFormatConfigurations, k.ending_credit < 0 ? '-' : '');
            k.ending_balance = self.props.ksFormatCurrencySign(formatZeroToTwoDecimal(k.ending_balance), ksFormatConfigurations, k.ending_balance < 0 ? '-' : '');
        });
        self.props.account_data = report_lines
        self.props.retained = this.props.ks_retained
        self.props.subtotal = this.props.ks_subtotal
    }

}
registry.category("components").add("Trial Balance", KsTrialBalance);

Object.assign(KsTrialBalance.prototype, KsAmountMixin);
