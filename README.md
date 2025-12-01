# Invoice Generator - Professional PDF System

A complete invoice, purchase order, and quotation generator with intelligent PDF generation and GST compliance.

## Key Features

### ✅ Intelligent Page Breaking
- **20mm top margin on pages 2+** (no margin on page 1)
- **Tax Summary never breaks** - moves entirely to next page
- **Tables stay intact** - no mid-table page breaks
- **Smart content analysis** - detects headers, tables, tax summaries
- **Automatic adjustment** - finds optimal break points

### ✅ Professional Templates
1. **Tax Invoice** - Full GST compliance with e-Invoice support
2. **Purchase Order** - Complete vendor/supplier management
3. **Professional Quotation** - Clean, branded proposals

### ✅ Complete Features
- Logo and signature uploads
- GST calculations (CGST/SGST & IGST)
- HSN/SAC summary tables
- Item-level tax rates
- Bank details section
- Consignee (ship-to) details
- Declaration and round-off
- Live preview with updates
- Template field customization

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## How It Works

### PDF Generation Process

1. **Content Analysis**
   - Scans invoice DOM structure
   - Identifies unbreakable blocks (tables, tax summary, headers)
   - Calculates element positions and heights

2. **Smart Page Calculation**
   - Page 1: Full height (0mm top margin, 20mm bottom)
   - Page 2+: Reduced height (20mm top margin, 20mm bottom)
   - Finds optimal break points avoiding content splits

3. **Canvas Slicing**
   - Captures invoice as high-quality canvas
   - Slices at calculated break points
   - Applies proper margins per page
   - Adds footer to each page

4. **PDF Assembly**
   - Combines all pages
   - Maintains consistent formatting
   - Saves with sanitized filename

### Content Block Types

- **Header** - Company name, logo, invoice title
- **Table** - Items table, HSN summary
- **Tax Summary** - Totals section (never breaks)
- **Text Blocks** - Amounts in words, declarations
- **Signature** - Authorized signatory section

## Usage

### 1. Select Template
Click one of the preset templates:
- Invoice
- Purchase Order
- Quotation

### 2. Edit Details
Update in the left panel:
- Company information
- Client/buyer details
- Items and quantities
- Tax settings
- Notes and terms

### 3. Generate PDF
Click "Generate PDF" button. The system:
- Analyzes content blocks
- Calculates intelligent page breaks
- Ensures Tax Summary integrity
- Applies proper margins
- Downloads PDF automatically

## Technical Details

### Page Margins
```typescript
Page 1:
  Top: 0mm
  Bottom: 20mm
  Content Area: 277mm

Page 2+:
  Top: 20mm
  Bottom: 20mm
  Content Area: 257mm
```

### Unbreakable Elements
- Headers
- Tables (entire table)
- Tax Summary section
- "Amount Chargeable in words"
- Authorized signature block
- Any element with `.print-avoid-break` class

### Smart Break Logic
```typescript
// Detects if Tax Summary would be cut
if (taxSummaryStartsBeforePageEnd && taxSummaryEndsAfterPageEnd) {
  // Move entire Tax Summary to next page
  pageBreak = taxSummaryStart
}
```

### Content Detection
- Searches for `.tax-summary` class
- Checks text content for "TAX SUMMARY"
- Identifies tables by tag and structure
- Respects `.print-avoid-break` markers

## File Structure

```
src/
├── App.tsx                           # Main application
├── services/
│   └── pdfGenerator.ts              # Intelligent PDF generation
├── components/
│   ├── InvoicePreview.tsx           # Template router
│   ├── TaxInvoiceTemplate.tsx       # Tax invoice template
│   ├── ProfessionalQuotationTemplate.tsx
│   ├── PurchaseOrderTemplate.tsx
│   ├── InvoiceItem.tsx              # Item row editor
│   ├── Notification.tsx             # Toast messages
│   ├── AuthorizedBy.tsx             # Signature component
│   └── template-editor/             # Field customization
└── utils/
    └── templateConfigStorage.ts      # localStorage helpers
```

## Key Algorithms

### Block Analysis
```typescript
interface ContentBlock {
  element: HTMLElement;
  y: number;              // Position from top
  height: number;         // Block height
  isBreakable: boolean;   // Can split across pages?
  type: 'header' | 'table' | 'tax-summary' | 'text' | 'other';
}
```

### Page Break Calculation
1. Start with page 1 full height
2. For each content block:
   - Check if fits on current page
   - If not and is unbreakable, start new page
   - If would break unbreakable content, adjust break point
3. Apply margins per page (0mm or 20mm top)
4. Generate page list with start/end positions

### Canvas Slicing
1. Capture full invoice as 2x scale canvas
2. For each page:
   - Create page-sized canvas
   - Copy relevant section from full canvas
   - Apply white background
   - Convert to image
   - Add to PDF with proper margin
   - Add footer text

## Browser Support

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

## Performance

- **First Load**: 2-3 seconds (loading libraries)
- **PDF Generation**: 1-3 seconds
- **Preview Updates**: Instant
- **File Size**: ~200-500KB per page

## Known Limitations

- No database (by design - all in-memory)
- Single currency (₹)
- No email sending
- Logo/signature per session only

## Troubleshooting

**Q: Tax Summary still breaking?**
A: Ensure the section has `.tax-summary` class or "TAX SUMMARY" text.

**Q: No top margin on page 2?**
A: Check console logs. Should show "Content blocks analyzed: X" and proper page calculations.

**Q: Page breaks in wrong places?**
A: Add `.print-avoid-break` class to elements that shouldn't break.

**Q: PDF not generating?**
A: Check browser console for errors. Ensure html2canvas and jsPDF loaded.

## Advanced Customization

### Add Custom Unbreakable Blocks
```tsx
<div className="print-avoid-break">
  This content will never break across pages
</div>
```

### Mark Tax Summary Sections
```tsx
<section className="tax-summary">
  {/* Tax totals that must stay together */}
</section>
```

### Adjust Page Margins
Edit `pdfGenerator.ts`:
```typescript
const topMarginPage1 = 0;        // Page 1 top margin
const topMarginOtherPages = 20;  // Pages 2+ top margin
const bottomMargin = 20;         // All pages bottom margin
```

## Credits

Built with:
- **React** + TypeScript
- **Tailwind CSS**
- **html2canvas** by Niklas von Hertzen
- **jsPDF** by MrRio

## License

MIT License - Free to use and modify

---

## Summary

This invoice generator provides:
- ✅ Perfect page breaks with 20mm top margin on pages 2+
- ✅ Tax Summary never breaks across pages
- ✅ Smart content-aware slicing
- ✅ Professional PDF output
- ✅ GST compliance features
- ✅ Easy to use interface

Ready for production use!
