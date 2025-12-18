import React, { useMemo } from 'react';
import { computeItemsWithTaxes } from 'src/components/ProfessionalQuotationTemplate';
import AuthorizedBy from 'src/components/AuthorizedBy';
import TemplatePreviewWrapper from 'src/components/template-editor/TemplatePreviewWrapper';
import {
  ColumnConfig,
  TemplateConfig,
  createTaxInvoiceDefaultConfig,
  getColumnValue,
  getFieldLabel,
  getSectionLabel,
  getVisibleColumns,
  isFieldVisible,
  isSectionVisible,
  getOrderedFields,
  getFieldConfig,
  getSectionConfig,
  resolveTemplateConfig,
} from 'src/components/template-editor/field-types';
import { mapFieldStyleToClasses, mapFieldStyleToInlineStyle } from 'src/components/template-editor/style-utils';
import { renderFieldNode } from 'src/components/template-editor/field-renderer';

interface TaxInvoiceProps {
  data: any;
  templateConfig?: TemplateConfig;
  currencySymbol?: string;
}

const numberToWords = (num: number): string => {
  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return 'number too large';
  };

  const numStr = Math.floor(num).toString();
  if (numStr.length > 7) return 'number too large';
  const [integerPart, decimalPart] = num.toString().split('.');
  let words = inWords(Number(integerPart));
  const decimalValue = decimalPart ? Number(decimalPart.slice(0, 2)) : 0;
  if (decimalValue > 0) {
    words += ' and ' + inWords(decimalValue) + ' paise';
  }
  return words.toUpperCase() + ' ONLY';
};

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

export const TaxInvoiceTemplate: React.FC<TaxInvoiceProps> = ({ data, templateConfig, currencySymbol }) => {
  const invoiceData = data || {};
  const resolvedConfig = useMemo(
    () => resolveTemplateConfig(createTaxInvoiceDefaultConfig, templateConfig),
    [templateConfig],
  );

  const currency = currencySymbol || invoiceData.currencySymbol || '₹';
  const { gstType, itemsWithCalculations, totals, hsnSummary } = computeItemsWithTaxes(invoiceData);
  const { subtotal, totalCgst, totalSgst, totalIgst, grandTotal } = totals;
  const roundOff = toNumber(invoiceData.roundOff) ?? 0;
  const payableTotal = grandTotal + roundOff;
  const totalTax = (totalCgst || 0) + (totalSgst || 0) + (totalIgst || 0);
  const amountInWords = numberToWords(payableTotal);
  const taxInWords = numberToWords(totalTax);

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

  // --- NEW: sync HSN visibility with tableColumns ---
  const showHSN = tableColumns.some((col) => col.key === 'hsn');

  // map section styles to classes
  const headerClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'header')?.style);
  const headerInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'header')?.style);
  const companyClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'companyDetails')?.style);
  const companyInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'companyDetails')?.style);
  const consigneeClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'consignee')?.style);
  const consigneeInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'consignee')?.style);
  const buyerClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'buyer')?.style);
  const buyerInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'buyer')?.style);
  const orderMetaClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'orderMeta')?.style);
  const orderMetaInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'orderMeta')?.style);
  const amountInWordsClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'amountInWords')?.style);
  const amountInWordsInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'amountInWords')?.style);
  const bankDetailsClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'bankDetails')?.style);
  const bankDetailsInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'bankDetails')?.style);

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
    const rawValue = getColumnValue(item, columnKey, invoiceData);

    if (columnKey === 'service' || columnKey === 'description') {
      const title = rawValue || item.service || item.description || '';
      const description = item.description && item.description !== title ? item.description : '';
      // if HSN column is hidden in tableColumns, show HSN inside the service/description cell
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
  const companySectionVisible = isSectionVisible(resolvedConfig, 'companyDetails', true);
  const consigneeVisible = isSectionVisible(resolvedConfig, 'consignee', true);
  const buyerVisible = isSectionVisible(resolvedConfig, 'buyer', true);
  const orderMetaVisible = isSectionVisible(resolvedConfig, 'orderMeta', true);
  const totalsVisible = isSectionVisible(resolvedConfig, 'totals', true);
  const amountInWordsVisible = isSectionVisible(resolvedConfig, 'amountInWords', true);
  const bankDetailsVisible = isSectionVisible(resolvedConfig, 'bankDetails', true);

  const renderField = (sectionId: string, field: any) =>
    renderFieldNode({ sectionId, field, config: resolvedConfig, data: invoiceData, currency });

  return (
    <div className="bg-white p-6 font-sans text-xs text-black">
      <style>{`
        @media print {
          .print-avoid-break { break-inside: avoid; }
        }
        .text-xxs { font-size: 0.65rem; }
      `}</style>

      {headerVisible && (
        <header className={`mb-4 text-center avoid-break ${headerClass}`} style={headerInline}>
            {getOrderedFields(resolvedConfig, 'header').map((field) => renderField('header', field))}
          </header>
      )}

      {companySectionVisible && (
        <section className={`mb-4 border-y border-gray-400 py-2 text-center text-xxs text-black avoid-break ${companyClass}`} style={companyInline}>
          {getOrderedFields(resolvedConfig, 'companyDetails').map((field) => renderField('companyDetails', field))}
        </section>
      )}

      <section className="mb-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-3 avoid-break">
        {consigneeVisible && (
          <div className={`p-2 ${consigneeClass}`} style={consigneeInline}>
            <h3 className="mb-1 border-b border-gray-300 pb-1 font-bold text-gray-900">
              {getSectionLabel(resolvedConfig, 'consignee', 'Consignee (Ship to)')}
            </h3>
            {getOrderedFields(resolvedConfig, 'consignee').map((field) => renderField('consignee', field))}
          </div>
        )}

        {buyerVisible && (
          <div className={`p-2 ${buyerClass}`} style={buyerInline}>
            <h3 className="mb-1 border-b border-gray-300 pb-1 font-bold text-gray-900">
              {getSectionLabel(resolvedConfig, 'buyer', 'Buyer (Bill to)')}
            </h3>
            {getOrderedFields(resolvedConfig, 'buyer').map((field) => renderField('buyer', field))}
          </div>
        )}

        {orderMetaVisible && (
          <div className={`p-2 text-xs text-gray-700 ${orderMetaClass}`} style={orderMetaInline}>
            {getOrderedFields(resolvedConfig, 'orderMeta').map((field) => renderField('orderMeta', field))}
          </div>
        )}
      </section>

      <section className="mb-3">
        <div className="overflow-hidden rounded border border-gray-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-gray-200 uppercase tracking-wide text-bold text-solid black">
              <tr className="avoid-break">
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
                  <td colSpan={tableColumns.length} className="p-3 text-center text-gray-500">
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

      {Object.keys(hsnSummary).length > 0 && (
        <section className="mb-3">
          <div className="overflow-hidden rounded border border-black-400">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-black-200 uppercase tracking-wide text-bold text-solid black">
                <tr className="avoid-break">

                  {/* HSN column synced with first table */}
                  {showHSN && (
                    <th className="bg-violet-400 p-2 text-center">HSN</th>
                  )}

                  <th className="bg-violet-400 p-2 text-center">Taxable Value</th>

                  {gstType === 'IGST' ? (
                    <>
                      <th className="bg-violet-400 p-2 text-center">IGST Rate</th>
                      <th className="bg-violet-400 p-2 text-center">IGST Amount</th>
                    </>
                  ) : (
                    <>
                      <th className="bg-violet-400 p-2 text-center">CGST Rate</th>
                      <th className="bg-violet-400 p-2 text-center">CGST Amount</th>
                      <th className="bg-violet-400 p-2 text-center">SGST Rate</th>
                      <th className="bg-violet-400 p-2 text-center">SGST Amount</th>
                    </>
                  )}

                  <th className="bg-violet-400 p-2 text-center">Total Tax</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(hsnSummary).map(([hsn, summary], idx) => (
                  <tr
                    key={hsn}
                    className={`avoid-break border-t border-black-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-violet-50'}`}
                  >
                    {/* HSN synced with first table */}
                    {showHSN && (
                      <td className="border border-black-200 p-2 text-center">{hsn}</td>
                    )}

                    <td className="border border-black-200 p-2 text-center">{formatCurrency(summary.taxableValue)}</td>

                    {gstType === 'IGST' ? (
                      <>
                        <td className="border border-black-200 p-2 text-center">{formatNumber(summary.rate)}%</td>
                        <td className="border border-black-200 p-2 text-center">{formatCurrency(summary.igst)}</td>
                      </>
                    ) : (
                      <>
                        <td className="border border-black-200 p-2 text-center">{formatNumber(summary.rate)}%</td>
                        <td className="border border-black-200 p-2 text-center">{formatCurrency(summary.cgst)}</td>
                        <td className="border border-black-200 p-2 text-center">{formatNumber(summary.rate)}%</td>
                        <td className="border border-black-200 p-2 text-center">{formatCurrency(summary.sgst)}</td>
                      </>
                    )}

                    <td className="border border-black-200 p-2 text-center">
                      {formatCurrency((summary.cgst || 0) + (summary.sgst || 0) + (summary.igst || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {totalsVisible && (
        <section className="mb-3 flex justify-end avoid-break">
          <div className="w-full max-w-xs overflow-hidden rounded border border-gray-300 bg-white shadow-sm">
            <div className="bg-gray-100 px-4 py-2 text-[0.8rem] font-bold uppercase tracking-wide text-gray-800">
              Tax Summary
            </div>
            <dl className="divide-y divide-gray-200 text-[0.8rem]">
              {getOrderedFields(resolvedConfig, 'totals').map((field) => {
                if (field.visible === false) return null;
                const label = getFieldLabel(resolvedConfig, 'totals', field.key, field.label || '');
                let value: any = '';
                switch (field.key) {
                  case 'subtotalLabel':
                    value = formatCurrency(subtotal);
                    break;
                  case 'cgstLabel':
                    value = formatCurrency(totalCgst);
                    break;
                  case 'sgstLabel':
                    value = formatCurrency(totalSgst);
                    break;
                  case 'igstLabel':
                    value = formatCurrency(totalIgst);
                    break;
                  case 'totalTaxLabel':
                    value = formatCurrency(totalTax);
                    break;
                  case 'roundOffLabel':
                    if (roundOff === 0 && invoiceData.roundOff == null) return null;
                    value = formatCurrency(roundOff);
                    break;
                  case 'grandTotalLabel':
                    value = formatCurrency(payableTotal);
                    break;
                  default:
                    // fallback to invoiceData or default
                    value = (invoiceData as any)[field.key] ?? field.defaultValue ?? '';
                }

                return (
                  <div key={field.key} className="flex items-center justify-between px-4 py-2">
                    <dt className="text-gray-600">{label}</dt>
                    <dd className="font-semibold text-gray-900">{value}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </section>
      )}

      {amountInWordsVisible && (
        <>
          <section className="mb-2 border-t border-gray-400 pt-2 avoid-break">
            {getOrderedFields(resolvedConfig, 'amountInWords').map((field) => {
              if (field.visible === false) return null;
              const label = getFieldLabel(resolvedConfig, 'amountInWords', field.key, field.label || '');
              let value: any = '';
              if (field.key === 'amountChargeableLabel') value = amountInWords;
              else if (field.key === 'taxAmountLabel') value = taxInWords;
              else value = (invoiceData as any)[field.key] ?? field.defaultValue ?? '';
              return (
                <p key={field.key} className="font-bold text-gray-800">
                  {label} 
                  <span className="font-normal text-gray-700">{value}</span>
                </p>
              );
            })}
          </section>
        </>
      )}

      <AuthorizedBy
          signatureUrl={invoiceData.authorizedSignatureUrl ?? resolvedConfig.authorizedBy?.signatureUrl}
          personName={invoiceData.authorizedPersonName ?? resolvedConfig.authorizedBy?.personName}
          designation={invoiceData.authorizedDesignation ?? resolvedConfig.authorizedBy?.designation}
          align={(resolvedConfig.authorizedBy?.align as any) ?? 'right'}
          label={resolvedConfig.authorizedBy?.label}
          visible={resolvedConfig.authorizedBy?.visible !== false}
      />

      {bankDetailsVisible && (
        <footer className="border-t border-gray-400 pt-2 text-xs text-gray-700 avoid-break">
          <div>
            <h4 className="mb-1 font-bold text-gray-900">
              {getSectionLabel(resolvedConfig, 'bankDetails', "Company's Bank Details")}
            </h4>
            {getOrderedFields(resolvedConfig, 'bankDetails').map((field) => renderField('bankDetails', field))}
          </div>
        </footer>
      )}
    </div>
  );
};

export const TaxInvoiceTemplatePreview: React.FC = () => (
  <TemplatePreviewWrapper
    defaultConfigFactory={createTaxInvoiceDefaultConfig}
  />
);

export default TaxInvoiceTemplate;
