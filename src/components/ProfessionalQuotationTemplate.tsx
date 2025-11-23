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
  resolveTemplateConfig,
} from 'src/components/template-editor/field-types';

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
  const word = inWords(Math.floor(num));
  return word.toUpperCase() + ' RUPEES ONLY';
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
  const totalTax = totalCgst + totalSgst + totalIgst;
  const totalTaxInWords = numberToWords(totalTax);

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
          <span className="block font-semibold text-gray-800">{String(title || '')}</span>
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

  return (
    <div className="bg-white p-8 font-sans text-xs text-gray-800">
      {headerVisible && (
        <header className="mb-4 flex items-start justify-between pb-4">
          <div className="w-1/2 space-y-3">
            {headerTitleVisible && (
              <h1 className="text-3xl font-bold uppercase text-blue-700">
                {invoiceData.invoiceTitle || getFieldLabel(resolvedConfig, 'header', 'title', 'Quotation')}
              </h1>
            )}
            <div className="space-y-1">
              {headerNumberVisible && (
                <p>
                  <strong>{getFieldLabel(resolvedConfig, 'header', 'quotationNumberLabel', 'Quotation #')}:</strong>{' '}
                  {invoiceData.quotationNumber || '---'}
                </p>
              )}
              {headerDateVisible && (
                <p>
                  <strong>{getFieldLabel(resolvedConfig, 'header', 'quotationDateLabel', 'Quotation Date')}:</strong>{' '}
                  {invoiceData.date || '---'}
                </p>
              )}
            </div>
          </div>
          <div className="w-1/2 text-right">
            <img
              src={logoSrc}
              alt={invoiceData.companyName ? `${invoiceData.companyName} logo` : 'Company Logo'}
              className="inline-block h-16 max-h-16 w-auto object-contain"
              crossOrigin="anonymous"
            />
          </div>
        </header>
      )}

      {(quotationFromVisible || quotationForVisible) && (
        <section className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          {quotationFromVisible && (
            <div>
              <h3 className="mb-2 border-b border-gray-300 pb-1 text-sm font-bold uppercase">
                {getSectionLabel(resolvedConfig, 'quotationFrom', 'Quotation From')}
              </h3>
              <p className="text-base font-bold text-gray-900">{invoiceData.companyName || '---'}</p>
              {isFieldVisible(resolvedConfig, 'quotationFrom', 'addressLabel') && invoiceData.companyAddress ? (
                <p className="mt-1 whitespace-pre-line">
                  <span className="font-semibold text-gray-700">
                    {getFieldLabel(resolvedConfig, 'quotationFrom', 'addressLabel', 'Address')}:
                  </span>
                  {'\n'}
                  {invoiceData.companyAddress}
                </p>
              ) : null}
              {isFieldVisible(resolvedConfig, 'quotationFrom', 'emailLabel') && (
                <p className="mt-1">
                  <strong>{getFieldLabel(resolvedConfig, 'quotationFrom', 'emailLabel', 'Email')}:</strong>{' '}
                  {invoiceData.companyEmail || '---'}
                </p>
              )}
              {isFieldVisible(resolvedConfig, 'quotationFrom', 'phoneLabel') && (
                <p className="mt-1">
                  <strong>{getFieldLabel(resolvedConfig, 'quotationFrom', 'phoneLabel', 'Phone')}:</strong>{' '}
                  {invoiceData.companyPhone || '---'}
                </p>
              )}
              {isFieldVisible(resolvedConfig, 'quotationFrom', 'gstinLabel') && (
                <p className="mt-1">
                  <strong>{getFieldLabel(resolvedConfig, 'quotationFrom', 'gstinLabel', 'GSTIN')}:</strong>{' '}
                  {invoiceData.companyGstin || '---'}
                </p>
              )}
              {isFieldVisible(resolvedConfig, 'quotationFrom', 'panLabel') && (
                <p className="mt-1">
                  <strong>{getFieldLabel(resolvedConfig, 'quotationFrom', 'panLabel', 'PAN')}:</strong>{' '}
                  {invoiceData.companyPan || '---'}
                </p>
              )}
            </div>
          )}
          {quotationForVisible && (
            <div>
              <h3 className="mb-2 border-b border-gray-300 pb-1 text-sm font-bold uppercase">
                {getSectionLabel(resolvedConfig, 'quotationFor', 'Quotation For')}
              </h3>
              <p className="text-base font-bold text-gray-900">{invoiceData.clientName || '---'}</p>
              {invoiceData.clientCompany && isFieldVisible(resolvedConfig, 'quotationFor', 'companyLabel') && (
                <p className="mt-1">
                  <strong>{getFieldLabel(resolvedConfig, 'quotationFor', 'companyLabel', 'Company')}:</strong>{' '}
                  {invoiceData.clientCompany}
                </p>
              )}
              {isFieldVisible(resolvedConfig, 'quotationFor', 'addressLabel') && invoiceData.clientAddress ? (
                <p className="mt-1 whitespace-pre-line">
                  <span className="font-semibold text-gray-700">
                    {getFieldLabel(resolvedConfig, 'quotationFor', 'addressLabel', 'Address')}:
                  </span>
                  {'\n'}
                  {invoiceData.clientAddress}
                </p>
              ) : null}
              {isFieldVisible(resolvedConfig, 'quotationFor', 'phoneLabel') && (
                <p className="mt-1">
                  <strong>{getFieldLabel(resolvedConfig, 'quotationFor', 'phoneLabel', 'Phone')}:</strong>{' '}
                  {invoiceData.clientPhone || '---'}
                </p>
              )}
              {isFieldVisible(resolvedConfig, 'quotationFor', 'gstinLabel') && (
                <p className="mt-1">
                  <strong>{getFieldLabel(resolvedConfig, 'quotationFor', 'gstinLabel', 'GSTIN')}:</strong>{' '}
                  {invoiceData.clientGstin || '---'}
                </p>
              )}
              {isFieldVisible(resolvedConfig, 'quotationFor', 'panLabel') && (
                <p className="mt-1">
                  <strong>{getFieldLabel(resolvedConfig, 'quotationFor', 'panLabel', 'PAN')}:</strong>{' '}
                  {invoiceData.clientPan || '---'}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <section className="print-avoid-break">
        <div className="overflow-hidden rounded border border-gray-300">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-gray-100 text-[11px] uppercase tracking-wide text-gray-800">
              <tr>
                {tableColumns.map((column) => (
                  <th
                    key={column.key}
                    className={`border border-gray-300 p-2 font-bold text-gray-900 ${getColumnAlignment(column)}`}
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
                  <tr key={`${item.service}-${rowIndex}`} className="border-t border-gray-200">
                    {tableColumns.map((column) => {
                      const content = renderCell(item, column.key, column.formatter || 'text');
                      const alignment = getColumnAlignment(column);
                      return (
                        <td
                          key={column.key}
                          className={`align-top p-2 ${alignment} border border-gray-200 ${column.key === 'service' || column.key === 'description' ? 'leading-relaxed' : ''}`}
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

        {itemsSummaryVisible && isFieldVisible(resolvedConfig, 'itemsSummary', 'totalTaxInWordsLabel') && (
          <div className="border border-t-0 border-gray-300 p-2 text-right font-semibold text-gray-700">
            {getFieldLabel(resolvedConfig, 'itemsSummary', 'totalTaxInWordsLabel', 'Total Tax In Words')}
            {': '}
            {totalTaxInWords}
          </div>
        )}
      </section>

      {totalsSectionVisible && (
        <section className="mt-4 flex justify-end print-avoid-break">
          <div className="w-full max-w-md">
            <table className="w-full text-sm">
              <tbody>
                {isFieldVisible(resolvedConfig, 'totals', 'amountLabel') && (
                  <tr>
                    <td className="p-2 text-gray-700">
                      {getFieldLabel(resolvedConfig, 'totals', 'amountLabel', 'Amount')}
                    </td>
                    <td className="p-2 text-right font-medium">{formatCurrency(subtotal)}</td>
                  </tr>
                )}
                {gstType === 'IGST' && isFieldVisible(resolvedConfig, 'totals', 'igstLabel') && (
                  <tr>
                    <td className="p-2 text-gray-700">
                      {getFieldLabel(resolvedConfig, 'totals', 'igstLabel', 'IGST')}
                    </td>
                    <td className="p-2 text-right font-medium">{formatCurrency(totalIgst)}</td>
                  </tr>
                )}
                {gstType === 'CGST_SGST' && (
                  <>
                    {isFieldVisible(resolvedConfig, 'totals', 'cgstLabel') && (
                      <tr>
                        <td className="p-2 text-gray-700">
                          {getFieldLabel(resolvedConfig, 'totals', 'cgstLabel', 'CGST')}
                        </td>
                        <td className="p-2 text-right font-medium">{formatCurrency(totalCgst)}</td>
                      </tr>
                    )}
                    {isFieldVisible(resolvedConfig, 'totals', 'sgstLabel') && (
                      <tr>
                        <td className="p-2 text-gray-700">
                          {getFieldLabel(resolvedConfig, 'totals', 'sgstLabel', 'SGST')}
                        </td>
                        <td className="p-2 text-right font-medium">{formatCurrency(totalSgst)}</td>
                      </tr>
                    )}
                  </>
                )}
                {isFieldVisible(resolvedConfig, 'totals', 'grandTotalLabel') && (
                  <tr className="bg-gray-100 text-base font-semibold text-gray-900">
                    <td className="p-3">
                      {getFieldLabel(resolvedConfig, 'totals', 'grandTotalLabel', 'Total (INR)')}
                    </td>
                    <td className="p-3 text-right">{formatCurrency(grandTotal)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <AuthorizedBy
        signatureUrl={invoiceData.authorizedSignatureUrl}
        personName={invoiceData.authorizedPersonName}
        align="right"
        label={resolvedConfig.authorizedBy?.label}
        visible={resolvedConfig.authorizedBy?.visible !== false}
      />

      {notesSectionVisible && (
        <section className="mt-8 print-avoid-break">
          <h4 className="mb-1 text-sm font-bold text-gray-800">
            {getFieldLabel(resolvedConfig, 'notes', 'notesHeading', 'Terms & Conditions')}
          </h4>
          <p className="whitespace-pre-line rounded-lg border border-gray-200 p-3 text-xs text-gray-700">
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
