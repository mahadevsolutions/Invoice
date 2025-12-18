import React from 'react';
import { TemplateConfig, getFieldLabel, getFieldConfig } from './field-types';
import { mapFieldStyleToClasses, mapFieldStyleToInlineStyle } from './style-utils';

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const formatNumber = (value: unknown) => {
  const n = toNumber(value);
  if (typeof n === 'number') return n.toLocaleString('en-IN');
  return String(value ?? '');
};

const formatCurrency = (value: unknown, currency = '₹') => {
  const n = toNumber(value) ?? 0;
  return `${currency}${n.toLocaleString('en-IN')}`;
};

const formatDate = (value: unknown) => {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const resolveRawValue = (data: any, field: any, sectionId: string) => {
  if (!data) return field.defaultValue ?? '';

  // direct key match
  if (field.key in data) return data[field.key];

  const stripped = String(field.key).replace(/(Label|Heading)$/i, '');

  // direct stripped match (e.g., 'gstin' -> data.gstin)
  if (stripped in data) return data[stripped];

  const keys = Object.keys(data || {});
  const strippedLower = stripped.toLowerCase();

  // try to find an exact containing key (e.g., companyGstin, clientGstin)
  const containsMatches = keys.filter((k) => k.toLowerCase().includes(strippedLower));
  if (containsMatches.length === 1) return data[containsMatches[0]];

  // handle simple synonyms/abbreviations (e.g., "accountNumber" vs "accountNo")
  const altVariants = new Set<string>();
  altVariants.add(strippedLower);
  if (strippedLower.includes('number')) altVariants.add(strippedLower.replace(/number/g, 'no'));
  if (strippedLower.includes('no')) altVariants.add(strippedLower.replace(/no/g, 'number'));
  if (strippedLower.includes('account')) {
    altVariants.add(strippedLower.replace(/account/g, 'acct'));
    altVariants.add(strippedLower.replace(/acct/g, 'account'));
  }
  for (const v of Array.from(altVariants)) {
    const matches = keys.filter((k) => k.toLowerCase().includes(v));
    if (matches.length === 1) return data[matches[0]];
  }

  // prefer keys that also include a section-related prefix
  const sectionPrefixMap: Record<string, string[]> = {
    companyDetails: ['company'],
    consignee: ['consignee'],
    buyer: ['client', 'buyer'],
    quotationFrom: ['company', 'client'],
    quotationFor: ['client'],
    supplier: ['client', 'supplier'],
    shipTo: ['consignee', 'delivery', 'ship'],
    orderMeta: ['invoice', 'quotation', 'date', 'delivery', 'buyersOrder', 'dispatch'],
    bankDetails: ['company', 'bank', 'account'],
    header: ['invoice', 'quotation', 'po', 'title'],
  };

  const prefixes = sectionPrefixMap[sectionId] || [sectionId.split(/(?=[A-Z])|[_-]/)[0]];
  for (const p of prefixes) {
    const match = keys.find((k) => k.toLowerCase().includes(p) && k.toLowerCase().includes(strippedLower));
    if (match) return data[match];
  }

  // final fallback: any key that contains the stripped fragment (prefer earlier keys)
  if (containsMatches.length > 0) return data[containsMatches[0]];

  return field.defaultValue ?? '';
};

const parseOption = (opt: string) => {
  // Accept formats: "key::label", "key|label", "key:label" or simple "label"
  const sep = opt.includes('::') ? '::' : opt.includes('|') ? '|' : opt.includes(':') ? ':' : null;
  if (!sep) return { key: opt, label: opt };
  const [k, ...rest] = opt.split(sep);
  return { key: k, label: rest.join(sep) };
};

export const renderFieldNode = (params: {
  sectionId: string;
  field: any;
  config: TemplateConfig;
  data: any;
  currency?: string;
}): React.ReactNode => {
  const { sectionId, field, config, data, currency } = params;
  if (field.visible === false) return null;

  const label = getFieldLabel(config, sectionId, field.key, field.label || '');
  const raw = resolveRawValue(data, field, sectionId);
  const fieldCfg = getFieldConfig(config, sectionId, field.key) || field;
  const styleClasses = mapFieldStyleToClasses(fieldCfg.style);
  const inlineStyle = mapFieldStyleToInlineStyle(fieldCfg.style);

  switch (field.type) {
    case 'number':
      return (
        <p key={field.key} className={`mb-1 ${styleClasses}`} style={inlineStyle}>
          <strong>{label}</strong> {formatNumber(raw)}
        </p>
      );
    case 'currency':
      return (
        <p key={field.key} className={`mb-1 ${styleClasses}`} style={inlineStyle}>
          <strong>{label}</strong> {formatCurrency(raw, currency)}
        </p>
      );
    case 'date':
      return (
        <p key={field.key} className={`mb-1 ${styleClasses}`} style={inlineStyle}>
          <strong>{label}</strong> {formatDate(raw) || field.placeholder || ''}
        </p>
      );
    case 'textarea':
      return (
        <p key={field.key} className={`mb-1 whitespace-pre-line ${styleClasses}`} style={inlineStyle}>
          <strong>{label}</strong> {String(raw || field.placeholder || '')}
        </p>
      );
    case 'select': {
      let display = '';
      if (field.options && Array.isArray(field.options)) {
        const parsed = field.options.map((o: string) => parseOption(String(o)));
        const found = parsed.find((p: any) => p.key === raw || p.label === raw || p.key === String(raw));
        display = found ? found.label : String(raw || field.defaultValue || '');
      } else {
        display = String(raw || field.defaultValue || '');
      }
      return (
        <p key={field.key} className={`mb-1 ${styleClasses}`} style={inlineStyle}>
          <strong>{label}</strong> {display}
        </p>
      );
    }
    case 'checkbox':
      return (
        <p key={field.key} className={`mb-1 ${styleClasses}`} style={inlineStyle}>
          <strong>{label}</strong> {raw ? '✓' : '✗'}
        </p>
      );
    default:
      return (
        <p key={field.key} className={`mb-1 ${styleClasses}`} style={inlineStyle}>
          <strong>{label}</strong> {String(raw || field.placeholder || '')}
        </p>
      );
  }
};

export default renderFieldNode;