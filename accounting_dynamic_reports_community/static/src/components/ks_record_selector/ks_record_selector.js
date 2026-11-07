/** @odoo-module **/

import { Component, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";
import { AutoComplete } from "@web/core/autocomplete/autocomplete";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

/**
 * Small many2many tag selector for Odoo 16 (MultiRecordSelector only exists from 17).
 * Props: resModel, resIds, update(ids), [domain], [placeholder]
 */
export class KsRecordSelector extends Component {
    setup() {
        this.orm = useService("orm");
        this.state = useState({ records: [] });
        onWillStart(() => this.loadRecords(this.props.resIds));
        onWillUpdateProps((next) => {
            const cur = (this.props.resIds || []).join(",");
            if ((next.resIds || []).join(",") !== cur) {
                return this.loadRecords(next.resIds);
            }
        });
    }

    async loadRecords(ids) {
        ids = (ids || []).map((id) => parseInt(id, 10)).filter(Boolean);
        if (!ids.length) {
            this.state.records = [];
            return;
        }
        const records = await this.orm.read(this.props.resModel, ids, ["display_name"]);
        this.state.records = records.map((r) => ({ id: r.id, name: r.display_name }));
    }

    get sources() {
        return [
            {
                placeholder: _t("Loading..."),
                options: async (request) => {
                    const exclude = this.state.records.map((r) => r.id);
                    const domain = [...(this.props.domain || []), ["id", "not in", exclude]];
                    const results = await this.orm.call(this.props.resModel, "name_search", [], {
                        name: request || "",
                        args: domain,
                        limit: 8,
                    });
                    if (!results.length) {
                        return [{ label: _t("No records"), unselectable: true }];
                    }
                    return results.map(([id, name]) => ({ label: name, value: id }));
                },
            },
        ];
    }

    onSelect(option) {
        if (!option || !option.value) {
            return;
        }
        const ids = [...this.state.records.map((r) => r.id), option.value];
        this.props.update(ids);
    }

    remove(id) {
        this.props.update(this.state.records.filter((r) => r.id !== id).map((r) => r.id));
    }
}
KsRecordSelector.template = "accounting_dynamic_reports_community.KsRecordSelector";
KsRecordSelector.components = { AutoComplete };
KsRecordSelector.props = {
    resModel: String,
    resIds: { type: Array, optional: true },
    update: Function,
    domain: { type: Array, optional: true },
    placeholder: { type: String, optional: true },
};
