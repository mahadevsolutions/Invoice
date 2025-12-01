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
  resolveTemplateConfig,
} from 'src/components/template-editor/field-types';

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
  const totalTax = totalCgst + totalSgst + totalIgst;
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

  return (
    <div className="bg-white font-sans text-xs text-gray-900">
      <style>{`
        @media print {
          .print-avoid-break { break-inside: avoid; }
        }
        .text-xxs { font-size: 0.65rem; }
      `}</style>

      {headerVisible && (
        <header className="mb-4 text-center">
          {isFieldVisible(resolvedConfig, 'header', 'title') && (
            <h1 className="text-2xl font-bold text-gray-900">
              {invoiceData.invoiceTitle || getFieldLabel(resolvedConfig, 'header', 'title', 'Tax Invoice')}
            </h1>
          )}
          {isFieldVisible(resolvedConfig, 'header', 'subjectLabel') && invoiceData.projectSubject ? (
            <p className="font-bold text-gray-700">
              {getFieldLabel(resolvedConfig, 'header', 'subjectLabel', 'Subject')}: {invoiceData.projectSubject}
            </p>
          ) : null}
        </header>
      )}

      {companySectionVisible && (
        <section className="mb-4 border-y border-gray-400 py-2 text-center text-xxs text-gray-700">
          {isFieldVisible(resolvedConfig, 'companyDetails', 'companyHeading') && (
            <h2 className="text-lg font-bold text-gray-900">
              {invoiceData.companyName || getFieldLabel(resolvedConfig, 'companyDetails', 'companyHeading', 'Company Name')}
            </h2>
          )}
          {isFieldVisible(resolvedConfig, 'companyDetails', 'addressLabel') && invoiceData.companyAddress ? (
            <p>{invoiceData.companyAddress}</p>
          ) : null}
          {isFieldVisible(resolvedConfig, 'companyDetails', 'gstinLabel') && (
            <p>
              <strong>{getFieldLabel(resolvedConfig, 'companyDetails', 'gstinLabel', 'GSTIN/UIN')}:</strong>{' '}
              {invoiceData.companyGstin || '---'}
            </p>
          )}
          <p>
            {isFieldVisible(resolvedConfig, 'companyDetails', 'contactLabel') && invoiceData.companyPhone ? (
              <>
                <strong>{getFieldLabel(resolvedConfig, 'companyDetails', 'contactLabel', 'Contact')}:</strong>{' '}
                {invoiceData.companyPhone}
              </>
            ) : null}
            {isFieldVisible(resolvedConfig, 'companyDetails', 'emailLabel') && invoiceData.companyEmail ? (
              <>
                {'  '}|{' '}
                <strong>{getFieldLabel(resolvedConfig, 'companyDetails', 'emailLabel', 'E-Mail')}:</strong>{' '}
                {invoiceData.companyEmail}
              </>
            ) : null}
          </p>
        </section>
      )}

      <section className="mb-2 grid grid-cols-1 gap-2 text-xxs md:grid-cols-3">
        {consigneeVisible && (
          <div className="border border-gray-400 p-2">
            <h3 className="mb-1 border-b border-gray-300 pb-1 font-bold text-gray-900">
              {getSectionLabel(resolvedConfig, 'consignee', 'Consignee (Ship to)')}
            </h3>
            <p className="font-bold text-gray-800">{invoiceData.consigneeName || invoiceData.clientName || '---'}</p>
            {invoiceData.consigneeAddress || invoiceData.clientAddress ? (
              <p>{invoiceData.consigneeAddress || invoiceData.clientAddress}</p>
            ) : null}
            {isFieldVisible(resolvedConfig, 'consignee', 'gstinLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'consignee', 'gstinLabel', 'GSTIN/UIN')}:</strong>{' '}
                {invoiceData.consigneeGstin || invoiceData.clientGstin || '---'}
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'consignee', 'stateLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'consignee', 'stateLabel', 'State Name')}:</strong>{' '}
                {invoiceData.consigneeState || invoiceData.clientState || '---'}
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'consignee', 'contactPersonLabel') && invoiceData.consigneeContactPerson ? (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'consignee', 'contactPersonLabel', 'Contact Person')}:</strong>{' '}
                {invoiceData.consigneeContactPerson}
              </p>
            ) : null}
            {isFieldVisible(resolvedConfig, 'consignee', 'contactLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'consignee', 'contactLabel', 'Contact')}:</strong>{' '}
                {invoiceData.consigneeContact || '---'}
              </p>
            )}
          </div>
        )}

        {buyerVisible && (
          <div className="border border-gray-400 p-2">
            <h3 className="mb-1 border-b border-gray-300 pb-1 font-bold text-gray-900">
              {getSectionLabel(resolvedConfig, 'buyer', 'Buyer (Bill to)')}
            </h3>
            <p className="font-bold text-gray-800">{invoiceData.clientName || '---'}</p>
            {invoiceData.clientAddress ? <p>{invoiceData.clientAddress}</p> : null}
            {isFieldVisible(resolvedConfig, 'buyer', 'gstinLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'buyer', 'gstinLabel', 'GSTIN/UIN')}:</strong>{' '}
                {invoiceData.clientGstin || '---'}
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'buyer', 'stateLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'buyer', 'stateLabel', 'State Name')}:</strong>{' '}
                {invoiceData.clientState || '---'}
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'buyer', 'contactPersonLabel') && invoiceData.clientContactPerson ? (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'buyer', 'contactPersonLabel', 'Contact Person')}:</strong>{' '}
                {invoiceData.clientContactPerson}
              </p>
            ) : null}
            {isFieldVisible(resolvedConfig, 'buyer', 'contactLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'buyer', 'contactLabel', 'Contact')}:</strong>{' '}
                {invoiceData.clientPhone || '---'}
              </p>
            )}
          </div>
        )}

        {orderMetaVisible && (
          <div className="border border-gray-400 p-2 text-xxs text-gray-700">
            {isFieldVisible(resolvedConfig, 'orderMeta', 'invoiceNumberLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'orderMeta', 'invoiceNumberLabel', 'Invoice No.')}:</strong>{' '}
                <span className="font-bold text-gray-900">{invoiceData.quotationNumber || '---'}</span>
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'orderMeta', 'invoiceDateLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'orderMeta', 'invoiceDateLabel', 'Dated')}:</strong>{' '}
                <span className="font-bold text-gray-900">{invoiceData.date || '---'}</span>
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'orderMeta', 'deliveryNoteLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'orderMeta', 'deliveryNoteLabel', 'Delivery Note')}:</strong>{' '}
                {invoiceData.deliveryNote || '--'}
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'orderMeta', 'buyersOrderLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'orderMeta', 'buyersOrderLabel', "Buyer's Order No.")}:</strong>{' '}
                {invoiceData.buyersOrderNo || '--'}
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'orderMeta', 'dispatchDocLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'orderMeta', 'dispatchDocLabel', 'Dispatch Doc No.')}:</strong>{' '}
                {invoiceData.dispatchDocNo || '--'}
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'orderMeta', 'dispatchedThroughLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'orderMeta', 'dispatchedThroughLabel', 'Dispatched through')}:</strong>{' '}
                {invoiceData.dispatchedThrough || '--'}
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'orderMeta', 'destinationLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'orderMeta', 'destinationLabel', 'Destination')}:</strong>{' '}
                {invoiceData.destination || '--'}
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'orderMeta', 'termsLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'orderMeta', 'termsLabel', 'Terms of Delivery')}:</strong>{' '}
                {invoiceData.termsOfDelivery || '--'}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mb-3 print-avoid-break">
        <div className="overflow-hidden rounded border border-gray-400">
          <table className="w-full border-collapse text-left text-xxs">
            <thead className="bg-gray-100 uppercase tracking-wide text-gray-600">
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
                  <td colSpan={tableColumns.length} className="p-3 text-center text-gray-500">
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

      {Object.keys(hsnSummary).length > 0 && (
        <section className="mb-3 print-avoid-break">
          <div className="overflow-hidden rounded border border-gray-400">
            <table className="w-full border-collapse text-xxs">
              <thead className="bg-gray-100 text-gray-700">
              <tr>
                  <th className="border border-gray-300 p-2 text-left">HSN</th>
                  <th className="border border-gray-300 p-2 text-right">Taxable Value</th>
                {gstType === 'IGST' ? (
                  <>
                    <th className="border border-gray-300 p-2 text-right">IGST Rate</th>
                    <th className="border border-gray-300 p-2 text-right">IGST Amount</th>
                  </>
                ) : (
                  <>
                    <th className="border border-gray-300 p-2 text-right">CGST Rate</th>
                    <th className="border border-gray-300 p-2 text-right">CGST Amount</th>
                    <th className="border border-gray-300 p-2 text-right">SGST Rate</th>
                    <th className="border border-gray-300 p-2 text-right">SGST Amount</th>
                  </>
                )}
                  <th className="border border-gray-300 p-2 text-right">Total Tax</th>
              </tr>
            </thead>
              <tbody>
              {Object.entries(hsnSummary).map(([hsn, summary]) => (
                <tr key={hsn} className="border-t border-gray-200">
                  <td className="border border-gray-200 p-2 text-left">{hsn}</td>
                  <td className="border border-gray-200 p-2 text-right">{formatCurrency(summary.taxableValue)}</td>
                  {gstType === 'IGST' ? (
                    <>
                      <td className="border border-gray-200 p-2 text-right">{formatNumber(summary.rate)}%</td>
                      <td className="border border-gray-200 p-2 text-right">{formatCurrency(summary.igst)}</td>
                    </>
                  ) : (
                    <>
                      <td className="border border-gray-200 p-2 text-right">{formatNumber(summary.rate)}%</td>
                      <td className="border border-gray-200 p-2 text-right">{formatCurrency(summary.cgst)}</td>
                      <td className="border border-gray-200 p-2 text-right">{formatNumber(summary.rate)}%</td>
                      <td className="border border-gray-200 p-2 text-right">{formatCurrency(summary.sgst)}</td>
                    </>
                  )}
                  <td className="border border-gray-200 p-2 text-right">
                    {formatCurrency(summary.cgst + summary.sgst + summary.igst)}
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {totalsVisible && (
        <section className="mb-3 flex justify-end print-avoid-break tax-summary">
          <div className="w-full max-w-xs overflow-hidden rounded border border-gray-300 bg-white shadow-sm">
            <div className="bg-gray-100 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-wide text-gray-800">
              Tax Summary
            </div>
            <dl className="divide-y divide-gray-200 text-[0.7rem]">
              {isFieldVisible(resolvedConfig, 'totals', 'subtotalLabel') && (
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-gray-600">
                    {getFieldLabel(resolvedConfig, 'totals', 'subtotalLabel', 'Subtotal')}
                  </dt>
                  <dd className="font-semibold text-gray-900">{formatCurrency(subtotal)}</dd>
                </div>
              )}
              {gstType === 'IGST' && isFieldVisible(resolvedConfig, 'totals', 'igstLabel') && (
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-gray-600">
                    {getFieldLabel(resolvedConfig, 'totals', 'igstLabel', 'IGST')}
                  </dt>
                  <dd className="font-semibold text-gray-900">{formatCurrency(totalIgst)}</dd>
                </div>
              )}
              {gstType === 'CGST_SGST' && (
                <>
                  {isFieldVisible(resolvedConfig, 'totals', 'cgstLabel') && (
                    <div className="flex items-center justify-between px-4 py-2">
                      <dt className="text-gray-600">
                        {getFieldLabel(resolvedConfig, 'totals', 'cgstLabel', 'CGST')}
                      </dt>
                      <dd className="font-semibold text-gray-900">{formatCurrency(totalCgst)}</dd>
                    </div>
                  )}
                  {isFieldVisible(resolvedConfig, 'totals', 'sgstLabel') && (
                    <div className="flex items-center justify-between px-4 py-2">
                      <dt className="text-gray-600">
                        {getFieldLabel(resolvedConfig, 'totals', 'sgstLabel', 'SGST')}
                      </dt>
                      <dd className="font-semibold text-gray-900">{formatCurrency(totalSgst)}</dd>
                    </div>
                  )}
                </>
              )}
              {isFieldVisible(resolvedConfig, 'totals', 'totalTaxLabel') && (
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-gray-600">
                    {getFieldLabel(resolvedConfig, 'totals', 'totalTaxLabel', 'Total Tax')}
                  </dt>
                  <dd className="font-semibold text-gray-900">{formatCurrency(totalTax)}</dd>
                </div>
              )}
              {isFieldVisible(resolvedConfig, 'totals', 'roundOffLabel') && (roundOff !== 0 || invoiceData.roundOff != null) && (
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-gray-600">
                    {getFieldLabel(resolvedConfig, 'totals', 'roundOffLabel', 'Round Off')}
                  </dt>
                  <dd className="font-semibold text-gray-900">{formatCurrency(roundOff)}</dd>
                </div>
              )}
              {isFieldVisible(resolvedConfig, 'totals', 'grandTotalLabel') && (
                <div className="flex items-center justify-between bg-gray-900 px-4 py-3 font-bold text-white">
                  <dt>
                    {getFieldLabel(resolvedConfig, 'totals', 'grandTotalLabel', 'Grand Total')}
                  </dt>
                  <dd>{formatCurrency(payableTotal)}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>
      )}

      {amountInWordsVisible && (
        <section className="mb-2 border-t border-gray-400 pt-2 print-avoid-break">
          {isFieldVisible(resolvedConfig, 'amountInWords', 'amountChargeableLabel') && (
            <p className="font-bold text-gray-800">
              {getFieldLabel(resolvedConfig, 'amountInWords', 'amountChargeableLabel', 'Amount Chargeable (in words)')}{': '}
              <span className="font-normal text-gray-700">{amountInWords}</span>
            </p>
          )}
        </section>
      )}

      {amountInWordsVisible && isFieldVisible(resolvedConfig, 'amountInWords', 'taxAmountLabel') && (
        <section className="mb-2 print-avoid-break">
          <div className="border border-gray-400 border-t-0 p-2 font-bold text-gray-800">
            {getFieldLabel(resolvedConfig, 'amountInWords', 'taxAmountLabel', 'Tax Amount (in words)')}{': '}
            {taxInWords}
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

      {bankDetailsVisible && (
        <footer className="print-avoid-break border-t border-gray-400 pt-2 text-xxs text-gray-700">
          <div>
            <h4 className="mb-1 font-bold text-gray-900">
              {getSectionLabel(resolvedConfig, 'bankDetails', "Company's Bank Details")}
            </h4>
            {isFieldVisible(resolvedConfig, 'bankDetails', 'bankNameLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'bankDetails', 'bankNameLabel', 'Bank Name')}:</strong>{' '}
                {invoiceData.companyBankName || '---'}
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'bankDetails', 'accountNumberLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'bankDetails', 'accountNumberLabel', 'A/c No.')}:</strong>{' '}
                {invoiceData.companyAccountNo || '---'}
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'bankDetails', 'branchLabel') && (
              <p>
                <strong>{getFieldLabel(resolvedConfig, 'bankDetails', 'branchLabel', 'Branch & IFS Code')}:</strong>{' '}
                {invoiceData.companyBankBranch || '---'}
              </p>
            )}
            {isFieldVisible(resolvedConfig, 'bankDetails', 'declarationHeading') && invoiceData.declaration ? (
              <>
                <h4 className="mt-2 mb-1 font-bold text-gray-900">
                  {getFieldLabel(resolvedConfig, 'bankDetails', 'declarationHeading', 'Declaration')}
                </h4>
                <p>{invoiceData.declaration}</p>
              </>
            ) : null}
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
