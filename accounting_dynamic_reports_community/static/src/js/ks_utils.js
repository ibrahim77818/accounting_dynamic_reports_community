/** @odoo-module **/

import { getCurrency as webGetCurrency } from "@web/core/currency";

/** Returns {symbol, position, digits} or undefined. */
export function getCurrency(currencyId) {
    const id = Array.isArray(currencyId) ? currencyId[0] : currencyId;
    return webGetCurrency(id);
}

/** CSS class used to colour an amount the same way in the web view, PDF and Excel. */
export function ksAmountClass(value) {
    const num = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
    if (!num || Number.isNaN(num)) {
        return "ks-zero";
    }
    return num < 0 ? "ks-neg" : "ks-pos";
}

import { formatFloat } from "@web/views/fields/formatters";

/**
 * Methods mixed into every report component so templates can format and
 * colour amounts consistently: ksFmt(value, symbol, position) and ksCls(value).
 */
export const KsAmountMixin = {
    ksFmt(value, symbol, position) {
        if (value === undefined || value === null || value === false || value === "") {
            return "-";
        }
        if (typeof value === "string") {
            if (!/^\s*-?\d+(\.\d+)?\s*$/.test(value)) {
                // already formatted by the component (trial balance, aged reports)
                return value;
            }
            value = parseFloat(value);
        }
        if (!value || Math.abs(value) < 0.005) {
            return "-";
        }
        const num = formatFloat(Math.abs(value), { digits: [69, 2] });
        const sign = value < 0 ? "-" : "";
        if (!symbol) {
            return sign + num;
        }
        return position === "after" ? `${sign}${num} ${symbol}` : `${sign}${symbol} ${num}`;
    },
    ksCls(value) {
        if (typeof value === "string") {
            if (!/[1-9]/.test(value)) {
                return "ks-amt ks-zero";
            }
            return /(^|[^\w])-\s*\S*\d/.test(value) || /^\s*\(/.test(value) ? "ks-amt ks-neg" : "ks-amt ks-pos";
        }
        if (!value || Math.abs(value) < 0.005) {
            return "ks-amt ks-zero";
        }
        return value < 0 ? "ks-amt ks-neg" : "ks-amt ks-pos";
    },
};
