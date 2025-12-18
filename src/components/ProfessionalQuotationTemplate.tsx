import React, { useMemo } from 'react';
import {
  computeItemsWithTaxes as computeItemsWithTaxesUtil,
  GstType,
} from 'src/components/ItemsTable';
import AuthorizedBy from 'src/components/AuthorizedBy';
import TemplatePreviewWrapper from 'src/components/template-editor/TemplatePreviewWrapper';
import {
  TemplateConfig,
  ColumnConfig,
  createProfessionalQuotationDefaultConfig,
  getFieldLabel,
  getSectionLabel,
  getVisibleColumns,
  isFieldVisible,
  isSectionVisible,
  getColumnValue,
  getOrderedFields,
  getFieldConfig,
  resolveTemplateConfig,
} from 'src/components/template-editor/field-types';
import { renderFieldNode } from 'src/components/template-editor/field-renderer';
import { mapFieldStyleToClasses, mapFieldStyleToInlineStyle } from 'src/components/template-editor/style-utils';
import { getSectionConfig } from 'src/components/template-editor/field-types';

export function computeItemsWithTaxes(data: any) {
  const items = data?.items || [];
  const rawGstType = data?.gstType;
  const gstType: GstType = rawGstType === 'IGST'
    ? 'IGST'
    : rawGstType === 'NONE'
    ? 'NONE'
    : rawGstType
    ? 'CGST_SGST'
    : 'NONE';

  const result = computeItemsWithTaxesUtil(items, gstType, data?.globalTaxRate || 0);

  return {
    gstType,
    ...result,
  };
}

const numberToWords = (num: number): string => {
  if (!Number.isFinite(num)) return 'ZERO RUPEES ONLY';
  const n = Math.floor(Math.abs(num));

  if (n === 0) return 'ZERO RUPEES ONLY';

  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  const inWords = (x: number): string => {
    if (x < 20) return a[x];
    if (x < 100) return b[Math.floor(x / 10)] + (x % 10 !== 0 ? ' ' + a[x % 10] : '');
    if (x < 1000) return a[Math.floor(x / 100)] + ' hundred' + (x % 100 !== 0 ? ' and ' + inWords(x % 100) : '');
    if (x < 100000) return inWords(Math.floor(x / 1000)) + ' thousand' + (x % 1000 !== 0 ? ' ' + inWords(x % 1000) : '');
    if (x < 10000000) return inWords(Math.floor(x / 100000)) + ' lakh' + (x % 100000 !== 0 ? ' ' + inWords(x % 100000) : '');
    return 'number too large';
  };

  // support up to crores if needed — staying consistent with previous limit
  if (n >= 10000000) return 'NUMBER TOO LARGE';

  const word = inWords(n);
  return (word + ' rupees only').toUpperCase();
};

interface QuotationProps {
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

export const ProfessionalQuotationTemplate: React.FC<QuotationProps> = ({
  data,
  templateConfig,
  currencySymbol,
}) => {
  const invoiceData = data || {};
  const resolvedConfig = useMemo(
    () => resolveTemplateConfig(createProfessionalQuotationDefaultConfig, templateConfig),
    [templateConfig],
  );

  const currency = currencySymbol || invoiceData.currencySymbol || '₹';
  const logoSrc = invoiceData.logoSrc || 'https://placehold.co/150x50/000000/FFFFFF?text=MAHADEV';
  const { gstType, itemsWithCalculations, totals } = computeItemsWithTaxes(invoiceData);
  const { subtotal, totalCgst, totalSgst, totalIgst, grandTotal } = totals;
  const totalTax = (totalCgst || 0) + (totalSgst || 0) + (totalIgst || 0);
  const totalTaxInWords = numberToWords(totalTax);
  const totalAmountInWords = numberToWords(grandTotal || 0);

  const tableColumns = useMemo(
    () =>
      getVisibleColumns(resolvedConfig)
        .filter((column) => column.key !== 'hsn')
        .filter((column) => {
          if (column.key === 'igst' && gstType !== 'IGST') return false;
          if ((column.key === 'cgst' || column.key === 'sgst') && gstType !== 'CGST_SGST') return false;
          return column.visible !== false;
        }),
    [resolvedConfig, gstType],
  );

  const getColumnAlignment = (column: ColumnConfig): 'text-left' | 'text-right' | 'text-center' => {
    if (column.key === 'serialNumber') {
      return 'text-center';
    }
    if (column.formatter === 'currency' || column.formatter === 'number' || column.key === 'gstRate') {
      return 'text-right';
    }
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
    const rawValue = getColumnValue(item, columnKey, invoiceData);

    if (columnKey === 'service' || columnKey === 'description') {
      const title = rawValue || item.service || item.description || '';
      const description = item.description && item.description !== title ? item.description : '';
      const productCode = item.itemNumber || item.productCode || item.hsn;

      return (
        <div className="space-y-1">
          <span className="block font-bold text-gray-800">{String(title || '')}</span>
          {description ? (
            <span className="block text-[11px] text-gray-600">{description}</span>
          ) : null}
          {productCode ? (
            <span className="block text-[11px] font-medium text-gray-700">Product Code: {productCode}</span>
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

  const headerVisible = isSectionVisible(resolvedConfig, 'header');
  const headerTitleVisible = isFieldVisible(resolvedConfig, 'header', 'title');
  const headerNumberVisible = isFieldVisible(resolvedConfig, 'header', 'quotationNumberLabel');
  const headerDateVisible = isFieldVisible(resolvedConfig, 'header', 'quotationDateLabel');
  const quotationFromVisible = isSectionVisible(resolvedConfig, 'quotationFrom');
  const quotationForVisible = isSectionVisible(resolvedConfig, 'quotationFor');
  const itemsSummaryVisible = isSectionVisible(resolvedConfig, 'itemsSummary');
  const totalsSectionVisible = isSectionVisible(resolvedConfig, 'totals');
  const notesSectionVisible = isSectionVisible(resolvedConfig, 'notes') && Boolean(invoiceData.notes);

  const renderField = (sectionId: string, field: any) =>
    renderFieldNode({ sectionId, field, config: resolvedConfig, data: invoiceData, currency });

  const headerClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'header')?.style);
  const headerInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'header')?.style);
  const quotationFromClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'quotationFrom')?.style);
  const quotationFromInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'quotationFrom')?.style);
  const quotationForClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'quotationFor')?.style);
  const quotationForInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'quotationFor')?.style);
  const totalsClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'totals')?.style);
  const totalsInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'totals')?.style);
  const notesClass = mapFieldStyleToClasses(getSectionConfig(resolvedConfig, 'notes')?.style);
  const notesInline = mapFieldStyleToInlineStyle(getSectionConfig(resolvedConfig, 'notes')?.style);

  return (
    <div className="bg-white p-6 font-sans text-xs text-black">
      <style>{`
        @media print {
          .print-avoid-break { break-inside: avoid; }
        }
        .text-xxs { font-size: 0.65rem; }
      `}</style>
      {headerVisible && (
        <header className={`mb-4 flex items-start justify-between pb-4 print-avoid-break ${headerClass}`} style={headerInline}>
          <div className="w-1/2 space-y-3">
            {getOrderedFields(resolvedConfig, 'header').map((field) => renderField('header', field))}
          </div>
          <div className="w-1/2 text-right">
            {/* allow header fields to contain logo or title items */}
            {getOrderedFields(resolvedConfig, 'header').map((field) => renderField('header', field))}
          </div>
        </header>
      )}

      {(quotationFromVisible) && (
        <section className="mb-4 grid grid-cols-1 gap-8 md:grid-cols-2 p-4 rounded-lg">
          <div className={quotationFromClass} style={quotationFromInline}>
            <h3 className="mb-2 border-b border-gray-600 pb-1 text-sm font-bold uppercase">{getSectionLabel(resolvedConfig, 'quotationFrom', 'Quotation From')}</h3>
            {getOrderedFields(resolvedConfig, 'quotationFrom').map((field) => renderField('quotationFrom', field))}
          </div>
          <div className={quotationForClass} style={quotationForInline}>
            <h3 className="mb-2 border-b border-gray-600 pb-1 text-sm font-bold uppercase">{getSectionLabel(resolvedConfig, 'quotationFor', 'Quotation For')}</h3>
            {getOrderedFields(resolvedConfig, 'quotationFor').map((field) => renderField('quotationFor', field))}
          </div>
        </section>
      )}

      <section className="print-avoid-break">
        <div className="overflow-hidden rounded border border-gray-300">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-gray-200 uppercase tracking-wide font-bold text-black">
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
                  <td colSpan={tableColumns.length} className="p-4 text-center text-sm text-gray-500">
                    No items added.
                  </td>
                </tr>
              ) : (
                itemsWithCalculations.map((item: any, rowIndex: number) => (
                  <tr
                    key={`${item.service}-${rowIndex}`}
                    className={`avoid-break border-t border-black-200 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-violet-50'}`}
                  >
                    {tableColumns.map((column) => {
                      const content = renderCell(item, column.key, column.formatter || 'text');
                      const alignment = getColumnAlignment(column);
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

    {totalsSectionVisible && (
        <section className="mt-4 flex justify-end print-avoid-break">
          <div className={`w-72 text-sm ${totalsClass}`} style={totalsInline}>
            <div className="rounded border border-gray-200 overflow-hidden shadow-sm bg-white">
              <div className="divide-y divide-gray-200">
                {getOrderedFields(resolvedConfig, 'totals').map((field) => {
                  if (field.visible === false) return null;
                  const label = getFieldLabel(resolvedConfig, 'totals', field.key, field.label || '');
                  let value: any = '';
                  switch (field.key) {
                    case 'amountLabel': value = formatCurrency(subtotal); break;
                    case 'cgstLabel': value = formatCurrency(totalCgst); break;
                    case 'sgstLabel': value = formatCurrency(totalSgst); break;
                    case 'igstLabel': value = formatCurrency(totalIgst); break;
                    case 'totalTaxLabel': value = formatCurrency(totalTax); break;
                    default: value = (invoiceData as any)[field.key] ?? field.defaultValue ?? '';
                  }
                  return (
                    <div key={field.key} className="flex items-center justify-between px-4 py-2 text-gray-700">
                      <span className="text-sm">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  );
                })}

                {getOrderedFields(resolvedConfig, 'totals').some(f => f.key === 'grandTotalLabel' && f.visible !== false) && (
                  <div className="bg-gray-900 px-4 py-2.5 flex items-center justify-between text-white">
                    <span className="text-sm font-semibold">{getFieldLabel(resolvedConfig, 'totals', 'grandTotalLabel', 'Total (INR)')}</span>
                    <span className="text-sm font-bold">{formatCurrency(grandTotal)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
    )}



      <div className="mt-6">
        <AuthorizedBy
          signatureUrl={invoiceData.authorizedSignatureUrl ?? resolvedConfig.authorizedBy?.signatureUrl}
          personName={invoiceData.authorizedPersonName ?? resolvedConfig.authorizedBy?.personName}
          designation={invoiceData.authorizedDesignation ?? resolvedConfig.authorizedBy?.designation}
          align={(resolvedConfig.authorizedBy?.align as any) ?? 'right'}
          label={resolvedConfig.authorizedBy?.label}
          visible={resolvedConfig.authorizedBy?.visible !== false}
        />
      </div>

      {notesSectionVisible && (
        <section className="mt-8 print-avoid-break">
          <h4 className="mb-1 text-sm font-bold text-gray-800">
            {getFieldLabel(resolvedConfig, 'notes', 'notesHeading', 'Terms & Conditions')}
          </h4>
          <p className={`whitespace-pre-line rounded-lg border border-gray-200 p-3 text-xs text-gray-700 ${notesClass}`} style={notesInline}>
            {invoiceData.notes}
          </p>
        </section>
      )}
    </div>
  );
};

export const ProfessionalQuotationTemplatePreview: React.FC = () => (
  <TemplatePreviewWrapper
    defaultConfigFactory={createProfessionalQuotationDefaultConfig}
  />
);

export default ProfessionalQuotationTemplate;
