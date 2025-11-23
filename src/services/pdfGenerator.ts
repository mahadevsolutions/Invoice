import { RefObject } from 'react';

// --- Window augmentation to avoid TS errors when using global libs ---
declare global {
  interface Window {
    jspdf?: any;
    html2canvas?: any;
  }
}

const FOOTER_HEIGHT_MM = 16;
const FOOTER_INITIAL_FONT_SIZE = 9;
const FOOTER_MIN_FONT_SIZE = 7;
const FOOTER_FONT_STEP = 0.5;
const FOOTER_MAX_LINES = 2;
const FOOTER_PADDING_MM = 10;
const WATERMARK_MAX_WIDTH_RATIO = 0.45;
const WATERMARK_MAX_HEIGHT_RATIO = 0.45;

interface StyleSnapshot {
  el: HTMLElement;
  cssText: string;
  hadInlineStyle: boolean;
}

interface WatermarkData {
  dataUrl: string;
  aspectRatio: number;
  type: 'PNG' | 'JPEG';
}

// --- Utility: dynamically load a script ---
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

// --- Helpers for working with jspdf state safely ---
const safeSetOpacity = (pdf: any, opacity: number) => {
  try {
    if (typeof pdf.setGState === 'function') {
      // @ts-ignore - GState is runtime from jspdf
      pdf.setGState(new (pdf as any).GState({ opacity }));
    }
  } catch (e) {
    // ignore: opacity not supported
  }
};

const waitForLayout = async () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));

const ensureFontsReady = async () => {
  try {
    const fontSet = (document as any).fonts;
    if (fontSet?.ready) {
      await fontSet.ready;
    }
  } catch (err) {
    console.warn('document.fonts.ready rejected; continuing without blocking.', err);
  }
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

const toggleNoPrintFooters = (): HTMLElement[] => {
  const toggled: HTMLElement[] = [];
  document.querySelectorAll<HTMLElement>('.no-print-footer').forEach((element) => {
    if (!element.classList.contains('hide-for-pdf')) {
      element.classList.add('hide-for-pdf');
      toggled.push(element);
    }
  });
  return toggled;
};

const snapshotStyle = (map: Map<HTMLElement, StyleSnapshot>, el: HTMLElement) => {
  if (map.has(el)) return;
  map.set(el, {
    el,
    cssText: el.getAttribute('style') ?? '',
    hadInlineStyle: el.hasAttribute('style')
  });
};

const restoreStyles = (snapshots: StyleSnapshot[]) => {
  snapshots.forEach(({ el, cssText, hadInlineStyle }) => {
    if (hadInlineStyle) {
      el.setAttribute('style', cssText);
    } else {
      el.removeAttribute('style');
    }
  });
};

const prepareWrapperForCapture = (
  wrapper: HTMLElement,
  styleMap: Map<HTMLElement, StyleSnapshot>
) => {
  snapshotStyle(styleMap, wrapper);
  wrapper.style.height = 'auto';
  wrapper.style.maxHeight = 'none';
  wrapper.style.overflow = 'visible';
  wrapper.style.visibility = 'visible';
  wrapper.style.background = '#ffffff';
};

const adjustFixedElements = (
  root: HTMLElement,
  styleMap: Map<HTMLElement, StyleSnapshot>
) => {
  const adjusted: HTMLElement[] = [];
  const allNodes = root.querySelectorAll<HTMLElement>('*');
  allNodes.forEach((element) => {
    const computed = window.getComputedStyle(element);
    if (computed.position === 'fixed') {
      snapshotStyle(styleMap, element);
      element.style.position = 'static';
      adjusted.push(element);
    }
  });
  return adjusted;
};

const computePageCanvasPx = (
  canvasWidthPx: number,
  contentHeightMm: number,
  pdfWidthMm: number
): number => Math.max(1, Math.round((contentHeightMm * canvasWidthPx) / pdfWidthMm));

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
    if (!naturalWidth || !naturalHeight) {
      console.warn('Watermark image missing intrinsic dimensions; skipping watermark.');
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = naturalWidth;
    canvas.height = naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Unable to create 2D context for watermark; skipping.');
      return null;
    }
    ctx.drawImage(img, 0, 0);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      return { dataUrl, aspectRatio: naturalHeight / naturalWidth, type: 'PNG' };
    } catch (err) {
      console.warn('Watermark toDataURL failed, attempting JPEG fallback.', err);
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        return { dataUrl, aspectRatio: naturalHeight / naturalWidth, type: 'JPEG' };
      } catch (jpegErr) {
        console.warn('Watermark JPEG fallback failed; skipping watermark.', jpegErr);
        return null;
      }
    }
  } catch (err) {
    console.warn('Failed to preload watermark image; skipping watermark.', err);
    return null;
  }
};

type ImageType = 'PNG' | 'JPEG';

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
    console.warn('pdf.addImage failed; using fallback.', err);
    if (fallbackProducer) {
      try {
        const fallback = fallbackProducer();
        pdf.addImage(fallback.dataUrl, fallback.type, x, y, width, height, undefined, 'FAST');
        return;
      } catch (fallbackErr) {
        console.warn('Fallback pdf.addImage failed.', fallbackErr);
        throw fallbackErr;
      }
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

const truncateToMaxLines = (lines: string[], maxLines: number): string[] => {
  if (lines.length <= maxLines) {
    return lines;
  }
  if (maxLines <= 0) {
    return [];
  }
  const truncated = lines.slice(0, maxLines);
  const lastIndex = truncated.length - 1;
  const ellipsis = '...';
  truncated[lastIndex] = `${truncated[lastIndex].trimEnd()}${ellipsis}`;
  return truncated;
};

const computeLineHeightMm = (pdf: any, fontSize: number): number => {
  const scaleFactor = pdf.internal.scaleFactor || (72 / 25.4);
  const lineHeightFactor = typeof pdf.getLineHeightFactor === 'function' ? pdf.getLineHeightFactor() : 1.15;
  return (fontSize * lineHeightFactor) / scaleFactor;
};

interface FooterSlotResult {
  lines: string[];
  fontSize: number;
  truncated: boolean;
}

const fitTextWithinSlot = (
  pdf: any,
  rawText: string,
  maxWidth: number,
  maxLines: number
): FooterSlotResult => {
  const text = (rawText ?? '').toString().trim();
  if (!text || maxWidth <= 0 || maxLines <= 0) {
    return { lines: [], fontSize: FOOTER_INITIAL_FONT_SIZE, truncated: false };
  }

  const initialFontSize = pdf.getFontSize();
  let fontSize = FOOTER_INITIAL_FONT_SIZE;
  let lines: string[] = [];
  let truncated = false;

  const applySplit = (size: number) => {
    pdf.setFontSize(size);
    return pdf.splitTextToSize(text, maxWidth) as string[];
  };

  let attemptFontSize = fontSize;
  while (attemptFontSize >= FOOTER_MIN_FONT_SIZE) {
    lines = applySplit(attemptFontSize);
    if (lines.length <= maxLines) {
      fontSize = attemptFontSize;
      break;
    }
    attemptFontSize = parseFloat((attemptFontSize - FOOTER_FONT_STEP).toFixed(2));
    if (attemptFontSize < FOOTER_MIN_FONT_SIZE) {
      attemptFontSize = FOOTER_MIN_FONT_SIZE;
      lines = applySplit(attemptFontSize);
      fontSize = attemptFontSize;
      break;
    }
  }

  if (lines.length > maxLines) {
    truncated = true;
    lines = truncateToMaxLines(lines, maxLines);
    const ellipsis = '...';
    const lastIndex = lines.length - 1;
    let lastLine = lines[lastIndex];
    if (!lastLine.endsWith(ellipsis)) {
      lastLine = `${lastLine.trimEnd()}${ellipsis}`;
    }
    pdf.setFontSize(fontSize);
    while (pdf.getTextWidth(lastLine) > maxWidth && lastLine.replace(ellipsis, '').length > 0) {
      const withoutEllipsis = lastLine.endsWith(ellipsis)
        ? lastLine.slice(0, -ellipsis.length)
        : lastLine;
      const shortened = withoutEllipsis.slice(0, Math.max(0, withoutEllipsis.length - 1)).trimEnd();
      lastLine = `${shortened}${ellipsis}`;
    }
    lines[lastIndex] = lastLine;
  } else {
    fontSize = Math.max(Math.min(fontSize, FOOTER_INITIAL_FONT_SIZE), FOOTER_MIN_FONT_SIZE);
  }

  pdf.setFontSize(initialFontSize);
  return { lines, fontSize, truncated };
};

const drawFooter = (
  pdf: any,
  pageNumber: number,
  totalPages: number,
  pdfWidthMm: number,
  pdfHeightMm: number,
  footerText: string,
  clientName: string,
  dateStr: string
) => {
  pdf.setPage(pageNumber);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80, 80, 80);

  const paddingMm = FOOTER_PADDING_MM;
  const leftSlotWidth = Math.max(0, pdfWidthMm * 0.45 - paddingMm);
  const centerSlotWidth = Math.max(0, pdfWidthMm * 0.35 - paddingMm);
  const rightSlotWidth = Math.max(0, pdfWidthMm - leftSlotWidth - centerSlotWidth - paddingMm * 2);

  const leftSlot = fitTextWithinSlot(pdf, clientName, leftSlotWidth, FOOTER_MAX_LINES);
  const centerSlot = fitTextWithinSlot(pdf, footerText, centerSlotWidth, FOOTER_MAX_LINES);
  const rightSlot = fitTextWithinSlot(pdf, dateStr, rightSlotWidth, 1);

  if (leftSlot.truncated) {
    console.warn('Footer left slot truncated to fit available space.', clientName);
  }
  if (centerSlot.truncated) {
    console.warn('Footer center slot truncated to fit available space.', footerText);
  }
  if (rightSlot.truncated) {
    console.warn('Footer right slot truncated to fit available space.', dateStr);
  }

  const mainBaseline = pdfHeightMm - 6;
  const pageNumberBaseline = pdfHeightMm - 2.5;

  if (leftSlot.lines.length) {
    pdf.setFontSize(leftSlot.fontSize);
    const lineHeight = computeLineHeightMm(pdf, leftSlot.fontSize);
    const startY = mainBaseline - lineHeight * (leftSlot.lines.length - 1);
    pdf.text(leftSlot.lines, paddingMm, startY, { align: 'left', baseline: 'alphabetic' });
  }

  if (centerSlot.lines.length) {
    pdf.setFontSize(centerSlot.fontSize);
    const lineHeight = computeLineHeightMm(pdf, centerSlot.fontSize);
    const startX = paddingMm + leftSlotWidth + centerSlotWidth / 2;
    const startY = mainBaseline - lineHeight * (centerSlot.lines.length - 1);
    pdf.text(centerSlot.lines, startX, startY, { align: 'center', baseline: 'alphabetic' });
  }

  if (rightSlot.lines.length) {
    pdf.setFontSize(rightSlot.fontSize);
    const lineHeight = computeLineHeightMm(pdf, rightSlot.fontSize);
    const startX = pdfWidthMm - paddingMm;
    const startY = pdfHeightMm - FOOTER_HEIGHT_MM + lineHeight;
    pdf.text(rightSlot.lines, startX, startY, { align: 'right', baseline: 'alphabetic' });
  }

  const pageFontSize = Math.max(FOOTER_MIN_FONT_SIZE, rightSlot.fontSize);
  pdf.setFontSize(pageFontSize);
  pdf.text(`Page ${pageNumber} of ${totalPages}`, pdfWidthMm - paddingMm, pageNumberBaseline, {
    align: 'right',
    baseline: 'alphabetic'
  });
};

// --- Public: load CDN scripts for jspdf & html2canvas ---
export const loadPdfScripts = async (
  onSuccess: () => void,
  onError: (msg: string) => void
): Promise<void> => {
  const jspdfURL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const html2canvasURL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

  try {
    await Promise.all([loadScript(jspdfURL), loadScript(html2canvasURL)]);
    onSuccess();
  } catch (err) {
    console.error(err);
    onError('Failed to load necessary PDF scripts.');
  }
};

// --- Main exported function to generate PDF from a DOM node ---
export const generatePdf = async (
  previewRef: RefObject<HTMLDivElement>,
  clientName: string,
  dateStr: string,
  logoSrc: string,
  footerText: string,
  onError: (msg: string) => void
): Promise<void> => {
  if (!window.jspdf || !window.html2canvas) {
    onError('PDF libraries are not loaded. Call loadPdfScripts first.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const html2canvas = window.html2canvas as typeof import('html2canvas');

  const root = previewRef?.current;
  if (!root) {
    onError('Preview element not found.');
    return;
  }

  const captureTarget = root.querySelector<HTMLElement>('#invoice-wrapper') ?? root;
  if (!captureTarget) {
    onError('Invoice wrapper not found.');
    return;
  }

  const watermarkPromise = preloadWatermark(logoSrc);

  const toggledHideEls = toggleNoPrintFooters();
  const styleSnapshots = new Map<HTMLElement, StyleSnapshot>();
  prepareWrapperForCapture(captureTarget, styleSnapshots);
  const adjustedFixedEls = adjustFixedElements(captureTarget, styleSnapshots);
  if (adjustedFixedEls.length) {
    console.warn('Temporarily adjusting fixed-position elements for PDF capture.');
  }

  const previousWrapperScrollTop = captureTarget.scrollTop;
  const previousWrapperScrollLeft = captureTarget.scrollLeft;
  const previousWindowScrollX = window.pageXOffset;
  const previousWindowScrollY = window.pageYOffset;
  captureTarget.scrollTop = 0;
  captureTarget.scrollLeft = 0;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

  await waitForLayout();
  await ensureFontsReady();

  let canvas: HTMLCanvasElement | null = null;
  const html2canvasFactory = (html2canvas as any)?.default ?? (html2canvas as any);
  if (typeof html2canvasFactory !== 'function') {
    captureTarget.scrollTop = previousWrapperScrollTop;
    captureTarget.scrollLeft = previousWrapperScrollLeft;
    window.scrollTo({ top: previousWindowScrollY, left: previousWindowScrollX, behavior: 'auto' });
    restoreStyles(Array.from(styleSnapshots.values()));
    toggledHideEls.forEach((el) => el.classList.remove('hide-for-pdf'));
    onError('html2canvas is unavailable.');
    return;
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    captureTarget.scrollTop = previousWrapperScrollTop;
    captureTarget.scrollLeft = previousWrapperScrollLeft;
    window.scrollTo({ top: previousWindowScrollY, left: previousWindowScrollX, behavior: 'auto' });
    restoreStyles(Array.from(styleSnapshots.values()));
    toggledHideEls.forEach((el) => el.classList.remove('hide-for-pdf'));
  };

  const deviceScale = Math.min(2, window.devicePixelRatio || 1) || 1;
  const baseOptions = {
    scale: deviceScale,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    ignoreElements: (node: Element) => node.classList?.contains('hide-for-pdf') ?? false
  };

  try {
    canvas = await html2canvasFactory(captureTarget, baseOptions);
  } catch (firstErr) {
    console.warn('html2canvas first attempt failed, retrying with allowTaint fallback.', firstErr);
    try {
      canvas = await html2canvasFactory(captureTarget, { ...baseOptions, useCORS: false, allowTaint: true });
    } catch (secondErr) {
      console.error('html2canvas failed on second attempt.', secondErr);
      cleanup();
      onError('Failed to capture invoice content for PDF export.');
      return;
    }
  } finally {
    cleanup();
  }

  if (!canvas) {
    onError('Capture failed: html2canvas returned no canvas.');
    return;
  }

  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidthMm = pdf.internal.pageSize.getWidth();
    const pdfHeightMm = pdf.internal.pageSize.getHeight();
    const contentHeightMm = pdfHeightMm - FOOTER_HEIGHT_MM;
    if (contentHeightMm <= 0) {
      onError('Invalid PDF page dimensions.');
      return;
    }

    const pageCanvasPx = computePageCanvasPx(canvas.width, contentHeightMm, pdfWidthMm);
    const totalPages = Math.max(1, Math.ceil(canvas.height / pageCanvasPx));
    const watermark = await watermarkPromise.catch((err) => {
      console.warn('Watermark preload rejected.', err);
      return null;
    });

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const srcY = pageIndex * pageCanvasPx;
      const sliceHeight = Math.min(pageCanvasPx, Math.max(0, canvas.height - srcY));
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = pageCanvasPx;
      const ctx = sliceCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('Unable to acquire 2D context for page slice.');
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      if (sliceHeight > 0) {
        ctx.drawImage(
          canvas,
          0,
          srcY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );
      }

      const primaryDataUrl = sliceCanvas.toDataURL('image/png');

      if (pageIndex > 0) {
        pdf.addPage();
      }

      tryAddImage(
        pdf,
        primaryDataUrl,
        'PNG',
        0,
        0,
        pdfWidthMm,
        contentHeightMm,
        () => {
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = Math.max(1, Math.floor(sliceCanvas.width / 2));
          fallbackCanvas.height = Math.max(1, Math.floor(sliceCanvas.height / 2));
          const fallbackCtx = fallbackCanvas.getContext('2d');
          if (fallbackCtx) {
            fallbackCtx.fillStyle = '#ffffff';
            fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
            fallbackCtx.drawImage(
              sliceCanvas,
              0,
              0,
              sliceCanvas.width,
              sliceCanvas.height,
              0,
              0,
              fallbackCanvas.width,
              fallbackCanvas.height
            );
          }
          return {
            dataUrl: fallbackCanvas.toDataURL('image/jpeg', 0.85),
            type: 'JPEG' as ImageType
          };
        }
      );

      drawWatermark(pdf, watermark, pageIndex + 1, pdfWidthMm, contentHeightMm);
      drawFooter(
        pdf,
        pageIndex + 1,
        totalPages,
        pdfWidthMm,
        pdfHeightMm,
        footerText,
        clientName,
        dateStr
      );
    }

    const filename = sanitizeFilename(clientName, dateStr);
    pdf.save(filename);
  } catch (err) {
    console.error('PDF generation error:', err);
    onError('Could not generate PDF.');
  }
};

export default generatePdf;

// Manual verification checklist:
// 1. Reproduce the overlapping footer case from /mnt/data/e0980d3e-93ee-4c92-8d2a-0c5f5f2699ad.png and confirm slots no longer collide.
// 2. Use a 200-character single-word company name to ensure the left slot wraps to two lines and ends with ellipsis.
// 3. Provide multi-sentence footer text and validate the center slot remains centered across one or two lines.
// 4. Confirm the date and "Page X of Y" remain visible and correctly aligned on every page of a multi-page PDF.
// 5. Verify the watermark appears beneath the footer content while remaining visible behind the invoice content.
// 6. Ensure the downloaded filename stays sanitized via sanitizeFilename and matches previous behavior.
