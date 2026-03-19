import { RefObject } from 'react';

declare global {
  interface Window {
    jspdf?: any;
    html2canvas?: any;
  }
}

const WATERMARK_MAX_WIDTH_RATIO = 0.45;
const WATERMARK_MAX_HEIGHT_RATIO = 0.45;
const SYSTEM_GENERATED_FOOTER_TEXT = 'This is an electronically generated document, no signature is required.';

interface WatermarkData {
  dataUrl: string;
  aspectRatio: number;
  type: 'PNG' | 'JPEG';
}

type ImageType = 'PNG' | 'JPEG';

type Snapshot = {
  el: HTMLElement;
  cssText: string;
  hadInline: boolean;
};

const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });

const safeSetOpacity = (pdf: any, opacity: number) => {
  try {
    if (typeof pdf.setGState === 'function') {
      pdf.setGState(new (pdf as any).GState({ opacity }));
    }
  } catch {}
};

const sanitizeSegment = (value: string, fallback: string): string => {
  const trimmed = value?.trim() ?? '';
  const source = trimmed || fallback;
  const sanitized = source
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/[^a-z0-9_\-]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
  return sanitized || fallback;
};

const sanitizeFilename = (clientName: string, dateStr: string): string => {
  const safeName = sanitizeSegment(clientName, 'invoice');
  const safeDate = sanitizeSegment(
    dateStr || new Date().toISOString().slice(0, 10),
    new Date().toISOString().slice(0, 10)
  );
  return `${safeName}-${safeDate}.pdf`;
};

const preloadWatermark = async (logoSrc?: string): Promise<WatermarkData | null> => {
  if (!logoSrc || !logoSrc.trim()) return null;

  const src = logoSrc.trim();
  const loadImage = () =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });

  try {
    const img = await loadImage();
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    if (!naturalWidth || !naturalHeight) return null;

    const canvas = document.createElement('canvas');
    canvas.width = naturalWidth;
    canvas.height = naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);

    try {
      const dataUrl = canvas.toDataURL('image/png');
      return { dataUrl, aspectRatio: naturalHeight / naturalWidth, type: 'PNG' };
    } catch {
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        return { dataUrl, aspectRatio: naturalHeight / naturalWidth, type: 'JPEG' };
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
};

const tryAddImage = (
  pdf: any,
  dataUrl: string,
  type: ImageType,
  x: number,
  y: number,
  width: number,
  height: number,
  fallbackProducer?: () => { dataUrl: string; type: ImageType }
) => {
  try {
    pdf.addImage(dataUrl, type, x, y, width, height, undefined, 'FAST');
  } catch (err) {
    if (fallbackProducer) {
      const fallback = fallbackProducer();
      pdf.addImage(fallback.dataUrl, fallback.type, x, y, width, height, undefined, 'FAST');
      return;
    }
    throw err;
  }
};

const drawWatermark = (
  pdf: any,
  watermark: WatermarkData | null,
  pageNumber: number,
  pdfWidthMm: number,
  contentHeightMm: number
) => {
  if (!watermark) return;

  const maxWidth = pdfWidthMm * WATERMARK_MAX_WIDTH_RATIO;
  const maxHeight = contentHeightMm * WATERMARK_MAX_HEIGHT_RATIO;

  let targetWidth = maxWidth;
  let targetHeight = targetWidth * watermark.aspectRatio;
  if (targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = targetHeight / watermark.aspectRatio;
  }

  const x = (pdfWidthMm - targetWidth) / 2;
  const y = (contentHeightMm - targetHeight) / 2;

  pdf.setPage(pageNumber);
  safeSetOpacity(pdf, 0.08);
  try {
    tryAddImage(pdf, watermark.dataUrl, watermark.type, x, y, targetWidth, targetHeight);
  } finally {
    safeSetOpacity(pdf, 1);
  }
};

export const loadPdfScripts = async (onSuccess: () => void, onError: (msg: string) => void): Promise<void> => {
  const jspdfURL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const html2canvasURL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

  try {
    await Promise.all([loadScript(jspdfURL), loadScript(html2canvasURL)]);
    onSuccess();
  } catch {
    onError('Failed to load necessary PDF scripts.');
  }
};

const normalizeMultilineText = (val: any) =>
  String(val ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const renderCenteredMultiline = (
  pdf: any,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  maxLines: number,
  lineStepMm: number
) => {
  const cleaned = normalizeMultilineText(text);
  if (!cleaned) return 0;

  const rawSegments = cleaned.split('\n');
  const lines: string[] = [];
  rawSegments.forEach((seg, idx) => {
    const t = seg.trim();
    if (t.length) {
      const split = pdf.splitTextToSize(t, maxWidth) as string[];
      lines.push(...split);
    } else if (idx !== rawSegments.length - 1) {
      lines.push('');
    }
  });

  while (lines.length && lines[lines.length - 1].trim().length === 0) lines.pop();
  if (!lines.length) return 0;

  const limited = maxLines > 0 ? lines.slice(0, maxLines) : [];
  limited.forEach((ln, i) => {
    const w = pdf.getTextWidth(ln);
    pdf.text(ln, centerX - w / 2, startY + i * lineStepMm);
  });

  return limited.length;
};

const buildFooterTextForPdf = (invoiceMeta: any, footerText?: string) => {
  const uiFooter = normalizeMultilineText(footerText);
  const metaFooter = normalizeMultilineText(invoiceMeta?.footerDetails);
  const systemFooter = normalizeMultilineText(invoiceMeta?.systemGeneratedFooterText);
  const lines = [uiFooter, metaFooter]
    .flatMap((value) => value.split('\n'))
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index, arr) => arr.indexOf(line) === index);

  if (systemFooter) {
    const systemLines = systemFooter
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line, index, arr) => arr.indexOf(line) === index);

    return [...lines, ...systemLines].join('\n');
  }

  return lines.join('\n');
};

const hasAuthorizedDetails = (invoiceMeta: any) => {
  const name = String(invoiceMeta?.authorizedPersonName ?? '').trim();
  const des = String(invoiceMeta?.authorizedDesignation ?? '').trim();
  return name.length > 0 || des.length > 0;
};

const snapshot = (snaps: Snapshot[], el: HTMLElement) => {
  snaps.push({
    el,
    cssText: el.getAttribute('style') ?? '',
    hadInline: el.hasAttribute('style'),
  });
};

const restoreSnapshots = (snaps: Snapshot[]) => {
  for (let i = snaps.length - 1; i >= 0; i--) {
    const s = snaps[i];
    if (s.hadInline) s.el.setAttribute('style', s.cssText);
    else s.el.removeAttribute('style');
  }
};

const cssNumber = (v: string) => {
  const n = parseFloat(v || '0');
  return Number.isFinite(n) ? n : 0;
};

const isHrLike = (el: HTMLElement) => {
  const tag = el.tagName.toLowerCase();
  if (tag === 'hr') return true;
  const rect = el.getBoundingClientRect();
  if (rect.height > 8) return false;
  const s = window.getComputedStyle(el);
  const bt = cssNumber(s.borderTopWidth);
  const bb = cssNumber(s.borderBottomWidth);
  return bt >= 1 || bb >= 1;
};

const hasBorderTop = (el: HTMLElement) => {
  const s = window.getComputedStyle(el);
  const bt = cssNumber(s.borderTopWidth);
  return bt >= 1;
};

const findElementByExactText = (root: HTMLElement, text: string) => {
  const needle = text.trim().toLowerCase();
  if (!needle) return null;
  const els = Array.from(root.querySelectorAll<HTMLElement>('*'));
  for (const el of els) {
    const t = (el.textContent || '').trim().toLowerCase();
    if (t === needle) return el;
  }
  return null;
};

const findElementsByContainsText = (root: HTMLElement, needle: string) => {
  const n = needle.trim().toLowerCase();
  if (!n) return [];
  const els = Array.from(root.querySelectorAll<HTMLElement>('*'));
  return els.filter((el) => (el.textContent || '').trim().toLowerCase().includes(n));
};

const findFirstBelow = (root: HTMLElement, y: number, filter: (el: HTMLElement) => boolean, maxScanPx: number) => {
  const all = Array.from(root.querySelectorAll<HTMLElement>('*'));
  const candidates = all
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .filter((x) => x.rect.top >= y - 1 && x.rect.top <= y + maxScanPx)
    .filter((x) => filter(x.el))
    .sort((a, b) => a.rect.top - b.rect.top);
  return candidates[0]?.el ?? null;
};

const findSectionRootNear = (root: HTMLElement, anchor: HTMLElement) => {
  const ancRect = anchor.getBoundingClientRect();
  let cur: HTMLElement | null = anchor;
  for (let i = 0; i < 8 && cur; i++) {
    const r = cur.getBoundingClientRect();
    const s = window.getComputedStyle(cur);
    const tag = cur.tagName.toLowerCase();
    const isTableish = tag === 'td' || tag === 'th' || tag === 'tr' || tag === 'table';
    const isBlocky = s.display === 'block' || s.display === 'flex' || s.display === 'grid';
    const closeX = Math.abs(r.right - ancRect.right) < 80 || Math.abs(r.left - ancRect.left) < 80;
    if ((isBlocky || isTableish) && closeX) return cur;
    cur = cur.parentElement;
  }
  return root;
};

const tightenAuthorizedBlock = (root: HTMLElement, invoiceMeta: any) => {
  const snaps: Snapshot[] = [];
  if (!hasAuthorizedDetails(invoiceMeta)) return snaps;

  const desText = String(invoiceMeta?.authorizedDesignation ?? '').trim();
  const nameText = String(invoiceMeta?.authorizedPersonName ?? '').trim();

  const designationEl = desText ? findElementByExactText(root, desText) : null;
  const nameEl = nameText ? findElementByExactText(root, nameText) : null;

  const labelEls = findElementsByContainsText(root, 'authorized signatory');
  const labelEl = labelEls.length ? labelEls[0] : null;

  const anchor = designationEl || nameEl || labelEl;
  if (!anchor) return snaps;

  const sectionRoot = findSectionRootNear(root, anchor);

  const labelRect = labelEl ? labelEl.getBoundingClientRect() : anchor.getBoundingClientRect();
  const labelBottom = labelRect.bottom;

  const nameRect = nameEl ? nameEl.getBoundingClientRect() : null;
  const desRect = designationEl ? designationEl.getBoundingClientRect() : null;

  const firstTextTop = Math.min(
    nameRect?.top ?? Number.POSITIVE_INFINITY,
    desRect?.top ?? Number.POSITIVE_INFINITY
  );

  if (Number.isFinite(firstTextTop) && firstTextTop - labelBottom > 24) {
    const between = Array.from(sectionRoot.querySelectorAll<HTMLElement>('*'))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter((x) => x.rect.top >= labelBottom - 2 && x.rect.bottom <= firstTextTop + 2)
      .filter((x) => {
        const t = (x.el.textContent || '').replace(/\s+/g, '').trim();
        if (t.length) return false;
        const h = x.rect.height;
        return h >= 18;
      })
      .sort((a, b) => b.rect.height - a.rect.height);

    const spacer = between[0]?.el ?? null;
    if (spacer) {
      snapshot(snaps, spacer);
      spacer.style.height = '18px';
      spacer.style.minHeight = '0px';
      spacer.style.maxHeight = '18px';
      spacer.style.paddingTop = '0px';
      spacer.style.paddingBottom = '0px';
      spacer.style.marginTop = '0px';
      spacer.style.marginBottom = '0px';
    }
  }

  const tightenTextEl = (el: HTMLElement) => {
    snapshot(snaps, el);
    el.style.marginTop = '2px';
    el.style.paddingTop = '0px';
    el.style.lineHeight = '1.2';
  };

  if (nameEl) tightenTextEl(nameEl);
  if (designationEl) tightenTextEl(designationEl);

  const lastTextEl = designationEl || nameEl;
  if (lastTextEl) {
    const lastRect = lastTextEl.getBoundingClientRect();
    const gapPx = 10;
    const hrCandidate = findFirstBelow(sectionRoot, lastRect.bottom, isHrLike, 200);
    if (hrCandidate) {
      const hrRect = hrCandidate.getBoundingClientRect();
      if (hrRect.top < lastRect.bottom + gapPx) {
        const delta = Math.ceil(lastRect.bottom + gapPx - hrRect.top);
        snapshot(snaps, hrCandidate);
        const s = window.getComputedStyle(hrCandidate);
        const mt = cssNumber(s.marginTop);
        hrCandidate.style.marginTop = `${mt + delta}px`;
      }
    } else {
      const borderTopCandidate = findFirstBelow(sectionRoot, lastRect.bottom, hasBorderTop, 220);
      if (borderTopCandidate) {
        const r = borderTopCandidate.getBoundingClientRect();
        if (r.top < lastRect.bottom + gapPx) {
          const delta = Math.ceil(lastRect.bottom + gapPx - r.top);
          snapshot(snaps, borderTopCandidate);
          const s = window.getComputedStyle(borderTopCandidate);
          const pt = cssNumber(s.paddingTop);
          borderTopCandidate.style.paddingTop = `${pt + delta}px`;
        }
      }
    }
  }

  return snaps;
};

const getDocumentMode = (invoiceMeta: any): 'invoice' | 'purchaseOrder' | 'quotation' => {
  const mode = String(invoiceMeta?.documentMode || '').trim();
  if (mode === 'purchaseOrder' || mode === 'quotation' || mode === 'invoice') {
    return mode;
  }
  return 'invoice';
};

const getFooterLabels = (invoiceMeta: any) => {
  const mode = getDocumentMode(invoiceMeta);

  if (mode === 'purchaseOrder') {
    return {
      numberLabel: 'Purchase Order No',
      dateLabel: 'Date',
      partyLabel: 'Vendor',
    };
  }

  if (mode === 'quotation') {
    return {
      numberLabel: 'Quotation No',
      dateLabel: 'Date',
      partyLabel: 'Quotation To',
    };
  }

  return {
    numberLabel: 'Invoice No',
    dateLabel: 'Invoice Date',
    partyLabel: 'Billed To',
  };
};

const drawBottomFooter = (
  pdf: any,
  pageNum: number,
  totalPages: number,
  pdfWidth: number,
  pdfHeight: number,
  bottomMarginMm: number,
  invoiceMeta: any,
  footerTextCombined: string,
  isCompact: boolean
) => {
  pdf.setPage(pageNum);
  pdf.setFont('helvetica', 'normal');

  const padX = 14;
  const footerTop = pdfHeight - bottomMarginMm;
  const metaTopY = footerTop + 6;
  const metaValueY = metaTopY + 4;
  const pageBottomY = pdfHeight - 4;

  const { numberLabel, dateLabel, partyLabel } = getFooterLabels(invoiceMeta);

  const invoiceNo = String(invoiceMeta?.quotationNumber || invoiceMeta?.invoiceNumber || '---');
  const invoiceDate = String(invoiceMeta?.date || '---');
  const billedTo = String(invoiceMeta?.clientName || invoiceMeta?.consigneeName || '---');
  const pageText = `Page ${pageNum} of ${totalPages}`;

  pdf.setTextColor(40);
  pdf.setFontSize(9);

  if (!isCompact) {
    pdf.setFont(undefined, 'bold');
    pdf.text(numberLabel, padX, metaTopY);
    pdf.setFont(undefined, 'normal');
    pdf.text(invoiceNo, padX, metaValueY);

    pdf.setFont(undefined, 'bold');
    pdf.text(dateLabel, padX + 44, metaTopY);
    pdf.setFont(undefined, 'normal');
    pdf.text(invoiceDate, padX + 44, metaValueY);

    pdf.setFont(undefined, 'bold');
    pdf.text(partyLabel, padX + 92, metaTopY);
    pdf.setFont(undefined, 'normal');
    pdf.text(billedTo, padX + 92, metaValueY);

    pdf.setFontSize(8);
    const pageW = pdf.getTextWidth(pageText);
    pdf.text(pageText, pdfWidth - padX - pageW, metaValueY);
  } else {
    const leftX = 12;
    const baseY = footerTop + 9;

    pdf.setFontSize(8.5);

    const numberLabelWithColon = `${numberLabel}: `;
    pdf.setFont(undefined, 'bold');
    pdf.text(numberLabelWithColon, leftX, baseY);
    const invLabelW = pdf.getTextWidth(numberLabelWithColon);
    pdf.setFont(undefined, 'normal');
    pdf.text(invoiceNo, leftX + invLabelW, baseY);

    const billedY = baseY + 4;
    const partyLabelWithColon = `${partyLabel}: `;
    pdf.setFont(undefined, 'bold');
    pdf.text(partyLabelWithColon, leftX, billedY);
    const billedLabelW = pdf.getTextWidth(partyLabelWithColon);
    pdf.setFont(undefined, 'normal');
    pdf.text(billedTo, leftX + billedLabelW, billedY);

    const rightX = pdfWidth - 12;

    const dateLabelWithColon = `${dateLabel}: `;
    pdf.setFont(undefined, 'bold');
    const dateValueW = pdf.getTextWidth(invoiceDate);
    const dateLabelW = pdf.getTextWidth(dateLabelWithColon);
    const dateTextX = rightX - dateValueW;
    pdf.text(dateLabelWithColon, dateTextX - dateLabelW, baseY);
    pdf.setFont(undefined, 'normal');
    pdf.text(invoiceDate, dateTextX, baseY);

    const pgW = pdf.getTextWidth(pageText);
    pdf.text(pageText, rightX - pgW, billedY);
  }

  const footerBody = normalizeMultilineText(footerTextCombined);
  if (footerBody) {
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(80);
    pdf.setFontSize(8);

    const centerX = pdfWidth / 2;
    const maxCenterWidth = pdfWidth - 120;

    const startY = isCompact ? footerTop + 8 : metaValueY + 6;
    const reservedBottomGap = 4.5;
    const availableHeight = Math.max(0, pageBottomY - reservedBottomGap - startY);
    const lineStep = 3.8;
    const maxLines = Math.max(1, Math.floor(availableHeight / lineStep));

    renderCenteredMultiline(pdf, footerBody, centerX, startY, maxCenterWidth, maxLines, lineStep);
  }
};

export const generatePdf = async (
  previewRef: RefObject<HTMLDivElement>,
  invoiceMeta: any,
  logoSrc: string | undefined,
  footerText: string | undefined,
  signatureImageUrl: string | undefined,
  onError: (msg: string) => void
): Promise<void> => {
  try {
    if (!window.jspdf || !window.html2canvas) {
      onError('PDF libraries are not loaded.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const html2canvas = window.html2canvas;

    const input = previewRef.current;
    if (!input) {
      onError('Preview element not found.');
      return;
    }

    if ((document as any).fonts && (document as any).fonts.ready) {
      await (document as any).fonts.ready;
    }

    const hasAuth = hasAuthorizedDetails(invoiceMeta);
    const hasSignatureImage = Boolean(signatureImageUrl && String(signatureImageUrl).trim().length > 0);

    const effectiveInvoiceMeta = {
      ...invoiceMeta,
      systemGeneratedFooterText: hasSignatureImage ? '' : invoiceMeta?.systemGeneratedFooterText ?? SYSTEM_GENERATED_FOOTER_TEXT,
    };

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const MARGIN_TOP_MM = hasAuth || hasSignatureImage ? 22 : 20;
    const MARGIN_BOTTOM_MM = hasAuth || hasSignatureImage ? 32 : 26;

    const avoidEls = Array.from(input.querySelectorAll('.avoid-break')) as HTMLElement[];
    avoidEls.forEach((el) => {
      el.style.marginTop = '';
      if (el.tagName === 'TR') Array.from(el.children).forEach((td: any) => (td.style.paddingTop = ''));
    });

    const pxPerMm = input.offsetWidth / 210;
    const PAGE_1_CUT = (pdfHeight - MARGIN_BOTTOM_MM) * pxPerMm;
    const SUBSEQUENT_PAGE_HEIGHT_PX = (pdfHeight - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) * pxPerMm;

    avoidEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const containerRect = input.getBoundingClientRect();
      const relativeTop = rect.top - containerRect.top;
      const height = el.offsetHeight;
      const relativeBottom = relativeTop + height;

      let cutLine = PAGE_1_CUT;
      while (cutLine < relativeTop) cutLine += SUBSEQUENT_PAGE_HEIGHT_PX;

      if (relativeTop < cutLine && relativeBottom > cutLine) {
        const pushAmount = Math.ceil(cutLine - relativeTop) + 18;
        if (el.tagName === 'TR') {
          Array.from(el.children).forEach((td: any) => {
            const currentPadding = parseInt(window.getComputedStyle(td).paddingTop) || 0;
            td.style.paddingTop = `${currentPadding + pushAmount}px`;
          });
        } else {
          el.style.marginTop = `${pushAmount}px`;
        }
      }
    });

    await new Promise((r) => setTimeout(r, 250));

    const snaps = tightenAuthorizedBlock(input, effectiveInvoiceMeta);

    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        logging: false,
        height: input.scrollHeight,
        windowHeight: input.scrollHeight,
        ignoreElements: (el: Element) => el.classList.contains('no-print-footer'),
      });
    } finally {
      restoreSnapshots(snaps);
    }

    const imgData = canvas.toDataURL('image/png');

    const CONTENT_HEIGHT_PAGE1 = pdfHeight - MARGIN_BOTTOM_MM;
    const CONTENT_HEIGHT_OTHERS = pdfHeight - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;

    const watermark = await preloadWatermark(logoSrc);

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const totalPages = Math.max(1, 1 + Math.ceil(Math.max(0, imgHeight - CONTENT_HEIGHT_PAGE1) / CONTENT_HEIGHT_OTHERS));

    let heightLeft = imgHeight;
    let position = 0;
    let pageNumber = 1;

    const footerCombined = buildFooterTextForPdf(effectiveInvoiceMeta, footerText);

    const maskAndFooter = (pageNum: number, isFirstPage: boolean) => {
      pdf.setFillColor(255, 255, 255);
      if (!isFirstPage) pdf.rect(0, 0, pdfWidth, MARGIN_TOP_MM, 'F');
      pdf.rect(0, pdfHeight - MARGIN_BOTTOM_MM, pdfWidth, MARGIN_BOTTOM_MM, 'F');

      try {
        if (watermark) {
          const contentH = isFirstPage ? CONTENT_HEIGHT_PAGE1 : CONTENT_HEIGHT_OTHERS;
          drawWatermark(pdf, watermark, pageNum, pdfWidth, contentH);
        }
      } catch {}

      const compact = Boolean(hasSignatureImage || hasAuth);
      drawBottomFooter(pdf, pageNum, totalPages, pdfWidth, pdfHeight, MARGIN_BOTTOM_MM, effectiveInvoiceMeta, footerCombined, compact);
    };

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    maskAndFooter(pageNumber, true);

    heightLeft -= CONTENT_HEIGHT_PAGE1;
    position -= CONTENT_HEIGHT_PAGE1;
    pageNumber++;

    while (heightLeft > 0) {
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position + MARGIN_TOP_MM, imgWidth, imgHeight);
      maskAndFooter(pageNumber, false);
      heightLeft -= CONTENT_HEIGHT_OTHERS;
      position -= CONTENT_HEIGHT_OTHERS;
      pageNumber++;
    }

    const fileName = sanitizeFilename(String(effectiveInvoiceMeta?.clientName || 'invoice'), String(effectiveInvoiceMeta?.date || ''));
    pdf.save(fileName);
  } catch (err) {
    console.error('PDF generation error:', err);
    onError('Could not generate PDF.');
  }
};

export default generatePdf;