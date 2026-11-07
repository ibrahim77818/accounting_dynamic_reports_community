/** @odoo-module **/

import { KsAmountMixin } from "@accounting_dynamic_reports_community/js/ks_utils";
import { Component, useState, onWillStart, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { getCurrency } from "@accounting_dynamic_reports_community/js/ks_utils";
import { formatMonetary } from "@web/views/fields/formatters";
import { registry } from "@web/core/registry";
const { DateTime } = luxon;

export class KsAgePayable extends Component {

    static props = {
        action: { type: Object, optional: true },
        ks_df_informations: { type: Object, optional: true },
        ks_df_report_opt: { type: Object, optional: true },
        ksFormatCurrencySign: { type: Function, optional: true },
        ksSetReportCurrencyConfig: { type: Function, optional: true },
        ks_period_list: { type: Object, optional: true },
        ks_partner_dict: { type: Object, optional: true },
        ksgetaction: { type: Function, optional: true },
        ks_df_context: { type: Object, optional: true },
    };

    static defaultProps = {

    };

    static template = "accounting_dynamic_reports_community.ks_df_pay_action";

    setup() {
        this.orm = useService("orm");
        this.ks_lang = this.props.ks_df_context.lang;
        this.state = useState({
            count: {},
            account_data: [],
            period_list: [],
            visible: {},
            offsets: {},
        });
        onWillStart(()=>{
            this.props.ksSetReportCurrencyConfig();
        });

        for (let partnerId in this.props.ks_partner_dict) {
            let partnerData = this.props.ks_partner_dict[partnerId];

            if (typeof partnerData !== 'object') continue;

            let currency_id = partnerData.company_currency_id || 1;
            let ksFormatConfig = {
                currency_id,
                noSymbol: false,
            };

            for (let key of Object.keys(partnerData)) {
                if (this.props.ks_period_list.includes(key) || key === 'total') {
                    let value = partnerData[key];
                    partnerData[key + '_formatted'] = this.props.ksFormatCurrencySign(value || 0, ksFormatConfig, value < 0 ? '-' : '');
                }
            }
        }
        onWillUpdateProps((nextProps) => {
            for (let partnerId in nextProps.ks_partner_dict) {
                let partnerData = nextProps.ks_partner_dict[partnerId];

                let currency_id = partnerData.company_currency_id || 1;
                let ksFormatConfig = {
                    currency_id,
                    noSymbol: false,
                };

                for (let key of Object.keys(partnerData)) {
                    if (nextProps.ks_period_list.includes(key) || key === 'total') {
                        let value = partnerData[key];
                        partnerData[key + '_formatted'] = nextProps.ksFormatCurrencySign(value || 0, ksFormatConfig, value < 0 ? '-' : '');
                    }
                }
            }
        });
    }

    ksShowLines(event, account) {
        let partner_id = parseInt(event.currentTarget.dataset.bsPartnerId) || 0;
//        if (!this.state.visible[partner_id]) {
            this.state.visible[partner_id] = { isVisible: true, data: [], showLoadMore: false };
            this.state.offsets[partner_id] = 0;
            this.ksGetAgedLinesInfo(partner_id);
//        }
    }

    async ksGetAgedReportDetailedInfo(offset, partner_id) {
        var self = this;
        var lines = await this.orm.call("ks.dynamic.financial.reports", 'ks_process_aging_data', [this.props.action.context.id, this.props.ks_df_informations,
        offset, partner_id])
        return Promise.resolve(lines);
    }

    async ksGetAgedLinesInfo(partner_id, loadMore = false) {
        let offset = this.state.offsets[partner_id] || 0;
        let datas = await this.ksGetAgedReportDetailedInfo(offset, partner_id);
        let total_count = datas[0];
        let new_offset = datas[1];
        let account_data = datas[2];

        const partnerInfo = this.props.ks_partner_dict[partner_id];
        const ksFormatConfigurations = {
            currency_id: partnerInfo?.company_currency_id || 1,
            noSymbol: false
        };

        for (let line of account_data) {
            line.range_0 = this.props.ksFormatCurrencySign(line.range_0, ksFormatConfigurations, line.range_0 < 0 ? '-' : '');
            line.range_1 = this.props.ksFormatCurrencySign(line.range_1, ksFormatConfigurations, line.range_1 < 0 ? '-' : '');
            line.range_2 = this.props.ksFormatCurrencySign(line.range_2, ksFormatConfigurations, line.range_2 < 0 ? '-' : '');
            line.range_3 = this.props.ksFormatCurrencySign(line.range_3, ksFormatConfigurations, line.range_3 < 0 ? '-' : '');
            line.range_4 = this.props.ksFormatCurrencySign(line.range_4, ksFormatConfigurations, line.range_4 < 0 ? '-' : '');
            line.range_5 = this.props.ksFormatCurrencySign(line.range_5, ksFormatConfigurations, line.range_5 < 0 ? '-' : '');
            line.range_6 = this.props.ksFormatCurrencySign(line.range_6, ksFormatConfigurations, line.range_6 < 0 ? '-' : '');
        }


        if (!this.state.visible[partner_id]) {
            this.state.visible[partner_id] = { isVisible: true, data: [], showLoadMore: false };
        }

        if (loadMore && account_data.length > 0) {
            this.state.visible[partner_id].data = [...this.state.visible[partner_id].data, ...account_data];
            this.state.offsets[partner_id] = new_offset;
        } else if (!loadMore) {
            this.state.visible[partner_id].data = account_data;
            this.state.offsets[partner_id] = new_offset;
        }

        this.state.count[partner_id] = total_count;
        this.state.visible[partner_id].showLoadMore = this.state.visible[partner_id].data.length < total_count;

        this.render();
    }
}
registry.category("components").add("Age Payable", KsAgePayable);

Object.assign(KsAgePayable.prototype, KsAmountMixin);
