import React from 'react';
// Avoid importing VISUAL_TEMPLATES from App to prevent a circular dependency.
// Define the same keys locally here to keep the preview logic self-contained.
export const VISUAL_TEMPLATES = {
    DIGITAL_MARKETING: 'Digital Marketing Style',
    AGREEMENT: 'Service Agreement Style',
    TAX_INVOICE: 'Tax Invoice Style',
    PURCHASE_ORDER: 'Purchase Order Style',
    PROFESSIONAL_QUOTATION: 'Professional Quotation Style',
    MODERN: 'Modern Red Style',
    WEBSITE: 'Website Style',
    WEBSITE_DEVELOPMENT: 'Website Development Style',
    FORMAL: 'Formal Classic Style',
};

// Import your separated template components
import { DigitalMarketingTemplate } from './DigitalMarketingTemplate';
import { FormalTemplate } from './FormalTemplate';
import { AgreementTemplate } from './AgreementTemplates';
import { ModernTemplate } from './ModernTemplate';
import WebsiteTemplate from './WebsiteTemplate';
import PurchaseOrderTemplate from './PurchaseOrderTemplate';
import ProfessionalQuotationTemplate from './ProfessionalQuotationTemplate';
import { TaxInvoiceTemplate } from './TaxInvoiceTemplate';

interface InvoicePreviewProps {
    data: any;
}

const InvoicePreview = React.forwardRef<HTMLDivElement, InvoicePreviewProps>(({ data }, ref) => {
    const items = data?.items ?? [];
    const template = data?.template ?? VISUAL_TEMPLATES.MODERN;
    const subtotal = items.reduce((acc: number, item: any) => acc + (item?.cost || 0) * (item?.quantity || 1), 0);
    // --- REVISED TAX LOGIC ---
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
    // --- END REVISED TAX LOGIC ---

    const renderTemplate = () => {
        switch (template) {
            case VISUAL_TEMPLATES.DIGITAL_MARKETING:
                return <DigitalMarketingTemplate data={data} subtotal={subtotal} totalCgst={totalCgst} totalSgst={totalSgst} totalIgst={totalIgst} total={total} />;
            case VISUAL_TEMPLATES.FORMAL:
                return <FormalTemplate data={data} subtotal={subtotal} totalCgst={totalCgst} totalSgst={totalSgst} totalIgst={totalIgst} total={total} />;
            case VISUAL_TEMPLATES.PURCHASE_ORDER:
                    return <PurchaseOrderTemplate data={data} subtotal={subtotal} totalCgst={totalCgst} totalSgst={totalSgst} totalIgst={totalIgst} total={total} />;
            case VISUAL_TEMPLATES.TAX_INVOICE:
                return <TaxInvoiceTemplate data={data} />;
            case VISUAL_TEMPLATES.PROFESSIONAL_QUOTATION:
                return <ProfessionalQuotationTemplate data={data} />;
            case VISUAL_TEMPLATES.AGREEMENT:
                return <AgreementTemplate data={data} subtotal={subtotal} totalCgst={totalCgst} totalSgst={totalSgst} totalIgst={totalIgst} total={total} />;
            case VISUAL_TEMPLATES.WEBSITE:
            case VISUAL_TEMPLATES.WEBSITE_DEVELOPMENT:
                return <WebsiteTemplate data={data} subtotal={subtotal} totalCgst={totalCgst} totalSgst={totalSgst} totalIgst={totalIgst} total={total} />;
            case VISUAL_TEMPLATES.MODERN:
            default:
                return <ModernTemplate data={data} subtotal={subtotal} totalCgst={totalCgst} totalSgst={totalSgst} totalIgst={totalIgst} total={total} />;
        }
    };

    return (
        <div ref={ref} className="p-8 bg-white shadow-lg rounded-xl">
            {renderTemplate()}
        </div>
    );
});

export default InvoicePreview;