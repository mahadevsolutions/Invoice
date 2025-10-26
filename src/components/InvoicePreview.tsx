import React from 'react';
// Avoid importing VISUAL_TEMPLATES from App to prevent a circular dependency.
// Define the same keys locally here to keep the preview logic self-contained.
export const VISUAL_TEMPLATES = {
    DIGITAL_MARKETING: 'Digital Marketing Style',
    AGREEMENT: 'Service Agreement Style',
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

interface InvoicePreviewProps {
    data: any;
}

const InvoicePreview = React.forwardRef<HTMLDivElement, InvoicePreviewProps>(({ data }, ref) => {
    const items = data?.items ?? [];
    const template = data?.template ?? VISUAL_TEMPLATES.MODERN;
    const subtotal = items.reduce((acc: number, item: any) => acc + (item?.cost || 0) * (item?.quantity || 1), 0);
    const tax = subtotal * 0.18; 
    const total = subtotal + tax;

    const renderTemplate = () => {
        switch (template) {
            case VISUAL_TEMPLATES.DIGITAL_MARKETING:
                return <DigitalMarketingTemplate data={data} total={total} />;
            case VISUAL_TEMPLATES.FORMAL:
                return <FormalTemplate data={data} subtotal={subtotal} tax={tax} total={total} />;
            case VISUAL_TEMPLATES.AGREEMENT:
                return <AgreementTemplate data={data} total={total} />;
            case VISUAL_TEMPLATES.WEBSITE:
            case VISUAL_TEMPLATES.WEBSITE_DEVELOPMENT:
                return <WebsiteTemplate data={data} subtotal={subtotal} tax={tax} total={total} />;
            case VISUAL_TEMPLATES.MODERN:
            default:
                return <ModernTemplate data={data} total={total} />;
        }
    };

    return (
        <div ref={ref} className="p-8 bg-white shadow-lg rounded-xl">
            {renderTemplate()}
        </div>
    );
});

export default InvoicePreview;