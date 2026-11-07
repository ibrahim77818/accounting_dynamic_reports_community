/** @odoo-module **/

import { download } from "@web/core/network/download";
import { registry } from "@web/core/registry";

const actionRegistry = registry.category("actions");

async function ks_executexlsxReportDownloadAction(parent, action) {


    await download({
        url: "/accounting_dynamic_reports_community",
        data: action.data,
    });
};
actionRegistry.add("ks_executexlsxReportDownloadAction", ks_executexlsxReportDownloadAction);

