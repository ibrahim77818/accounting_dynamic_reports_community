/** @odoo-module **/

import { KsAmountMixin } from "@accounting_dynamic_reports_community/js/ks_utils";
import { Component, useState, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
const { DateTime } = luxon;

export class KsGeneralLedger extends Component {

     static props = {
        action: { type: Object, optional: true },
        ks_report_lines : { type: Object, optional: true },
        ks_df_report_opt: { type: Object, optional: true },
        ksFormatCurrencySign: { type: Function, optional: true },
        ks_enable_ledger_in_bal: { type: Boolean, optional: true },
        ks_df_context: { type: Object, optional: true },
        ksgetaction: { type: Function, optional: true },
        ksSetReportCurrencyConfig: { type: Function, optional: true },
     };

     static defaultProps = {

     };

    static template = "accounting_dynamic_reports_community.ks_df_gl_action";

    setup() {
        this.orm = useService("orm");
        this.ks_lang = this.props.ks_df_context.lang;
        this.ks_enable_ledger_in_bal = this.props.ks_enable_ledger_in_bal;
        this.state = useState({
            count: 0,
            account_data: this.props.ks_report_lines,
            period_list: [],
            visible: {},
            limit: 50,
        });

    }
    loadMoreLines() {
        this.state.limit += 50;
    }

}
registry.category("components").add("General Ledger", KsGeneralLedger);

Object.assign(KsGeneralLedger.prototype, KsAmountMixin);
