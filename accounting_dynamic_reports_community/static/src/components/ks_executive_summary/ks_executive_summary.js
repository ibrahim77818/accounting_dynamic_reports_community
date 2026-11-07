/** @odoo-module **/

import { KsAmountMixin } from "@accounting_dynamic_reports_community/js/ks_utils";
import { Component, useState, onWillStart, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { getCurrency } from "@accounting_dynamic_reports_community/js/ks_utils";
import { formatMonetary } from "@web/views/fields/formatters";
import { formatFloat } from "@web/views/fields/formatters";
import { registry } from "@web/core/registry";
const { DateTime } = luxon;

export class KsExecutiveSummary extends Component {

    static props = {
        action: { type: Object, optional: true },
        ks_df_report_opt: { type: Object, optional: true },
        ks_report_lines : { type: Object, optional: true },
        ks_initial_balance : { type: Number, optional: true },
        ks_current_balance : { type: Number, optional: true },
        ks_ending_balance : { type: Number, optional: true },
        showesreport : { type: Boolean, optional: true },
        ksgetaction: { type: Function, optional: true },
        ksSetReportCurrencyConfig: { type: Function, optional: true },
        ksFormatCurrencySign: { type: Function, optional: true },
        ksSetExecutiveReportCurrencyConfig: { type: Function, optional: true },
    };

    static defaultProps = {

    };

    static template = "accounting_dynamic_reports_community.ks_df_es_action";

    setup() {
        onWillStart(() => {
            this.ksRenderExecutiveSummary();
        });
    }

    async ksRenderExecutiveSummary() {
        var self = this;
        if (parseFloat(String(self.props.ks_initial_balance)) > 0 || parseFloat(String(self.props.ks_current_balance)) > 0 ||
        parseFloat(String(self.props.ks_ending_balance)) > 0) {
            this.showesreport = true
        } else {
            this.showesreport = false
        }
    }

    async ksGetMoveLines(event) {
        let account = Object.values(this.props.ks_report_lines)
        return account;
    }

}
registry.category("components").add("Executive Summary", KsExecutiveSummary);

Object.assign(KsExecutiveSummary.prototype, KsAmountMixin);
