import { RefObject } from 'react';

declare global {
  interface Window {
    jspdf?: any;
    html2canvas?: any;
  }
}

const WATERMARK_OPACITY = 0.06;
const WATERMARK_MAX_WIDTH_RATIO = 0.45;
const WATERMARK_MAX_HEIGHT_RATIO = 0.45;
const PAGE_TOP_PADDING_PX = 24;

interface WatermarkData {
  dataUrl: string;
  aspectRatio: number;
  type: 'PNG' | 'JPEG';
}

interface PageGeometry {
  widthMm: number;
  heightMm: number;
  contentHeightMm: number;
  topMarginMm: number;
  bottomMarginMm: number;
}

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

const sanitizeFilename = (clientName: string, dateStr: string): string => {
  const sanitize = (value: string, fallback: string): string => {
    const trimmed = value?.trim() ?? '';
    const source = trimmed || fallback;
    return source
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/[^a-z0-9_\-]+/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 100) || fallback;
  };

  const safeName = sanitize(clientName, 'invoice');
  const safeDate = sanitize(dateStr || new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10));
  return `${safeName}-${safeDate}.pdf`;
};

const getElementOuterHeight = (element: HTMLElement): number => {
  const rect = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);
  const marginTop = Number.parseFloat(styles.marginTop) || 0;
  const marginBottom = Number.parseFloat(styles.marginBottom) || 0;
  return Math.ceil(rect.height + marginTop + marginBottom);
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

const safeSetOpacity = (pdf: any, opacity: number) => {
  try {
    if (typeof pdf.setGState === 'function') {
      pdf.setGState(new (pdf as any).GState({ opacity }));
    }
  } catch (e) {
    // opacity not supported
  }
};

const drawWatermark = (
  pdf: any,
  watermark: WatermarkData | null,
  pageNumber: number,
  geometry: PageGeometry
) => {
  if (!watermark) return;

  const maxWidth = geometry.widthMm * WATERMARK_MAX_WIDTH_RATIO;
  const maxHeight = geometry.contentHeightMm * WATERMARK_MAX_HEIGHT_RATIO;
  let targetWidth = maxWidth;
  let targetHeight = targetWidth * watermark.aspectRatio;

  if (targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = targetHeight / watermark.aspectRatio;
  }

  const x = (geometry.widthMm - targetWidth) / 2;
  const y = geometry.topMarginMm + (geometry.contentHeightMm - targetHeight) / 2;

  pdf.setPage(pageNumber);
  safeSetOpacity(pdf, WATERMARK_OPACITY);
  try {
    pdf.addImage(watermark.dataUrl, watermark.type, x, y, targetWidth, targetHeight, undefined, 'FAST');
  } finally {
    safeSetOpacity(pdf, 1);
  }
};

interface ElementInfo {
  element: HTMLElement;
  height: number;
  isTable: boolean;
  isTableHeader: boolean;
  isTableRow: boolean;
  isTableFooter: boolean;
  isTaxSummary: boolean;
  tableName?: string;
}

const analyzeElement = (element: HTMLElement): ElementInfo => {
  const isTable = element.tagName === 'TABLE';
  const isTableHeader = element.tagName === 'THEAD';
  const isTableRow = element.tagName === 'TR';
  const isTableFooter = element.tagName === 'TFOOT';
  const isTaxSummary = element.classList.contains('tax-summary') ||
                        element.querySelector('.tax-summary') !== null ||
                        (element.textContent?.includes('Tax Summary') &&
                         element.classList.contains('print-avoid-break'));

  let tableName: string | undefined;
  if (isTable || element.closest('table')) {
    const tableEl = isTable ? element : element.closest('table');
    tableName = tableEl?.getAttribute('data-table-name') || 'table';
  }

  return {
    element,
    height: getElementOuterHeight(element),
    isTable,
    isTableHeader,
    isTableRow,
    isTableFooter,
    isTaxSummary,
    tableName,
  };
};

interface PageContainer {
  container: HTMLElement;
  elements: HTMLElement[];
  height: number;
  pageNumber: number;
}

const buildSmartPageContainers = (
  wrapper: HTMLElement,
  pageContentPx: number
): PageContainer[] => {
  if (!Number.isFinite(pageContentPx) || pageContentPx <= 0) {
    throw new Error('Invalid page content height');
  }

  const children = Array.from(wrapper.children).filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && !node.classList.contains('hide-for-pdf')
  );

  if (!children.length) {
    return [];
  }

  const wrapperRect = wrapper.getBoundingClientRect();
  const wrapperWidthPx = Math.ceil(wrapper.scrollWidth || wrapperRect.width);

  const createContainer = (pageNumber: number, isFirstPage: boolean): PageContainer => {
    const clone = wrapper.cloneNode(false) as HTMLElement;
    if (clone.id) clone.removeAttribute('id');
    clone.innerHTML = '';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.boxSizing = 'border-box';
    clone.style.border = 'none';
    clone.style.boxShadow = 'none';
    if (wrapperWidthPx > 0) {
      clone.style.width = `${wrapperWidthPx}px`;
    }
    if (!isFirstPage && PAGE_TOP_PADDING_PX > 0) {
      clone.style.paddingTop = `${PAGE_TOP_PADDING_PX}px`;
    }
    clone.dataset.pdfPageContainer = 'true';

    return {
      container: clone,
      elements: [],
      height: isFirstPage ? 0 : PAGE_TOP_PADDING_PX,
      pageNumber,
    };
  };

  const containers: PageContainer[] = [];
  let currentPage = createContainer(1, true);
  let activeTable: { header: HTMLElement | null; rows: HTMLElement[]; footer: HTMLElement | null; name: string } | null = null;

  const finalizePage = () => {
    if (currentPage.elements.length > 0) {
      currentPage.elements.forEach(el => currentPage.container.appendChild(el));
      containers.push(currentPage);
    }
  };

  const startNewPage = () => {
    finalizePage();
    currentPage = createContainer(containers.length + 1, false);
    currentPage.height = PAGE_TOP_PADDING_PX;
  };

  const canFitOnCurrentPage = (height: number): boolean => {
    return currentPage.height + height <= pageContentPx + 1;
  };

  const addElementToPage = (element: HTMLElement, height: number) => {
    const clone = element.cloneNode(true) as HTMLElement;
    if (clone.id) clone.removeAttribute('id');
    currentPage.elements.push(clone);
    currentPage.height += height;
  };

  const flushTable = () => {
    if (!activeTable) return;

    const tableHeight =
      (activeTable.header ? getElementOuterHeight(activeTable.header) : 0) +
      activeTable.rows.reduce((sum, row) => sum + getElementOuterHeight(row), 0) +
      (activeTable.footer ? getElementOuterHeight(activeTable.footer) : 0);

    if (canFitOnCurrentPage(tableHeight)) {
      if (activeTable.header) addElementToPage(activeTable.header, getElementOuterHeight(activeTable.header));
      activeTable.rows.forEach(row => addElementToPage(row, getElementOuterHeight(row)));
      if (activeTable.footer) addElementToPage(activeTable.footer, getElementOuterHeight(activeTable.footer));
    } else {
      const headerHeight = activeTable.header ? getElementOuterHeight(activeTable.header) : 0;
      const footerHeight = activeTable.footer ? getElementOuterHeight(activeTable.footer) : 0;

      let rowBatch: HTMLElement[] = [];
      let batchHeight = 0;

      const flushBatch = (isLast: boolean) => {
        if (rowBatch.length === 0) return;

        const totalHeight = headerHeight + batchHeight + (isLast ? footerHeight : 0);

        if (!canFitOnCurrentPage(totalHeight)) {
          if (currentPage.elements.length > 0) {
            startNewPage();
          }
        }

        if (activeTable?.header) {
          addElementToPage(activeTable.header, headerHeight);
        }
        rowBatch.forEach(row => addElementToPage(row, getElementOuterHeight(row)));
        if (isLast && activeTable?.footer) {
          addElementToPage(activeTable.footer, footerHeight);
        }

        rowBatch = [];
        batchHeight = 0;

        if (!isLast) {
          startNewPage();
        }
      };

      activeTable.rows.forEach((row, index) => {
        const rowHeight = getElementOuterHeight(row);
        const isLast = index === activeTable.rows.length - 1;
        const nextTotalHeight = headerHeight + batchHeight + rowHeight + (isLast ? footerHeight : 0);

        if (nextTotalHeight > pageContentPx && rowBatch.length > 0) {
          flushBatch(false);
        }

        if (headerHeight + rowHeight + (isLast ? footerHeight : 0) > pageContentPx) {
          throw new Error(`Table row too large to fit on a single page`);
        }

        rowBatch.push(row);
        batchHeight += rowHeight;

        if (isLast) {
          flushBatch(true);
        }
      });
    }

    activeTable = null;
  };

  for (const child of children) {
    const info = analyzeElement(child);

    if (info.isTable) {
      if (activeTable) flushTable();

      const tbody = child.querySelector('tbody');
      const thead = child.querySelector('thead');
      const tfoot = child.querySelector('tfoot');
      const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];

      activeTable = {
        header: thead as HTMLElement | null,
        rows: rows as HTMLElement[],
        footer: tfoot as HTMLElement | null,
        name: info.tableName || 'table',
      };
      continue;
    }

    if (activeTable) flushTable();

    if (info.isTaxSummary) {
      if (!canFitOnCurrentPage(info.height)) {
        startNewPage();
        if (!canFitOnCurrentPage(info.height)) {
          throw new Error('Tax Summary too large to fit on a single page');
        }
      }
      addElementToPage(info.element, info.height);
      continue;
    }

    if (info.height > pageContentPx) {
      throw new Error(`Element too large to fit on a single page: ${info.height}px > ${pageContentPx}px`);
    }

    if (!canFitOnCurrentPage(info.height)) {
      if (currentPage.elements.length > 0) {
        startNewPage();
      } else {
        currentPage.container.style.paddingTop = '0px';
        currentPage.height = 0;
      }
    }

    addElementToPage(info.element, info.height);
  }

  if (activeTable) flushTable();
  finalizePage();

  return containers;
};

const capturePageContainers = async (
  containers: PageContainer[],
  html2canvasFactory: any,
  baseOptions: Record<string, unknown>
): Promise<HTMLCanvasElement[]> => {
  if (!containers.length) return [];

  const stagingRoot = document.createElement('div');
  stagingRoot.style.position = 'fixed';
  stagingRoot.style.left = '-10000px';
  stagingRoot.style.top = '0';
  stagingRoot.style.pointerEvents = 'none';
  stagingRoot.style.opacity = '0';
  stagingRoot.style.zIndex = '-1';
  stagingRoot.style.background = '#ffffff';

  containers.forEach((page, index) => {
    page.container.dataset.pdfPageIndex = String(index);
    page.container.style.boxSizing = 'border-box';
    page.container.style.border = 'none';
    page.container.style.boxShadow = 'none';
    stagingRoot.appendChild(page.container);
  });

  document.body.appendChild(stagingRoot);
  await waitForLayout();

  const canvases: HTMLCanvasElement[] = [];
  try {
    for (const page of containers) {
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvasFactory(page.container, baseOptions);
      } catch (err) {
        console.warn('html2canvas page capture failed; retrying with relaxed CORS.', err);
        canvas = await html2canvasFactory(page.container, {
          ...baseOptions,
          useCORS: false,
          allowTaint: true,
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

const renderElementToCanvas = async (
  element: HTMLElement,
  html2canvasFactory: any,
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
        allowTaint: true,
      });
    } catch (secondErr) {
      console.error('html2canvas failed on second attempt.', secondErr);
      throw secondErr;
    }
  }
};

const detectRowBoundaries = (canvas: HTMLCanvasElement): number[] => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const boundaries: number[] = [];

  let lastWasWhite = true;
  const threshold = 250;

  for (let y = 0; y < canvas.height; y++) {
    let whiteCount = 0;
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (r > threshold && g > threshold && b > threshold) {
        whiteCount++;
      }
    }

    const isWhiteRow = whiteCount > canvas.width * 0.95;

    if (!lastWasWhite && isWhiteRow && y > 50) {
      boundaries.push(y);
    }

    lastWasWhite = isWhiteRow;
  }

  return boundaries;
};

const sliceCanvasIntoPages = (
  canvas: HTMLCanvasElement,
  pageCanvasPx: number
): HTMLCanvasElement[] => {
  const slices: HTMLCanvasElement[] = [];
  if (!canvas || pageCanvasPx <= 0) return slices;

  const rowBoundaries = detectRowBoundaries(canvas);
  const totalPages = Math.max(1, Math.ceil(canvas.height / pageCanvasPx));

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    let srcY = pageIndex * pageCanvasPx;
    let nextSrcY = Math.min((pageIndex + 1) * pageCanvasPx, canvas.height);

    const potentialBoundaries = rowBoundaries.filter(
      boundary => boundary > srcY && boundary < nextSrcY && boundary < canvas.height
    );

    if (potentialBoundaries.length > 0) {
      const closestBoundary = potentialBoundaries.reduce((prev, curr) =>
        Math.abs(curr - nextSrcY) < Math.abs(prev - nextSrcY) ? curr : prev
      );

      if (Math.abs(closestBoundary - nextSrcY) < pageCanvasPx * 0.1) {
        nextSrcY = closestBoundary;
      }
    }

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

const preComposeWatermarkOnCanvas = (
  canvas: HTMLCanvasElement,
  watermarkData: WatermarkData,
  geometry: PageGeometry,
  canvasScale: number
): HTMLCanvasElement => {
  const composedCanvas = document.createElement('canvas');
  composedCanvas.width = canvas.width;
  composedCanvas.height = canvas.height;
  const ctx = composedCanvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);

  const maxWidth = geometry.widthMm * WATERMARK_MAX_WIDTH_RATIO;
  const maxHeight = geometry.contentHeightMm * WATERMARK_MAX_HEIGHT_RATIO;
  let targetWidth = maxWidth;
  let targetHeight = targetWidth * watermarkData.aspectRatio;

  if (targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = targetHeight / watermarkData.aspectRatio;
  }

  const xMm = (geometry.widthMm - targetWidth) / 2;
  const yMm = geometry.topMarginMm + (geometry.contentHeightMm - targetHeight) / 2;
  const xPx = (xMm / geometry.widthMm) * composedCanvas.width;
  const yPx = (yMm / geometry.heightMm) * composedCanvas.height;
  const widthPx = (targetWidth / geometry.widthMm) * composedCanvas.width;
  const heightPx = (targetHeight / geometry.heightMm) * composedCanvas.height;

  const watermarkImg = new Image();
  watermarkImg.src = watermarkData.dataUrl;

  ctx.globalAlpha = WATERMARK_OPACITY;
  ctx.drawImage(watermarkImg, xPx, yPx, widthPx, heightPx);
  ctx.globalAlpha = 1.0;

  ctx.drawImage(canvas, 0, 0);

  return composedCanvas;
};

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

export const generatePdf = async (
  previewRef: RefObject<HTMLDivElement>,
  clientName: string,
  date: string,
  logoSrc: string,
  footerText: string,
  onError: (msg: string) => void
): Promise<void> => {
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

  try {
    await ensureFontsReady();

    const pdf = new jsPDF('p', 'mm', 'a4');
    const geometry: PageGeometry = {
      widthMm: pdf.internal.pageSize.getWidth(),
      heightMm: pdf.internal.pageSize.getHeight(),
      contentHeightMm: pdf.internal.pageSize.getHeight() - 20,
      topMarginMm: 0,
      bottomMarginMm: 20,
    };

    const watermark = await preloadWatermark(logoSrc);

    const tempWrapper = input.cloneNode(true) as HTMLElement;
    tempWrapper.style.border = 'none';
    tempWrapper.style.boxShadow = 'none';
    tempWrapper.style.background = '#ffffff';

    const hideElements = tempWrapper.querySelectorAll('.no-print-footer');
    hideElements.forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });

    const html2canvasOptions = {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
    };

    let pageCanvases: HTMLCanvasElement[] = [];
    let usedFallback = false;

    try {
      const scaleFactor = pdf.internal.scaleFactor || (72 / 25.4);
      const pageContentPx = Math.round((geometry.contentHeightMm * scaleFactor * html2canvasOptions.scale) / (25.4 / 72));

      console.log(`Attempting DOM-based page splitting with page height: ${pageContentPx}px`);

      const pageContainers = buildSmartPageContainers(tempWrapper, pageContentPx);
      console.log(`Successfully split into ${pageContainers.length} pages`);

      pageCanvases = await capturePageContainers(pageContainers, html2canvas, html2canvasOptions);
      console.log('DOM-based approach successful');
    } catch (domError) {
      console.warn('DOM-based splitting failed, falling back to image slicing:', domError);
      usedFallback = true;

      const fullCanvas = await renderElementToCanvas(tempWrapper, html2canvas, html2canvasOptions);
      const pageCanvasPx = computePageCanvasPx(fullCanvas.width, geometry.contentHeightMm, geometry.widthMm);

      console.log(`Slicing full canvas (${fullCanvas.height}px) into pages of ${pageCanvasPx}px`);
      pageCanvases = sliceCanvasIntoPages(fullCanvas, pageCanvasPx);
      console.log(`Image slicing produced ${pageCanvases.length} pages`);
    }

    if (pageCanvases.length === 0) {
      throw new Error('No page canvases generated');
    }

    for (let i = 0; i < pageCanvases.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const canvas = pageCanvases[i];
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = geometry.widthMm;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, geometry.topMarginMm, imgWidth, imgHeight, undefined, 'FAST');

      drawWatermark(pdf, watermark, i + 1, geometry);

      if (footerText) {
        pdf.setPage(i + 1);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(128, 128, 128);
        pdf.text(footerText, geometry.widthMm / 2, geometry.heightMm - 10, { align: 'center' });
      }
    }

    const filename = sanitizeFilename(clientName, date);
    pdf.save(filename);

    console.log(`PDF generated successfully using ${usedFallback ? 'image slicing fallback' : 'DOM splitting'}`);
  } catch (err) {
    console.error('PDF generation error:', err);
    onError('Could not generate PDF. Please try again.');
  }
};

export default generatePdf;
