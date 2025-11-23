import type { ComputedItem } from 'src/components/ItemsTable';

export type ColumnFormatter = 'currency' | 'number' | 'text';

export interface FieldConfig {
  key: string;
  label: string;
  visible: boolean;
  required?: boolean;
  className?: string;
  order?: number;
}

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  width?: number;
  order: number;
  formatter?: ColumnFormatter;
  isCustom?: boolean;
}

export interface SectionConfig {
  id: string;
  label: string;
  visible: boolean;
  order?: number;
  fields: FieldConfig[];
}

export interface AuthorizedByConfig {
  visible: boolean;
  label: string;
  signatureUrl?: string;
}

export interface TemplateConfig {
  id?: string;
  name: string;
  createdAt?: string;
  sections: SectionConfig[];
  columns: ColumnConfig[];
  authorizedBy?: AuthorizedByConfig;
  metadata?: Record<string, unknown>;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'serialNumber', label: 'S.No', visible: true, width: 6, order: 0, formatter: 'number' },
  { key: 'service', label: 'Description', visible: true, width: 24, order: 1, formatter: 'text' },
  { key: 'hsn', label: 'HSN/SAC', visible: true, width: 10, order: 2, formatter: 'text' },
  { key: 'quantity', label: 'Quantity', visible: true, width: 8, order: 3, formatter: 'number' },
  { key: 'unit', label: 'Unit', visible: true, width: 8, order: 4, formatter: 'text' },
  { key: 'gstRate', label: 'GST %', visible: true, width: 8, order: 5, formatter: 'number' },
  { key: 'cost', label: 'Rate', visible: true, width: 10, order: 6, formatter: 'currency' },
  { key: 'amount', label: 'Amount', visible: true, width: 12, order: 7, formatter: 'currency' },
  { key: 'cgst', label: 'CGST', visible: true, width: 10, order: 8, formatter: 'currency' },
  { key: 'sgst', label: 'SGST', visible: true, width: 10, order: 9, formatter: 'currency' },
  { key: 'igst', label: 'IGST', visible: true, width: 10, order: 10, formatter: 'currency' },
  { key: 'itemTotal', label: 'Total', visible: true, width: 12, order: 11, formatter: 'currency' },
];

const cloneColumns = (columns: ColumnConfig[]): ColumnConfig[] =>
  columns.map((column, index) => ({
    ...column,
    order: column.order ?? index,
  }));

const toStartCase = (value: string): string => {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
};

const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const normaliseOrder = <T extends { order?: number }>(items: T[]): T[] => {
  return items
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((item, index) => ({ ...item, order: index }));
};

export const getBaseColumns = (): ColumnConfig[] => cloneColumns(DEFAULT_COLUMNS);

export const mergeTemplateConfig = (
  base: TemplateConfig,
  override?: TemplateConfig | null,
): TemplateConfig => {
  const merged = deepClone(base);
  if (!override) {
    merged.sections = normaliseOrder(merged.sections);
    merged.sections = merged.sections.map((section) => ({
      ...section,
      fields: normaliseOrder(section.fields),
    }));
    merged.columns = normaliseOrder(merged.columns);
    return merged;
  }

  if (override.name) {
    merged.name = override.name;
  }
  merged.id = override.id ?? merged.id;
  merged.createdAt = override.createdAt ?? merged.createdAt;

  const baseSectionMap = new Map<string, SectionConfig>();
  merged.sections.forEach((section) => baseSectionMap.set(section.id, section));

  override.sections.forEach((section) => {
    const existing = baseSectionMap.get(section.id);
    if (existing) {
      existing.label = section.label || existing.label;
      existing.visible = section.visible ?? existing.visible;
      if (typeof section.order === 'number') {
        existing.order = section.order;
      }

      const fieldMap = new Map(existing.fields.map((field) => [field.key, field] as const));
      section.fields.forEach((field) => {
        const existingField = fieldMap.get(field.key);
        if (existingField) {
          existingField.label = field.label || existingField.label;
          existingField.visible = field.visible ?? existingField.visible;
          existingField.required = field.required ?? existingField.required;
          existingField.className = field.className || existingField.className;
          if (typeof field.order === 'number') {
            existingField.order = field.order;
          }
        } else {
          fieldMap.set(field.key, {
            ...field,
            order: field.order ?? existing.fields.length + 1,
          });
        }
      });
      existing.fields = normaliseOrder(Array.from(fieldMap.values()));
    } else {
      baseSectionMap.set(section.id, {
        ...section,
        fields: normaliseOrder(section.fields ?? []),
      });
    }
  });

  merged.sections = normaliseOrder(Array.from(baseSectionMap.values()));

  const baseColumnMap = new Map(merged.columns.map((column) => [column.key, column] as const));
  override.columns.forEach((column) => {
    const existing = baseColumnMap.get(column.key);
    if (existing) {
      existing.label = column.label || existing.label || toStartCase(column.key);
      existing.visible = column.visible ?? existing.visible;
      existing.width = typeof column.width === 'number' ? column.width : existing.width;
      existing.formatter = column.formatter || existing.formatter;
      existing.order = typeof column.order === 'number' ? column.order : existing.order;
      existing.isCustom = column.isCustom ?? existing.isCustom;
    } else {
      baseColumnMap.set(column.key, {
        ...column,
        label: column.label || toStartCase(column.key),
        visible: column.visible ?? true,
        width: typeof column.width === 'number' ? column.width : undefined,
        order: typeof column.order === 'number' ? column.order : baseColumnMap.size,
        formatter: column.formatter || 'text',
        isCustom: true,
      });
    }
  });

  merged.columns = normaliseOrder(Array.from(baseColumnMap.values()));

  if (override.authorizedBy) {
    merged.authorizedBy = {
      visible:
        typeof override.authorizedBy.visible === 'boolean'
          ? override.authorizedBy.visible
          : merged.authorizedBy?.visible ?? true,
      label:
        override.authorizedBy.label ||
        merged.authorizedBy?.label ||
        'Authorized By',
      signatureUrl:
        override.authorizedBy.signatureUrl ?? merged.authorizedBy?.signatureUrl,
    };
  }

  merged.metadata = {
    ...(merged.metadata || {}),
    ...(override.metadata || {}),
  };

  return merged;
};

export const getSectionConfig = (
  config: TemplateConfig | undefined,
  sectionId: string,
): SectionConfig | undefined => config?.sections?.find((section) => section.id === sectionId);

export const getSectionLabel = (
  config: TemplateConfig | undefined,
  sectionId: string,
  fallback: string,
): string => {
  const section = getSectionConfig(config, sectionId);
  const label = section?.label?.trim();
  return label ? label : fallback;
};

export const isSectionVisible = (
  config: TemplateConfig | undefined,
  sectionId: string,
  defaultVisible: boolean = true,
): boolean => {
  const section = getSectionConfig(config, sectionId);
  if (!section) return defaultVisible;
  return typeof section.visible === 'boolean' ? section.visible : defaultVisible;
};

export const getOrderedSections = (config: TemplateConfig | undefined): SectionConfig[] => {
  if (!config?.sections) return [];
  return normaliseOrder(config.sections);
};

export const getFieldConfig = (
  config: TemplateConfig | undefined,
  sectionId: string,
  fieldKey: string,
): FieldConfig | undefined => {
  const section = getSectionConfig(config, sectionId);
  if (!section) return undefined;
  return section.fields.find((field) => field.key === fieldKey);
};

export const getFieldLabel = (
  config: TemplateConfig | undefined,
  sectionId: string,
  fieldKey: string,
  fallback: string,
): string => {
  const field = getFieldConfig(config, sectionId, fieldKey);
  const label = field?.label?.trim();
  return label ? label : fallback;
};

export const isFieldVisible = (
  config: TemplateConfig | undefined,
  sectionId: string,
  fieldKey: string,
  defaultVisible: boolean = true,
): boolean => {
  const field = getFieldConfig(config, sectionId, fieldKey);
  if (!field) return defaultVisible;
  return typeof field.visible === 'boolean' ? field.visible : defaultVisible;
};

export const getOrderedFields = (
  config: TemplateConfig | undefined,
  sectionId: string,
): FieldConfig[] => {
  const section = getSectionConfig(config, sectionId);
  if (!section) return [];
  return normaliseOrder(section.fields);
};

export interface VisibleColumn extends ColumnConfig {}

export const getVisibleColumns = (
  config: TemplateConfig | undefined,
  fallbackColumns: ColumnConfig[] = getBaseColumns(),
): VisibleColumn[] => {
  const baseColumns = fallbackColumns.length ? fallbackColumns : getBaseColumns();
  const columns = config?.columns?.length ? config.columns : baseColumns;
  const defaultsMap = new Map(baseColumns.map((column) => [column.key, column] as const));
  return normaliseOrder(columns)
    .filter((column) => column.visible !== false)
    .map((column) => {
      const defaults = defaultsMap.get(column.key);
      const label = column.label || defaults?.label || toStartCase(column.key);
      return {
        ...defaults,
        ...column,
        label,
        formatter: column.formatter || defaults?.formatter || 'text',
        width: typeof column.width === 'number' ? column.width : defaults?.width,
      };
    });
};

const createSection = (
  id: string,
  label: string,
  visible: boolean,
  fields: Array<Partial<FieldConfig> & { key: string }>,
  order: number,
): SectionConfig => ({
  id,
  label,
  visible,
  order,
  fields: fields.map((field, index) => ({
    label: '',
    visible: true,
    ...field,
    order: field.order ?? index,
  })),
});

export const createProfessionalQuotationDefaultConfig = (): TemplateConfig => ({
  name: 'Professional Quotation',
  sections: [
    createSection('header', 'Header', true, [
      { key: 'title', label: 'Quotation', visible: true },
      { key: 'quotationNumberLabel', label: 'Quotation #', visible: true },
      { key: 'quotationDateLabel', label: 'Quotation Date', visible: true },
    ], 0),
    createSection('quotationFrom', 'Quotation From', true, [
      { key: 'emailLabel', label: 'Email', visible: true },
      { key: 'phoneLabel', label: 'Phone', visible: true },
      { key: 'gstinLabel', label: 'GSTIN', visible: true },
      { key: 'panLabel', label: 'PAN', visible: true },
    ], 1),
    createSection('quotationFor', 'Quotation For', true, [
      { key: 'phoneLabel', label: 'Phone', visible: true },
      { key: 'gstinLabel', label: 'GSTIN', visible: true },
      { key: 'panLabel', label: 'PAN', visible: true },
      { key: 'companyLabel', label: 'Company', visible: true },
      { key: 'addressLabel', label: 'Address', visible: true },
    ], 2),
    createSection('itemsSummary', 'Items Summary', true, [
      { key: 'totalTaxInWordsLabel', label: 'Total Tax In Words', visible: true },
    ], 3),
    createSection('totals', 'Totals', true, [
      { key: 'amountLabel', label: 'Amount', visible: true },
      { key: 'cgstLabel', label: 'CGST', visible: true },
      { key: 'sgstLabel', label: 'SGST', visible: true },
      { key: 'igstLabel', label: 'IGST', visible: true },
      { key: 'grandTotalLabel', label: 'Total (INR)', visible: true },
    ], 4),
    createSection('notes', 'Terms & Conditions', true, [
      { key: 'notesHeading', label: 'Terms & Conditions', visible: true },
    ], 5),
  ],
  columns: cloneColumns(DEFAULT_COLUMNS).filter((column) => column.key !== 'hsn'),
  authorizedBy: {
    visible: true,
    label: 'Authorized By',
  },
});

export const createPurchaseOrderDefaultConfig = (): TemplateConfig => ({
  name: 'Purchase Order',
  sections: [
    createSection('header', 'Header', true, [
      { key: 'title', label: 'PURCHASE ORDER', visible: true },
      { key: 'projectSubjectLabel', label: 'Subject', visible: true },
      { key: 'poNumberLabel', label: 'PO #', visible: true },
      { key: 'dateLabel', label: 'Date', visible: true },
      { key: 'companyNameLabel', label: 'Company Name', visible: true },
      { key: 'companyAddressLabel', label: 'Address', visible: true },
      { key: 'companyEmailLabel', label: 'Email', visible: true },
      { key: 'companyPhoneLabel', label: 'Phone', visible: true },
    ], 0),
    createSection('supplier', 'Supplier', true, [
      { key: 'heading', label: 'Supplier', visible: true },
      { key: 'contactLabel', label: 'Contact', visible: true },
      { key: 'addressLabel', label: 'Address', visible: true },
      { key: 'phoneLabel', label: 'Phone', visible: true },
    ], 1),
    createSection('shipTo', 'Ship To', true, [
      { key: 'heading', label: 'Ship To', visible: true },
      { key: 'addressLabel', label: 'Address', visible: true },
      { key: 'requisitionerLabel', label: 'Requisitioner', visible: true },
      { key: 'shipViaLabel', label: 'Ship Via', visible: true },
      { key: 'fobLabel', label: 'F.O.B.', visible: true },
    ], 2),
    createSection('totals', 'Totals', true, [
      { key: 'subtotalLabel', label: 'Subtotal', visible: true },
      { key: 'igstLabel', label: 'IGST', visible: true },
      { key: 'cgstLabel', label: 'CGST', visible: true },
      { key: 'sgstLabel', label: 'SGST', visible: true },
      { key: 'shippingLabel', label: 'Shipping', visible: true },
      { key: 'grandTotalLabel', label: 'Total', visible: true },
    ], 3),
    createSection('notes', 'Notes', true, [
      { key: 'notesHeading', label: 'Notes', visible: true },
    ], 4),
  ],
  columns: cloneColumns(DEFAULT_COLUMNS),
  authorizedBy: {
    visible: true,
    label: 'Authorized By',
  },
});

export const createTaxInvoiceDefaultConfig = (): TemplateConfig => ({
  name: 'Tax Invoice',
  sections: [
    createSection('header', 'Header', true, [
      { key: 'title', label: 'Tax Invoice', visible: true },
      { key: 'subjectLabel', label: 'Subject', visible: true },
    ], 0),
    createSection('companyDetails', 'Company Details', true, [
      { key: 'companyHeading', label: 'Company Name', visible: true },
      { key: 'addressLabel', label: 'Address', visible: true },
      { key: 'gstinLabel', label: 'GSTIN/UIN', visible: true },
      { key: 'contactLabel', label: 'Contact', visible: true },
      { key: 'emailLabel', label: 'E-Mail', visible: true },
    ], 1),
    createSection('consignee', 'Consignee (Ship to)', true, [
      { key: 'heading', label: 'Consignee (Ship to)', visible: true },
      { key: 'gstinLabel', label: 'GSTIN/UIN', visible: true },
      { key: 'stateLabel', label: 'State Name', visible: true },
      { key: 'contactPersonLabel', label: 'Contact Person', visible: true },
      { key: 'contactLabel', label: 'Contact', visible: true },
    ], 2),
    createSection('buyer', 'Buyer (Bill to)', true, [
      { key: 'heading', label: 'Buyer (Bill to)', visible: true },
      { key: 'gstinLabel', label: 'GSTIN/UIN', visible: true },
      { key: 'stateLabel', label: 'State Name', visible: true },
      { key: 'contactPersonLabel', label: 'Contact Person', visible: true },
      { key: 'contactLabel', label: 'Contact', visible: true },
    ], 3),
    createSection('orderMeta', 'Order Meta', true, [
      { key: 'invoiceNumberLabel', label: 'Invoice No.', visible: true },
      { key: 'invoiceDateLabel', label: 'Dated', visible: true },
      { key: 'deliveryNoteLabel', label: 'Delivery Note', visible: true },
      { key: 'buyersOrderLabel', label: "Buyer's Order No.", visible: true },
      { key: 'dispatchDocLabel', label: 'Dispatch Doc No.', visible: true },
      { key: 'dispatchedThroughLabel', label: 'Dispatched through', visible: true },
      { key: 'destinationLabel', label: 'Destination', visible: true },
      { key: 'termsLabel', label: 'Terms of Delivery', visible: true },
    ], 4),
    createSection('totals', 'Totals', true, [
      { key: 'subtotalLabel', label: 'Subtotal', visible: true },
      { key: 'cgstLabel', label: 'CGST', visible: true },
      { key: 'sgstLabel', label: 'SGST', visible: true },
      { key: 'igstLabel', label: 'IGST', visible: true },
      { key: 'totalTaxLabel', label: 'Total Tax', visible: true },
      { key: 'roundOffLabel', label: 'Round Off', visible: true },
      { key: 'grandTotalLabel', label: 'Grand Total', visible: true },
    ], 5),
    createSection('amountInWords', 'Amount In Words', true, [
      { key: 'amountChargeableLabel', label: 'Amount Chargeable (in words)', visible: true },
      { key: 'taxAmountLabel', label: 'Tax Amount (in words)', visible: true },
    ], 6),
    createSection('bankDetails', "Company's Bank Details", true, [
      { key: 'bankNameLabel', label: 'Bank Name', visible: true },
      { key: 'accountNumberLabel', label: 'A/c No.', visible: true },
      { key: 'branchLabel', label: 'Branch & IFS Code', visible: true },
      { key: 'declarationHeading', label: 'Declaration', visible: true },
    ], 7),
  ],
  columns: cloneColumns(DEFAULT_COLUMNS),
  authorizedBy: {
    visible: true,
    label: 'Authorized Signatory',
  },
});

export const resolveTemplateConfig = (
  defaultConfigFactory: () => TemplateConfig,
  override?: TemplateConfig,
): TemplateConfig => mergeTemplateConfig(defaultConfigFactory(), override);

export const getColumnValue = (
  item: ComputedItem & { [key: string]: any },
  columnKey: string,
  data?: any,
): unknown => {
  const source = item as any;
  switch (columnKey) {
    case 'serialNumber':
    case 'sno':
    case 'sNo':
      return source.serialNumber ?? source.itemNumber ?? '';
    case 'service':
    case 'description':
      return source.service ?? source.description;
    case 'hsn':
      return source.hsn;
    case 'quantity':
      return source.quantity ?? 0;
    case 'unit':
      return source.unit;
    case 'gstRate':
      return source.gstRate;
    case 'cost':
    case 'rate':
      return source.cost;
    case 'amount':
      return source.amount;
    case 'cgst':
      return source.cgst;
    case 'sgst':
      return source.sgst;
    case 'igst':
      return source.igst;
    case 'itemTotal':
    case 'total':
      return source.itemTotal;
    default:
      if (source.custom && columnKey in source.custom) {
        return source.custom[columnKey];
      }
      if (data?.customFields && columnKey in data.customFields) {
        return data.customFields[columnKey];
      }
      return source[columnKey];
  }
};
