import { RefObject } from 'react';

// --- Type declaration for window properties ---
// This tells TypeScript that jspdf and html2canvas will be available on the window
declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

// --- Script Loader ---
export const loadPdfScripts = (onSuccess: () => void, onError: (msg: string) => void) => {
    const jspdfURL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    const html2canvasURL = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";

    const loadScript = (src: string): Promise<void> => new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Script load error for ${src}`));
        document.body.appendChild(script);
    });

    Promise.all([loadScript(jspdfURL), loadScript(html2canvasURL)])
        .then(onSuccess)
        .catch(error => {
            console.error(error);
            onError("Failed to load necessary PDF scripts.");
        });
};

// --- Watermark Function ---
const addWatermark = (pdf: any, logo: string, pageCount: number) => {
    // Set opacity to 10% for watermark effect (semi-transparent)
    pdf.setGState(new pdf.GState({ opacity: 0.1 }));
    
    // Get page dimensions
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Create a temporary image to get original dimensions and maintain aspect ratio
    const img = new Image();
    img.src = logo;
    
    // Fixed watermark width (medium-sized)
    const logoWidth = 80;
    
    // Calculate height to maintain aspect ratio
    // If image dimensions are available, use them; otherwise use a square ratio
    const aspectRatio = img.naturalHeight && img.naturalWidth 
        ? img.naturalHeight / img.naturalWidth 
        : 1; // Default to square if dimensions not available
    const logoHeight = logoWidth * aspectRatio;
    
    // Calculate center position for perfect centering
    const x = (pdfWidth - logoWidth) / 2;
    const y = (pdfHeight - logoHeight) / 2;
    
    // Add the logo as watermark centered on the page
    pdf.addImage(logo, 'PNG', x, y, logoWidth, logoHeight);
    
    // Reset opacity back to normal (1.0)
    pdf.setGState(new pdf.GState({ opacity: 1.0 }));
};

// --- PDF Generation ---
export const generatePdf = async (
    previewRef: RefObject<HTMLDivElement>, 
    clientName: string, 
    date: string,
    logoSrc: string,
    footerText: string,
    onError: (msg: string) => void
) => {
    if (!window.jspdf || !window.html2canvas) {
        onError("PDF libraries are not loaded.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const html2canvas = window.html2canvas;
    const input = previewRef.current;

    if (!input) {
        onError("Preview element not found.");
        return;
    }

    try {
        // Ensure fonts and images are loaded before rendering
        if ((document as any).fonts && (document as any).fonts.ready) {
            await (document as any).fonts.ready;
        }

        // Make sure the element is visible and on-screen for html2canvas
        try { input.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) { /* ignore */ }

        // Temporarily ensure white background for consistent rendering
        const previousBg = (input as HTMLElement).style.backgroundColor;
        if (!previousBg) (input as HTMLElement).style.backgroundColor = '#ffffff';

        // Attempt rendering with useCORS; if it fails due to tainting, retry with allowTaint
        let canvas: HTMLCanvasElement | null = null;
        const attemptRender = async (opts: any) => {
            return await html2canvas(input, opts) as HTMLCanvasElement;
        };

        try {
            canvas = await attemptRender({
                scale: Math.min(2, window.devicePixelRatio || 1) || 1,
                useCORS: true,
                allowTaint: false,
                logging: false,
                ignoreElements: (el: Element) => el.classList.contains('no-print-footer')
            });
        } catch (firstErr) {
            console.warn('html2canvas first attempt failed, retrying with allowTaint. Error:', firstErr);
            // Retry with allowTaint true as a fallback
            canvas = await attemptRender({
                scale: Math.min(2, window.devicePixelRatio || 1) || 1,
                useCORS: false,
                allowTaint: true,
                logging: false,
                ignoreElements: (el: Element) => el.classList.contains('no-print-footer')
            });
        }

        // restore previous background if we changed it
        try { (input as HTMLElement).style.backgroundColor = previousBg || ''; } catch (e) { /* ignore */ }

        if (!canvas) throw new Error('html2canvas returned no canvas');
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        // Calculate image dimensions in PDF units (mm)
        const imgWidth = pdfWidth;
        const imgHeight = (canvasHeight * imgWidth) / canvasWidth;

        let heightLeft = imgHeight;
        let position = 0;

        // Add first page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        try { addWatermark(pdf, logoSrc, 1); } catch (wmErr) { console.warn('Watermark failed', wmErr); }
        heightLeft -= pdfHeight;

        let pageNumber = 2;
        while (heightLeft > 0) {
            position = position - pdfHeight; // negative y to show the next chunk of the same long image
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            try { addWatermark(pdf, logoSrc, pageNumber); } catch (wmErr) { console.warn('Watermark failed', wmErr); }
            heightLeft -= pdfHeight;
            pageNumber++;
        }
        
        // --- START FOOTER LOGIC ---
        const pageCount = pdf.internal.getNumberOfPages();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const pageWidth = pdf.internal.pageSize.getWidth();

        // Add footer to all pages
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            
            // Set text styles
            pdf.setFontSize(9);
            pdf.setTextColor(128, 128, 128); // Set text to gray
            
            // Draw the footer text, centered, 10 units from the bottom
            pdf.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }
        // --- END FOOTER LOGIC ---
        
        pdf.save(`${clientName || 'invoice'}-${date}.pdf`);

    } catch (err) {
        console.error("PDF generation error:", err);
        onError("Could not generate PDF.");
    }
};