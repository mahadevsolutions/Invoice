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

    await new Promise(resolve => setTimeout(resolve, 300));

    input.style.transform = 'scale(1)';
    input.style.transformOrigin = 'top left';

    const canvas = await html2canvas(input, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: input.scrollWidth,
      windowHeight: input.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    const topMargin = 0;
    const bottomMargin = 20;
    const availableHeight = pdfHeight - topMargin - bottomMargin;

    let yPosition = topMargin;
    let remainingHeight = imgHeight;
    let sourceY = 0;
    let pageCount = 0;

    while (remainingHeight > 0) {
      if (pageCount > 0) {
        pdf.addPage();
      }

      const heightToCopy = Math.min(remainingHeight, availableHeight);
      const sourceHeight = (heightToCopy / imgWidth) * canvas.width;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      const ctx = pageCanvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        ctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sourceHeight,
          0,
          0,
          pageCanvas.width,
          sourceHeight
        );

        const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
        pdf.addImage(pageImgData, 'PNG', 0, yPosition, imgWidth, heightToCopy, undefined, 'FAST');
      }

      if (footerText && footerText.trim()) {
        pdf.setFontSize(9);
        pdf.setTextColor(128, 128, 128);
        pdf.text(footerText, pdfWidth / 2, pdfHeight - 10, { align: 'center' });
      }

      sourceY += sourceHeight;
      remainingHeight -= heightToCopy;
      pageCount++;
    }

    const filename = sanitizeFilename(clientName, date);
    pdf.save(filename);

    console.log(`PDF generated successfully with ${pageCount} page(s)`);
  } catch (err) {
    console.error('PDF generation error:', err);
    onError('Could not generate PDF. Please try again.');
  }
};

export default generatePdf;
