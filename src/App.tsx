import React, { useState, useEffect, useRef } from 'react';

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
  shouldShowField,
} from './components/template-editor/field-types';
import { loadConfig, saveConfig } from './utils/templateConfigStorage';

const getCurrentDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  let mm: string | number = today.getMonth() + 1;
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
}: {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}): string => {
  const parts: string[] = [];

  const trimmedName = companyName?.trim();
  const trimmedAddress = companyAddress?.trim()?.replace(/\s*\n\s*/g, ', ');
  const trimmedPhone = companyPhone?.trim();
  const trimmedEmail = companyEmail?.trim();

  if (trimmedName) parts.push(trimmedName);
  if (trimmedAddress) parts.push(trimmedAddress);

  const contactParts = [trimmedPhone, trimmedEmail].filter(Boolean);
  if (contactParts.length) parts.push(contactParts.join(' | '));

  return parts.join(' • ');
};

export const VISUAL_TEMPLATES = {
  DIGITAL_MARKETING: 'Digital Marketing Style',
  TAX_INVOICE: 'Tax Invoice Style',
  PURCHASE_ORDER: 'Purchase Order Style',
  PROFESSIONAL_QUOTATION: 'Professional Quotation Style',
};

const defaultLogoUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAABJCAMAAAB8a8NCAAAAmVBMVEVHcEz/gwD/gQD/gwD/gQD/gwD/gQD/gwD/gQD/gwD/gQD/gQD/gwD/gQD/gwD/gQD/gQD/gQD/gQD/gQD/gQD/gQD/gQD/gQD/gQD/gwD/gQD/gQD/gQD/gQD/gQD/gQD/gwD/gQD/gQD/gQD/gQD/gwD/gwD/gQD/gwD/gwD/gQD/gwD/gwC12B/lAAAAJnRSTlMAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHx/d32f4AAAApElEQVRYw+3WSQqAMAwEUdJg3B0b3f+sDgjvRzIJDk/i4Q4uW+q5iK+S2Kq1pUUtR9iU4LdFk6F/6S91g1rC1fS8hYq4o00v+R5T9+7w2k9h8H91pBvR1D/f0oI+8tH/iP+8v2C/fK92f+7f3vCjR/9u/vXG/9jP2f94f6C/Xn2C/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c7-..';

const BANK_DEFAULTS = {
  companyBankName: 'AXIS BANK',
  companyAccountNo: '925020045861677',
  companyCustomerId: '977860708',
  companyBankBranch: 'KISMATPUR',
  companyIfscCode: 'UTIB0005921',
};

const INVOICE_COMPANY_NAME = 'MAHADEV SOLUTIONS';
const INVOICE_COMPANY_ADDRESS =
  '2-1-38, ROAD NO 4, PLOT NO 38, SRI VENKATESWARA\nCOLONY, BANDLAGUDA JAGIR, HYDERABAD';
const INVOICE_COMPANY_EMAIL = 'mahadevsolutions@outlook.com';
const INVOICE_COMPANY_PHONE = '6304569149';
const SYSTEM_GENERATED_FOOTER_TEXT = 'This is an electronically generated document, no signature is required.';

const INVOICE_TEMPLATE = {
  name: 'Invoice',
  data: {
    companyName: INVOICE_COMPANY_NAME,
    companyAddress: INVOICE_COMPANY_ADDRESS,
    companyEmail: INVOICE_COMPANY_EMAIL,
    companyPhone: INVOICE_COMPANY_PHONE,
    companyGstin: '36AAVFN0075F1Z2',
    ...BANK_DEFAULTS,
    clientName: 'MAHADEV SOLUTIONS',
    clientAddress:
      'Plot No.21, H.No.3-24/74, Vikas Nagar Colony,\nSai Baba Temple, Bandlaguda Jagir, Hyderbad,\nRangareddy, Telangana, 500086',
    clientPhone: '+91-84668 88128',
    clientContactPerson: 'Mr.Srinu',
    clientGstin: '36ACEFM8212G1ZB',
    clientPan: '',
    consigneeName: 'MAHADEV SOLUTIONS',
    consigneeAddress:
      'Plot No.21, H.No.3-24/74, Vikas Nagar Colony,\nSai Baba Temple, Bandlaguda Jagir, Hyderbad,\nRangareddy, Telangana, 500086',
    consigneeGstin: '36ACEFM8212G1ZB',
    consigneeState: 'Telangana, Code: 36',
    consigneeContactPerson: 'Mr.Srinu',
    consigneeContact: '+91-84668 88128',
    shippingAddressSource: 'Same as billing',
    shippingAddressLabel: '',
    shippingAddressContactLabel: '',
    invoiceTitle: 'Tax Invoice',
    projectSubject: 'e-Invoice',
    date: '3-Nov-25',
    quotationNumber: 'NE/NOV-433/25-26',
    deliveryNote: '',
    buyersOrderNo: '',
    dispatchDocNo: '',
    dispatchedThrough: '',
    destination: '',
    termsOfDelivery: '',
    items: [
      { service: 'YZuri/BL', description: '', cost: 8400, quantity: 3, itemNumber: '1', unit: 'EACH', hsn: '83014090', gstRate: 18 },
      { service: 'Yale Access Multi Bridge', description: '', cost: 2625, quantity: 3, itemNumber: '2', unit: 'EACH', hsn: '83016000', gstRate: 18 },
      { service: 'YPVL-902-BM', description: '', cost: 2730, quantity: 23, itemNumber: '3', unit: 'PRS', hsn: '83024110', gstRate: 18 },
      { service: '24-8560BRSS04 PBM', description: '', cost: 840, quantity: 5, itemNumber: '4', unit: 'pcs', hsn: '83016000', gstRate: 18 },
    ],
    notes: '',
    declaration:
      'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    roundOff: 0.06,
    gstType: 'CGST/SGST',
    globalTaxRate: 18,
    template: VISUAL_TEMPLATES.TAX_INVOICE,
    logoSrc: defaultLogoUrl,
    authorizedSignatureUrl: null,
    authorizedPersonName: null,
    authorizedDesignation: null,
    footerDetails: '',
  },
};

const PURCHASE_ORDER_COMPANY_NAME = 'MAHADEV SOLUTIONS';
const PURCHASE_ORDER_COMPANY_ADDRESS =
  '2-1-38, ROAD NO 4, PLOT NO 38, SRI VENKATESWARA COLONY, BANDLAGUDA JAGIR, HYDERABAD';
const PURCHASE_ORDER_COMPANY_EMAIL = 'mahadevsolution7@gmail.com';
const PURCHASE_ORDER_COMPANY_PHONE = '9030602967';

const PURCHASE_ORDER_TEMPLATE = {
  name: 'Purchase Order',
  data: {
    companyName: PURCHASE_ORDER_COMPANY_NAME,
    companyAddress: PURCHASE_ORDER_COMPANY_ADDRESS,
    companyEmail: PURCHASE_ORDER_COMPANY_EMAIL,
    companyPhone: PURCHASE_ORDER_COMPANY_PHONE,
    ...BANK_DEFAULTS,
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
    authorizedDesignation: null,
    deliveryAddress: 'MAHADEV SOLUTIONS\n123 Tech Road\nVisakhapatnam, AP 530001',
    deliveryDate: getCurrentDate(),
    requisitioner: 'Project Manager',
    shipVia: 'FedEx Ground',
    fob: 'Origin',
    shippingCost: 50,
    shippingAddressSource: 'Custom',
    shippingAddressLabel: 'MAHADEV SOLUTIONS\n123 Tech Road\nVisakhapatnam, AP 530001',
    shippingAddressContactLabel: '+91 9030602967',
    footerDetails: '',
  },
};

const QUOTATION_COMPANY_NAME = 'MAHADEV SOLUTIONS';
const QUOTATION_COMPANY_ADDRESS =
  'Plot No. 21, H.No. 3-24/74, Vikas Nagar Colony, Near Sai baba Temple, Bandlaguda Jagir,\nHyderabad, Telangana, India - 500086';
const QUOTATION_COMPANY_EMAIL = 'mahadevsolutions@outlook.com';
const QUOTATION_COMPANY_PHONE = '+91 90306 02967';

const QUOTATION_TEMPLATE = {
  name: 'Quotation',
  data: {
    companyName: QUOTATION_COMPANY_NAME,
    companyAddress: QUOTATION_COMPANY_ADDRESS,
    companyEmail: QUOTATION_COMPANY_EMAIL,
    companyPhone: QUOTATION_COMPANY_PHONE,
    companyGstin: '36ACEFM8212G1ZB',
    companyPan: 'ACEFM8212G',
    ...BANK_DEFAULTS,
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
    authorizedDesignation: null,
    deliveryAddress: '',
    deliveryDate: '',
    requisitioner: '',
    shipVia: '',
    fob: '',
    shippingCost: 0,
    shippingAddressSource: 'Same as billing',
    shippingAddressLabel: '',
    shippingAddressContactLabel: '',
    gstType: 'CGST/SGST',
    globalTaxRate: 18,
    footerDetails: '',
  },
};

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
  [VISUAL_TEMPLATES.DIGITAL_MARKETING]: VISUAL_TEMPLATES.TAX_INVOICE,
};

const getDocumentMode = (activeTemplateName: string, data: any, selectedTemplate: string) => {
  const title = String(data?.invoiceTitle || '').toLowerCase();

  if (
    activeTemplateName === 'Purchase Order' ||
    selectedTemplate === VISUAL_TEMPLATES.PURCHASE_ORDER ||
    title.includes('purchase order')
  ) {
    return 'purchaseOrder';
  }

  if (
    activeTemplateName === 'Quotation' ||
    selectedTemplate === VISUAL_TEMPLATES.PROFESSIONAL_QUOTATION ||
    title.includes('quotation')
  ) {
    return 'quotation';
  }

  return 'invoice';
};

const getDocumentLabels = (mode: 'invoice' | 'purchaseOrder' | 'quotation') => {
  if (mode === 'purchaseOrder') {
    return {
      numberLabel: 'Purchase Order Number',
      dateLabel: 'Date',
      billedToLabel: 'Vendor',
    };
  }

  if (mode === 'quotation') {
    return {
      numberLabel: 'Quotation Number',
      dateLabel: 'Date',
      billedToLabel: 'Quotation To',
    };
  }

  return {
    numberLabel: 'Invoice Number',
    dateLabel: 'Invoice Date',
    billedToLabel: 'Billed To',
  };
};

export default function App() {
  interface Item {
    service: string;
    description: string;
    cost: number;
    quantity: number;
    itemNumber: string;
    unit: string;
    hsn: string;
  }

  const initialItem: Item = { service: '', description: '', cost: 0, quantity: 1, itemNumber: '', unit: 'PCS', hsn: '' };

  const [templateConfigs, setTemplateConfigs] = useState<Record<string, TemplateConfig | undefined>>({});
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [isFormPopulated, setIsFormPopulated] = useState(false);
  const [activeTemplateName, setActiveTemplateName] = useState('');
  const [template, setTemplate] = useState(VISUAL_TEMPLATES.DIGITAL_MARKETING);
  const [invoiceData, setInvoiceData] = useState<any>({});

  const previewRef = useRef<HTMLDivElement>(null);

  const showNotification = (message: string, type = 'error') => {
    setNotification({ message, type });
  };

  const hasAuthorizedDetails = (data: any) => {
    const nameOk = String(data?.authorizedPersonName || '').trim().length > 0;
    const desOk = String(data?.authorizedDesignation || '').trim().length > 0;
    return nameOk || desOk;
  };

  const buildFooterLine = (data: any) => {
    const rawUserFooter = String(data?.footerDetails || '').trim();
    const userFooter = rawUserFooter
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line !== SYSTEM_GENERATED_FOOTER_TEXT)
      .join('\n');

    const authorizedPresent = hasAuthorizedDetails(data);

    const authName = String(data?.authorizedPersonName || '').trim();
    const authDes = String(data?.authorizedDesignation || '').trim();
    const authParts = [authName, authDes].filter(Boolean);
    const authLine = authParts.length ? authParts.join(' | ') : '';

    const companyLine = composeFooterDetails({
      companyName: data?.companyName,
      companyAddress: data?.companyAddress,
      companyPhone: data?.companyPhone,
      companyEmail: data?.companyEmail,
    }).trim();

    const lines: string[] = [];

    if (authorizedPresent) {
      if (userFooter) {
        lines.push(userFooter);
      } else {
        if (companyLine) lines.push(companyLine);
        if (authLine) lines.push(authLine);
      }
    } else {
      if (userFooter) {
        lines.push(userFooter);
      }
    }

    return lines.filter(Boolean).join('\n');
  };

  useEffect(() => {
    loadPdfScripts(
      () => setScriptsLoaded(true),
      (errorMsg) => showNotification(errorMsg, 'error')
    );
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

  const resolvedTemplateKey = TEMPLATE_EDITOR_MAP[template] ? template : TEMPLATE_ALIASES[template];
  const activeTemplateConfig = resolvedTemplateKey ? templateConfigs[resolvedTemplateKey] : undefined;
  const activeTemplateEditor = resolvedTemplateKey ? TEMPLATE_EDITOR_MAP[resolvedTemplateKey] : undefined;

  const previewData = { ...(invoiceData || {}), templateConfig: activeTemplateConfig } as any;
  const effectivePreviewData = { ...previewData } as any;
  const fieldMap: Record<string, any> = {};

  if (activeTemplateConfig) {
    const sectionList = activeTemplateConfig.sections || [];
    sectionList.forEach((section) => {
      const fields = getOrderedFields(activeTemplateConfig, section.id) || [];
      fields.forEach((f: any) => {
        fieldMap[f.key] = f;
        if (effectivePreviewData[f.key] == null && f.defaultValue !== undefined) {
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

  if (!effectivePreviewData.shippingAddressSource) {
    effectivePreviewData.shippingAddressSource = 'Same as billing';
  }

  if (
    effectivePreviewData.shippingAddressSource === 'Same as billing' &&
    !effectivePreviewData.shippingAddressLabel
  ) {
    effectivePreviewData.shippingAddressLabel =
      effectivePreviewData.clientAddress ||
      effectivePreviewData.deliveryAddress ||
      effectivePreviewData.consigneeAddress ||
      '';
  }

  if (
    effectivePreviewData.shippingAddressSource === 'Same as billing' &&
    !effectivePreviewData.shippingAddressContactLabel
  ) {
    effectivePreviewData.shippingAddressContactLabel =
      effectivePreviewData.clientPhone ||
      effectivePreviewData.consigneeContact ||
      '';
  }

  const documentMode = getDocumentMode(activeTemplateName, effectivePreviewData, template);
  const documentLabels = getDocumentLabels(documentMode);

  effectivePreviewData.footerDetails = buildFooterLine(effectivePreviewData);
  effectivePreviewData.documentMode = documentMode;
  effectivePreviewData.documentNumberLabel = documentLabels.numberLabel;
  effectivePreviewData.documentDateLabel = documentLabels.dateLabel;
  effectivePreviewData.partySectionLabel = documentLabels.billedToLabel;
  effectivePreviewData.systemGeneratedFooterText = SYSTEM_GENERATED_FOOTER_TEXT;

  const getPlaceholderForKey = (key: string, fallback?: string) => {
    const f = fieldMap[key];
    return (f && f.placeholder) || fallback || '';
  };

  const getFieldOptions = (key: string, fallback: string[] = []) => {
    const f = fieldMap[key];
    return Array.isArray(f?.options) && f.options.length ? f.options : fallback;
  };

  const isFieldAllowed = (key: string) => shouldShowField(fieldMap[key], invoiceData);

  const updateInvoiceField = (key: string, value: any) => {
    setInvoiceData((prev: any) => {
      const next = { ...(prev || {}), [key]: value };
      if (key === 'shippingAddressSource' && value === 'Same as billing') {
        next.shippingAddressLabel =
          next.clientAddress || next.deliveryAddress || next.consigneeAddress || '';
        next.shippingAddressContactLabel =
          next.clientPhone || next.consigneeContact || '';
      }
      if (key === 'clientAddress' && next.shippingAddressSource === 'Same as billing') {
        next.shippingAddressLabel = value;
      }
      if (key === 'deliveryAddress' && next.shippingAddressSource === 'Same as billing') {
        next.shippingAddressLabel = value;
      }
      if (key === 'consigneeAddress' && next.shippingAddressSource === 'Same as billing') {
        next.shippingAddressLabel = value;
      }
      if (key === 'clientPhone' && next.shippingAddressSource === 'Same as billing') {
        next.shippingAddressContactLabel = value;
      }
      if (key === 'consigneeContact' && next.shippingAddressSource === 'Same as billing') {
        next.shippingAddressContactLabel = value;
      }
      return next;
    });
  };

  const addItem = () =>
    setInvoiceData((prev: any) => ({ ...(prev || {}), items: [...(prev?.items || []), { ...initialItem }] }));

  const updateItem = (index: number, field: keyof Item, value: any, extraFields?: Partial<Item>) => {
    setInvoiceData((prev: any) => {
      const items = [...(prev?.items || [])];
      items[index] = { ...(items[index] || {}), [field]: value, ...(extraFields || {}) };
      return { ...(prev || {}), items };
    });
  };

  const removeItem = (index: number) =>
    setInvoiceData((prev: any) => ({ ...(prev || {}), items: (prev?.items || []).filter((_: any, i: number) => i !== index) }));

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
    setActiveTemplateName('');
  };

  const loadContentTemplate = (templateEntry: any) => {
    const templateData = templateEntry?.data ?? templateEntry;
    const name = templateEntry?.name ?? templateData?.name ?? '';
    const normalized = { ...(templateData || {}) };
    if (normalized.footerDetails == null) normalized.footerDetails = '';
    if (!normalized.shippingAddressSource) normalized.shippingAddressSource = 'Same as billing';
    if (
      normalized.shippingAddressSource === 'Same as billing' &&
      !normalized.shippingAddressLabel
    ) {
      normalized.shippingAddressLabel =
        normalized.clientAddress || normalized.deliveryAddress || normalized.consigneeAddress || '';
    }
    if (
      normalized.shippingAddressSource === 'Same as billing' &&
      !normalized.shippingAddressContactLabel
    ) {
      normalized.shippingAddressContactLabel =
        normalized.clientPhone || normalized.consigneeContact || '';
    }
    setInvoiceData(normalized);
    setTemplate(normalized.template || templateData.template || Object.values(VISUAL_TEMPLATES)[0]);
    setActiveTemplateName(name);
    setIsFormPopulated(true);
    showNotification(`${name || 'Template'} loaded!`, 'success');
  };

  const handleTemplateConfigApply = (templateKey: string, updatedConfig: TemplateConfig) => {
    let shouldPersist = false;
    setTemplateConfigs((prev) => {
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

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    const footerLine = buildFooterLine(invoiceData);
    const currentDocumentMode = getDocumentMode(activeTemplateName, invoiceData, template);

    try {
      const invoiceMeta = {
        quotationNumber: invoiceData?.quotationNumber,
        invoiceNumber: invoiceData?.quotationNumber,
        date: invoiceData?.date,
        clientName: invoiceData?.clientName,
        consigneeName: invoiceData?.consigneeName,
        companyName: invoiceData?.companyName,
        footerDetails: footerLine,
        documentMode: currentDocumentMode,
      };

      await generatePdf(
        previewRef,
        invoiceMeta,
        invoiceData?.logoSrc || defaultLogoUrl,
        footerLine,
        invoiceData?.authorizedSignatureUrl || undefined,
        (errMsg: string) => {
          showNotification(errMsg, 'error');
        }
      );
    } catch (e) {
      showNotification('Failed to generate PDF.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const isButtonDisabled = isGenerating;

  return (
    <>
      <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: '' })} />
      <div className="bg-gray-100 min-h-screen font-sans">
        <header className="bg-white shadow-md">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-3xl font-bold text-gray-800">Mahadev Solutions</h1>
            <p className="text-gray-500">The Future You Build, The Expertise We Bring...</p>
          </div>
        </header>
        <main className="container mx-auto p-4 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg h-fit">
            <div className="mb-6 border-b pb-4">
              <h2 className="text-2xl font-semibold mb-3">Invoice Templates</h2>
              <div className="flex flex-col sm:flex-row gap-2">
                {PRESET_DATA_TEMPLATES.map((ct) => (
                  <button
                    key={ct.name}
                    onClick={() => loadContentTemplate(ct)}
                    className="flex-1 p-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition text-sm"
                  >
                    {ct.name}
                  </button>
                ))}
              </div>
            </div>

            {isFormPopulated ? (
              <>
                <div className="flex justify-between items-center mb-6 border-b pb-3">
                  <h2 className="text-2xl font-semibold">Edit Details</h2>
                  <button onClick={resetForm} className="text-sm text-red-600 hover:underline">
                    Clear Form
                  </button>
                </div>

                {activeTemplateName === 'Invoice' && (
                  <div className="space-y-4 mb-6">
                    <h3 className="font-semibold text-lg border-b pb-2">e-Invoice Details</h3>
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  <h3 className="font-semibold text-lg border-b pb-2">Your Company Details</h3>
                  <div className="flex items-center space-x-4">
                    <img src={invoiceData.logoSrc || defaultLogoUrl} alt="Current Logo" className="h-12 w-12 object-contain border p-1 rounded-md bg-gray-50" />
                    <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 text-sm font-semibold py-2 px-3 rounded-lg hover:bg-gray-50">
                      Upload Logo
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      {invoiceData.authorizedSignatureUrl ? (
                        <img
                          src={invoiceData.authorizedSignatureUrl}
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
                          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleSignatureChange} />
                        </label>
                        {invoiceData.authorizedSignatureUrl && (
                          <button type="button" onClick={() => updateInvoiceField('authorizedSignatureUrl', null)} className="text-xs text-red-600 hover:underline">
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder={getPlaceholderForKey('authorizedPersonName', 'Authorized Person Name')}
                      value={invoiceData.authorizedPersonName || ''}
                      onChange={(e) => updateInvoiceField('authorizedPersonName', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />

                    <input
                      type="text"
                      placeholder={getPlaceholderForKey('authorizedDesignation', 'Designation')}
                      value={invoiceData.authorizedDesignation || ''}
                      onChange={(e) => updateInvoiceField('authorizedDesignation', e.target.value)}
                      className="w-full p-2 border rounded-md mt-2"
                    />
                  </div>

                  <input
                    type="text"
                    placeholder={getPlaceholderForKey('companyName', 'Company Name')}
                    value={invoiceData.companyName || ''}
                    onChange={(e) => updateInvoiceField('companyName', e.target.value)}
                    className="w-full p-2 border rounded-md"
                  />

                  <textarea
                    placeholder={getPlaceholderForKey('companyAddress', 'Company Address')}
                    value={invoiceData.companyAddress || ''}
                    onChange={(e) => updateInvoiceField('companyAddress', e.target.value)}
                    className="w-full p-2 border rounded-md"
                    rows={2}
                  />

                  <input
                    type="email"
                    placeholder={getPlaceholderForKey('companyEmail', 'Company Email')}
                    value={invoiceData.companyEmail || ''}
                    onChange={(e) => updateInvoiceField('companyEmail', e.target.value)}
                    className="w-full p-2 border rounded-md"
                  />

                  <input
                    type="tel"
                    placeholder={getPlaceholderForKey('companyPhone', 'Company Phone')}
                    value={invoiceData.companyPhone || ''}
                    onChange={(e) => updateInvoiceField('companyPhone', e.target.value)}
                    className="w-full p-2 border rounded-md"
                  />

                  {(activeTemplateName === 'Invoice' || activeTemplateName === 'Quotation') && (
                    <div className="flex space-x-2 mt-2">
                      <input
                        type="text"
                        placeholder={getPlaceholderForKey('companyGstin', 'Company GSTIN')}
                        value={invoiceData.companyGstin || ''}
                        onChange={(e) => updateInvoiceField('companyGstin', e.target.value)}
                        className="w-1/2 p-2 border rounded-md"
                      />
                      {activeTemplateName === 'Quotation' && (
                        <input
                          type="text"
                          placeholder="Company PAN"
                          value={invoiceData.companyPan || ''}
                          onChange={(e) => updateInvoiceField('companyPan', e.target.value)}
                          className="w-1/2 p-2 border rounded-md"
                        />
                      )}
                    </div>
                  )}

                  <div className="pt-2">
                    <h4 className="font-semibold text-md">Bank Details</h4>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Bank Name</label>
                        <input
                          type="text"
                          placeholder={getPlaceholderForKey('companyBankName', 'Bank Name')}
                          value={invoiceData.companyBankName || ''}
                          onChange={(e) => updateInvoiceField('companyBankName', e.target.value)}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Account Number</label>
                        <input
                          type="text"
                          placeholder={getPlaceholderForKey('companyAccountNo', 'Account Number')}
                          value={invoiceData.companyAccountNo || ''}
                          onChange={(e) => updateInvoiceField('companyAccountNo', e.target.value)}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Customer ID</label>
                        <input
                          type="text"
                          placeholder={getPlaceholderForKey('companyCustomerId', 'Customer ID')}
                          value={invoiceData.companyCustomerId || ''}
                          onChange={(e) => updateInvoiceField('companyCustomerId', e.target.value)}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Branch</label>
                        <input
                          type="text"
                          placeholder={getPlaceholderForKey('companyBankBranch', 'Branch')}
                          value={invoiceData.companyBankBranch || ''}
                          onChange={(e) => updateInvoiceField('companyBankBranch', e.target.value)}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">IFSC Code</label>
                        <input
                          type="text"
                          placeholder={getPlaceholderForKey('companyIfscCode', 'IFSC Code')}
                          value={invoiceData.companyIfscCode || ''}
                          onChange={(e) => updateInvoiceField('companyIfscCode', e.target.value)}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>
                    </div>
                  </div>

                  {activeTemplateName === 'Invoice' && (
                    <textarea
                      placeholder="Declaration"
                      value={invoiceData.declaration || ''}
                      onChange={(e) => updateInvoiceField('declaration', e.target.value)}
                      className="w-full p-3 border rounded-md mt-3"
                      rows={3}
                    />
                  )}
                </div>

                {activeTemplateName === 'Invoice' && (
                  <div className="space-y-4 mb-6">
                    <h3 className="font-semibold text-lg border-b pb-2">Billed By</h3>

                    <input
                      type="text"
                      placeholder={getPlaceholderForKey('consigneeName', 'Consignee Name')}
                      value={invoiceData.consigneeName || ''}
                      onChange={(e) => updateInvoiceField('consigneeName', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />

                    <textarea
                      placeholder={getPlaceholderForKey('consigneeAddress', 'Consignee Address')}
                      value={invoiceData.consigneeAddress || ''}
                      onChange={(e) => updateInvoiceField('consigneeAddress', e.target.value)}
                      className="w-full p-2 border rounded-md"
                      rows={2}
                    />

                    <input
                      type="text"
                      placeholder={getPlaceholderForKey('consigneeGstin', 'Consignee GSTIN/UIN')}
                      value={invoiceData.consigneeGstin || ''}
                      onChange={(e) => updateInvoiceField('consigneeGstin', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />

                    <input
                      type="text"
                      placeholder={getPlaceholderForKey('consigneeState', 'Consignee State (e.g., Telangana, Code: 36)')}
                      value={invoiceData.consigneeState || ''}
                      onChange={(e) => updateInvoiceField('consigneeState', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />

                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder={getPlaceholderForKey('consigneeContactPerson', 'Contact Person')}
                        value={invoiceData.consigneeContactPerson || ''}
                        onChange={(e) => updateInvoiceField('consigneeContactPerson', e.target.value)}
                        className="w-1/2 p-2 border rounded-md"
                      />
                      <input
                        type="text"
                        placeholder={getPlaceholderForKey('consigneeContact', 'Contact Phone')}
                        value={invoiceData.consigneeContact || ''}
                        onChange={(e) => updateInvoiceField('consigneeContact', e.target.value)}
                        className="w-1/2 p-2 border rounded-md"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  <h3 className="font-semibold text-lg border-b pb-2">
                    {activeTemplateName === 'Purchase Order'
                      ? 'Vendor / Supplier Details'
                      : activeTemplateName === 'Quotation'
                      ? documentLabels.billedToLabel
                      : activeTemplateName === 'Invoice'
                      ? documentLabels.billedToLabel
                      : 'Client Details'}
                  </h3>

                  <input
                    type="text"
                    placeholder={getPlaceholderForKey('clientName', activeTemplateName === 'Purchase Order' ? 'Supplier Name' : 'Client Name')}
                    value={invoiceData.clientName || ''}
                    onChange={(e) => updateInvoiceField('clientName', e.target.value)}
                    className="w-full p-2 border rounded-md"
                  />

                  {activeTemplateName !== 'Invoice' && (
                    <input
                      type="text"
                      placeholder={getPlaceholderForKey(
                        'clientCompany',
                        activeTemplateName === 'Purchase Order' ? 'Supplier Company (Optional)' : 'Client Company (Optional)'
                      )}
                      value={invoiceData.clientCompany || ''}
                      onChange={(e) => updateInvoiceField('clientCompany', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                  )}

                  <textarea
                    placeholder={getPlaceholderForKey('clientAddress', activeTemplateName === 'Purchase Order' ? 'Supplier Address' : 'Client Address')}
                    value={invoiceData.clientAddress || ''}
                    onChange={(e) => updateInvoiceField('clientAddress', e.target.value)}
                    className="w-full p-2 border rounded-md"
                    rows={2}
                  />

                  {activeTemplateName === 'Invoice' && (
                    <>
                      <input
                        type="text"
                        placeholder={getPlaceholderForKey('clientGstin', 'Client GSTIN/UIN')}
                        value={invoiceData.clientGstin || ''}
                        onChange={(e) => updateInvoiceField('clientGstin', e.target.value)}
                        className="w-full p-2 border rounded-md"
                      />
                      <input
                        type="text"
                        placeholder={getPlaceholderForKey('clientState', 'Client State (e.g., Telangana, Code: 36)')}
                        value={invoiceData.clientState || ''}
                        onChange={(e) => updateInvoiceField('clientState', e.target.value)}
                        className="w-full p-2 border rounded-md"
                      />
                      <input
                        type="text"
                        placeholder={getPlaceholderForKey('clientContactPerson', 'Client Contact Person')}
                        value={invoiceData.clientContactPerson || ''}
                        onChange={(e) => updateInvoiceField('clientContactPerson', e.target.value)}
                        className="w-1/2 p-2 border rounded-md"
                      />
                    </>
                  )}

                  <input
                    type="tel"
                    placeholder={getPlaceholderForKey('clientPhone', activeTemplateName === 'Purchase Order' ? 'Supplier Phone' : 'Client Phone')}
                    value={invoiceData.clientPhone || ''}
                    onChange={(e) => updateInvoiceField('clientPhone', e.target.value)}
                    className="w-1/2 p-2 border rounded-md"
                  />

                  {activeTemplateName === 'Quotation' && (
                    <>
                      {isFieldAllowed('shippingAddressSource') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {fieldMap.shippingAddressSource?.label || 'Shipping Address'}
                          </label>
                          <select
                            value={invoiceData.shippingAddressSource || 'Same as billing'}
                            onChange={(e) => updateInvoiceField('shippingAddressSource', e.target.value)}
                            className="w-full p-3 border rounded-md bg-white"
                          >
                            {getFieldOptions('shippingAddressSource', ['Same as billing', 'Custom']).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {isFieldAllowed('shippingAddressLabel') && (
                        <>
                          <textarea
                            placeholder={getPlaceholderForKey('shippingAddressLabel', 'Shipping Address')}
                            value={invoiceData.shippingAddressLabel || ''}
                            onChange={(e) => updateInvoiceField('shippingAddressLabel', e.target.value)}
                            className="w-full p-2 border rounded-md"
                            rows={2}
                          />
                          <input
                            type="text"
                            placeholder={getPlaceholderForKey('shippingAddressContactLabel', 'Shipping Contact Number')}
                            value={invoiceData.shippingAddressContactLabel || ''}
                            onChange={(e) => updateInvoiceField('shippingAddressContactLabel', e.target.value)}
                            className="w-full p-2 border rounded-md"
                          />
                        </>
                      )}

                      <div className="flex space-x-2 mt-2">
                        <input
                          type="text"
                          placeholder="Client GSTIN"
                          value={invoiceData.clientGstin || ''}
                          onChange={(e) => updateInvoiceField('clientGstin', e.target.value)}
                          className="w-1/2 p-2 border rounded-md"
                        />
                        <input
                          type="text"
                          placeholder="Client PAN"
                          value={invoiceData.clientPan || ''}
                          onChange={(e) => updateInvoiceField('clientPan', e.target.value)}
                          className="w-1/2 p-2 border rounded-md"
                        />
                      </div>
                    </>
                  )}
                </div>

                {activeTemplateName === 'Purchase Order' && (
                  <div className="space-y-4 mb-6">
                    <h3 className="font-semibold text-lg border-b pb-2">Ship-To Details</h3>

                    {isFieldAllowed('shippingAddressSource') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {fieldMap.shippingAddressSource?.label || 'Shipping Address'}
                        </label>
                        <select
                          value={invoiceData.shippingAddressSource || 'Same as billing'}
                          onChange={(e) => updateInvoiceField('shippingAddressSource', e.target.value)}
                          className="w-full p-3 border rounded-md bg-white"
                        >
                          {getFieldOptions('shippingAddressSource', ['Same as billing', 'Custom']).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {isFieldAllowed('shippingAddressLabel') ? (
                      <>
                        <textarea
                          placeholder={getPlaceholderForKey('shippingAddressLabel', 'Shipping Address')}
                          value={invoiceData.shippingAddressLabel || ''}
                          onChange={(e) => updateInvoiceField('shippingAddressLabel', e.target.value)}
                          className="w-full p-2 border rounded-md"
                          rows={2}
                        />
                        <input
                          type="text"
                          placeholder={getPlaceholderForKey('shippingAddressContactLabel', 'Shipping Contact Number')}
                          value={invoiceData.shippingAddressContactLabel || ''}
                          onChange={(e) => updateInvoiceField('shippingAddressContactLabel', e.target.value)}
                          className="w-full p-2 border rounded-md"
                        />
                      </>
                    ) : (
                      <>
                        <textarea
                          placeholder="Shipping Address"
                          value={invoiceData.shippingAddressLabel || invoiceData.deliveryAddress || ''}
                          onChange={(e) => {
                            updateInvoiceField('deliveryAddress', e.target.value);
                            updateInvoiceField('shippingAddressLabel', e.target.value);
                          }}
                          className="w-full p-2 border rounded-md"
                          rows={2}
                        />
                        <input
                          type="text"
                          placeholder="Shipping Contact Number"
                          value={invoiceData.shippingAddressContactLabel || ''}
                          onChange={(e) => updateInvoiceField('shippingAddressContactLabel', e.target.value)}
                          className="w-full p-2 border rounded-md"
                        />
                      </>
                    )}
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  <h3 className="font-semibold text-lg border-b pb-2">Document Details</h3>

                  <input
                    type="text"
                    placeholder={getPlaceholderForKey('invoiceTitle', 'Invoice Title (e.g., Quotation)')}
                    value={invoiceData.invoiceTitle || ''}
                    onChange={(e) => updateInvoiceField('invoiceTitle', e.target.value)}
                    className="w-full p-2 border rounded-md"
                  />

                  <input
                    type="text"
                    placeholder={getPlaceholderForKey('projectSubject', 'Project Subject')}
                    value={invoiceData.projectSubject || ''}
                    onChange={(e) => updateInvoiceField('projectSubject', e.target.value)}
                    className="w-full p-2 border rounded-md"
                  />

                  <div className="flex space-x-2">
                    <input
                      type="date"
                      value={invoiceData.date || ''}
                      onChange={(e) => updateInvoiceField('date', e.target.value)}
                      className="w-1/2 p-2 border rounded-md"
                    />
                    <input
                      type="text"
                      placeholder={getPlaceholderForKey(
                        'quotationNumber',
                        activeTemplateName === 'Purchase Order'
                          ? 'P.O. Number'
                          : activeTemplateName === 'Quotation'
                          ? 'Quotation #'
                          : activeTemplateName === 'Invoice'
                          ? 'Invoice No.'
                          : 'Quote #'
                      )}
                      value={invoiceData.quotationNumber || ''}
                      onChange={(e) => updateInvoiceField('quotationNumber', e.target.value)}
                      className="w-1/2 p-2 border rounded-md"
                    />
                  </div>

                  {(activeTemplateName === 'Invoice' || activeTemplateName === 'Purchase Order') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {fieldMap.shippingAddressLabel?.label || 'Shipping Address'}
                        </label>
                        <textarea
                          placeholder={getPlaceholderForKey('shippingAddressLabel', 'Shipping Address')}
                          value={invoiceData.shippingAddressLabel || ''}
                          onChange={(e) => updateInvoiceField('shippingAddressLabel', e.target.value)}
                          className="w-full p-2 border rounded-md"
                          rows={2}
                        />
                      </div>
                      <input
                        type="text"
                        placeholder={getPlaceholderForKey('shippingAddressContactLabel', 'Shipping Contact Number')}
                        value={invoiceData.shippingAddressContactLabel || ''}
                        onChange={(e) => updateInvoiceField('shippingAddressContactLabel', e.target.value)}
                        className="w-full p-2 border rounded-md"
                      />
                    </>
                  )}
                </div>

                <div className="space-y-4 mb-6">
                  <h3 className="font-semibold text-lg border-b pb-2">Tax Settings</h3>
                  <div className="flex space-x-2">
                    <div className="w-1/2">
                      <label className="block text-sm font-medium text-gray-700">GST Type</label>
                      <select
                        value={invoiceData.gstType || 'CGST/SGST'}
                        onChange={(e) => updateInvoiceField('gstType', e.target.value)}
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
                        onChange={(e) => updateInvoiceField('globalTaxRate', parseFloat(e.target.value) || 0)}
                        className="w-full p-3 border rounded-md"
                      />
                    </div>
                  </div>
                </div>

                {activeTemplateName === 'Purchase Order' && (
                  <div className="space-y-4 mb-6">
                    <h3 className="font-semibold text-lg border-b pb-2">Shipping & PO Details</h3>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder={getPlaceholderForKey('requisitioner', 'Requisitioner')}
                        value={invoiceData.requisitioner || ''}
                        onChange={(e) => updateInvoiceField('requisitioner', e.target.value)}
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder={getPlaceholderForKey('shipVia', 'Ship Via (e.g., FedEx)')}
                        value={invoiceData.shipVia || ''}
                        onChange={(e) => updateInvoiceField('shipVia', e.target.value)}
                        className="w-1/2 p-2 border rounded-md"
                      />
                      <input
                        type="text"
                        placeholder={getPlaceholderForKey('fob', 'F.O.B.')}
                        value={invoiceData.fob || ''}
                        onChange={(e) => updateInvoiceField('fob', e.target.value)}
                        className="w-1/2 p-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Shipping Cost</label>
                      <input
                        type="number"
                        placeholder={getPlaceholderForKey('shippingCost', 'Shipping Cost')}
                        value={invoiceData.shippingCost || 0}
                        onChange={(e) => updateInvoiceField('shippingCost', parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                  </div>
                )}

                {activeTemplateName === 'Invoice' && (
                  <div className="space-y-4 mb-6">
                    <h3 className="font-semibold text-lg border-b pb-2">Dispatch & Delivery Details</h3>
                    <input
                      type="text"
                      placeholder={getPlaceholderForKey('deliveryNote', 'Delivery Note')}
                      value={invoiceData.deliveryNote || ''}
                      onChange={(e) => updateInvoiceField('deliveryNote', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                    <input
                      type="text"
                      placeholder={getPlaceholderForKey('buyersOrderNo', "Buyer's Order No.")}
                      value={invoiceData.buyersOrderNo || ''}
                      onChange={(e) => updateInvoiceField('buyersOrderNo', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                    <input
                      type="text"
                      placeholder={getPlaceholderForKey('dispatchDocNo', 'Dispatch Doc No.')}
                      value={invoiceData.dispatchDocNo || ''}
                      onChange={(e) => updateInvoiceField('dispatchDocNo', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                    <input
                      type="text"
                      placeholder={getPlaceholderForKey('dispatchedThrough', 'Dispatched Through')}
                      value={invoiceData.dispatchedThrough || ''}
                      onChange={(e) => updateInvoiceField('dispatchedThrough', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                    <input
                      type="text"
                      placeholder={getPlaceholderForKey('destination', 'Destination')}
                      value={invoiceData.destination || ''}
                      onChange={(e) => updateInvoiceField('destination', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                    <input
                      type="text"
                      placeholder={getPlaceholderForKey('termsOfDelivery', 'Terms of Delivery')}
                      value={invoiceData.termsOfDelivery || ''}
                      onChange={(e) => updateInvoiceField('termsOfDelivery', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
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
                  <button onClick={addItem} className="w-full mt-2 p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition">
                    + Add Item
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  <textarea
                    placeholder={getPlaceholderForKey('notes', 'Notes / Terms & Conditions')}
                    value={invoiceData.notes || ''}
                    onChange={(e) => updateInvoiceField('notes', e.target.value)}
                    className="w-full p-3 border rounded-md"
                    rows={3}
                  />

                  {activeTemplateName === 'Invoice' && (
                    <div className="space-y-4 mb-2">
                      <textarea
                        placeholder={getPlaceholderForKey('declaration', 'Declaration')}
                        value={invoiceData.declaration || ''}
                        onChange={(e) => updateInvoiceField('declaration', e.target.value)}
                        className="w-full p-3 border rounded-md"
                        rows={3}
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Round Off</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder={getPlaceholderForKey('roundOff', '0.00')}
                          value={invoiceData.roundOff || 0}
                          onChange={(e) => updateInvoiceField('roundOff', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>
                    </div>
                  )}

                  <label className="block text-sm font-medium text-gray-700">Visual Style</label>
                  <select
                    value={template}
                    onChange={(e) => {
                      setTemplate(e.target.value);
                      updateInvoiceField('template', e.target.value);
                    }}
                    className="w-full p-3 border rounded-md bg-white"
                  >
                    {Object.values(VISUAL_TEMPLATES).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 mb-6">
                  <h3 className="font-semibold text-lg border-b pb-2">Footer Details</h3>
                  <textarea
                    placeholder={getPlaceholderForKey('footerDetails', 'Add company footer lines')}
                    value={invoiceData.footerDetails || ''}
                    onChange={(event) => updateInvoiceField('footerDetails', event.target.value)}
                    className="w-full p-3 border rounded-md"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">These lines appear in the live preview and PDF footer. Use line breaks to control how the footer is stacked.</p>
                </div>

                <div>
                  <button
                    onClick={handleGeneratePdf}
                    disabled={isButtonDisabled || !scriptsLoaded}
                    className="w-full p-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? 'Generating...' : !scriptsLoaded ? 'Loading Libs...' : 'Generate PDF'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-gray-500">
                <p className="font-semibold text-lg">Please select a template above to begin.</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Live Preview</h2>
              <div className="overflow-x-auto">
                <div style={{ width: '210mm' }}>
                  {isFormPopulated ? (
                    <InvoicePreview ref={previewRef} data={effectivePreviewData} />
                  ) : (
                    <div className="bg-white p-8 shadow-lg rounded-xl h-96 flex items-center justify-center text-gray-400">Preview will appear here...</div>
                  )}
                </div>
              </div>

              {activeTemplateEditor && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setIsTemplateEditorOpen((prev) => !prev)}
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
          </div>
        </main>
      </div>
    </>
  );
}