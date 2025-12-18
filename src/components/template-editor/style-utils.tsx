import React from 'react';

export const mapFieldStyleToClasses = (style: any | undefined) => {
  if (!style) return '';
  const classes: string[] = [];
  if (style.fontFamily) {
    if (style.fontFamily === 'serif') classes.push('font-serif');
    else if (style.fontFamily === 'mono') classes.push('font-mono');
    else classes.push('font-sans');
  }
  if (style.fontSize) classes.push({ xs: 'text-xs', sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl', '2xl': 'text-2xl' }[style.fontSize] || '');
  if (style.fontWeight) classes.push({ normal: 'font-normal', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold' }[style.fontWeight] || '');
  if (style.textColor) classes.push(style.textColor);
  if (style.bgColor) classes.push(style.bgColor);
  if (style.align) classes.push(style.align === 'center' ? 'text-center' : style.align === 'right' ? 'text-right' : 'text-left');
  if (style.padding) classes.push(style.padding);
  if (style.margin) classes.push(style.margin);
  return classes.filter(Boolean).join(' ');
};

export const mapFieldStyleToInlineStyle = (style: any | undefined): React.CSSProperties | undefined => {
  if (!style) return undefined;
  const css: React.CSSProperties = {};

  const looksLikeCssColor = (val: string | undefined) => {
    if (!val) return false;
    if (val.startsWith('#')) return true;
    if (val.startsWith('rgb')) return true;
    if (/[a-zA-Z]+/.test(val) && !val.includes('-') && !val.startsWith('text') && !val.startsWith('bg')) {
      // simple color keywords like 'white', 'black', 'red'
      return true;
    }
    return false;
  };

  if (style.bgColor && looksLikeCssColor(style.bgColor)) {
    css.backgroundColor = style.bgColor as any;
  }
  if (style.textColor && looksLikeCssColor(style.textColor)) {
    css.color = style.textColor as any;
  }
  if (style.align) {
    css.textAlign = style.align as any;
  }
  if (style.fontFamily) {
    if (style.fontFamily === 'serif') css.fontFamily = 'Georgia, serif';
    else if (style.fontFamily === 'mono') css.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace';
    else css.fontFamily = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
  }

  return Object.keys(css).length ? css : undefined;
};
