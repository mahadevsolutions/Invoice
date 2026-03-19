import React, { useMemo } from 'react';
import { computeItemsWithTaxes } from 'src/components/ProfessionalQuotationTemplate';
import AuthorizedBy from 'src/components/AuthorizedBy';
import TemplatePreviewWrapper from 'src/components/template-editor/TemplatePreviewWrapper';
import {
  ColumnConfig,
  TemplateConfig,
  createTaxInvoiceDefaultConfig,
  getColumnValue,
  getFieldConfig,
  getFieldLabel,
  getSectionLabel,
  getVisibleColumns,
  isSectionVisible,
  isFieldVisible,
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

const normalizeMultiline = (value: unknown): string => {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
};

export const TaxInvoiceTemplate: React.FC<TaxInvoiceProps> = ({ data, templateConfig, currencySymbol }) => {
  const invoiceData = data || {};
  const resolvedConfig = useMemo(
    () => resolveTemplateConfig(createTaxInvoiceDefaultConfig, templateConfig),
    [templateConfig]
  );

  const currency = currencySymbol || invoiceData.currencySymbol || '₹';
  const { gstType, itemsWithCalculations, totals, hsnSummary } = computeItemsWithTaxes(invoiceData);
  const { subtotal, totalCgst, totalSgst, totalIgst, grandTotal } = totals;
  const roundOff = toNumber(invoiceData.roundOff) ?? 0;
  const payableTotal = grandTotal + roundOff;
  const totalTax = (totalCgst || 0) + (totalSgst || 0) + (totalIgst || 0);
  const amountInWords = numberToWords(payableTotal);
  const taxInWords = numberToWords(totalTax);
  const documentNumberLabel = invoiceData.documentNumberLabel || 'Invoice Number';
  const documentDateLabel = invoiceData.documentDateLabel || 'Invoice Date';
  const buyerSectionLabel = invoiceData.partySectionLabel || 'Billed To';

  const tableColumns = useMemo(
    () =>
      getVisibleColumns(resolvedConfig).filter((column) => {
        if (column.key === 'igst' && gstType !== 'IGST') return false;
        if ((column.key === 'cgst' || column.key === 'sgst') && gstType !== 'CGST_SGST') return false;
        return column.visible !== false;
      }),
    [resolvedConfig, gstType]
  );

  const showHSN = tableColumns.some((col) => col.key === 'hsn');

  function getSectionConfigStyle(sectionId: string) {
    return resolvedConfig.sections.find((section) => section.id === sectionId)?.style;
  }

  const headerClass = mapFieldStyleToClasses(
    getFieldConfig(resolvedConfig, 'header', 'title')?.style ||
      getFieldConfig(resolvedConfig, 'header', 'subjectLabel')?.style ||
      getSectionConfigStyle('header')
  );
  const headerInline = mapFieldStyleToInlineStyle(
    getFieldConfig(resolvedConfig, 'header', 'title')?.style ||
      getFieldConfig(resolvedConfig, 'header', 'subjectLabel')?.style ||
      getSectionConfigStyle('header')
  );
  const companyClass = mapFieldStyleToClasses(getSectionConfigStyle('companyDetails'));
  const companyInline = mapFieldStyleToInlineStyle(getSectionConfigStyle('companyDetails'));
  const consigneeClass = mapFieldStyleToClasses(getSectionConfigStyle('consignee'));
  const consigneeInline = mapFieldStyleToInlineStyle(getSectionConfigStyle('consignee'));
  const buyerClass = mapFieldStyleToClasses(getSectionConfigStyle('buyer'));
  const buyerInline = mapFieldStyleToInlineStyle(getSectionConfigStyle('buyer'));
  const orderMetaClass = mapFieldStyleToClasses(getSectionConfigStyle('orderMeta'));
  const orderMetaInline = mapFieldStyleToInlineStyle(getSectionConfigStyle('orderMeta'));

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
    formatter: ColumnConfig['formatter']
  ): React.ReactNode => {
    const rawValue = getColumnValue(item, columnKey, invoiceData);

    if (columnKey === 'service' || columnKey === 'description') {
      const title = rawValue || item.service || item.description || '';
      const description = item.description && item.description !== title ? item.description : '';
      const hsnWithinCell = !tableColumns.some((col) => col.key === 'hsn') && item.hsn;

      return (
        <div className="space-y-1">
          <span className="block font-semibold text-gray-800">{String(title || '')}</span>
          {description ? <span className="block text-[11px] text-gray-600">{description}</span> : null}
          {hsnWithinCell ? <span className="block text-[11px] text-gray-500">HSN/SAC: {hsnWithinCell}</span> : null}
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

  const personName = String(invoiceData.authorizedPersonName ?? resolvedConfig.authorizedBy?.personName ?? '').trim();
  const designation = String(invoiceData.authorizedDesignation ?? resolvedConfig.authorizedBy?.designation ?? '').trim();
  const hasAuthText = personName.length > 0 || designation.length > 0;

  const titleLabel = getFieldLabel(resolvedConfig, 'header', 'title', 'Tax Invoice');
  const displayTitle = String(invoiceData.invoiceTitle ?? '').trim() || titleLabel;
  const showTitle = headerVisible && displayTitle.length > 0;

  const subjectLabel = getFieldLabel(resolvedConfig, 'header', 'subjectLabel', 'Subject');
  const subjectValue = String(invoiceData.projectSubject ?? '').trim();
  const showSubject =
    headerVisible && isFieldVisible(resolvedConfig, 'header', 'subjectLabel', true) && subjectValue.length > 0;

  const renderMetaRow = (label: string, value: React.ReactNode, key: string, multiline?: boolean) => {
    const isEmpty = value == null || (typeof value === 'string' && value.trim().length === 0);
    if (isEmpty) return null;

    return (
      <div key={key} className="border-b border-gray-200 px-3 py-2 last:border-b-0">
        <div className="font-semibold text-gray-800">{label}</div>
        {multiline ? (
          <div className="mt-1 whitespace-pre-line text-gray-700">{value}</div>
        ) : (
          <div className="mt-1 text-gray-700">{value}</div>
        )}
      </div>
    );
  };

  const shippingAddressText = normalizeMultiline(invoiceData.shippingAddressLabel);
  const shippingAddressContact = String(invoiceData.shippingAddressContactLabel ?? '').trim();
  const shippingAddressCombined = [shippingAddressText, shippingAddressContact ? `Contact: ${shippingAddressContact}` : '']
    .filter(Boolean)
    .join('\n');

  const invoiceNoLabel = documentNumberLabel;
  const dateLabel = documentDateLabel;
  const buyersOrderLabel = getFieldLabel(resolvedConfig, 'orderMeta', 'buyersOrderLabel', "Buyer's Order No.");
  const shippingAddressLabel = getFieldLabel(resolvedConfig, 'orderMeta', 'shippingAddressLabel', 'Shipping Address');
  const deliveryNoteLabel = getFieldLabel(resolvedConfig, 'orderMeta', 'deliveryNoteLabel', 'Delivery Note');
  const dispatchDocLabel = getFieldLabel(resolvedConfig, 'orderMeta', 'dispatchDocLabel', 'Dispatch Doc No.');
  const dispatchedThroughLabel = getFieldLabel(resolvedConfig, 'orderMeta', 'dispatchedThroughLabel', 'Dispatched through');
  const destinationLabel = getFieldLabel(resolvedConfig, 'orderMeta', 'destinationLabel', 'Destination');
  const termsLabel = getFieldLabel(resolvedConfig, 'orderMeta', 'termsLabel', 'Terms of Delivery');

  const footerDescription = normalizeMultiline(invoiceData.footerDetails);
  const systemGeneratedMessage = normalizeMultiline(invoiceData.systemGeneratedFooterText);
  const showFooterDescription = footerDescription.length > 0;
  const showSystemGeneratedMessage = systemGeneratedMessage.length > 0;
  const showFixedFooter = showFooterDescription || showSystemGeneratedMessage;

  return (
    <div className="tax-invoice-template bg-white p-6 pb-24 font-sans text-xs text-black">
      <style>{`
        @page {
          margin: 16mm 12mm 24mm 12mm;
        }
        @media print {
          .print-avoid-break { break-inside: avoid; }
          .tax-invoice-template {
            padding-bottom: 90px !important;
          }
          .page-footer-fixed {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            background: #ffffff;
            padding: 0 12mm 8mm 12mm;
            z-index: 9999;
          }
        }
        .text-xxs { font-size: 0.65rem; }
        .auth-by-tight { margin-top: 6px !important; padding-top: 0px !important; line-height: 1.15 !important; }
        .auth-by-tight * { line-height: 1.15 !important; }
        .auth-by-tight p { margin-top: 2px !important; margin-bottom: 0px !important; }
        .auth-by-tight .auth-by-name { margin-top: 8px !important; }
        .auth-by-tight .auth-by-des { margin-top: 4px !important; }
        .page-footer-fixed {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          background: #ffffff;
          padding: 0 24px 16px 24px;
          z-index: 9999;
        }
      `}</style>

      {(showTitle || showSubject) && (
        <header className={`mb-4 text-center avoid-break ${headerClass}`} style={headerInline}>
          {showTitle && <h1 className="text-2xl font-bold text-gray-900">{displayTitle}</h1>}
          {showSubject && (
            <p className="mt-2 text-base">
              <span className="font-bold">{subjectLabel}</span> <span>{subjectValue}</span>
            </p>
          )}
        </header>
      )}

      {companySectionVisible && (
        <section
          className={`mb-4 border-y border-gray-400 py-2 text-center text-xxs text-black avoid-break ${companyClass}`}
          style={companyInline}
        >
          {['companyHeading', 'addressLabel', 'gstinLabel', 'contactLabel', 'emailLabel']
            .filter((key) => isFieldVisible(resolvedConfig, 'companyDetails', key, true))
            .map((key) => {
              const field = getFieldConfig(resolvedConfig, 'companyDetails', key);
              return field ? renderField('companyDetails', field) : null;
            })}
        </section>
      )}

      <section className="mb-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-3 avoid-break">
        {consigneeVisible && (
          <div className={`p-2 ${consigneeClass}`} style={consigneeInline}>
            <h3 className="mb-1 border-b border-gray-300 pb-1 font-bold text-gray-900">
              {getSectionLabel(resolvedConfig, 'consignee', 'Billed By')}
            </h3>
            {['heading', 'gstinLabel', 'stateLabel', 'contactPersonLabel', 'contactLabel']
              .map((key) => getFieldConfig(resolvedConfig, 'consignee', key))
              .filter(Boolean)
              .map((field) => renderField('consignee', field))}
          </div>
        )}

        {buyerVisible && (
          <div className={`p-2 ${buyerClass}`} style={buyerInline}>
            <h3 className="mb-1 border-b border-gray-300 pb-1 font-bold text-gray-900">
              {buyerSectionLabel}
            </h3>
            {['heading', 'gstinLabel', 'stateLabel', 'contactPersonLabel', 'contactLabel']
              .map((key) => getFieldConfig(resolvedConfig, 'buyer', key))
              .filter(Boolean)
              .map((field) => renderField('buyer', field))}
          </div>
        )}

        {orderMetaVisible && (
          <div className={`overflow-hidden rounded border border-gray-200 ${orderMetaClass}`} style={orderMetaInline}>
            {renderMetaRow(invoiceNoLabel, String(invoiceData.quotationNumber ?? '').trim(), 'invoiceNumber')}
            {renderMetaRow(dateLabel, String(invoiceData.date ?? '').trim(), 'date')}
            {renderMetaRow(buyersOrderLabel, String(invoiceData.buyersOrderNo ?? '').trim(), 'buyersOrder')}
            {renderMetaRow(shippingAddressLabel, shippingAddressCombined, 'shippingAddress', true)}
            {renderMetaRow(deliveryNoteLabel, String(invoiceData.deliveryNote ?? '').trim(), 'deliveryNote')}
            {renderMetaRow(dispatchDocLabel, String(invoiceData.dispatchDocNo ?? '').trim(), 'dispatchDoc')}
            {renderMetaRow(dispatchedThroughLabel, String(invoiceData.dispatchedThrough ?? '').trim(), 'dispatchedThrough')}
            {renderMetaRow(destinationLabel, String(invoiceData.destination ?? '').trim(), 'destination')}
            {renderMetaRow(termsLabel, normalizeMultiline(invoiceData.termsOfDelivery), 'termsOfDelivery', true)}
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
                    className="bg-violet-400 p-2 text-center"
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
                      return (
                        <td key={column.key} className="p-2 text-center align-top">
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
                  {showHSN && <th className="bg-violet-400 p-2 text-center">HSN</th>}
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
                    {showHSN && <td className="border border-black-200 p-2 text-center">{hsn}</td>}

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
              {(() => {
                const totalRows = [
                  {
                    key: 'subtotalLabel',
                    visible: true,
                    label: getFieldLabel(resolvedConfig, 'totals', 'subtotalLabel', 'Subtotal'),
                    value: formatCurrency(subtotal),
                  },
                  {
                    key: 'cgstLabel',
                    visible: gstType === 'CGST_SGST',
                    label: getFieldLabel(resolvedConfig, 'totals', 'cgstLabel', 'CGST'),
                    value: formatCurrency(totalCgst),
                  },
                  {
                    key: 'sgstLabel',
                    visible: gstType === 'CGST_SGST',
                    label: getFieldLabel(resolvedConfig, 'totals', 'sgstLabel', 'SGST'),
                    value: formatCurrency(totalSgst),
                  },
                  {
                    key: 'igstLabel',
                    visible: gstType === 'IGST',
                    label: getFieldLabel(resolvedConfig, 'totals', 'igstLabel', 'IGST'),
                    value: formatCurrency(totalIgst),
                  },
                  {
                    key: 'totalTaxLabel',
                    visible: true,
                    label: getFieldLabel(resolvedConfig, 'totals', 'totalTaxLabel', 'Total Tax'),
                    value: formatCurrency(totalTax),
                  },
                  {
                    key: 'roundOffLabel',
                    visible: !(roundOff === 0 && invoiceData.roundOff == null),
                    label: getFieldLabel(resolvedConfig, 'totals', 'roundOffLabel', 'Round Off'),
                    value: formatCurrency(roundOff),
                  },
                  {
                    key: 'grandTotalLabel',
                    visible: true,
                    label: getFieldLabel(resolvedConfig, 'totals', 'grandTotalLabel', 'Grand Total'),
                    value: formatCurrency(payableTotal),
                  },
                ];

                return totalRows.map((row) => {
                  const field = getFieldConfig(resolvedConfig, 'totals', row.key);
                  if (!field || field.visible === false || !row.visible) return null;

                  return (
                    <div key={row.key} className="flex items-center justify-between px-4 py-2">
                      <dt className="text-gray-600">{row.label}</dt>
                      <dd className="font-semibold text-gray-900">{row.value}</dd>
                    </div>
                  );
                });
              })()}
            </dl>
          </div>
        </section>
      )}

      {amountInWordsVisible && (
        <section className="mb-2 border-t border-gray-400 pt-2 avoid-break">
          {['amountChargeableLabel', 'taxAmountLabel'].map((key) => {
            const field = getFieldConfig(resolvedConfig, 'amountInWords', key);
            if (!field || field.visible === false) return null;
            const label = getFieldLabel(resolvedConfig, 'amountInWords', field.key, field.label || '');
            let value: any = '';
            if (field.key === 'amountChargeableLabel') value = amountInWords;
            else if (field.key === 'taxAmountLabel') value = taxInWords;
            else value = invoiceData[field.key] ?? field.defaultValue ?? '';
            return (
              <p key={field.key} className="font-bold text-gray-800">
                {label}
                <span className="font-normal text-gray-700">{value}</span>
              </p>
            );
          })}
        </section>
      )}

      <div className={hasAuthText ? 'auth-by-tight' : ''}>
        <AuthorizedBy
          signatureUrl={invoiceData.authorizedSignatureUrl ?? resolvedConfig.authorizedBy?.signatureUrl}
          personName={invoiceData.authorizedPersonName ?? resolvedConfig.authorizedBy?.personName}
          designation={invoiceData.authorizedDesignation ?? resolvedConfig.authorizedBy?.designation}
          align={(resolvedConfig.authorizedBy?.align as any) ?? 'right'}
          label={resolvedConfig.authorizedBy?.label}
          visible={resolvedConfig.authorizedBy?.visible !== false}
        />
      </div>

      {bankDetailsVisible && (
        <footer className="border-t border-gray-400 pt-3 text-xs text-gray-700 avoid-break">
          <div>
            <h4 className="mb-1 font-bold text-gray-900">
              {getSectionLabel(resolvedConfig, 'bankDetails', "Company's Bank Details")}
            </h4>
            {['bankNameLabel', 'accountNumberLabel', 'branchLabel', 'declarationHeading']
              .map((key) => getFieldConfig(resolvedConfig, 'bankDetails', key))
              .filter(Boolean)
              .map((field) => renderField('bankDetails', field))}
          </div>
        </footer>
      )}

      {showFixedFooter && (
        <div className="page-footer-fixed text-center text-[11px] leading-[1.3] text-gray-600">
          {showFooterDescription && <div className="whitespace-pre-line">{footerDescription}</div>}
          {showSystemGeneratedMessage && (
            <div className={showFooterDescription ? 'mt-1' : ''}>
              {systemGeneratedMessage}
            </div>
          )}
        </div>
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