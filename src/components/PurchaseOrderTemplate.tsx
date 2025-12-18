import React, { useMemo } from 'react';
import AuthorizedBy from 'src/components/AuthorizedBy';
import { computeItemsWithTaxes } from 'src/components/ProfessionalQuotationTemplate';
import TemplatePreviewWrapper from 'src/components/template-editor/TemplatePreviewWrapper';
import {
    ColumnConfig,
    TemplateConfig,
    createPurchaseOrderDefaultConfig,
    getColumnValue,
    getFieldLabel,
    getSectionLabel,
    getVisibleColumns,
    isFieldVisible,
    isSectionVisible,
    getOrderedFields,
    getFieldConfig,
    resolveTemplateConfig,
} from 'src/components/template-editor/field-types';
import { renderFieldNode } from 'src/components/template-editor/field-renderer';
import { mapFieldStyleToClasses, mapFieldStyleToInlineStyle } from 'src/components/template-editor/style-utils';
import { getSectionConfig } from 'src/components/template-editor/field-types';

interface POProps {
    data: any;
    templateConfig?: TemplateConfig;
    currencySymbol?: string;
}

const toNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
};

export const PurchaseOrderTemplate: React.FC<POProps> = ({ data, templateConfig, currencySymbol }) => {
    const purchaseData = data || {};
    const resolvedConfig = useMemo(
        () => resolveTemplateConfig(createPurchaseOrderDefaultConfig, templateConfig),
        [templateConfig],
    );

    const currency = currencySymbol || purchaseData.currencySymbol || '₹';
    const { gstType, itemsWithCalculations, totals } = computeItemsWithTaxes(purchaseData);
    const { subtotal, totalCgst, totalSgst, totalIgst, grandTotal } = totals;
    const shipping = toNumber(purchaseData.shippingCost) ?? 0;
    const finalTotal = grandTotal + shipping;

    const tableColumns = useMemo(
        () =>
            getVisibleColumns(resolvedConfig)
                .filter((column) => {
                    if (column.key === 'igst' && gstType !== 'IGST') return false;
                    if ((column.key === 'cgst' || column.key === 'sgst') && gstType !== 'CGST_SGST') return false;
                        return column.visible !== false;
                }),
        [resolvedConfig, gstType],
    );

    const formatCurrency = (value: unknown): string => {
        const numeric = toNumber(value) ?? 0;
        return `${currency}${numeric.toLocaleString('en-IN')}`;
    };

    const formatNumber = (value: unknown): string => {
        const numeric = toNumber(value);
        if (typeof numeric === 'number') {
            return numeric.toLocaleString('en-IN');
        }
        return String(value ?? '');
    };

    const renderCell = (
        item: any,
        columnKey: string,
        formatter: ColumnConfig['formatter'],
    ): React.ReactNode => {
        const rawValue = getColumnValue(item, columnKey, purchaseData);

        if (columnKey === 'service' || columnKey === 'description') {
            const title = rawValue || item.service || item.description || '';
            const description = item.description && item.description !== title ? item.description : '';
            const hsnWithinCell = !tableColumns.some((col) => col.key === 'hsn') && item.hsn;

            return (
                <div className="space-y-1">
                    <span className="block font-semibold text-black-800">{String(title || '')}</span>
                    {description ? (
                        <span className="block text-[11px] text-black-600">{description}</span>
                    ) : null}
                    {hsnWithinCell ? (
                        <span className="block text-[11px] text-black-500">HSN/SAC: {hsnWithinCell}</span>
                    ) : null}
                </div>
            );
        }

        if (columnKey === 'hsn') {
            return rawValue ? String(rawValue) : '';
        }

        if (columnKey === 'gstRate') {
            const numeric = toNumber(rawValue) ?? 0;
            return `${numeric.toLocaleString('en-IN')}%`;
        }

        if (formatter === 'currency') {
            return formatCurrency(rawValue);
        }

        if (formatter === 'number') {
            return formatNumber(rawValue);
        }

        return rawValue == null ? '' : String(rawValue);
    };

    const headerVisible = isSectionVisible(resolvedConfig, 'header', true);
    const supplierVisible = isSectionVisible(resolvedConfig, 'supplier', true);
    const shipToVisible = isSectionVisible(resolvedConfig, 'shipTo', true);
    const totalsVisible = isSectionVisible(resolvedConfig, 'totals', true);
    const notesVisible = isSectionVisible(resolvedConfig, 'notes', true) && Boolean(purchaseData.notes);

    const renderField = (sectionId: string, field: any) =>
        renderFieldNode({ sectionId, field, config: resolvedConfig, data: purchaseData, currency });

    const headerClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'header')?.style);
    const headerInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'header')?.style);
    const supplierInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'supplier')?.style);
    const shipToInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'shipTo')?.style);
    const totalsInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'totals')?.style);
    const notesInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'notes')?.style);
    const supplierClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'supplier')?.style);
    const shipToClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'shipTo')?.style);
    const totalsClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'totals')?.style);
    const notesClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'notes')?.style);

    return (
        <div className="bg-white p-6 font-sans text-xs text-black">
            <style>{`
              @media print {
                .print-avoid-break { break-inside: avoid; }
              }
            `}</style>

            {headerVisible && (
                <div className={`mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between ${headerClass}`} style={headerInline}>
                    <div className="space-y-0">
                        {getOrderedFields(resolvedConfig, 'header').map((field) => renderField('header', field))}
                    </div>
                    <div className="text-right">
                        {/* allow header fields to include title/logo entries as configured */}
                        {getOrderedFields(resolvedConfig, 'header').map((field) => renderField('header', field))}
                    </div>
                </div>
            )}

            {(supplierVisible || shipToVisible) && (
                <div className={`mb-6 grid grid-cols-2 gap-6 md:grid-cols-2 px-4 py-2 rounded ${supplierClass} ${shipToClass}`} style={{ ...supplierInline, ...shipToInline }}>
                    <div>
                        {supplierVisible && getOrderedFields(resolvedConfig, 'supplier').map((field) => renderField('supplier', field))}
                    </div>
                    <div>
                        {shipToVisible && getOrderedFields(resolvedConfig, 'shipTo').map((field) => renderField('shipTo', field))}
                    </div>
                </div>
            )}

            <section className="mb-6 print-avoid-break">
                <div className="overflow-hidden rounded border border-black-400">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-black-200 uppercase tracking-wide text-bold text-solid black">
                            <tr>
                                {tableColumns.map((column) => (
                                    <th
                                        key={column.key}
                                        className="text-center bg-violet-400 p-2"
                                        style={column.width ? { width: `${column.width}%` } : undefined}
                                    >
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {itemsWithCalculations.length === 0 ? (
                                <tr>
                                    <td colSpan={tableColumns.length} className="p-4 text-center text-sm text-black-500">
                                        No items added.
                                    </td>
                                </tr>
                            ) : (
                                itemsWithCalculations.map((item: any, index: number) => (
                                    <tr
                                        key={`${item.service}-${index}`}
                                        className={`avoid-break border-t border-black-200 ${index % 2 === 0 ? 'bg-white' : 'bg-violet-50'}`}
                                    >
                                        {tableColumns.map((column) => {
                                            const content = renderCell(item, column.key, column.formatter || 'text');
                                            const isNumeric = column.formatter === 'currency' || column.formatter === 'number';
                                            return (
                                                <td
                                                    key={column.key}
                                                    className={'text-center align-top p-2'}
                                                >
                                                    {content}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

                        {totalsVisible && (
                    <div className="flex justify-end">
                        <div className="w-72 text-sm">
                            <div className="rounded border border-gray-200 overflow-hidden shadow-sm bg-white">
                                <div className="divide-y divide-gray-200">
                                    {getOrderedFields(resolvedConfig, 'totals').map((field) => {
                                        if (field.visible === false) return null;
                                        const label = getFieldLabel(resolvedConfig, 'totals', field.key, field.label || '');
                                        let value: any = '';
                                        switch (field.key) {
                                            case 'subtotalLabel': value = formatCurrency(subtotal); break;
                                            case 'cgstLabel': value = formatCurrency(totalCgst); break;
                                            case 'sgstLabel': value = formatCurrency(totalSgst); break;
                                            case 'igstLabel': value = formatCurrency(totalIgst); break;
                                            case 'shippingLabel': value = formatCurrency(shipping); break;
                                            default: value = (purchaseData as any)[field.key] ?? field.defaultValue ?? '';
                                        }
                                        return (
                                            <div key={field.key} className="flex items-center justify-between px-4 py-2 text-gray-700">
                                                <span className="text-sm">{label}</span>
                                                <span className="font-medium">{value}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {getOrderedFields(resolvedConfig, 'totals').some(f => f.key === 'grandTotalLabel' && f.visible !== false) && (
                                    <div className="bg-gray-900 px-4 py-2.5 flex items-center justify-between text-white">
                                        <span className="text-sm font-semibold">{getFieldLabel(resolvedConfig, 'totals', 'grandTotalLabel', 'Grand Total')}</span>
                                        <span className="text-sm font-bold">{formatCurrency(finalTotal)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            <AuthorizedBy
                signatureUrl={purchaseData.authorizedSignatureUrl ?? resolvedConfig.authorizedBy?.signatureUrl}
                personName={purchaseData.authorizedPersonName ?? resolvedConfig.authorizedBy?.personName}
                designation={purchaseData.authorizedDesignation ?? resolvedConfig.authorizedBy?.designation}
                align={(resolvedConfig.authorizedBy?.align as any) ?? 'right'}
                label={resolvedConfig.authorizedBy?.label}
                visible={resolvedConfig.authorizedBy?.visible !== false}
            />

            {notesVisible && (
                <div className="no-print-footer mt-6 text-xs text-black-600" style={notesInline}>
                    <p>
                        <strong>{getFieldLabel(resolvedConfig, 'notes', 'notesHeading', 'Notes')}</strong>{' '}
                        {purchaseData.notes}
                    </p>
                </div>
            )}
        </div>
    );
};

export const PurchaseOrderTemplatePreview: React.FC = () => (
    <TemplatePreviewWrapper
        defaultConfigFactory={createPurchaseOrderDefaultConfig}
    />
);

export default PurchaseOrderTemplate;
