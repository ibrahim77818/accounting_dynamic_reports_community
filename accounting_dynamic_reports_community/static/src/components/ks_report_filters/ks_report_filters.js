/** @odoo-module **/

import { Component, useState, onWillStart, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { KsRecordSelector } from "@accounting_dynamic_reports_community/components/ks_record_selector/ks_record_selector";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";
const { DateTime } = luxon;

export class KsReportFilters extends Component {

    static props = {
        action: { type: Object, optional: true },
        ks_df_report_opt: { type: Object, optional: true },
        ks_df_context: { type: Object, optional: true },
        ks_df_informations : { type: Object, optional: true },
        ks_master_value : { type: Object, optional: true },
        _ksRenderBody : { type: Function, optional: true },
        setReportValues : { type: Function, optional: true },
        ksSetReportInfo : { type: Function, optional: true },
        date_from_cmp: { type: String, optional: true },
        new_ks_df_reports_ids : { type: String, optional: true },
        date_to_cmp: { type: String, optional: true },
    };

    static defaultProps = {

    };

    static template = "accounting_dynamic_reports_community.ks_report_filters";

    static components = { DropdownItem, Dropdown, KsRecordSelector }

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.dialogService = useService("dialog");
        this.notification = useService("notification");
        this.state = useState({
            previous_period: 1,
            start_date: null,
            end_date: null,
            start_date_diff: null,
            end_date_diff: null,
        });
    }

    async updateFilter(bsFilter) {
        var self = this;
        self.props.ks_df_context.ks_option_enable = false;
        self.props.ks_df_context.ks_journal_enable = false;
        self.props.ks_df_context.ks_account_enable = false;
        self.props.ks_df_context.ks_account_both_enable = false;
        self.props.ks_df_report_opt.date.ks_filter = bsFilter;

        var error = false;
        var new_date_format = 'yyyy-M-d';
        var diffFilter = self.props.ks_df_report_opt.ks_differ.ks_differentiate_filter;

        if (diffFilter === "no_differentiation" && (!this.state.start_date || !this.state.end_date)) {
            self.props.ks_df_report_opt.ks_differ.ks_differentiate_filter = "no_differentiation";
            self.props.ks_df_report_opt.ks_diff_filter.ks_diff_filter_enablity = false;
            self.props.ks_df_report_opt.ks_diff_filter.ks_debit_credit_visibility = true;
        }

        if (bsFilter === 'custom') {
            var ks_start_date = '';
            var ks_end_date = '';
            if(this.props.ks_df_report_opt.date.ks_process === 'range') {
                if (this.state.start_date && this.state.end_date) {
                    ks_start_date = this.state.start_date.toISODate(new_date_format);
                    ks_end_date = this.state.end_date.toISODate(new_date_format);

                    if (ks_start_date > ks_end_date) {
                        error = true;
                        this.dialogService.add(AlertDialog, {
                            title: _t('Odoo Warning'),
                            body: _t("Start Date cannot be greater than End Date."),
                            confirmLabel: _t('Ok'),
                        });
                        return;
                    }
                }
                if (ks_start_date) {
                    self.props.ks_df_report_opt.date.ks_start_date = ks_start_date;
                }
                if (ks_end_date) {
                    self.props.ks_df_report_opt.date.ks_end_date = ks_end_date;
                }
            }
            else {
                if (this.state.end_date) {
                    self.props.ks_df_report_opt.date.ks_end_date = this.state.end_date.toISODate();
                }
            }

        }
        if (error) {
            this.dialogService.add(AlertDialog, {
                title: _t('Odoo Warning'),
                body: _t("Date cannot be empty."),
                confirmLabel: _t('Ok'),
            });
            return;
        }
        let result = await this.props._ksRenderBody(self.props.ks_df_report_opt);
        document.querySelectorAll('.accordion-toggle').forEach(row => {
            row.setAttribute('aria-expanded', 'false');
            let targetSelector = row.getAttribute('data-bs-target');
            if (targetSelector) {
                document.querySelectorAll(targetSelector).forEach(collapseDiv => {
                  collapseDiv.classList.remove('show');
                });
            }
        });
        this.props.setReportValues(result);
    }

    async OnClickDate(bsFilter) {
        var self = this;
        var option_value = bsFilter;
        if(option_value == 'ks_report_with_lines'){
            if (self.props.ks_df_report_opt.print_detailed_view){
                self.props.ks_df_report_opt.print_detailed_view = false;
            } else {
                self.props.ks_df_report_opt.print_detailed_view = true;
            }
        }
        self.props.ks_df_context.ks_option_enable = false;
        self.props.ks_df_context.ks_journal_enable = false;
        self.props.ks_df_context.ks_account_enable = false;
        self.props.ks_df_context.ks_account_both_enable = false;
        self.props.ks_df_report_opt.print_detailed_view = false;

        var ks_options_enable = false;
        if (!event.currentTarget.classList.contains('selected')) {
            ks_options_enable = true;
            if(option_value == 'ks_report_with_lines' && !self.props.ks_df_context.print_detailed_view){
                self.props.ks_df_report_opt.print_detailed_view = true;
            }
        }

        var ks_temp_arr = [];
        var ks_options = event.currentTarget;
        if (ks_options.dataset.filter !== option_value) {
            ks_temp_arr.push(ks_options.classList.contains('selected'));
        }
        if (ks_temp_arr.indexOf(true) !== -1 || ks_options_enable){
            self.props.ks_df_context.ks_option_enable = true;
        } else {
            self.props.ks_df_context.ks_option_enable = false;
        }

        if(option_value == 'ks_comparison_range'){
            var ks_date_range_change = {};
            ks_date_range_change['ks_comparison_range'] = !self.props.ks_df_report_opt[option_value];
            return await this.orm.call("ks.dynamic.financial.reports", 'write', [this.props.action.context.id, ks_date_range_change], {
                context: this.props.action.context
            }).then((data) => {
                this.orm.call("ks.dynamic.financial.reports", 'ks_reload_page').then((data) => {
                    return this.action.doAction(data);
                });
            });
        }

        else if(option_value!='ks_comparison_range'){
            self.props.ks_df_report_opt[option_value]= !self.props.ks_df_report_opt[option_value];
            self.props.ks_df_informations[option_value] = self.props.ks_df_report_opt[option_value];
        }

        if (option_value === 'unfold_all') {
            self.unfold_all(self.props.ks_df_report_opt[option_value]);
        }

        let result = await self.props._ksRenderBody(self.props.ks_df_report_opt);
        document.querySelectorAll('.accordion-toggle').forEach(row => {
            row.setAttribute('aria-expanded', 'false');
            let targetSelector = row.getAttribute('data-bs-target');
            if (targetSelector) {
                document.querySelectorAll(targetSelector).forEach(collapseDiv => {
                  collapseDiv.classList.remove('show');
                });
            }
        });
        self.props.setReportValues(result);
    }

    previousPeriodChange(value) {
        let period = Number(value);
        if (period < 1) {
            this.dialogService.add(AlertDialog, {
                title: _t("Odoo Warning"),
                body: _t("Please select a value greater than 0."),
                confirmLabel: _t("Ok"),
            });
            return;
        } else if (period > 30) {
            this.dialogService.add(AlertDialog, {
                title: _t("Odoo Warning"),
                body: _t("You cannot select more than 30 periods."),
                confirmLabel: _t("Ok"),
            });
            return;
        } else {
            this.state.previous_period = period;
        }
    }

    async OnChangeComp(bsFilter) {
        var self = this;
        self.props.ks_df_context.ks_option_enable = false;
        self.props.ks_df_context.ks_journal_enable = false;
        self.props.ks_df_context.ks_account_enable = false;
        self.props.ks_df_context.ks_account_both_enable = false;
        self.props.ks_df_report_opt.ks_differ.ks_differentiate_filter = bsFilter;

        let new_date_format = 'yyyy-M-d';
        let error = false;

        if (bsFilter === "no_differentiation") {
            self.props.ks_df_report_opt.ks_diff_filter.ks_diff_filter_enablity = false;
            self.props.ks_df_report_opt.ks_diff_filter.ks_debit_credit_visibility = true;
        } else {
            self.props.ks_df_report_opt.ks_diff_filter.ks_diff_filter_enablity = true;
            self.props.ks_df_report_opt.ks_diff_filter.ks_debit_credit_visibility = false;
        }

        if (bsFilter === "earlier_interval") {
            self.props.ks_df_report_opt.ks_differ.ks_no_of_interval = parseInt(this.state.previous_period, 10) || 1;
        }

        if (self.props.ks_df_report_opt.ks_differ.ks_no_of_interval < 1 && bsFilter !== "no_differentiation") {
            this.dialogService.add(AlertDialog, {
                title: _t("Odoo Warning"),
                body: _t("Please select a value greater than 0."),
                confirmLabel: _t("Ok"),
            });
            return;
        }

        if (
            self.props.ks_df_report_opt.ks_differ.ks_no_of_interval > 30 &&
            bsFilter !== "no_differentiation"
        ) {
            this.dialogService.add(AlertDialog, {
                title: _t("Odoo Warning"),
                body: _t("You cannot select more than 30 periods."),
                confirmLabel: _t("Ok"),
            });
            return;
        }

        if (bsFilter === "custom") {
            let ks_start_date = "";
            let ks_end_date = "";

            if (this.state.start_date_diff) {
                ks_start_date = this.state.start_date_diff.toISODate(new_date_format);
            }

            if (this.state.end_date_diff) {
                ks_end_date = this.state.end_date_diff.toISODate(new_date_format);
            }
            if (!ks_start_date || !ks_end_date) {
                this.dialogService.add(AlertDialog, {
                    title: _t("Odoo Warning"),
                    body: _t("Both Start Date and End Date are required for comparison."),
                    confirmLabel: _t("Ok"),
                });
                const diffState = self.props.ks_df_report_opt.ks_differ;
                diffState.ks_differentiate_filter = "no_differentiation";
                diffState.ks_start_date = "";
                diffState.ks_end_date = "";
                diffState.ks_no_of_interval = 0;
                self.props.ks_df_report_opt.ks_diff_filter.ks_diff_filter_enablity = false;
                self.props.ks_df_report_opt.ks_diff_filter.ks_debit_credit_visibility = true;
                return;
            }
            if (new Date(ks_start_date) > new Date(ks_end_date)) {
                this.dialogService.add(AlertDialog, {
                    title: _t("Odoo Warning"),
                    body: _t("Start Date should be less than End Date."),
                    confirmLabel: _t("Ok"),
                });
                return;
            }
            self.props.ks_df_report_opt.ks_differ.ks_start_date = ks_start_date;
            self.props.ks_df_report_opt.ks_differ.ks_end_date = ks_end_date;
        }
        let result = await this.props._ksRenderBody(self.props.ks_df_report_opt);
        document.querySelectorAll('.accordion-toggle').forEach(row => {
            row.setAttribute('aria-expanded', 'false');
            let targetSelector = row.getAttribute('data-bs-target');
            if (targetSelector) {
                document.querySelectorAll(targetSelector).forEach(collapseDiv => {
                  collapseDiv.classList.remove('show');
                });
            }
        });
        this.props.setReportValues(result);
    }


    async js_account_report_group_choice_filter(bsFilter, bsMemberIds) {
        const memberIds = (bsMemberIds || []).map(Number);
        const options = this.props.ks_df_report_opt[bsFilter] || [];
        const group = options.find((el) => el.id === "group" && JSON.stringify(el.ids) === JSON.stringify(bsMemberIds));
        const select = !(group && group.selected);
        for (const el of options) {
            if (el.id === "group") {
                el.selected = el === group ? select : false;
            } else if (el.id !== "divider") {
                el.selected = select && memberIds.includes(Number(el.id));
            }
        }
        const result = await this.props._ksRenderBody(this.props.ks_df_report_opt);
        this.props.setReportValues(result);
    }

    /** ISO string (yyyy-MM-dd) for a luxon DateTime, used by the native date inputs. */
    ksIso(value) {
        return value && value.toISODate ? value.toISODate() : "";
    }

    ksParse(value) {
        return value ? DateTime.fromISO(value) : null;
    }

    onKsSearchFilter() {
        event.stopPropagation();
        event.preventDefault();
        let ks_input = event.currentTarget.value;
        let ks_filter = ks_input.toUpperCase();
        let ks_accounts = event.currentTarget.closest('div').querySelectorAll('.js_account_report_choice_filter');
        ks_accounts.forEach(account => {
            let txtValue = account.textContent || account.innerText;
            if (txtValue.toUpperCase().includes(ks_filter)) {
                account.classList.remove('ks_d_none');
            } else {
                account.classList.add('ks_d_none');
            }
        });
    }

     async js_account_report_choice_filter(bsId,bsFilter) {
        let self = this
        self.props.ks_df_context.ks_journal_enable = false
        self.props.ks_df_context.ks_account_enable = false
        self.props.ks_df_context.ks_account_both_enable = false
        self.props.ks_df_context.ks_option_enable = false;
        let option_value = bsFilter;
        let option_id = bsId;
        if (!event.currentTarget.classList.contains('selected')){
            var ks_options_enable = true
        }
        let ks_temp_arr = []
        let ks_options = event.currentTarget.parentElement.querySelectorAll('span');
        ks_options.forEach(option => {
            if (parseInt(option.id) !== option_id) {
                ks_temp_arr.push(option.classList.contains('selected'));
            }
        });
        if (option_value === 'account'){
            if (ks_temp_arr.indexOf(true) !== -1 || ks_options_enable){
                self.props.ks_df_context.ks_account_enable = true;
            }
        }
        if (option_value === 'journals'){
            if (ks_temp_arr.indexOf(true) !== -1 || ks_options_enable){
                self.props.ks_df_context.ks_journal_enable = true;
            }
        }
        if (option_value === 'account_type'){
            if (ks_temp_arr.indexOf(true) !== -1 || ks_options_enable){
                self.props.ks_df_context.ks_account_both_enable = true;
            }
        }
        self.props.ks_df_report_opt[option_value].filter((el) => {
            if ('' + el.id == '' + option_id) {
                if (el.selected === undefined || el.selected === null) {
                    el.selected = false;
                }
                el.selected = !el.selected;
            } else if (option_value === 'ir_filters') {
                el.selected = false;
            }
            return el;
        });
        let result = await self.props._ksRenderBody(self.props.ks_df_report_opt);
        document.querySelectorAll('.accordion-toggle').forEach(row => {
            row.setAttribute('aria-expanded', 'false');
            row.classList.add('collapsed');
            let targetSelector = row.getAttribute('data-bs-target');
            if (targetSelector) {
                document.querySelectorAll(targetSelector).forEach(collapseDiv => {
                    collapseDiv.classList.remove('show');
                });
            }
        });
        this.props.setReportValues(result);
    }

    getMultiRecordSelectorProps(resModel, optionKey) {
        return {
            resModel,
            resIds:this.props.ks_df_report_opt.ks_partner_ids,
            update: (event) => {
                if (event.length > 50) {
                    this.notification.add("You can select a maximum of 50 partners.", {
                        type: "warning",
                    });
                    return;
                }
                 this.ksPerformOnchange(event);
            },

        };
    }

    getMultiRecordSelectoraccount(resModel, optionKey) {
        return {
            resModel,
            resIds:this.props.ks_df_report_opt.analytic_accounts || [],
            update: (event) => {
                this.ksPerformOnchangeaccount(event);

            },

        };
    }

    async ksPerformOnchange(ev){
        await this._ksPerformOnchange(ev)
        this.render()
    }

    async _ksPerformOnchange(ev){
        var self = this;
        self.props.ks_df_report_opt.ks_partner_ids = ev;
        let result = await this.props._ksRenderBody(self.props.ks_df_report_opt);
        this.props.setReportValues(result)
    }

    async ksPerformOnchangeaccount(ev){
        await this._ksPerformOnchangeaccount(ev)
        this.render()
    }

    async _ksPerformOnchangeaccount(ev){
        var self = this;
        self.props.ks_df_report_opt.analytic_accounts = ev;
        let result = await this.props._ksRenderBody(self.props.ks_df_report_opt);
        this.props.setReportValues(result)
    }

    async onDateTimeChanged(e){
        this.props.ks_end_date = e
        this.state.end_date = this.props.ks_end_date
    }

    async onDateTimeChangedStartDate(e){
        this.props.ks_start_date = e
        this.state.start_date = this.props.ks_start_date
    }

    async fdate_from_cmp(e){
        this.props.date_from_cmp = e
        this.state.start_date_diff = this.props.date_from_cmp;
    }

    async fdate_to_cmp(e){
        this.props.date_to_cmp = e
        this.state.end_date_diff = this.props.date_to_cmp;
    }

}