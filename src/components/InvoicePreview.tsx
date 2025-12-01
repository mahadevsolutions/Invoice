import React from 'react';

// Define only the templates that have implementations in the repo
export const VISUAL_TEMPLATES = {
  DIGITAL_MARKETING: 'Digital Marketing Style',
  TAX_INVOICE: 'Tax Invoice Style',
  PURCHASE_ORDER: 'Purchase Order Style',
  PROFESSIONAL_QUOTATION: 'Professional Quotation Style',
} as const;

// Import your separated template components
import { DigitalMarketingTemplate } from './DigitalMarketingTemplate';
import PurchaseOrderTemplate from './PurchaseOrderTemplate';
import ProfessionalQuotationTemplate from './ProfessionalQuotationTemplate';
import { TaxInvoiceTemplate } from './TaxInvoiceTemplate';

type VisualTemplateKey = keyof typeof VISUAL_TEMPLATES;

interface InvoicePreviewProps {
  data: any;
}

/**
 * InvoicePreview
 *
 * - Uses only templates that exist in your project.
 * - Defaults to TAX_INVOICE when `data.template` is missing or unknown.
 * - Keeps the printable wrapper `#invoice-wrapper` and a `.page-break-group`
 *   around the main template output so pdfGenerator can do DOM page-splitting.
 */
const InvoicePreview = React.forwardRef<HTMLDivElement, InvoicePreviewProps>(({ data }, ref) => {
  const items = data?.items ?? [];
  const providedTemplate = (data?.template as string) || '';
  // If provided template matches one of the known keys, use it, otherwise fall back.
  const templateKey: VisualTemplateKey = (Object.keys(VISUAL_TEMPLATES).includes(providedTemplate)
    ? (providedTemplate as VisualTemplateKey)
    : 'TAX_INVOICE');

  const subtotal = items.reduce(
    (acc: number, item: any) => acc + (item?.cost || 0) * (item?.quantity || 1),
    0
  );

  // --- TAX CALC (keeps previous logic) ---
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
  // --- END TAX CALC ---

  const templateConfig = data?.templateConfig;
  const footerLines = (data?.footerDetails || '')
    .toString()
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0);

  const renderTemplate = () => {
    switch (templateKey) {
      case 'DIGITAL_MARKETING':
        return (
          <DigitalMarketingTemplate
            data={data}
            subtotal={subtotal}
            totalCgst={totalCgst}
            totalSgst={totalSgst}
            totalIgst={totalIgst}
            total={total}
          />
        );
      case 'PURCHASE_ORDER':
        return <PurchaseOrderTemplate data={data} templateConfig={templateConfig} />;
      case 'TAX_INVOICE':
        return <TaxInvoiceTemplate data={data} templateConfig={templateConfig} />;
      case 'PROFESSIONAL_QUOTATION':
        return <ProfessionalQuotationTemplate data={data} templateConfig={templateConfig} />;
      default:
        // Fallback (shouldn't be hit because of templateKey logic), render tax invoice as safe fallback
        return <TaxInvoiceTemplate data={data} templateConfig={templateConfig} />;
    }
  };

  return (
    <div id="invoice-wrapper" ref={ref} className="invoice-root p-6 bg-white">
      {renderTemplate()}

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
