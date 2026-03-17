import React from 'react';

export const VISUAL_TEMPLATES = {
  DIGITAL_MARKETING: 'Digital Marketing Style',
  TAX_INVOICE: 'Tax Invoice Style',
  PURCHASE_ORDER: 'Purchase Order Style',
  PROFESSIONAL_QUOTATION: 'Professional Quotation Style',
} as const;

import { DigitalMarketingTemplate } from './DigitalMarketingTemplate';
import PurchaseOrderTemplate from './PurchaseOrderTemplate';
import ProfessionalQuotationTemplate from './ProfessionalQuotationTemplate';
import { TaxInvoiceTemplate } from './TaxInvoiceTemplate';

type VisualTemplateKey = keyof typeof VISUAL_TEMPLATES;

interface InvoicePreviewProps {
  data: any;
}

const InvoicePreview = React.forwardRef<HTMLDivElement, InvoicePreviewProps>(({ data }, ref) => {
  const items = data?.items ?? [];
  const providedTemplate = (data?.template as string) || '';
  const templateKeys = Object.keys(VISUAL_TEMPLATES) as VisualTemplateKey[];
  let templateKey: VisualTemplateKey = 'TAX_INVOICE';

  if (templateKeys.includes(providedTemplate as VisualTemplateKey)) {
    templateKey = providedTemplate as VisualTemplateKey;
  } else {
    const match = templateKeys.find((k) => VISUAL_TEMPLATES[k] === providedTemplate);
    if (match) templateKey = match;
  }

  const subtotal = items.reduce(
    (acc: number, item: any) => acc + (item?.cost || 0) * (item?.quantity || 1),
    0
  );

  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  const rate = (data?.globalTaxRate || 0) / 100;

  if (data?.gstType === 'IGST') {
    totalIgst = subtotal * rate;
  } else {
    totalCgst = subtotal * (rate / 2);
    totalSgst = subtotal * (rate / 2);
  }

  const shipping = data?.shippingCost || 0;
  const total = subtotal + totalCgst + totalSgst + totalIgst + shipping;
  const tax = totalCgst + totalSgst + totalIgst;
  const templateConfig = data?.templateConfig;

  const footerLines = (data?.footerDetails || '')
    .toString()
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0);

  const normalizedData = {
    ...data,
    subtotal,
    totalCgst,
    totalSgst,
    totalIgst,
    tax,
    total,
    shipping,
    documentNumberLabel:
      data?.documentNumberLabel ||
      (templateKey === 'PURCHASE_ORDER'
        ? 'Purchase Order Number'
        : templateKey === 'PROFESSIONAL_QUOTATION'
        ? 'Quotation Number'
        : 'Invoice Number'),
    documentDateLabel:
      data?.documentDateLabel ||
      (templateKey === 'PURCHASE_ORDER' || templateKey === 'PROFESSIONAL_QUOTATION'
        ? 'Date'
        : 'Invoice Date'),
    partySectionLabel:
      data?.partySectionLabel ||
      (templateKey === 'PURCHASE_ORDER'
        ? 'Vendor'
        : templateKey === 'PROFESSIONAL_QUOTATION'
        ? 'Quotation To'
        : 'Billed To'),
    systemGeneratedFooterText:
      data?.systemGeneratedFooterText ||
      'This is an electronically generated document, no signature is required.',
  };

  const renderTemplate = () => {
    switch (templateKey) {
      case 'DIGITAL_MARKETING':
        return (
          <DigitalMarketingTemplate
            data={normalizedData}
            subtotal={subtotal}
            totalCgst={totalCgst}
            totalSgst={totalSgst}
            totalIgst={totalIgst}
            total={total}
          />
        );
      case 'PURCHASE_ORDER':
        return <PurchaseOrderTemplate data={normalizedData} templateConfig={templateConfig} />;
      case 'TAX_INVOICE':
        return <TaxInvoiceTemplate data={normalizedData} templateConfig={templateConfig} />;
      case 'PROFESSIONAL_QUOTATION':
        return <ProfessionalQuotationTemplate data={normalizedData} templateConfig={templateConfig} />;
      default:
        return <TaxInvoiceTemplate data={normalizedData} templateConfig={templateConfig} />;
    }
  };

  return (
    <div id="invoice-wrapper" ref={ref} className="invoice-root p-8 bg-white shadow-lg rounded-xl">
      <div className="page-break-group">{renderTemplate()}</div>

      {footerLines.length > 0 && (
        <div className="no-print-footer mt-8 text-center text-xs text-gray-500">
          {footerLines.map((line: string, index: number) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
});

InvoicePreview.displayName = 'InvoicePreview';

export default InvoicePreview;