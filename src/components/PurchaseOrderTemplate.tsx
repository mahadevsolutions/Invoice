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

    const getColumnAlignment = (column: ColumnConfig): 'text-left' | 'text-right' | 'text-center' => {
        if (column.key === 'serialNumber') return 'text-center';
        if (column.key === 'service' || column.key === 'description') return 'text-left';
        if (column.formatter === 'currency' || column.formatter === 'number' || column.key === 'gstRate') return 'text-right';
        return 'text-left';
    };

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

    return (
        <div className="bg-white p-8 font-sans text-sm text-black">
            <style>{`
              @media print {
                .print-avoid-break { break-inside: avoid; }
              }
            `}</style>

            {headerVisible && (
                <div className="mb-4">
                    <div className="flex items-start justify-between">
                        <div>
                            {isFieldVisible(resolvedConfig, 'header', 'companyNameLabel') && (
                                <h1 className="text-3xl font-extrabold text-blue-600">
                                    {purchaseData.companyName || getFieldLabel(resolvedConfig, 'header', 'companyNameLabel', 'Company')}
                                </h1>
                            )}
                            {isFieldVisible(resolvedConfig, 'header', 'companyAddressLabel') && purchaseData.companyAddress ? (
                                <p className="whitespace-pre-line text-black text-sm mt-1">
                                    {purchaseData.companyAddress}
                                </p>
                            ) : null}
                        </div>

                        <div className="text-right">
                            {isFieldVisible(resolvedConfig, 'header', 'title') && (
                                <h2 className="text-3xl font-semibold text-blue-600">
                                    {getFieldLabel(resolvedConfig, 'header', 'title', 'PURCHASE ORDER')}
                                </h2>
                            )}
                            <div className="mt-2 text-sm text-black">
                                {isFieldVisible(resolvedConfig, 'header', 'poNumberLabel') && (
                                    <div className="font-semibold">{getFieldLabel(resolvedConfig, 'header', 'poNumberLabel', 'PO #')}: {purchaseData.quotationNumber || ''}</div>
                                )}
                                {isFieldVisible(resolvedConfig, 'header', 'dateLabel') && (
                                    <div className="font-semibold">{getFieldLabel(resolvedConfig, 'header', 'dateLabel', 'Date')}: {purchaseData.date || ''}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {(supplierVisible || shipToVisible) && (
                <div className="mb-6 grid grid-cols-2 gap-6 md:grid-cols-2 bg-emerald-100 px-6 py-6 rounded-lg">
                    {supplierVisible && (
                        <div className="space-y-1">
                            {isFieldVisible(resolvedConfig, 'supplier', 'heading') && (
                                <h3 className="text-sm font-bold text-black-900">
                                    {getSectionLabel(resolvedConfig, 'supplier', getFieldLabel(resolvedConfig, 'supplier', 'heading', 'BILLED TO'))}
                                </h3>
                            )}
                            {purchaseData.clientName ? <p className="font-semibold text-lg text-black-800">{purchaseData.clientName}</p> : null}
                            {purchaseData.clientCompany ? <p className="text-sm text-black-700">{purchaseData.clientCompany}</p> : null}
                            {isFieldVisible(resolvedConfig, 'supplier', 'addressLabel') && purchaseData.clientAddress ? (
                                <p className="whitespace-pre-line text-sm text-black-700">
                                    {purchaseData.clientAddress}
                                </p>
                            ) : null}
                            {isFieldVisible(resolvedConfig, 'supplier', 'contactLabel') && purchaseData.clientPhone ? (
                                <p className="text-sm text-black-700">
                                    <strong>{getFieldLabel(resolvedConfig, 'supplier', 'contactLabel', 'Contact')}:</strong>{' '}
                                    {purchaseData.clientPhone}
                                </p>
                            ) : null}
                        </div>
                    )}
                    {shipToVisible && (
                        <div className="space-y-1">
                            {isFieldVisible(resolvedConfig, 'shipTo', 'heading') && (
                                <h3 className="text-sm font-bold text-black-900">
                                    {getSectionLabel(resolvedConfig, 'shipTo', 'SHIP TO') || getFieldLabel(resolvedConfig, 'shipTo', 'heading', 'SHIP TO')}
                                </h3>
                            )}
                            {isFieldVisible(resolvedConfig, 'shipTo', 'addressLabel') && purchaseData.deliveryAddress ? (
                                <p className="whitespace-pre-line text-sm text-black-700">
                                    {purchaseData.deliveryAddress}
                                </p>
                            ) : null}
                            <div className="space-y-1">
                                {isFieldVisible(resolvedConfig, 'shipTo', 'requisitionerLabel') && purchaseData.requisitioner ? (
                                    <p className="text-sm">
                                        <strong>{getFieldLabel(resolvedConfig, 'shipTo', 'requisitionerLabel', 'Requisitioner')}:</strong>{' '}
                                        {purchaseData.requisitioner}
                                    </p>
                                ) : null}
                                <div className="flex flex-wrap gap-3 text-sm text-black-700">
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
              {/* Card wrapper */}
              <div className="rounded border border-gray-200 overflow-hidden shadow-sm bg-white">
            
                {/* Content rows (uses divide to render lines between rows) */}
                <div className="divide-y divide-gray-200">
                  {isFieldVisible(resolvedConfig, 'totals', 'subtotalLabel') && (
                    <div className="flex items-center justify-between px-4 py-2 text-gray-700">
                      <span className="text-sm">{getFieldLabel(resolvedConfig, 'totals', 'subtotalLabel', 'Subtotal')}</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                  )}

                  {gstType === 'IGST' && isFieldVisible(resolvedConfig, 'totals', 'igstLabel') && (
                    <div className="flex items-center justify-between px-4 py-2 text-gray-700">
                      <span className="text-sm">{getFieldLabel(resolvedConfig, 'totals', 'igstLabel', 'IGST')}</span>
                      <span className="font-medium">{formatCurrency(totalIgst)}</span>
                    </div>
                  )}

                  {gstType === 'CGST_SGST' && (
                    <>
                      {isFieldVisible(resolvedConfig, 'totals', 'cgstLabel') && (
                        <div className="flex items-center justify-between px-4 py-2 text-gray-700">
                          <span className="text-sm">{getFieldLabel(resolvedConfig, 'totals', 'cgstLabel', 'CGST')}</span>
                          <span className="font-medium">{formatCurrency(totalCgst)}</span>
                        </div>
                      )}
                      {isFieldVisible(resolvedConfig, 'totals', 'sgstLabel') && (
                        <div className="flex items-center justify-between px-4 py-2 text-gray-700">
                          <span className="text-sm">{getFieldLabel(resolvedConfig, 'totals', 'sgstLabel', 'SGST')}</span>
                          <span className="font-medium">{formatCurrency(totalSgst)}</span>
                        </div>
                      )}
                    </>
                  )}

                  {isFieldVisible(resolvedConfig, 'totals', 'shippingLabel') && (
                    <div className="flex items-center justify-between px-4 py-2 text-gray-700">
                      <span className="text-sm">{getFieldLabel(resolvedConfig, 'totals', 'shippingLabel', 'Shipping')}</span>
                      <span className="font-medium">{formatCurrency(shipping)}</span>
                    </div>
                  )}
                </div>
              
                {/* Grand Total row */}
                {isFieldVisible(resolvedConfig, 'totals', 'grandTotalLabel') && (
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
                signatureUrl={purchaseData.authorizedSignatureUrl}
                personName={purchaseData.authorizedPersonName}
                align="right"
                label={resolvedConfig.authorizedBy?.label}
                visible={resolvedConfig.authorizedBy?.visible !== false}
            />

            {notesVisible && (
                <div className="no-print-footer mt-6 text-xs text-black-600">
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