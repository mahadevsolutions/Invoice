import { RefObject } from 'react';

declare global {
  interface Window {
    jspdf?: any;
    html2canvas?: any;
  }
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

interface ContentBlock {
  element: HTMLElement;
  y: number;
  height: number;
  isBreakable: boolean;
  type: 'header' | 'table' | 'tax-summary' | 'text' | 'other';
}

const analyzeContent = (wrapper: HTMLElement): ContentBlock[] => {
  const blocks: ContentBlock[] = [];
  const children = Array.from(wrapper.children) as HTMLElement[];

  children.forEach((child) => {
    if (child.classList.contains('no-print-footer') || child.classList.contains('hide-for-pdf')) {
      return;
    }

    const rect = child.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    let type: ContentBlock['type'] = 'other';
    let isBreakable = true;

    if (child.tagName === 'HEADER' || child.querySelector('header')) {
      type = 'header';
      isBreakable = false;
    } else if (child.tagName === 'TABLE' || child.querySelector('table')) {
      type = 'table';
      isBreakable = false;
    } else if (
      child.classList.contains('tax-summary') ||
      child.textContent?.includes('TAX SUMMARY') ||
      child.textContent?.includes('Tax Summary') ||
      child.querySelector('.tax-summary')
    ) {
      type = 'tax-summary';
      isBreakable = false;
    } else if (
      child.textContent?.includes('Amount Chargeable') ||
      child.textContent?.includes('AUTHORIZED SIGNATORY') ||
      child.classList.contains('print-avoid-break')
    ) {
      isBreakable = false;
    }

    blocks.push({
      element: child,
      y: rect.top - wrapperRect.top,
      height: rect.height,
      isBreakable,
      type
    });
  });

  return blocks;
};

const calculatePageBreaks = (
  blocks: ContentBlock[],
  firstPageHeight: number,
  subsequentPageHeight: number
): number[] => {
  const breakPoints: number[] = [];
  let currentPageHeight = firstPageHeight;
  let currentY = 0;
  let isFirstPage = true;

  blocks.forEach((block, index) => {
    const blockEnd = block.y + block.height;
    const remainingSpace = currentPageHeight - (block.y - currentY);

    if (remainingSpace < block.height && !isFirstPage) {
      breakPoints.push(currentY + currentPageHeight);
      currentY += currentPageHeight;
      currentPageHeight = subsequentPageHeight;
      isFirstPage = false;
    } else if (remainingSpace < block.height && isFirstPage) {
      breakPoints.push(currentY + currentPageHeight);
      currentY += currentPageHeight;
      currentPageHeight = subsequentPageHeight;
      isFirstPage = false;
    }

    if (blockEnd > currentY + currentPageHeight) {
      if (!block.isBreakable) {
        breakPoints.push(block.y);
        currentY = block.y;
      }
    }
  });

  return breakPoints.filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
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
    if ((document as any).fonts && (document as any).fonts.ready) {
      await (document as any).fonts.ready;
    }

<<<<<<< HEAD
    // Row-aware pagination math
    const inputWidthPx = input.offsetWidth;
    const pxPerMm = inputWidthPx / 210; // A4 width

    const PAGE_HEIGHT_MM = 297;
    const MARGIN_TOP_MM = 20;
    const MARGIN_BOTTOM_MM = 20;

    const PAGE_1_CUT = (PAGE_HEIGHT_MM - MARGIN_BOTTOM_MM) * pxPerMm;
    const SUBSEQUENT_PAGE_HEIGHT_PX = (PAGE_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) * pxPerMm;

    // Reset previous adjustments
    const elements = Array.from(input.querySelectorAll('.avoid-break')) as HTMLElement[];
    elements.forEach((el) => {
      // reset any marginTop/paddingTop we may have set earlier
      (el as HTMLElement).style.marginTop = '';
      if (el.tagName === 'TR') {
        const cells = Array.from(el.children) as HTMLElement[];
        cells.forEach((td) => (td.style.paddingTop = ''));
      }
    });

    // --- SMART BREAK LOOP (Row-aware) ---
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const containerRect = input.getBoundingClientRect();
      const relativeTop = rect.top - containerRect.top;
      const height = el.offsetHeight;
      const relativeBottom = relativeTop + height;

      // Start with page 1 cut
      let cutLine = PAGE_1_CUT;
      while (cutLine < relativeTop) {
        cutLine += SUBSEQUENT_PAGE_HEIGHT_PX;
      }

      // If element crosses the cut line, push it down
      if (relativeTop < cutLine && relativeBottom > cutLine) {
        const pushAmount = Math.ceil(cutLine - relativeTop) + 20; // buffer
        console.debug(`Pushing ${el.tagName} down by ${pushAmount}px`);

        if (el.tagName === 'TR') {
          const cells = Array.from(el.children) as HTMLElement[];
          cells.forEach((td) => {
            const currentPadding = parseInt(window.getComputedStyle(td).paddingTop) || 0;
            td.style.paddingTop = `${currentPadding + pushAmount}px`;
          });
        } else {
          (el as HTMLElement).style.marginTop = `${pushAmount}px`;
        }
      }
    });

    // Wait a moment for reflow
    await new Promise((resolve) => setTimeout(resolve, 300));

    // --- 3. CAPTURE DOCUMENT ---
=======
    await new Promise(resolve => setTimeout(resolve, 300));

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const topMarginPage1 = 0;
    const topMarginOtherPages = 20;
    const bottomMargin = 20;

    const firstPageContentHeight = pdfHeight - topMarginPage1 - bottomMargin;
    const otherPageContentHeight = pdfHeight - topMarginOtherPages - bottomMargin;

    input.style.transform = 'scale(1)';
    input.style.transformOrigin = 'top left';

>>>>>>> dd4be0113b894ebf589fa4e426e57208b30c9214
    const canvas = await html2canvas(input, {
      scale: 2,
      useCORS: true,
      logging: false,
<<<<<<< HEAD
      height: input.scrollHeight,
      windowHeight: input.scrollHeight,
      ignoreElements: (el: Element) => el.classList.contains('no-print-footer')
    });

    // --- Slicing & PDF Creation (unchanged) ---
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const MARGIN_TOP = 20;
    const MARGIN_BOTTOM = 20;

    const CONTENT_HEIGHT_PAGE1 = pdfHeight - MARGIN_BOTTOM;
    const CONTENT_HEIGHT_OTHERS = pdfHeight - MARGIN_TOP - MARGIN_BOTTOM;

=======
      backgroundColor: '#ffffff',
      windowWidth: input.scrollWidth,
      windowHeight: input.scrollHeight,
    });

>>>>>>> dd4be0113b894ebf589fa4e426e57208b30c9214
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    const pxPerMm = canvas.height / imgHeight;
    const firstPageContentPx = firstPageContentHeight * pxPerMm;
    const otherPageContentPx = otherPageContentHeight * pxPerMm;

<<<<<<< HEAD
    const watermark = await preloadWatermark(logoSrc);

    const addFooterAndMasks = (pageNum: number, isFirstPage: boolean) => {
      pdf.setFillColor(255, 255, 255);
      if (!isFirstPage) pdf.rect(0, 0, pdfWidth, MARGIN_TOP, 'F');
      pdf.rect(0, pdfHeight - MARGIN_BOTTOM, pdfWidth, MARGIN_BOTTOM, 'F');
      pdf.setFontSize(9);
      pdf.setTextColor(128, 128, 128);
      pdf.text(footerText, pdfWidth / 2, pdfHeight - 10, { align: 'center' });
      try { drawWatermark(pdf, watermark, pageNum, pdfWidth, isFirstPage ? CONTENT_HEIGHT_PAGE1 : CONTENT_HEIGHT_OTHERS); } catch (e) {}
    };

    // Page 1
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    addFooterAndMasks(pageNumber, true);

    heightLeft -= CONTENT_HEIGHT_PAGE1;
    position -= CONTENT_HEIGHT_PAGE1;
    pageNumber++;

    while (heightLeft > 0) {
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position + MARGIN_TOP, imgWidth, imgHeight);
      addFooterAndMasks(pageNumber, false);
      heightLeft -= CONTENT_HEIGHT_OTHERS;
      position -= CONTENT_HEIGHT_OTHERS;
      pageNumber++;
    }

    pdf.save(sanitizeFilename(clientName || 'invoice', date));
=======
    const blocks = analyzeContent(input);
    console.log('Content blocks analyzed:', blocks.length);

    const pages: Array<{ startY: number; endY: number; pageNum: number }> = [];
    let currentY = 0;
    let pageNum = 1;

    while (currentY < canvas.height) {
      const isFirstPage = pageNum === 1;
      const pageContentPx = isFirstPage ? firstPageContentPx : otherPageContentPx;
      let pageEndY = currentY + pageContentPx;

      const blocksInRange = blocks.filter(
        block => {
          const blockStartPx = block.y * pxPerMm;
          const blockEndPx = (block.y + block.height) * pxPerMm;
          return blockStartPx < pageEndY && blockEndPx > currentY;
        }
      );

      const breakingBlocks = blocksInRange.filter(
        block => {
          const blockStartPx = block.y * pxPerMm;
          const blockEndPx = (block.y + block.height) * pxPerMm;
          return !block.isBreakable && blockStartPx < pageEndY && blockEndPx > pageEndY;
        }
      );

      if (breakingBlocks.length > 0 && pageNum > 1) {
        const earliestBreak = Math.min(...breakingBlocks.map(b => b.y * pxPerMm));
        if (earliestBreak > currentY + (pageContentPx * 0.3)) {
          pageEndY = earliestBreak;
        }
      }

      pageEndY = Math.min(pageEndY, canvas.height);

      pages.push({
        startY: currentY,
        endY: pageEndY,
        pageNum
      });

      currentY = pageEndY;
      pageNum++;

      if (currentY >= canvas.height) break;
      if (pageNum > 50) {
        console.warn('Safety break: too many pages');
        break;
      }
    }

    console.log(`Generated ${pages.length} pages`);

    pages.forEach((page, index) => {
      if (index > 0) {
        pdf.addPage();
      }

      const isFirstPage = page.pageNum === 1;
      const topMargin = isFirstPage ? topMarginPage1 : topMarginOtherPages;
      const contentHeight = isFirstPage ? firstPageContentHeight : otherPageContentHeight;

      const sliceHeight = page.endY - page.startY;
      const sliceHeightMm = sliceHeight / pxPerMm;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        ctx.drawImage(
          canvas,
          0,
          page.startY,
          canvas.width,
          sliceHeight,
          0,
          0,
          pageCanvas.width,
          sliceHeight
        );

        const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
        pdf.addImage(pageImgData, 'PNG', 0, topMargin, imgWidth, sliceHeightMm, undefined, 'FAST');
      }

      if (footerText && footerText.trim()) {
        pdf.setFontSize(9);
        pdf.setTextColor(128, 128, 128);
        pdf.text(footerText, pdfWidth / 2, pdfHeight - 10, { align: 'center' });
      }
    });

    const filename = sanitizeFilename(clientName, date);
    pdf.save(filename);

    console.log(`PDF generated successfully with ${pages.length} page(s)`);
>>>>>>> dd4be0113b894ebf589fa4e426e57208b30c9214
  } catch (err) {
    console.error('PDF generation error:', err);
    onError('Could not generate PDF. Please try again.');
  }
};

export default generatePdf;
