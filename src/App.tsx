import React, { useState, useEffect, useRef } from 'react';

// Import all your new, separated components and services
import Notification from './components/Notification';
import InvoiceItem from './components/InvoiceItem';
import InvoicePreview from './components/InvoicePreview';
import { loadPdfScripts, generatePdf } from './services/pdfGenerator';
import TemplatePreviewWrapper from './components/template-editor/TemplatePreviewWrapper';
import {
    TemplateConfig,
    createProfessionalQuotationDefaultConfig,
    createPurchaseOrderDefaultConfig,
    createTaxInvoiceDefaultConfig,
    getOrderedFields,
} from './components/template-editor/field-types';
import { loadConfig, saveConfig } from './utils/templateConfigStorage';

// --- Helper Functions & Constants ---
// We keep constants that App.tsx *needs* here.
// You could also move these to a new 'constants.ts' file.
const getCurrentDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    let mm: string | number = today.getMonth() + 1; // Months start at 0!
    let dd: string | number = today.getDate();
    if (dd < 10) dd = '0' + dd;
    if (mm < 10) mm = '0' + mm;
    return `${yyyy}-${mm}-${dd}`;
};

const composeFooterDetails = ({
  companyName,
  companyAddress,
  companyPhone,
  companyEmail,
  footerText = "This is an electronically generated document, no signature is required.",


}: {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  footerText?: string;
}): string => {
  const parts: string[] = [];

  const trimmedName = companyName?.trim();
  const trimmedAddress = companyAddress
    ?.trim()
    ?.replace(/\s*\n\s*/g, ', '); // replace newlines with ", "

  const trimmedPhone = companyPhone?.trim();
  const trimmedEmail = companyEmail?.trim();

  if (trimmedName) parts.push(trimmedName);
  if (trimmedAddress) parts.push(trimmedAddress);

  const contactParts = [trimmedPhone, trimmedEmail].filter(Boolean);
  if (contactParts.length) parts.push(contactParts.join(' | '));

  // create a compact single-line footer
  return parts.join(' • ');
};


export const VISUAL_TEMPLATES = {
    DIGITAL_MARKETING: 'Digital Marketing Style',
    TAX_INVOICE: 'Tax Invoice Style',
    PURCHASE_ORDER: 'Purchase Order Style',
    PROFESSIONAL_QUOTATION: 'Professional Quotation Style',
};

const defaultLogoUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAABJCAMAAAB8a8NCAAAAmVBMVEVHcEz/gwD/gQD/gwD/gQD/gwD/gQD/gwD/gQD/gwD/gQD/gQD/gwD/gQD/gwD/gQD/gwD/gQD/gQD/gQD/gQD/gwD/gQD/gQD/gQD/gQD/gQD/gwD/gQD/gQD/gQD/gQD/gQD/gQD/gwD/gQD/gQD/gQD/gQD/gwD/gwD/gQD/gwD/gwD/gQD/gwD/gwC12B/lAAAAJnRSTlMAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHx/d32f4AAAApElEQVRYw+3WSQqAMAwEUdJg3B0b3f+sDgjvRzIJDk/i4Q4uW+q5iK+S2Kq1pUUtR9iU4LdFk6F/6S91g1rC1fS8hYq4o00v+R5T9+7w2k9h8H91pBvR1D/f0oI+8tH/iP+8v2C/fK92f+7f3vCjR/9u/vXG/9jP2f94f6C/Xn2C/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c7config+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c7Good9+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c7-..";

// --- Content Template Data ---
// New preset templates (placeholders for now)
const INVOICE_COMPANY_NAME = 'NUTHANA ENTERPRISES';
const INVOICE_COMPANY_ADDRESS = '2-1-38, ROAD NO 4, PLOT NO 38, SRI VENKATESWARA\nCOLONY, BANDLAGUDA JAGIR, HYDERABAD';
const INVOICE_COMPANY_EMAIL = 'nuthanasales@gmail.com';
const INVOICE_COMPANY_PHONE = '6304569149';
const INVOICE_FOOTER_TEXT = 'This is an electronically generated document, no signature is required.';

const INVOICE_TEMPLATE = {
    name: 'Invoice',
    data: {
        // Company
        companyName: INVOICE_COMPANY_NAME,
        companyAddress: INVOICE_COMPANY_ADDRESS,
        companyEmail: INVOICE_COMPANY_EMAIL,
        companyPhone: INVOICE_COMPANY_PHONE,
        companyGstin: '36AAVFN0075F1Z2',
        companyBankName: 'ICICI BANK',
        companyAccountNo: '197405500089',
        companyBankBranch: 'Bandlaguda, Hyderabad & ICIC0001974',

        // Buyer (Bill-to)
        clientName: 'MAHADEV SOLUTIONS',
        clientAddress: 'Plot No.21, H.No.3-24/74, Vikas Nagar Colony,\nSai Baba Temple, Bandlaguda Jagir, Hyderbad,\nRangareddy, Telangana, 500086',
        clientPhone: '+91-84668 88128',
        clientContactPerson: 'Mr.Srinu',
        clientGstin: '36ACEFM8212G1ZB',
        clientPan: '',

        // Consignee (Ship-to)
        consigneeName: 'MAHADEV SOLUTIONS',
        consigneeAddress: 'Plot No.21, H.No.3-24/74, Vikas Nagar Colony,\nSai Baba Temple, Bandlaguda Jagir, Hyderbad,\nRangareddy, Telangana, 500086',
        consigneeGstin: '36ACEFM8212G1ZB',
        consigneeState: 'Telangana, Code: 36',
        consigneeContactPerson: 'Mr.Srinu',
        consigneeContact: '+91-84668 88128',

        // Document Details
        invoiceTitle: 'Tax Invoice',
        projectSubject: 'e-Invoice',
        date: '3-Nov-25',
        quotationNumber: 'NE/NOV-433/25-26',

        // Dispatch
        deliveryNote: '',
        buyersOrderNo: '',
        dispatchDocNo: '',
        dispatchedThrough: '',
        destination: '',
        termsOfDelivery: '',

        // Items
        items: [
            { service: 'YZuri/BL', description: '', cost: 8400, quantity: 3, itemNumber: '1', unit: 'EACH', hsn: '83014090', gstRate: 18 },
            { service: 'Yale Access Multi Bridge', description: '', cost: 2625, quantity: 3, itemNumber: '2', unit: 'EACH', hsn: '83016000', gstRate: 18 },
            { service: 'YPVL-902-BM', description: '', cost: 2730, quantity: 23, itemNumber: '3', unit: 'PRS', hsn: '83024110', gstRate: 18 },
            { service: '24-8560BRSS04 PBM', description: '', cost: 840, quantity: 5, itemNumber: '4', unit: 'pcs', hsn: '83016000', gstRate: 18 },
        ],

        // Footer & Totals
        notes: '',
        declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
        roundOff: 0.06,
        gstType: 'CGST/SGST',
        template: VISUAL_TEMPLATES.TAX_INVOICE,
        logoSrc: defaultLogoUrl,
        authorizedSignatureUrl: null,
        authorizedPersonName: null,
        footerDetails: composeFooterDetails({
            footerText: INVOICE_FOOTER_TEXT,
        }),
    }
};

const PURCHASE_ORDER_COMPANY_NAME = 'MAHADEV SOLUTIONS';
const PURCHASE_ORDER_COMPANY_ADDRESS = '123 Tech Road\nVisakhapatnam, AP 530001';
const PURCHASE_ORDER_COMPANY_EMAIL = 'mahadevsolution7@gmail.com';
const PURCHASE_ORDER_COMPANY_PHONE = '9030602967';

const PURCHASE_ORDER_TEMPLATE = {
    name: "Purchase Order",
    data: {
        companyName: PURCHASE_ORDER_COMPANY_NAME,
        companyAddress: PURCHASE_ORDER_COMPANY_ADDRESS,
        companyEmail: PURCHASE_ORDER_COMPANY_EMAIL,
        companyPhone: PURCHASE_ORDER_COMPANY_PHONE,
        clientName: 'Supplier Name',
        clientCompany: 'Supplier Company Inc.',
        clientAddress: '456 Supplier Ave\nHyderabad, TS 500001',
        projectSubject: 'Procurement of Office Supplies',
        invoiceTitle: 'Purchase Order',
        date: getCurrentDate(),
        quotationNumber: 'PO-2025-001',
        items: [
            { service: 'Product XYZ', description: 'Item Model #123-ABC', cost: 150, quantity: 10, itemNumber: 'XYZ-123', unit: 'PCS' },
            { service: 'Product ABC', description: 'Item Model #456-DEF', cost: 75, quantity: 5, itemNumber: 'ABC-456', unit: 'PCS' },
        ],
        notes: 'All items subject to inspection upon delivery. Payment terms: NET 30.',
        template: VISUAL_TEMPLATES.PURCHASE_ORDER,
        logoSrc: defaultLogoUrl,
        authorizedSignatureUrl: null,
        authorizedPersonName: null,

        // PO-Specific Fields
        deliveryAddress: 'MAHADEV SOLUTIONS\n123 Tech Road\nVisakhapatnam, AP 530001',
        deliveryDate: getCurrentDate(),
        requisitioner: 'Project Manager',
        shipVia: 'FedEx Ground',
        fob: 'Origin',
        shippingCost: 50,
       
        footerDetails: composeFooterDetails({
            footerText: INVOICE_FOOTER_TEXT,
        }),
    }
};

const QUOTATION_COMPANY_NAME = 'M/S MAHADEV SOLUTIONS';
const QUOTATION_COMPANY_ADDRESS = 'Plot No. 21, H.No. 3-24/74, Vikas Nagar Colony, Near Sai baba Temple, Bandlaguda Jagir,\nHyderabad, Telangana, India - 500086';
const QUOTATION_COMPANY_EMAIL = 'mahadevsolutions@outlook.com';
const QUOTATION_COMPANY_PHONE = '+91 90306 02967';

const QUOTATION_TEMPLATE = {
    name: "Quotation",
    data: {
        companyName: QUOTATION_COMPANY_NAME,
        companyAddress: QUOTATION_COMPANY_ADDRESS,
        companyEmail: QUOTATION_COMPANY_EMAIL,
        companyPhone: QUOTATION_COMPANY_PHONE,
        companyGstin: '36ACEFM8212G1ZB',
        companyPan: 'ACEFM8212G',

        clientName: 'HIPEX INFRA',
        clientCompany: '',
        clientAddress: 'Legend Chiems, Villa No-299, Gandipet,\nHyderabad, Telangana, India - 500075',
        clientPhone: '+91 84668 88128',
        clientGstin: '37AAPFH8903C1Z9',
        clientPan: 'AAPFH8903C',

        projectSubject: 'Supply of Goods',
        invoiceTitle: 'Quotation',
        date: getCurrentDate(),
        quotationNumber: 'Q-001',

        items: [
            { service: 'YZuri/BL', description: '', cost: 10800, quantity: 3, itemNumber: '1', unit: 'PCS', hsn: '83014090', gstRate: 18 },
            { service: 'Yale Access Multi Bridge', description: '', cost: 4000, quantity: 3, itemNumber: '2', unit: 'PCS', hsn: '83016000', gstRate: 18 },
            { service: 'YPVL-902-BM', description: '', cost: 3880, quantity: 23, itemNumber: '3', unit: 'PCS', hsn: '83024110', gstRate: 18 },
        ],

        notes: '1. Payment: 100% Advance.\n2. Delivery: Within 2 weeks.\n3. Prices are inclusive of all taxes.',
        template: VISUAL_TEMPLATES.PROFESSIONAL_QUOTATION,
        logoSrc: defaultLogoUrl,
        authorizedSignatureUrl: null,
        authorizedPersonName: null,

        // Clear PO-specific fields
        deliveryAddress: '',
        deliveryDate: '',
        requisitioner: '',
        shipVia: '',
        fob: '',
        shippingCost: 0,
        gstType: 'CGST/SGST',
        footerDetails: composeFooterDetails({
            footerText: INVOICE_FOOTER_TEXT,
        }),
    }
};

// Expose all presets (order: Invoice, Purchase Order, Quotation, Agreement)
const PRESET_DATA_TEMPLATES = [INVOICE_TEMPLATE, PURCHASE_ORDER_TEMPLATE, QUOTATION_TEMPLATE];

interface TemplateEditorDefinition {
    defaultConfigFactory: () => TemplateConfig;
    storageKey: string;
}

const TEMPLATE_EDITOR_MAP: Record<string, TemplateEditorDefinition> = {
    [VISUAL_TEMPLATES.TAX_INVOICE]: {
        defaultConfigFactory: createTaxInvoiceDefaultConfig,
        storageKey: 'template-config-tax-invoice',
    },
    [VISUAL_TEMPLATES.PURCHASE_ORDER]: {
        defaultConfigFactory: createPurchaseOrderDefaultConfig,
        storageKey: 'template-config-purchase-order',
    },
    [VISUAL_TEMPLATES.PROFESSIONAL_QUOTATION]: {
        defaultConfigFactory: createProfessionalQuotationDefaultConfig,
        storageKey: 'template-config-professional-quotation',
    },
};

const TEMPLATE_ALIASES: Record<string, string> = {
    // No aliases by default — add mappings like:
    [VISUAL_TEMPLATES.DIGITAL_MARKETING]: VISUAL_TEMPLATES.TAX_INVOICE,
};

// The main application component
export default function App() {
    interface Item { service: string; description: string; cost: number; quantity: number; itemNumber: string; unit: string; hsn: string }
    const initialItem: Item = { service: '', description: '', cost: 0, quantity: 1, itemNumber: '', unit: 'PCS', hsn: '' };
    
    // --- All State Management ---
    const [companyName, setCompanyName] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [companyEmail, setCompanyEmail] = useState('');
    const [companyPhone, setCompanyPhone] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientCompany, setClientCompany] = useState('');
    const [clientAddress, setClientAddress] = useState('');
    const [companyGstin, setCompanyGstin] = useState('');
    const [companyPan, setCompanyPan] = useState('');
    const [clientGstin, setClientGstin] = useState('');
    const [clientPan, setClientPan] = useState('');
    const [clientState, setClientState] = useState('');
    const [clientContactPerson, setClientContactPerson] = useState('');
    const [clientPhone, setClientPhone] = useState('');

    // GST Type: 'CGST/SGST' or 'IGST'
    const [gstType, setGstType] = useState('CGST/SGST');
    const [globalTaxRate, setGlobalTaxRate] = useState(18);
    // --- e-Invoice, Bank, Consignee, Dispatch & Footer fields ---


    // Company additional details
    const [companyBankName, setCompanyBankName] = useState('');
    const [companyAccountNo, setCompanyAccountNo] = useState('');
    const [companyBankBranch, setCompanyBankBranch] = useState('');

    // Consignee (Ship-To)
    const [consigneeName, setConsigneeName] = useState('');
    const [consigneeAddress, setConsigneeAddress] = useState('');
    const [consigneeGstin, setConsigneeGstin] = useState('');
    const [consigneeState, setConsigneeState] = useState('');
    const [consigneeContactPerson, setConsigneeContactPerson] = useState('');
    const [consigneeContact, setConsigneeContact] = useState('');

    // Dispatch & Delivery
    const [deliveryNote, setDeliveryNote] = useState('');
    const [buyersOrderNo, setBuyersOrderNo] = useState('');
    const [dispatchDocNo, setDispatchDocNo] = useState('');
    const [dispatchedThrough, setDispatchedThrough] = useState('');
    const [destination, setDestination] = useState('');
    const [termsOfDelivery, setTermsOfDelivery] = useState('');

    // Totals & Footer
    const [roundOff, setRoundOff] = useState(0);
    const [declaration, setDeclaration] = useState('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.');
    const [projectSubject, setProjectSubject] = useState('');
    const [date, setDate] = useState(getCurrentDate());
    const [quotationNumber, setQuotationNumber] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryDate, setDeliveryDate] = useState(getCurrentDate());
    const [requisitioner, setRequisitioner] = useState('');
    const [shipVia, setShipVia] = useState('');
    const [fob, setFob] = useState('');
    const [shippingCost, setShippingCost] = useState(0);
    const [activeTemplateName, setActiveTemplateName] = useState(''); // Track selected preset
    const [invoiceTitle, setInvoiceTitle] = useState('');
    const [logoSrc, setLogoSrc] = useState(defaultLogoUrl);
    const [authorizedSignatureUrl, setAuthorizedSignatureUrl] = useState<string | null>(null);
    const [authorizedPersonName, setAuthorizedPersonName] = useState('');
    const [authorizedDesignation, setAuthorizedDesignation] = useState('');
    const [items, setItems] = useState<Item[]>([]);
    const [notes, setNotes] = useState('');
    const [footerDetails, setFooterDetails] = useState('');
    const [template, setTemplate] = useState(VISUAL_TEMPLATES.DIGITAL_MARKETING);
    const [templateConfigs, setTemplateConfigs] = useState<Record<string, TemplateConfig | undefined>>({});
    const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [isFormPopulated, setIsFormPopulated] = useState(false);

    const previewRef = useRef<HTMLDivElement>(null);

    // Single source of truth for all form data that Preview & PDF read from
    const [invoiceData, setInvoiceData] = useState<any>({});

    const showNotification = (message: string, type = 'error') => {
        setNotification({ message, type });
    };

    // --- Effect for loading scripts ---
    useEffect(() => {
        // Load PDF scripts
        loadPdfScripts(
            () => setScriptsLoaded(true),
            (errorMsg) => showNotification(errorMsg, 'error')
        );
        
        // No DB listeners anymore
        return () => {};
    }, []);

    useEffect(() => {
        const loaded: Record<string, TemplateConfig | undefined> = {};
        Object.entries(TEMPLATE_EDITOR_MAP).forEach(([key, entry]) => {
            const stored = loadConfig(entry.storageKey);
            if (stored) {
                loaded[key] = stored;
            }
        });
        if (Object.keys(loaded).length) {
            setTemplateConfigs(loaded);
        }
    }, []);

    useEffect(() => {
        const resolvedKey = TEMPLATE_EDITOR_MAP[template] ? template : TEMPLATE_ALIASES[template];
        if (!resolvedKey) {
            setIsTemplateEditorOpen(false);
        }
    }, [template]);

    // --- Form Handlers ---
    const addItem = () => setInvoiceData((prev: any) => ({ ...(prev || {}), items: [ ...(prev?.items || []), { ...initialItem } ] }));

    const updateItem = (index: number, field: keyof Item, value: any, extraFields?: Partial<Item>) => {
        setInvoiceData((prev: any) => {
            const items = [...(prev?.items || [])];
            items[index] = { ...(items[index] || {}), [field]: value, ...(extraFields || {}) };
            return { ...(prev || {}), items };
        });
    };

    const removeItem = (index: number) => setInvoiceData((prev: any) => ({ ...(prev || {}), items: (prev?.items || []).filter((_: any, i: number) => i !== index) }));

    const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setInvoiceData((prev: any) => ({ ...(prev || {}), logoSrc: reader.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const handleSignatureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setInvoiceData((prev: any) => ({ ...(prev || {}), authorizedSignatureUrl: reader.result as string }));
            reader.readAsDataURL(file);
        }
    };
    
    const resetForm = () => {
        setInvoiceData({});
        setTemplate(Object.values(VISUAL_TEMPLATES)[0]);
        setIsFormPopulated(false);
    };
    
    const loadContentTemplate = (templateEntry: any) => {
        const templateData = templateEntry?.data ?? templateEntry;
        const name = templateEntry?.name ?? templateData?.name ?? '';
        const footerText = templateData.footerDetails ?? composeFooterDetails({
            companyName: templateData.companyName,
            companyAddress: templateData.companyAddress,
            companyPhone: templateData.companyPhone,
            companyEmail: templateData.companyEmail,
        });
        const normalized = { ...(templateData || {}) };
        normalized.footerDetails = footerText || normalized.footerDetails || '';
        setInvoiceData(normalized);
        setTemplate(normalized.template || templateData.template || Object.values(VISUAL_TEMPLATES)[0]);
        setActiveTemplateName(name);
        setIsFormPopulated(true);
        showNotification(`${name || 'Template'} loaded!`, 'success');
    };

    // Removed loadInvoice - no database
    
    // --- Data for the preview component ---
    const resolvedTemplateKey = TEMPLATE_EDITOR_MAP[template] ? template : TEMPLATE_ALIASES[template];
    const activeTemplateConfig = resolvedTemplateKey ? templateConfigs[resolvedTemplateKey] : undefined;
    const activeTemplateEditor = resolvedTemplateKey ? TEMPLATE_EDITOR_MAP[resolvedTemplateKey] : undefined;

    // Use single source of truth for preview data
    const previewData = { ...(invoiceData || {}), templateConfig: activeTemplateConfig } as any;

    // Build effective preview data that includes defaultValue from template config
    const effectivePreviewData = { ...previewData } as any;
    const fieldMap: Record<string, any> = {};
    if (activeTemplateConfig) {
        const sectionIds = Object.keys(activeTemplateConfig.sections || {});
        sectionIds.forEach((sid) => {
            const fields = getOrderedFields(activeTemplateConfig, sid as any) || [];
            fields.forEach((f: any) => {
                fieldMap[f.key] = f;
                if (effectivePreviewData[f.key] == null && f.defaultValue !== undefined) {
                    // coerce checkbox default to boolean
                    if (f.type === 'checkbox') {
                        const dv = f.defaultValue;
                        effectivePreviewData[f.key] = dv === true || dv === 'true';
                    } else if (f.type === 'number' || f.type === 'currency') {
                        const num = Number(f.defaultValue);
                        effectivePreviewData[f.key] = Number.isFinite(num) ? num : f.defaultValue;
                    } else {
                        effectivePreviewData[f.key] = f.defaultValue;
                    }
                }
            });
        });
    }

    const getPlaceholderForKey = (key: string, fallback?: string) => {
        const f = fieldMap[key];
        return (f && f.placeholder) || fallback || '';
    };

    // --- Main Logic Handlers --- (no database writes)

    const handleTemplateConfigApply = (templateKey: string, updatedConfig: TemplateConfig) => {
        let shouldPersist = false;
        setTemplateConfigs(prev => {
            const current = prev[templateKey];
            if (current === updatedConfig) {
                return prev;
            }
            shouldPersist = true;
            return { ...prev, [templateKey]: updatedConfig };
        });

        const entry = TEMPLATE_EDITOR_MAP[templateKey];
        if (shouldPersist && entry) {
            saveConfig(entry.storageKey, updatedConfig);
        }
    };
    
    // App.tsx - replace handleGeneratePdf with this

    const handleGeneratePdf = async () => {
        setIsGenerating(true);

        // If user provided custom footer lines use them; otherwise build fallback from company fields.
        const fallbackFooter = composeFooterDetails({
            footerText: INVOICE_FOOTER_TEXT,
        });
        const footerLine = (invoiceData.footerDetails && String(invoiceData.footerDetails).trim().length > 0) ? invoiceData.footerDetails : fallbackFooter;

        try {
            // Pass the whole previewData (invoice metadata) so pdfGenerator can render Invoice No and Billed To
            const invoiceMeta = {
                quotationNumber: invoiceData?.quotationNumber,
                invoiceNumber: invoiceData?.quotationNumber,
                date: invoiceData?.date,
                clientName: invoiceData?.clientName,
                consigneeName: invoiceData?.consigneeName,
                companyName: invoiceData?.companyName,
                footerDetails: footerLine,
            };

            // NOTE: generatePdf signature was updated to accept invoiceMeta + footerText + signatureImageUrl
            await generatePdf(previewRef, invoiceMeta, invoiceData?.logoSrc || logoSrc, footerLine, invoiceData?.authorizedSignatureUrl || undefined, (errMsg: string) => {
                showNotification(errMsg, 'error');
            });
        } catch (e) {
            showNotification('Failed to generate PDF.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    
    const isButtonDisabled = isGenerating;

    // --- Main JSX Layout ---
    return (
        <>
            <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: '' })} />
            <div className="bg-gray-100 min-h-screen font-sans">
                <header className="bg-white shadow-md">
                    <div className="container mx-auto px-4 py-4"><h1 className="text-3xl font-bold text-gray-800">Mahadev Solutions</h1><p className="text-gray-500">The Future You Build, The Expertise We Bring...</p></div>
                </header>
                <main className="container mx-auto p-4 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg h-fit">
                        <div className="mb-6 border-b pb-4">
                            <h2 className="text-2xl font-semibold mb-3">Invoice Templates</h2>
                            <div className="flex flex-col sm:flex-row gap-2">
                                {PRESET_DATA_TEMPLATES.map(ct => (
                                    <button key={ct.name} onClick={() => loadContentTemplate(ct)} className="flex-1 p-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition text-sm">{ct.name}</button>
                                ))}
                            </div>
                        </div>
                        {isFormPopulated ? (
                            <>
                                <div className="flex justify-between items-center mb-6 border-b pb-3"><h2 className="text-2xl font-semibold">Edit Details</h2><button onClick={resetForm} className="text-sm text-red-600 hover:underline">Clear Form</button></div>

                                {/* Invoice-only: e-Invoice Details */}
                                {activeTemplateName === 'Invoice' && (
                                    <div className="space-y-4 mb-6">
                                        <h3 className="font-semibold text-lg border-b pb-2">e-Invoice Details</h3>
                                    </div>
                                )}

                                <div className="space-y-4 mb-6">
                                    <h3 className="font-semibold text-lg border-b pb-2">Your Company Details</h3>
                                    <div className="flex items-center space-x-4">
                                        <img src={logoSrc} alt="Current Logo" className="h-12 w-12 object-contain border p-1 rounded-md bg-gray-50"/>
                                        <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 text-sm font-semibold py-2 px-3 rounded-lg hover:bg-gray-50">Upload Logo<input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} /></label>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                                            {authorizedSignatureUrl ? (
                                                <img
                                                    src={authorizedSignatureUrl}
                                                    alt="Authorized signature preview"
                                                    className="h-16 w-auto max-w-[10rem] border p-1 rounded-md bg-gray-50"
                                                />
                                            ) : (
                                                <div className="h-16 w-40 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center text-xs text-gray-400">
                                                    Signature Preview
                                                </div>
                                            )}
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 text-sm font-semibold py-2 px-3 rounded-lg hover:bg-gray-50">
                                                    Upload Signature
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg"
                                                        className="hidden"
                                                        onChange={handleSignatureChange}
                                                    />
                                                </label>
                                                {authorizedSignatureUrl && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setAuthorizedSignatureUrl(null)}
                                                        className="text-xs text-red-600 hover:underline"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder={getPlaceholderForKey('authorizedPersonName', 'Authorized Person Name')}
                                            value={invoiceData.authorizedPersonName || ''}
                                            onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), authorizedPersonName: e.target.value }))}
                                            className="w-full p-2 border rounded-md"
                                        />
                                        <input
                                            type="text"
                                            placeholder={getPlaceholderForKey('authorizedDesignation', 'Designation')}
                                            value={invoiceData.authorizedDesignation || ''}
                                            onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), authorizedDesignation: e.target.value }))}
                                            className="w-full p-2 border rounded-md mt-2"
                                        />
                                    </div>
                                            <input type="text" placeholder={getPlaceholderForKey('companyName', 'Company Name')} value={invoiceData.companyName || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), companyName: e.target.value }))} className="w-full p-2 border rounded-md" />
                                            <textarea placeholder={getPlaceholderForKey('companyAddress', 'Company Address')} value={invoiceData.companyAddress || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), companyAddress: e.target.value }))} className="w-full p-2 border rounded-md" rows={2}></textarea>
                                            <input type="email" placeholder={getPlaceholderForKey('companyEmail', 'Company Email')} value={invoiceData.companyEmail || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), companyEmail: e.target.value }))} className="w-full p-2 border rounded-md" />
                                            <input type="tel" placeholder={getPlaceholderForKey('companyPhone', 'Company Phone')} value={invoiceData.companyPhone || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), companyPhone: e.target.value }))} className="w-full p-2 border rounded-md" />
                                    {(activeTemplateName === 'Quotation') && (
                                        <div className="flex space-x-2 mt-2">
                                            <input 
                                                   type="text" 
                                                   placeholder={getPlaceholderForKey('companyGstin', 'Company GSTIN')}
                                                value={invoiceData.companyGstin || ''} 
                                                onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), companyGstin: e.target.value }))} 
                                                className="w-1/2 p-2 border rounded-md" 
                                            />
                                            <input 
                                                type="text" 
                                                placeholder="Company PAN" 
                                                value={invoiceData.companyPan || ''} 
                                                onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), companyPan: e.target.value }))} 
                                                className="w-1/2 p-2 border rounded-md" 
                                            />
                                        </div>
                                    )}
                                    {(activeTemplateName === 'Invoice') && (
                                        <div className="flex space-x-2 mt-2">
                                            <input 
                                                   type="text" 
                                                   placeholder={getPlaceholderForKey('companyGstin', 'Company GSTIN')}
                                                value={invoiceData.companyGstin || ''} 
                                                onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), companyGstin: e.target.value }))} 
                                                className="w-full p-2 border rounded-md" 
                                            />
                                        </div>
                                    )}

                                    {/* Invoice-only: Bank Details & Declaration */}
                                    {activeTemplateName === 'Invoice' && (
                                        <>
                                            <h4 className="font-semibold text-md pt-2">Bank Details</h4>
                                            <input type="text" placeholder={getPlaceholderForKey('companyBankName', 'Bank Name')} value={invoiceData.companyBankName || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), companyBankName: e.target.value }))} className="w-full p-2 border rounded-md" />
                                            <div className="flex space-x-2">
                                                <input type="text" placeholder={getPlaceholderForKey('companyAccountNo', 'Account No.')} value={invoiceData.companyAccountNo || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), companyAccountNo: e.target.value }))} className="w-1/2 p-2 border rounded-md" />
                                                <input type="text" placeholder={getPlaceholderForKey('companyBankBranch', 'Branch & IFS Code')} value={invoiceData.companyBankBranch || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), companyBankBranch: e.target.value }))} className="w-1/2 p-2 border rounded-md" />
                                            </div>

                                            <textarea placeholder="Declaration" value={invoiceData.declaration || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), declaration: e.target.value }))} className="w-full p-3 border rounded-md" rows={3}></textarea>
                                        </>
                                    )}
                                </div>

                                <div className="space-y-4 mb-6">
                                    <h3 className="font-semibold text-lg border-b pb-2">{activeTemplateName === 'Purchase Order' ? 'Vendor / Supplier Details' : activeTemplateName === 'Quotation' ? 'Billed To' : activeTemplateName === 'Invoice' ? 'Buyer (Bill-to) Details' : 'Client Details'}</h3>
                                    <input type="text" placeholder={getPlaceholderForKey('clientName', activeTemplateName === 'Purchase Order' ? 'Supplier Name' : 'Client Name')} value={invoiceData.clientName || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), clientName: e.target.value }))} className="w-full p-2 border rounded-md" />
                                    {/* Hide Client Company for Invoice */}
                                    {activeTemplateName !== 'Invoice' && (
                                        <input 
                                            type="text" 
                                            placeholder={getPlaceholderForKey('clientCompany', activeTemplateName === 'Purchase Order' ? 'Supplier Company (Optional)' : 'Client Company (Optional)')} 
                                            value={invoiceData.clientCompany || ''} 
                                            onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), clientCompany: e.target.value }))} 
                                            className="w-full p-2 border rounded-md" 
                                        />
                                    )}
                                    <textarea placeholder={getPlaceholderForKey('clientAddress', activeTemplateName === 'Purchase Order' ? 'Supplier Address' : 'Client Address')} value={invoiceData.clientAddress || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), clientAddress: e.target.value }))} className="w-full p-2 border rounded-md" rows={2}></textarea>
                                    {/* Show extra Buyer fields ONLY for Invoice */}
                                    {activeTemplateName === 'Invoice' && (
                                        <>
                                            <input 
                                                type="text" 
                                                placeholder={getPlaceholderForKey('clientGstin', 'Client GSTIN/UIN')}
                                                value={invoiceData.clientGstin || ''} 
                                                onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), clientGstin: e.target.value }))} 
                                                className="w-full p-2 border rounded-md" 
                                            />
                                            <input 
                                                type="text" 
                                                placeholder={getPlaceholderForKey('clientState', 'Client State (e.g., Telangana, Code: 36)')}
                                                value={invoiceData.clientState || ''} 
                                                onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), clientState: e.target.value }))} 
                                                className="w-full p-2 border rounded-md" 
                                            />
                                            <input 
                                                type="text" 
                                                placeholder={getPlaceholderForKey('clientContactPerson', 'Client Contact Person')}
                                                value={invoiceData.clientContactPerson || ''} 
                                                onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), clientContactPerson: e.target.value }))} 
                                                className="w-1/2 p-2 border rounded-md" 
                                            />
                                        </>
                                    )}
                                        <input 
                                        type="tel" 
                                        placeholder={getPlaceholderForKey('clientPhone', activeTemplateName === 'Purchase Order' ? 'Supplier Phone' : 'Client Phone')}
                                        value={invoiceData.clientPhone || ''} 
                                        onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), clientPhone: e.target.value }))} 
                                        className="w-1/2 p-2 border rounded-md" 
                                    />
                                    {activeTemplateName === 'Quotation' && (
                                        <div className="flex space-x-2 mt-2">
                                            <input 
                                                type="text" 
                                                placeholder="Client GSTIN" 
                                                value={invoiceData.clientGstin || ''} 
                                                onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), clientGstin: e.target.value }))} 
                                                className="w-1/2 p-2 border rounded-md" 
                                            />
                                            <input 
                                                type="text" 
                                                placeholder="Client PAN" 
                                                value={invoiceData.clientPan || ''} 
                                                onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), clientPan: e.target.value }))} 
                                                className="w-1/2 p-2 border rounded-md" 
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Invoice-only: Consignee (Ship-to) Details */}
                                {activeTemplateName === 'Invoice' && (
                                    <div className="space-y-4 mb-6">
                                        <h3 className="font-semibold text-lg border-b pb-2">Consignee (Ship-to) Details</h3>
                                        <input type="text" placeholder={getPlaceholderForKey('consigneeName', 'Consignee Name')} value={invoiceData.consigneeName || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), consigneeName: e.target.value }))} className="w-full p-2 border rounded-md" />
                                        <textarea placeholder={getPlaceholderForKey('consigneeAddress', 'Consignee Address')} value={invoiceData.consigneeAddress || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), consigneeAddress: e.target.value }))} className="w-full p-2 border rounded-md" rows={2}></textarea>
                                        <input type="text" placeholder={getPlaceholderForKey('consigneeGstin', 'Consignee GSTIN/UIN')} value={invoiceData.consigneeGstin || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), consigneeGstin: e.target.value }))} className="w-full p-2 border rounded-md" />
                                        <input type="text" placeholder={getPlaceholderForKey('consigneeState', 'Consignee State (e.g., Telangana, Code: 36)')} value={invoiceData.consigneeState || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), consigneeState: e.target.value }))} className="w-full p-2 border rounded-md" />
                                        <div className="flex space-x-2">
                                            <input type="text" placeholder={getPlaceholderForKey('consigneeContactPerson', 'Contact Person')} value={invoiceData.consigneeContactPerson || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), consigneeContactPerson: e.target.value }))} className="w-1/2 p-2 border rounded-md" />
                                            <input type="text" placeholder={getPlaceholderForKey('consigneeContact', 'Contact Phone')} value={invoiceData.consigneeContact || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), consigneeContact: e.target.value }))} className="w-1/2 p-2 border rounded-md" />
                                        </div>
                                    </div>
                                )}

                                {activeTemplateName === 'Purchase Order' && (
                                    <div className="space-y-4 mb-6">
                                        <h3 className="font-semibold text-lg border-b pb-2">Ship-To Details</h3>
                                        <textarea 
                                            placeholder="Shipping Address (if different from Vendor)" 
                                            value={invoiceData.deliveryAddress || ''} 
                                            onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), deliveryAddress: e.target.value }))} 
                                            className="w-full p-2 border rounded-md" 
                                            rows={2}
                                        ></textarea>
                                    </div>
                                )}
                                
                                <div className="space-y-4 mb-6">
                                    <h3 className="font-semibold text-lg border-b pb-2">Document Details</h3>
                                                <input type="text" placeholder={getPlaceholderForKey('invoiceTitle', 'Invoice Title (e.g., Quotation)')} value={invoiceData.invoiceTitle || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), invoiceTitle: e.target.value }))} className="w-full p-2 border rounded-md" />
                                                <input type="text" placeholder={getPlaceholderForKey('projectSubject', 'Project Subject')} value={invoiceData.projectSubject || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), projectSubject: e.target.value }))} className="w-full p-2 border rounded-md" />
                                                <div className="flex space-x-2">
                                                    <input type="date" value={invoiceData.date || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), date: e.target.value }))} className="w-1/2 p-2 border rounded-md" />
                                                    <input type="text" placeholder={getPlaceholderForKey('quotationNumber', activeTemplateName === 'Purchase Order' ? 'P.O. Number' : activeTemplateName === 'Quotation' ? 'Quotation #' : activeTemplateName === 'Invoice' ? 'Invoice No.' : 'Quote #')} value={invoiceData.quotationNumber || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), quotationNumber: e.target.value }))} className="w-1/2 p-2 border rounded-md" />
                                                </div>
                                </div>

                                {/* Tax Settings are now always visible */}
                                <div className="space-y-4 mb-6">
                                    <h3 className="font-semibold text-lg border-b pb-2">Tax Settings</h3>
                                    <div className="flex space-x-2">
                                        <div className="w-1/2">
                                            <label className="block text-sm font-medium text-gray-700">GST Type</label>
                                            <select 
                                                value={invoiceData.gstType || 'CGST/SGST'} 
                                                onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), gstType: e.target.value }))} 
                                                className="w-full p-3 border rounded-md bg-white"
                                            >
                                                <option value="CGST/SGST">CGST / SGST</option>
                                                <option value="IGST">IGST</option>
                                            </select>
                                        </div>
                                        <div className="w-1/2">
                                            <label className="block text-sm font-medium text-gray-700">Tax Rate (%)</label>
                                            <input 
                                                type="number" 
                                                value={invoiceData.globalTaxRate || 0} 
                                                onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), globalTaxRate: parseFloat(e.target.value) || 0 }))} 
                                                className="w-full p-3 border rounded-md" 
                                            />
                                        </div>
                                    </div>
                                </div>

                                {activeTemplateName === 'Purchase Order' && (
                                    <div className="space-y-4 mb-6">
                                        <h3 className="font-semibold text-lg border-b pb-2">Shipping & PO Details</h3>
                                        <div className="flex space-x-2">
                                            <input type="text" placeholder={getPlaceholderForKey('requisitioner', 'Requisitioner')} value={invoiceData.requisitioner || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), requisitioner: e.target.value }))} className="w-full p-2 border rounded-md" />
                                        </div>
                                        <div className="flex space-x-2">
                                            <input type="text" placeholder={getPlaceholderForKey('shipVia', 'Ship Via (e.g., FedEx)')} value={invoiceData.shipVia || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), shipVia: e.target.value }))} className="w-1/2 p-2 border rounded-md" />
                                            <input type="text" placeholder={getPlaceholderForKey('fob', 'F.O.B.')} value={invoiceData.fob || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), fob: e.target.value }))} className="w-1/2 p-2 border rounded-md" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Shipping Cost</label>
                                            <input 
                                                type="number" 
                                                placeholder={getPlaceholderForKey('shippingCost', 'Shipping Cost')} 
                                                value={invoiceData.shippingCost || 0} 
                                                onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), shippingCost: parseFloat(e.target.value) || 0 }))} 
                                                className="w-full p-2 border rounded-md" 
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Invoice-only: Dispatch & Delivery Details */}
                                {activeTemplateName === 'Invoice' && (
                                    <div className="space-y-4 mb-6">
                                        <h3 className="font-semibold text-lg border-b pb-2">Dispatch & Delivery Details</h3>
                                        <input type="text" placeholder={getPlaceholderForKey('deliveryNote', 'Delivery Note')} value={invoiceData.deliveryNote || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), deliveryNote: e.target.value }))} className="w-full p-2 border rounded-md" />
                                        <input type="text" placeholder={getPlaceholderForKey('buyersOrderNo', "Buyer's Order No.") } value={invoiceData.buyersOrderNo || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), buyersOrderNo: e.target.value }))} className="w-full p-2 border rounded-md" />
                                        <input type="text" placeholder={getPlaceholderForKey('dispatchDocNo', 'Dispatch Doc No.')} value={invoiceData.dispatchDocNo || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), dispatchDocNo: e.target.value }))} className="w-full p-2 border rounded-md" />
                                        <input type="text" placeholder={getPlaceholderForKey('dispatchedThrough', 'Dispatched Through')} value={invoiceData.dispatchedThrough || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), dispatchedThrough: e.target.value }))} className="w-full p-2 border rounded-md" />
                                        <input type="text" placeholder={getPlaceholderForKey('destination', 'Destination')} value={invoiceData.destination || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), destination: e.target.value }))} className="w-full p-2 border rounded-md" />
                                        <input type="text" placeholder={getPlaceholderForKey('termsOfDelivery', 'Terms of Delivery')} value={invoiceData.termsOfDelivery || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), termsOfDelivery: e.target.value }))} className="w-full p-2 border rounded-md" />
                                    </div>
                                )}

                                <div className="mb-6">
                                <h3 className="font-semibold mb-2">Services / Items</h3>
                                {(invoiceData.items || []).map((item: any, index: number) => (
                                    <InvoiceItem 
                                        key={index} 
                                        item={item} 
                                        index={index} 
                                        updateItem={updateItem} 
                                        removeItem={removeItem} 
                                        activeTemplateName={activeTemplateName}
                                    />
                                    ))}
                                    <button onClick={addItem} className="w-full mt-2 p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition">+ Add Item</button>
                                </div>
                                
                                <div className="space-y-4 mb-6">
                                    <textarea placeholder={getPlaceholderForKey('notes', 'Notes / Terms & Conditions')} value={invoiceData.notes || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), notes: e.target.value }))} className="w-full p-3 border rounded-md" rows={3}></textarea>

                                    {activeTemplateName === 'Invoice' && (
                                        <div className="space-y-4 mb-2">
                                            <textarea placeholder={getPlaceholderForKey('declaration', 'Declaration')} value={invoiceData.declaration || ''} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), declaration: e.target.value }))} className="w-full p-3 border rounded-md" rows={3}></textarea>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Round Off</label>
                                                <input type="number" step="0.01" placeholder={getPlaceholderForKey('roundOff', '0.00')} value={invoiceData.roundOff || 0} onChange={e => setInvoiceData((prev:any) => ({ ...(prev||{}), roundOff: parseFloat(e.target.value) || 0 }))} className="w-full p-2 border rounded-md" />
                                            </div>
                                        </div>
                                    )}

                                    <label className="block text-sm font-medium text-gray-700">Visual Style</label>
                                    <select value={template} onChange={e => { setTemplate(e.target.value); setInvoiceData((prev:any)=>({ ...(prev||{}), template: e.target.value })); }} className="w-full p-3 border rounded-md bg-white">
                                        {Object.values(VISUAL_TEMPLATES).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2 mb-6">
                                    <h3 className="font-semibold text-lg border-b pb-2">Footer Details</h3>
                                    <textarea
                                        placeholder={getPlaceholderForKey('footerDetails', 'Add company footer lines')}
                                        value={invoiceData.footerDetails || ''}
                                        onChange={(event) => setInvoiceData((prev:any) => ({ ...(prev||{}), footerDetails: event.target.value }))}
                                        className="w-full p-3 border rounded-md"
                                        rows={3}
                                    ></textarea>
                                    <p className="text-xs text-gray-500">
                                        These lines appear in the live preview and PDF footer. Use line breaks to control how the footer is stacked.
                                    </p>
                                </div>

                                <div>
                                    <button onClick={handleGeneratePdf} disabled={isButtonDisabled || !scriptsLoaded} className="w-full p-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">
                                        {isGenerating ? 'Generating...' : !scriptsLoaded ? 'Loading Libs...' : 'Generate PDF'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-16 text-gray-500"><p className="font-semibold text-lg">Please select a template above to begin.</p></div>
                        )}
                    </div>
                    <div className="lg:col-span-2 space-y-8">
                         <div>
                            <h2 className="text-2xl font-semibold mb-4">Live Preview</h2>
                            <div className="overflow-x-auto">
                                <div style={{width: '210mm'}}>
                                   {isFormPopulated ? <InvoicePreview ref={previewRef} data={effectivePreviewData} /> : <div className="bg-white p-8 shadow-lg rounded-xl h-96 flex items-center justify-center text-gray-400">Preview will appear here...</div>}
                                </div>
                            </div>
                            {activeTemplateEditor && (
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsTemplateEditorOpen(prev => !prev)}
                                        className="rounded-md border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
                                    >
                                        {isTemplateEditorOpen ? 'Close Template Editor' : 'Customize Template'}
                                    </button>
                                    {isTemplateEditorOpen && resolvedTemplateKey && (
                                        <div className="mt-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                                            <TemplatePreviewWrapper
                                                defaultConfigFactory={activeTemplateEditor.defaultConfigFactory}
                                                config={activeTemplateConfig}
                                                storageKey={activeTemplateEditor.storageKey}
                                                onConfigApply={(updatedConfig) => handleTemplateConfigApply(resolvedTemplateKey, updatedConfig)}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Saved Invoices section removed (no database) */}
                    </div>
                </main>
            </div>
        </>
    );
}