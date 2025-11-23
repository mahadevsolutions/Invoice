import { RefObject } from 'react';

// --- Window augmentation to avoid TS errors when using global libs ---
declare global {
  interface Window {
    jspdf?: any;
    html2canvas?: any;
  }
}

const FOOTER_HEIGHT_MM = 18;
const FOOTER_INITIAL_FONT_SIZE = 9;
const FOOTER_MIN_FONT_SIZE = 7;
const FOOTER_FONT_STEP = 0.5;
const FOOTER_MAX_LINES = 2;
const FOOTER_PADDING_MM = 10;
const WATERMARK_MAX_WIDTH_RATIO = 0.45;
const WATERMARK_MAX_HEIGHT_RATIO = 0.45;
const SIGNATURE_FOOTER_TEXT =
  'This is an electronically generated document, no signature is required.';
const PAGE_TOP_PADDING_PX = 24;

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

type Html2CanvasInstance = (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;

interface CapturePageOptions {
  html2canvasFactory: Html2CanvasInstance;
  baseOptions: Record<string, unknown>;
}

const DOM_SPLIT_ERROR_CODE = 'ELEMENT_TOO_BIG_FOR_PAGE';

const describeElementForLogs = (element: HTMLElement): string => {
  const id = element.id ? `#${element.id}` : '';
  const className = (element.className || '').toString().trim().replace(/\s+/g, '.');
  const classes = className ? `.${className}` : '';
  return `${element.tagName.toLowerCase()}${id}${classes}`;
};

const getElementOuterHeight = (element: HTMLElement): number => {
  const rect = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);
  const marginTop = Number.parseFloat(styles.marginTop) || 0;
  const marginBottom = Number.parseFloat(styles.marginBottom) || 0;
  return Math.ceil(rect.height + marginTop + marginBottom);
};

const isElementTooBigForPage = (el: HTMLElement, pageContentPx: number): boolean => {
  if (!Number.isFinite(pageContentPx) || pageContentPx <= 0) {
    return false;
  }
  return getElementOuterHeight(el) > pageContentPx + 1;
};

const buildPageContainers = (wrapper: HTMLElement, pageContentPx: number): HTMLElement[] => {
  if (!Number.isFinite(pageContentPx) || pageContentPx <= 0) {
    return [];
  }

  const children = Array.from(wrapper.children).filter((node): node is HTMLElement =>
    node instanceof HTMLElement && !node.classList.contains('hide-for-pdf')
  );

  const wrapperRect = wrapper.getBoundingClientRect();
  const wrapperWidthPx = Math.ceil(
    wrapper.scrollWidth || wrapperRect.width || wrapper.clientWidth || wrapper.offsetWidth || 0
  );

  if (!children.length) {
    const singleContainer = wrapper.cloneNode(true) as HTMLElement;
    if (singleContainer.id) {
      singleContainer.removeAttribute('id');
    }
    singleContainer.style.height = 'auto';
    singleContainer.style.maxHeight = 'none';
    singleContainer.style.overflow = 'visible';
    singleContainer.style.boxSizing = 'border-box';
    singleContainer.dataset.pdfPageContainer = 'true';
    if (PAGE_TOP_PADDING_PX > 0) {
      singleContainer.style.paddingTop = '0px';
    }
    return [singleContainer];
  }

  const createPageContainer = (isFirst: boolean) => {
    const clone = wrapper.cloneNode(false) as HTMLElement;
    if (clone.id) {
      clone.removeAttribute('id');
    }
    clone.innerHTML = '';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.boxSizing = 'border-box';
    if (wrapperWidthPx > 0) {
      clone.style.width = `${wrapperWidthPx}px`;
    }
    if (!isFirst && PAGE_TOP_PADDING_PX > 0) {
      clone.style.paddingTop = `${PAGE_TOP_PADDING_PX}px`;
    }
    clone.dataset.pdfPageContainer = 'true';
    return clone;
  };

  const containers: HTMLElement[] = [];
  let currentContainer = createPageContainer(true);
  let usedHeight = 0;

  const finalizeCurrentContainer = () => {
    if (currentContainer.childNodes.length) {
      containers.push(currentContainer);
    }
  };

  const ensureFitsOnCurrentPage = (blockHeight: number): boolean => {
    if (usedHeight + blockHeight <= pageContentPx + 1) {
      return true;
    }

    const isFirstElementOnPage = currentContainer.childNodes.length === 0;
    if (isFirstElementOnPage && usedHeight > 0) {
      currentContainer.style.paddingTop = '0px';
      usedHeight = 0;
      return usedHeight + blockHeight <= pageContentPx + 1;
    }

    return false;
  };

  children.forEach((child, index) => {
    const blockHeight = getElementOuterHeight(child);
    if (isElementTooBigForPage(child, pageContentPx)) {
      console.warn(
        `DOM page-splitting fallback: ${describeElementForLogs(child)} height ${blockHeight}px exceeds page capacity ${pageContentPx}px.`
      );
      const err = new Error(DOM_SPLIT_ERROR_CODE);
      err.name = DOM_SPLIT_ERROR_CODE;
      throw err;
    }

    if (!ensureFitsOnCurrentPage(blockHeight) && currentContainer.childNodes.length) {
      finalizeCurrentContainer();
      currentContainer = createPageContainer(false);
      usedHeight = PAGE_TOP_PADDING_PX;
    }

    if (!ensureFitsOnCurrentPage(blockHeight)) {
      console.warn(
        `DOM page-splitting fallback: unable to fit ${describeElementForLogs(child)} within single page height (${blockHeight}px > ${pageContentPx}px).`
      );
      const err = new Error(DOM_SPLIT_ERROR_CODE);
      err.name = DOM_SPLIT_ERROR_CODE;
      throw err;
    }

    const clone = child.cloneNode(true) as HTMLElement;
    if (clone.id) {
      clone.removeAttribute('id');
    }
    currentContainer.appendChild(clone);
    usedHeight += blockHeight;

    const isLastChild = index === children.length - 1;
    if (isLastChild) {
      finalizeCurrentContainer();
    }
  });

  return containers;
};

const capturePageContainers = async (
  containers: HTMLElement[],
  options: CapturePageOptions
): Promise<HTMLCanvasElement[]> => {
  if (!containers.length) {
    return [];
  }

  const stagingRoot = document.createElement('div');
  stagingRoot.style.position = 'fixed';
  stagingRoot.style.left = '-10000px';
  stagingRoot.style.top = '0';
  stagingRoot.style.pointerEvents = 'none';
  stagingRoot.style.opacity = '0';
  stagingRoot.style.zIndex = '-1';
  stagingRoot.style.background = '#ffffff';

  containers.forEach((container, index) => {
    container.dataset.pdfPageIndex = String(index);
    container.style.boxSizing = 'border-box';
    stagingRoot.appendChild(container);
  });

  document.body.appendChild(stagingRoot);
  await waitForLayout();

  const canvases: HTMLCanvasElement[] = [];
  try {
    for (const container of containers) {
      let canvas: HTMLCanvasElement;
      try {
        canvas = await options.html2canvasFactory(container, options.baseOptions);
      } catch (err) {
        console.warn('html2canvas page capture failed; retrying with relaxed CORS.', err);
        canvas = await options.html2canvasFactory(container, {
          ...options.baseOptions,
          useCORS: false,
          allowTaint: true
        });
      }
      canvases.push(canvas);
    }
  } finally {
    stagingRoot.remove();
  }

  return canvases;
};

const computePageCanvasPx = (
  canvasWidthPx: number,
  contentHeightMm: number,
  pdfWidthMm: number
): number => Math.max(1, Math.round((contentHeightMm * canvasWidthPx) / pdfWidthMm));

// FALLBACK: capture the entire wrapper when DOM-based splitting is not possible.
const renderElementToCanvas = async (
  element: HTMLElement,
  html2canvasFactory: Html2CanvasInstance,
  baseOptions: Record<string, unknown>
): Promise<HTMLCanvasElement> => {
  try {
    return await html2canvasFactory(element, baseOptions);
  } catch (firstErr) {
    console.warn('html2canvas first attempt failed, retrying with allowTaint fallback.', firstErr);
    try {
      return await html2canvasFactory(element, {
        ...baseOptions,
        useCORS: false,
        allowTaint: true
      });
    } catch (secondErr) {
      console.error('html2canvas failed on second attempt.', secondErr);
      throw secondErr;
    }
  }
};

// FALLBACK: slices a full-page canvas into per-page canvases.
const sliceCanvasIntoPages = (
  canvas: HTMLCanvasElement,
  pageCanvasPx: number
): HTMLCanvasElement[] => {
  const slices: HTMLCanvasElement[] = [];
  if (!canvas || pageCanvasPx <= 0) {
    return slices;
  }
  const totalPages = Math.max(1, Math.ceil(canvas.height / pageCanvasPx));

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
    slices.push(sliceCanvas);
  }

  return slices;
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

interface FooterLayoutInfo {
  hasCenterLines: boolean;
  centerLineHeight: number;
  mainBaseline: number;
  pageNumberBaseline: number;
}

const fitTextWithinSlot = (
  pdf: any,
  rawText: string,
  maxWidth: number,
  maxLines: number
): FooterSlotResult => {
  const normalizedText = (rawText ?? '').toString().replace(/\r\n/g, '\n');
  const manualSegments = normalizedText.split('\n');
  const hasContent = manualSegments.some((segment) => segment.trim().length > 0);

  if (!hasContent || maxWidth <= 0 || maxLines <= 0) {
    return { lines: [], fontSize: FOOTER_INITIAL_FONT_SIZE, truncated: false };
  }

  const initialFontSize = pdf.getFontSize();
  let fontSize = FOOTER_INITIAL_FONT_SIZE;
  let lines: string[] = [];
  let truncated = false;

  const applySplit = (size: number) => {
    pdf.setFontSize(size);
    const lines: string[] = [];
    manualSegments.forEach((segment, index) => {
      const trimmed = segment.trim();
      if (trimmed.length > 0) {
        const splitLines = pdf.splitTextToSize(trimmed, maxWidth) as string[];
        lines.push(...splitLines);
      } else if (index !== manualSegments.length - 1) {
        lines.push('');
      }
    });
    while (lines.length && lines[lines.length - 1].trim().length === 0) {
      lines.pop();
    }
    return lines.length ? lines : [''];
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

/**
 * Draws a three-slot footer and the signature sentence on the given page.
 * Left: client/company (left-aligned)
 * Center: footerText (centered)
 * Right: date (top-right) + page number (bottom-right)
 *
 * This function draws the signature sentence AFTER watermark so it is always top-most.
 */
// --- replace existing addFooter with this implementation ---
const addFooter = (
  pdf: any,
  pageNumber: number,
  totalPages: number,
  pdfWidthMm: number,
  pdfHeightMm: number,
  footerText: string,
  clientName: string,
  dateStr: string
): FooterLayoutInfo => {
  pdf.setPage(pageNumber);
  pdf.setFont('helvetica', 'normal');

  // Layout / sizing
  const paddingMm = FOOTER_PADDING_MM || 10;
  const leftSlotRatio = 0.45;
  const centerSlotRatio = 0.35;
  const rightSlotRatio = 1 - leftSlotRatio - centerSlotRatio;
  const leftWidth = Math.max(0, pdfWidthMm * leftSlotRatio - paddingMm * 2);
  const centerWidth = Math.max(0, pdfWidthMm * centerSlotRatio - paddingMm * 2);
  const rightWidth = Math.max(0, pdfWidthMm * rightSlotRatio - paddingMm * 2);

  // Baselines (mm)
  const mainBaseline = pdfHeightMm - 8; // main footer baseline
  const signatureBaseline = pdfHeightMm - 12; // signature apron (still not used here)
  const pageNumberBaseline = pdfHeightMm - 3; // page number bottom baseline

  // Fit text for slots using fitTextWithinSlot helper
  const leftResult = clientName
    ? fitTextWithinSlot(pdf, clientName, leftWidth, FOOTER_MAX_LINES)
    : { lines: [], fontSize: FOOTER_INITIAL_FONT_SIZE, truncated: false };

  const centerResult = footerText
    ? fitTextWithinSlot(pdf, footerText, centerWidth, FOOTER_MAX_LINES)
    : { lines: [], fontSize: FOOTER_INITIAL_FONT_SIZE, truncated: false };

  const dateResult = dateStr
    ? fitTextWithinSlot(pdf, dateStr, rightWidth, 1)
    : { lines: [], fontSize: FOOTER_INITIAL_FONT_SIZE, truncated: false };

  // Draw left slot
  if (leftResult.lines.length) {
    pdf.setFontSize(leftResult.fontSize);
    pdf.setTextColor(80, 80, 80);
    // pdf.text accepts array for multiline
    pdf.text(leftResult.lines, paddingMm, mainBaseline, { align: 'left' });
  }

  // Draw center slot (centered)
  if (centerResult.lines.length) {
    pdf.setFontSize(centerResult.fontSize);
    pdf.setTextColor(80, 80, 80);
    pdf.text(centerResult.lines, pdfWidthMm / 2, mainBaseline, { align: 'center' });
  }

  // Draw date (right-top)
  if (dateResult.lines.length) {
    pdf.setFontSize(dateResult.fontSize);
    pdf.setTextColor(80, 80, 80);
    pdf.text(dateResult.lines[0] ?? '', pdfWidthMm - paddingMm, mainBaseline, { align: 'right' });
  }

  // Draw page number last so it appears top-most
  pdf.setFontSize(FOOTER_INITIAL_FONT_SIZE);
  pdf.setTextColor(80, 80, 80);
  pdf.text(`Page ${pageNumber} of ${totalPages}`, pdfWidthMm - paddingMm, pageNumberBaseline, {
    align: 'right'
  });

  // Compute center line height for layout decisions
  const centerLineCount = centerResult.lines.length || 0;
  const centerLineHeight =
    centerLineCount > 0 ? computeLineHeightMm(pdf, centerResult.fontSize) * centerLineCount : 0;

  const layout: FooterLayoutInfo = {
    hasCenterLines: centerLineCount > 0,
    centerLineHeight,
    mainBaseline,
    pageNumberBaseline
  };

  return layout;
};

// --- replace existing drawFooterAndSignatureLine with this implementation ---
const drawFooterAndSignatureLine = (
  pdf: any,
  pageNumber: number,
  totalPages: number,
  pdfWidthMm: number,
  pdfHeightMm: number,
  footerText: string,
  clientName: string,
  dateStr: string,
  signatureFooterText: string
) => {
  // Draw main footer and retrieve layout info
  const layout = addFooter(
    pdf,
    pageNumber,
    totalPages,
    pdfWidthMm,
    pdfHeightMm,
    footerText,
    clientName,
    dateStr
  );

  if (!signatureFooterText) {
    return;
  }

  const previousFontSize = pdf.getFontSize();
  pdf.setPage(pageNumber);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(120, 120, 120);
  const signatureFontSize = 8;
  pdf.setFontSize(signatureFontSize);
  const signatureLineHeight = computeLineHeightMm(pdf, signatureFontSize);

  // Fit signature text to available width (full page width minus padding)
  const signatureMaxWidth = Math.max(0, pdfWidthMm - (FOOTER_PADDING_MM || 10) * 2);
  const signatureLines = (pdf.splitTextToSize(signatureFooterText, signatureMaxWidth) as string[])
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (signatureLines.length) {
    const minStartY = pdfHeightMm - FOOTER_HEIGHT_MM + 1.5;
    const maxStartY = layout.pageNumberBaseline - 1 - signatureLineHeight * (signatureLines.length - 1);

    // If there's center footer content, attempt to place signature just below it, otherwise
    // use the minimum start Y inside the reserved footer area.
    const centerBaseline = layout.hasCenterLines ? layout.mainBaseline : minStartY;
    const preferredGap = layout.hasCenterLines
      ? Math.max(1.2, layout.centerLineHeight * 0.75)
      : Math.max(1.2, signatureLineHeight * 0.75);

    let startY = centerBaseline + preferredGap;

    if (maxStartY < minStartY) {
      startY = maxStartY;
    } else {
      startY = Math.min(Math.max(startY, minStartY), maxStartY);
    }

    pdf.text(signatureLines, pdfWidthMm / 2, startY, { align: 'center', baseline: 'alphabetic' });
  }

  pdf.setFontSize(previousFontSize);
  pdf.setTextColor(80, 80, 80);
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

  await waitForLayout();
  await ensureFontsReady();

  const html2canvasFactory = (html2canvas as any)?.default ?? (html2canvas as any);
  if (typeof html2canvasFactory !== 'function') {
    cleanup();
    onError('html2canvas is unavailable.');
    return;
  }

  const html2canvasInstance = html2canvasFactory as Html2CanvasInstance;

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
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidthMm = pdf.internal.pageSize.getWidth();
    const pdfHeightMm = pdf.internal.pageSize.getHeight();
    const contentHeightMm = pdfHeightMm - FOOTER_HEIGHT_MM;
    if (!Number.isFinite(contentHeightMm) || contentHeightMm <= 0) {
      throw new Error('Invalid PDF page dimensions.');
    }

    const wrapperRect = captureTarget.getBoundingClientRect();
    const wrapperWidthPx =
      captureTarget.scrollWidth ||
      wrapperRect.width ||
      captureTarget.clientWidth ||
      captureTarget.offsetWidth ||
      0;
    const pxPerMmFallback = (window.devicePixelRatio || 1) * (96 / 25.4);
    let pxPerMm = wrapperWidthPx > 0 ? wrapperWidthPx / pdfWidthMm : pxPerMmFallback;
    if (!Number.isFinite(pxPerMm) || pxPerMm <= 0) {
      pxPerMm = pxPerMmFallback;
    }
    let pageContentPx = Math.floor(contentHeightMm * pxPerMm);
    if (!Number.isFinite(pageContentPx) || pageContentPx <= 0) {
      pageContentPx = Math.floor(contentHeightMm * pxPerMmFallback);
    }
    pageContentPx = Math.max(pageContentPx, 1);

    let pageCanvases: HTMLCanvasElement[] = [];

    try {
      const containers = buildPageContainers(captureTarget, pageContentPx);
      if (containers.length) {
        const domPageCanvases = await capturePageContainers(containers, {
          html2canvasFactory: html2canvasInstance,
          baseOptions
        });
        if (domPageCanvases.length) {
          pageCanvases = domPageCanvases;
          console.info(
            `PDF generation: using DOM page-splitting strategy (${pageCanvases.length} pages).`
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === DOM_SPLIT_ERROR_CODE || (err as Error)?.name === DOM_SPLIT_ERROR_CODE) {
        console.warn('DOM page-splitting aborted due to oversized element; falling back to canvas slicing.');
      } else {
        console.warn('DOM page-splitting failed; falling back to canvas slicing.', err);
      }
      pageCanvases = [];
    }

    if (!pageCanvases.length) {
      // FALLBACK: the DOM-based strategy failed; capture full canvas and slice.
      const fullCanvas = await renderElementToCanvas(captureTarget, html2canvasInstance, baseOptions);
      const pageCanvasPx = computePageCanvasPx(fullCanvas.width, contentHeightMm, pdfWidthMm);
      pageCanvases = sliceCanvasIntoPages(fullCanvas, pageCanvasPx);
      console.warn(
        `PDF generation: using canvas-slice fallback (${Math.max(pageCanvases.length, 1)} pages).`
      );
    }

    if (!pageCanvases.length) {
      throw new Error('No pages were captured for PDF export.');
    }

    const watermark = await watermarkPromise.catch((err) => {
      console.warn('Watermark preload rejected.', err);
      return null;
    });

    const totalPages = pageCanvases.length;

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const pageCanvas = pageCanvases[pageIndex];
      const primaryDataUrl = pageCanvas.toDataURL('image/png');

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
          fallbackCanvas.width = Math.max(1, Math.floor(pageCanvas.width / 2));
          fallbackCanvas.height = Math.max(1, Math.floor(pageCanvas.height / 2));
          const fallbackCtx = fallbackCanvas.getContext('2d');
          if (fallbackCtx) {
            fallbackCtx.fillStyle = '#ffffff';
            fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
            fallbackCtx.drawImage(
              pageCanvas,
              0,
              0,
              pageCanvas.width,
              pageCanvas.height,
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
      drawFooterAndSignatureLine(
        pdf,
        pageIndex + 1,
        totalPages,
        pdfWidthMm,
        pdfHeightMm,
        footerText,
        clientName,
        dateStr,
        SIGNATURE_FOOTER_TEXT
      );
    }

    const filename = sanitizeFilename(clientName, dateStr);
    pdf.save(filename);
  } catch (err) {
    console.error('PDF generation error:', err);
    onError('Could not generate PDF.');
  } finally {
    cleanup();
  }
};

export default generatePdf;

// Manual verification checklist:
// 1. Generate the provided sample PDF and confirm the electronic-signature footer appears verbatim on every page.
// 2. Confirm long company/address lines stay clear of the page number in the footer.
// 3. Verify table rows do not split across pages when exporting multi-page invoices.
// 4. Check that signature and stamp blocks render wholly on a single page.
// 5. Trigger a scenario with an oversized single element and confirm the console warns about the canvas-slice fallback.
// 6. Confirm the watermark remains visible beneath content while the footer elements stay on top.
// 7. Edit footer details in the UI and confirm both the live preview and generated PDF reflect the change.
