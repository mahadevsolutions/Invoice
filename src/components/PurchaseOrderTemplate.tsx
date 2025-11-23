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
    resolveTemplateConfig,
} from 'src/components/template-editor/field-types';

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
                    <span className="block font-semibold text-gray-800">{String(title || '')}</span>
                    {description ? (
                        <span className="block text-[11px] text-gray-600">{description}</span>
                    ) : null}
                    {hsnWithinCell ? (
                        <span className="block text-[11px] text-gray-500">HSN/SAC: {hsnWithinCell}</span>
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

    return (
        <div className="bg-white text-sm text-gray-800">
            {headerVisible && (
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-0">
                        {isFieldVisible(resolvedConfig, 'header', 'companyNameLabel') && (
                            <h1 className="text-2xl font-bold text-gray-900">
                                {purchaseData.companyName || getFieldLabel(resolvedConfig, 'header', 'companyNameLabel', 'Company')}
                            </h1>
                        )}
                        {isFieldVisible(resolvedConfig, 'header', 'companyAddressLabel') && purchaseData.companyAddress ? (
                            <p className="whitespace-pre-line text-gray-700">
                                {purchaseData.companyAddress}
                            </p>
                        ) : null}
                        <div className="flex flex-wrap gap-x-3 text-gray-700">
                            {isFieldVisible(resolvedConfig, 'header', 'companyEmailLabel') && purchaseData.companyEmail ? (
                                <span>
                                    <strong>{getFieldLabel(resolvedConfig, 'header', 'companyEmailLabel', 'Email')}:</strong>{''}
                                    {purchaseData.companyEmail}
                                </span>
                            ) : null}
                            {isFieldVisible(resolvedConfig, 'header', 'companyPhoneLabel') && purchaseData.companyPhone ? (
                                <span>
                                    <strong>{getFieldLabel(resolvedConfig, 'header', 'companyPhoneLabel', 'Phone')}:</strong>{' '}
                                    {purchaseData.companyPhone}
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <div className="text-right">
                        {isFieldVisible(resolvedConfig, 'header', 'title') && (
                            <h2 className="text-xl font-semibold text-gray-900">
                                {getFieldLabel(resolvedConfig, 'header', 'title', 'PURCHASE ORDER')}
                            </h2>
                        )}
                        {isFieldVisible(resolvedConfig, 'header', 'projectSubjectLabel') && (
                            <p className="text-gray-600">
                                <strong>{getFieldLabel(resolvedConfig, 'header', 'projectSubjectLabel', 'Subject')}:</strong>{' '}
                                {purchaseData.projectSubject || '---'}
                            </p>
                        )}
                        {isFieldVisible(resolvedConfig, 'header', 'poNumberLabel') && (
                            <p className="font-semibold text-gray-700">
                                {getFieldLabel(resolvedConfig, 'header', 'poNumberLabel', 'PO #')}: {purchaseData.quotationNumber || '---'}
                            </p>
                        )}
                        {isFieldVisible(resolvedConfig, 'header', 'dateLabel') && (
                            <p className="text-gray-600">
                                {getFieldLabel(resolvedConfig, 'header', 'dateLabel', 'Date')}: {purchaseData.date || '---'}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {(supplierVisible || shipToVisible) && (
                <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                    {supplierVisible && (
                        <div className="space-y-0">
                            {isFieldVisible(resolvedConfig, 'supplier', 'heading') && (
                                <h3 className="text-base font-bold text-gray-900">
                                    {getFieldLabel(resolvedConfig, 'supplier', 'heading', 'Supplier')}
                                </h3>
                            )}
                            {purchaseData.clientName ? <p className="font-semibold text-gray-800">{purchaseData.clientName}</p> : null}
                            {purchaseData.clientCompany ? <p className="text-gray-700">{purchaseData.clientCompany}</p> : null}
                            {isFieldVisible(resolvedConfig, 'supplier', 'addressLabel') && purchaseData.clientAddress ? (
                                <p className="whitespace-pre-line text-gray-700">
                                    {purchaseData.clientAddress}
                                </p>
                            ) : null}
                            {isFieldVisible(resolvedConfig, 'supplier', 'contactLabel') && purchaseData.clientPhone ? (
                                <p className="text-gray-700">
                                    <strong>{getFieldLabel(resolvedConfig, 'supplier', 'contactLabel', 'Contact')}:</strong>{' '}
                                    {purchaseData.clientPhone}
                                </p>
                            ) : null}
                        </div>
                    )}
                    {shipToVisible && (
                        <div className="space-y-2">
                            {isFieldVisible(resolvedConfig, 'shipTo', 'heading') && (
                                <h3 className="text-base font-bold text-gray-900">
                                    {getFieldLabel(resolvedConfig, 'shipTo', 'heading', 'Ship To')}
                                </h3>
                            )}
                            {isFieldVisible(resolvedConfig, 'shipTo', 'addressLabel') && purchaseData.deliveryAddress ? (
                                <p className="whitespace-pre-line text-gray-700">
                                    {purchaseData.deliveryAddress}
                                </p>
                            ) : null}
                            <div className="space-y-1">
                                {isFieldVisible(resolvedConfig, 'shipTo', 'requisitionerLabel') && purchaseData.requisitioner ? (
                                    <p>
                                        <strong>{getFieldLabel(resolvedConfig, 'shipTo', 'requisitionerLabel', 'Requisitioner')}:</strong>{' '}
                                        {purchaseData.requisitioner}
                                    </p>
                                ) : null}
                                <div className="flex flex-wrap gap-3">
                                    {isFieldVisible(resolvedConfig, 'shipTo', 'shipViaLabel') && purchaseData.shipVia ? (
                                        <p>
                                            <strong>{getFieldLabel(resolvedConfig, 'shipTo', 'shipViaLabel', 'Ship Via')}:</strong>{' '}
                                            {purchaseData.shipVia}
                                        </p>
                                    ) : null}
                                    {isFieldVisible(resolvedConfig, 'shipTo', 'fobLabel') && purchaseData.fob ? (
                                        <p>
                                            <strong>{getFieldLabel(resolvedConfig, 'shipTo', 'fobLabel', 'F.O.B.')}:</strong>{' '}
                                            {purchaseData.fob}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <section className="mb-6 print-avoid-break">
                <div className="overflow-hidden rounded border border-gray-300">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-gray-100 text-[11px] uppercase tracking-wide text-gray-600">
                            <tr>
                                {tableColumns.map((column) => (
                                    <th
                                        key={column.key}
                                        className="border-b border-gray-300 p-2"
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
                                    <td colSpan={tableColumns.length} className="p-4 text-center text-sm text-gray-500">
                                        No items added.
                                    </td>
                                </tr>
                            ) : (
                                itemsWithCalculations.map((item: any, index: number) => (
                                    <tr key={`${item.service}-${index}`} className="border-t border-gray-200">
                                        {tableColumns.map((column) => {
                                            const content = renderCell(item, column.key, column.formatter || 'text');
                                            const isNumeric = column.formatter === 'currency' || column.formatter === 'number';
                                            return (
                                                <td
                                                    key={column.key}
                                                    className={`${isNumeric ? 'text-right' : 'text-left'} align-top p-2`}
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
                        {isFieldVisible(resolvedConfig, 'totals', 'subtotalLabel') && (
                            <div className="flex justify-between border-b border-gray-200 py-1 text-gray-700">
                                <span>{getFieldLabel(resolvedConfig, 'totals', 'subtotalLabel', 'Subtotal')}</span>
                                <span className="font-medium">{formatCurrency(subtotal)}</span>
                            </div>
                        )}
                        {gstType === 'IGST' && isFieldVisible(resolvedConfig, 'totals', 'igstLabel') && (
                            <div className="flex justify-between border-b border-gray-200 py-1 text-gray-700">
                                <span>{getFieldLabel(resolvedConfig, 'totals', 'igstLabel', 'IGST')}</span>
                                <span className="font-medium">{formatCurrency(totalIgst)}</span>
                            </div>
                        )}
                        {gstType === 'CGST_SGST' && (
                            <>
                                {isFieldVisible(resolvedConfig, 'totals', 'cgstLabel') && (
                                    <div className="flex justify-between border-b border-gray-200 py-1 text-gray-700">
                                        <span>{getFieldLabel(resolvedConfig, 'totals', 'cgstLabel', 'CGST')}</span>
                                        <span className="font-medium">{formatCurrency(totalCgst)}</span>
                                    </div>
                                )}
                                {isFieldVisible(resolvedConfig, 'totals', 'sgstLabel') && (
                                    <div className="flex justify-between border-b border-gray-200 py-1 text-gray-700">
                                        <span>{getFieldLabel(resolvedConfig, 'totals', 'sgstLabel', 'SGST')}</span>
                                        <span className="font-medium">{formatCurrency(totalSgst)}</span>
                                    </div>
                                )}
                            </>
                        )}
                        {isFieldVisible(resolvedConfig, 'totals', 'shippingLabel') && (
                            <div className="flex justify-between border-b border-gray-200 py-1 text-gray-700">
                                <span>{getFieldLabel(resolvedConfig, 'totals', 'shippingLabel', 'Shipping')}</span>
                                <span className="font-medium">{formatCurrency(shipping)}</span>
                            </div>
                        )}
                        {isFieldVisible(resolvedConfig, 'totals', 'grandTotalLabel') && (
                            <div className="mt-2 flex justify-between border-t border-gray-300 py-2 text-base font-bold text-gray-900">
                                <span>{getFieldLabel(resolvedConfig, 'totals', 'grandTotalLabel', 'Total')}</span>
                                <span>{formatCurrency(finalTotal)}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <AuthorizedBy
                signatureUrl={purchaseData.authorizedSignatureUrl}
                personName={purchaseData.authorizedPersonName}
                align="right"
                label={resolvedConfig.authorizedBy?.label}
                visible={resolvedConfig.authorizedBy?.visible !== false}
            />

            {notesVisible && (
                <div className="no-print-footer mt-6 text-xs text-gray-600">
                    <p>
                        <strong>{getFieldLabel(resolvedConfig, 'notes', 'notesHeading', 'Notes')}:</strong>{' '}
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
