/** @odoo-module **/

import { registry } from "@web/core/registry";
const actionRegistry = registry.category("actions");
import { Component, onWillStart, onMounted, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
const { DateTime } = luxon;
import { session } from "@web/session";
import { getCurrency } from "@accounting_dynamic_reports_community/js/ks_utils";
import { formatMonetary } from "@web/views/fields/formatters";
import { formatFloat } from "@web/views/fields/formatters";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { KsTrialBalance } from '@accounting_dynamic_reports_community/components/ks_trial_balance_report/ks_trial_balance';
import { KsTaxReport } from '@accounting_dynamic_reports_community/components/ks_tax_report/ks_tax_report';
import { KsAgePayable } from '@accounting_dynamic_reports_community/components/ks_age_payable/ks_age_payable';
import { KsConsolidatedJournal } from '@accounting_dynamic_reports_community/components/ks_consolidated_journal/ks_consolidated_journal';
import { KsExecutiveSummary } from '@accounting_dynamic_reports_community/components/ks_executive_summary/ks_executive_summary';
import { KsGeneralLedger } from '@accounting_dynamic_reports_community/components/ks_general_ledger/ks_general_ledger';
import { KsPartnerLedger } from '@accounting_dynamic_reports_community/components/ks_partner_ledger/ks_partner_ledger';
import { KsOtherReports } from '@accounting_dynamic_reports_community/components/ks_other_reports/ks_other_reports';
import { KsControlPanel } from '@accounting_dynamic_reports_community/components/ks_control_panel/ks_control_panel';
import { KsReportFilters } from '@accounting_dynamic_reports_community/components/ks_report_filters/ks_report_filters';

class KsDynamicReportsWidget extends Component {

    static components = {
        DropdownItem,
        Dropdown,
        KsTrialBalance,
        KsTaxReport,
        KsAgePayable,
        KsConsolidatedJournal,
        KsExecutiveSummary,
        KsGeneralLedger,
        KsPartnerLedger,
        KsOtherReports,
        KsControlPanel,
        KsReportFilters
    };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.dialogService = useService('dialog');
        this.notificationService = useService("notification");

        this.ksSetInitObjects(null, this.action);

        this.state = useState({
            previous_period: 0,
            selected_component: this.props.action.name,
        });

        onWillStart(async () => {
            await this.ksRenderBody()
        });
    }



    get myComponent(){
        let componentMapping = {
            "Tax Report": "KsTaxReport",
            "Age Payable": "KsAgePayable",
            "Age Receivable": "KsAgePayable",
            "Trial Balance": "KsTrialBalance",
            "Executive Summary": "KsExecutiveSummary",
            "Consolidate Journal": "KsConsolidatedJournal",
            "General Ledger": "KsGeneralLedger",
            "Partner Ledger": "KsPartnerLedger",
            "Other Reports": "KsOtherReports",
        };
        return this.constructor.components[componentMapping[this.state.selected_component] || "KsOtherReports"];
    }

    // Get the common and component-specific props for rendering
    getProps() {
        var commonProps = {
            action: this.props.action,
            ksFormatCurrencySign: this.ksFormatCurrencySign,
            ksgetaction: this.ksgetaction.bind(this),
        };

        var componentSpecificProps = {};

        if(this.state.selected_component == 'Tax Report'){
            componentSpecificProps = {
                ks_report_lines: this.executiveHierarchy(this.ks_report_lines),
                ks_df_report_opt: this.ks_df_report_opt,
            };
        }
        else if(this.state.selected_component == 'Age Payable' || this.state.selected_component == 'Age Receivable') {
            componentSpecificProps = {
                ks_partner_dict: this.props.ks_master_value.ks_partner_dict,
                ks_df_informations: this.props.ks_master_value.ks_df_informations,
                ks_period_list: this.props.ks_master_value.ks_period_list,
                ks_df_report_opt: this.props.ks_df_report_opt,
                ksSetReportCurrencyConfig: this.ksSetReportCurrencyConfig.bind(this),
                ks_df_context: this.ks_df_context,
            };
        }
        else if(this.state.selected_component == 'Trial Balance') {
            componentSpecificProps = {
                ks_report_lines: this.props.ks_master_value.ks_report_lines,
                ks_df_informations: this.props.ks_master_value.ks_df_informations,
                ks_retained: this.ks_retained,
                ks_subtotal: this.ks_subtotal,
                ks_df_report_opt: this.props.ks_df_report_opt,
                ksSetReportCurrencyConfig: this.ksSetReportCurrencyConfig.bind(this),
            };
        }
        else if(this.state.selected_component == 'Executive Summary') {
            componentSpecificProps = {
                ks_report_lines: this.executiveHierarchy(this.props.ks_master_value.ks_report_lines),
                ks_initial_balance: this.props.ks_master_value.ks_initial_balance,
                ks_current_balance: this.props.ks_master_value.ks_current_balance,
                ks_ending_balance: this.props.ks_master_value.ks_ending_balance,
                ks_df_report_opt: this.ks_df_report_opt,
                ksSetExecutiveReportCurrencyConfig: this.ksSetExecutiveReportCurrencyConfig.bind(this),
            };
        }
        else if(this.state.selected_component == 'Consolidate Journal') {
            componentSpecificProps = {
                ks_report_lines: this.props.ks_master_value.ks_report_lines,
                ks_df_report_opt: this.props.ks_df_report_opt,
                ks_df_context: this.ks_df_context,
                ksSetReportCurrencyConfig: this.ksSetReportCurrencyConfig.bind(this),
            };
        }
        else if(this.state.selected_component == 'General Ledger') {
            componentSpecificProps = {
                ks_report_lines: this.props.ks_master_value.ks_report_lines,
                ks_enable_ledger_in_bal: Boolean(this.props.ks_enable_ledger_in_bal),
                ksSetReportCurrencyConfig: this.ksSetReportCurrencyConfig.bind(this),
                ks_df_report_opt: this.props.ks_df_report_opt,
                ks_df_context: this.ks_df_context,
            };
        }
        else if(this.state.selected_component == 'Partner Ledger') {
            componentSpecificProps = {
                ks_report_lines: this.props.ks_master_value.ks_report_lines,
                ks_enable_ledger_in_bal: Boolean(this.props.ks_enable_ledger_in_bal),
                ks_df_context: this.ks_df_context,
                ks_searchview_buttons: this.ks_searchview_buttons,
                ks_df_report_opt: this.props.ks_df_report_opt,
                ksSetReportCurrencyConfig: this.ksSetReportCurrencyConfig.bind(this),
            };
        }
        else {
            componentSpecificProps = {
                ks_report_lines: this.buildHierarchy(this.ks_report_lines),
                ks_df_report_opt: this.ks_df_report_opt,
                ksSetReportCurrencyConfig: this.ksSetReportCurrencyConfig.bind(this),
                ks_initial_balance: this.props.ks_master_value.ks_initial_balance,
                ks_current_balance: this.props.ks_master_value.ks_current_balance,
                ks_ending_balance: this.props.ks_master_value.ks_ending_balance,
            };
        }
        return { ...commonProps, ...componentSpecificProps };
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
        if(hasHierarchy) {
            return Object.values(tree);
        }
        else{
            return filteredLines;
        }
    }

    executiveHierarchy(reportLines) {
        let tree = [];
        let currentParent = null;
        let parentIdCounter = 1;

        reportLines.forEach(line => {
            line.children = [];
            if (line.ks_level === 1) {
                line.unique_id = `parent_${parentIdCounter++}`;
                tree.push(line);
                currentParent = line;
            } else if (line.ks_level === 2 && currentParent) {
                line.unique_id = `${currentParent.unique_id}_child_${currentParent.children.length + 1}`;
                currentParent.children.push(line);
            }
        });

        return tree;
    }


    ksSetInitObjects(parent, action) {
        this.actionManager = parent;
        this.ks_dyn_fin_model = this.props.action.context.model || 'ks.dynamic.financial.base';
        this.ks_report_id = this.props.action.context.id || false;
        this.ks_df_context = this.props.action.context;
        this.ks_df_report_opt = this.props.action.ks_df_informations || false;
    }

    async ksSetReportInfo(values) {
        this.ks_df_reports_ids = values.ks_df_reports_ids;
        this.ks_df_report_opt = values.ks_df_informations;
        this.ks_df_context = values.context;
        this.ks_report_manager_id = values.ks_report_manager_id;
        this.ks_remarks = values.ks_remarks;
        let buttons_div = document.createElement('div');
        buttons_div.innerHTML = values.ks_buttons;
        this.ks_buttons = buttons_div;
        let searchview_div = document.createElement('div');
        searchview_div.innerHTML = values.ks_searchview_html;
        this.ks_searchview_buttons = searchview_div;
        this.ks_currency = values.ks_currency;
        this.ks_report_lines = values.ks_report_lines;
        this.props.ks_enable_ledger_in_bal = values.ks_enable_ledger_in_bal;
        this.ks_initial_balance = values.ks_initial_balance;
        this.ks_current_balance = values.ks_current_balance;
        this.ks_ending_balance = values.ks_ending_balance;
        this.ks_diff_filter = values.ks_diff_filter;
        this.ks_retained = values.ks_retained;
        this.ks_subtotal = values.ks_subtotal;
        this.ks_partner_dict = values.ks_partner_dict
        this.ks_period_list = values.ks_period_list
        this.ks_period_dict = values.ks_period_dict
    }

    async ksRenderBody() {
        await this.orm.call('ks.dynamic.financial.reports', 'ks_get_dynamic_fin_info', [this.props.action.context.id,
        this.ks_df_report_opt],{context:this.props.action.context}).then((result) => {
            this.props.date_to_cmp =""
            this.props.date_from_cmp =""
            this.props.ks_end_date =""
            this.props.previos =""
            this.props.ks_master_value = result
            this.ksSetReportInfo(result);
            this.ks_df_context = result.context
            this.ks_df_report_opt = result['ks_df_informations']
            this.props.ks_df_report_opt = result['ks_df_informations']
            var ksFormatConfigurations = {
                currency_id: result.ks_currency,
                noSymbol: true,
            };
            this.initial_balance = this.ksFormatCurrencySign(result.ks_initial_balance, ksFormatConfigurations, result.ks_initial_balance < 0 ? '-' : '');
            this.current_balance = this.ksFormatCurrencySign(result.ks_current_balance, ksFormatConfigurations, result.ks_current_balance < 0 ? '-' : '');
            this.ending_balance = this.ksFormatCurrencySign(result.ks_ending_balance, ksFormatConfigurations, result.ks_ending_balance < 0 ? '-' : '');
            this.ks_partner_dict = result['ks_partner_dict']
            this.ks_period_list = result['ks_period_list']
            this.ks_period_dict = result['ks_period_dict']
            this.ks_report_lines = result['ks_report_lines']
        })
    }

    async _ksRenderBody(ks_df_report_opt) {
        this.ks_result = this.orm.silent.call('ks.dynamic.financial.reports', 'ks_get_dynamic_fin_info', [this.props.action.context.id,
            ks_df_report_opt
        ], {
            context: this.props.action.context
        })
        var ks_result = await this.ks_result
        return Promise.resolve(ks_result);
    }


    async ksSetReportCurrencyConfig() {
        var self = this;
        Object.entries(self.ks_report_lines).forEach(([v, k]) => {
            var ksFormatConfigurations = {
                currency_id: k.company_currency_id,
                noSymbol: true,
            };
            k.debit = self.ksFormatCurrencySign(k.debit, ksFormatConfigurations, k.debit < 0 ? '-' : '');
            k.credit = self.ksFormatCurrencySign(k.credit, ksFormatConfigurations, k.credit < 0 ? '-' : '');
            if (self.props.action.xml_id == _t('accounting_dynamic_reports_community.ks_df_tb_action')) {

            } else {
                k.initial_balance = self.ksFormatCurrencySign(k.initial_balance, ksFormatConfigurations, k.initial_balance < 0 ? '-' : '');
            }
            if (!k['percentage']) {
                k.balance = self.ksFormatCurrencySign(k.balance, ksFormatConfigurations, k.balance < 0 ? '-' : '');
            } else {
                k.balance = String(Math.round(k.balance)) + "%";
            }

            for (const prop in k.balance_cmp) {
                k.balance_cmp[prop] = self.ksFormatCurrencySign(k.balance_cmp[prop], ksFormatConfigurations, k.balance[prop] < 0 ? '-' : '');
            }
        });
    }

    async ksSetExecutiveReportCurrencyConfig() {
        var self = this;

        Object.entries(self.ks_report_lines).forEach(([v, k]) => {
            var ksFormatConfigurations = {
                currency_id: k.company_currency_id,
                noSymbol: true,
            };

            for (const prop in k.debit) {
                k.debit[prop] = self.ksFormatCurrencySign(k.debit[prop], ksFormatConfigurations, k.debit[prop] < 0 ? '-' : '');
            }
            for (const prop in k.credit) {
                k.credit[prop] = self.ksFormatCurrencySign(k.credit[prop], ksFormatConfigurations, k.credit[prop] < 0 ? '-' : '');
            }

            //  changed the values of balance
            if (!k['percentage']) {
                for (const prop in k.balance) {
                    k.balance[prop] = self.ksFormatCurrencySign(k.balance[prop], ksFormatConfigurations, k.balance[prop] < 0 ? '-' : '');
                }
            } else {
                for (const prop in k.balance) {
                    k.balance[prop] = String(formatFloat(k.balance[prop])) + "%";
                }
            }

            for (const prop in k.balance_cmp) {
                k.balance_cmp[prop] = self.ksFormatCurrencySign(k.balance_cmp[prop], ksFormatConfigurations, k.balance[prop] < 0 ? '-' : '');
            }
        });
    }


    ksFormatCurrencySign(amount, ksFormatConfigurations, sign) {
        var currency_id = ksFormatConfigurations.currency_id;
        currency_id = getCurrency(currency_id);
        var without_sign = formatMonetary(Math.abs(amount), {}, ksFormatConfigurations);
        if (!amount) {
            return '-'
        };
        if (currency_id) {
            if (currency_id.position === "after") {
                return sign + '' + without_sign + '' + currency_id.symbol;
            } else {
                return currency_id.symbol + '' + sign + '' + without_sign;
            }
        }
        return without_sign;
    }

    async setReportValues(result){
        this.props.ks_master_value = result
        this.ksSetReportInfo(result);
        this.ks_df_context = result.context
        this.ks_df_report_opt = result['ks_df_informations']
        var ksFormatConfigurations = {
            currency_id: result.ks_currency,
            noSymbol: true,
        };
        this.initial_balance = this.ksFormatCurrencySign(result.ks_initial_balance, ksFormatConfigurations, result.ks_initial_balance < 0 ? '-' : '');
        this.current_balance = this.ksFormatCurrencySign(result.ks_current_balance, ksFormatConfigurations, result.ks_current_balance < 0 ? '-' : '');
        this.ending_balance = this.ksFormatCurrencySign(result.ks_ending_balance, ksFormatConfigurations, result.ks_ending_balance < 0 ? '-' : '');
        this.ks_partner_dict = result['ks_partner_dict']
        this.ks_period_list = result['ks_period_list']
        this.ks_period_dict = result['ks_period_dict']
        this.ks_report_lines = result['ks_report_lines']
        this.render()
    }

    async ksgetaction(event, ks_df_report_opt) {
        event.stopPropagation();
        let self = this;
        let action = event.target.getAttribute('action');
        let tdElement = event.target.closest('td');
        let id = parseInt(tdElement?.dataset.bsAccountId) || parseInt(tdElement?.dataset.bsMoveId);
        let params = Object.fromEntries(
            Object.entries(event.target.dataset).map(([key, value]) => [key, isNaN(value) ? value : parseInt(value, 10)])
        );
        if (action) {
            await this.orm.call('ks.dynamic.financial.reports', action, [this.props.action.context.id,
            ks_df_report_opt, params],{context: this.props.action.context}).then((result) => {
                return self.action.doAction(result);
            });
        }
    }
}

KsDynamicReportsWidget.customizableComponents = {
};
KsDynamicReportsWidget.template = "ks_tax_report_lines";
actionRegistry.add('ks_dynamic_report', KsDynamicReportsWidget);
export { KsDynamicReportsWidget };
