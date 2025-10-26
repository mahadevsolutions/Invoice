import React, { useState, useEffect, useRef } from 'react';

// Import all your new, separated components and services
import Notification from './components/Notification';
import InvoiceItem from './components/InvoiceItem';
import InvoicePreview from './components/InvoicePreview';
import { loadPdfScripts, generatePdf } from './services/pdfGenerator';

// --- Helper Functions & Constants ---
// We keep constants that App.tsx *needs* here.
// You could also move these to a new 'constants.ts' file.
const getCurrentDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    let mm: string | number = today.getMonth() + 1; // Months start at 0!
    let dd: string | number = today.getDate();
    if (dd < 10) dd = '0' + dd;
    if (mm < 10) mm = '0' + mm;
    return `${yyyy}-${mm}-${dd}`;
};

export const VISUAL_TEMPLATES = {
    DIGITAL_MARKETING: 'Digital Marketing Style',
    AGREEMENT: 'Service Agreement Style',
    MODERN: 'Modern Red Style',
    WEBSITE_DEVELOPMENT: 'Website Development Style',
    FORMAL: 'Formal Classic Style',
};

const defaultLogoUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAABJCAMAAAB8a8NCAAAAmVBMVEVHcEz/gwD/gQD/gwD/gQD/gwD/gQD/gwD/gQD/gwD/gQD/gQD/gwD/gQD/gwD/gQD/gwD/gQD/gQD/gQD/gQD/gwD/gQD/gQD/gQD/gQD/gQD/gwD/gQD/gQD/gQD/gQD/gQD/gQD/gwD/gQD/gQD/gQD/gQD/gwD/gwD/gQD/gwD/gwD/gQD/gwD/gwC12B/lAAAAJnRSTlMAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHx/d32f4AAAApElEQVRYw+3WSQqAMAwEUdJg3B0b3f+sDgjvRzIJDk/i4Q4uW+q5iK+S2Kq1pUUtR9iU4LdFk6F/6S91g1rC1fS8hYq4o00v+R5T9+7w2k9h8H91pBvR1D/f0oI+8tH/iP+8v2C/fK92f+7f3vCjR/9u/vXG/9jP2f94f6C/Xn2C/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c7config+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c7S9+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c7Good9+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c79+ffy2/c7-..";

// --- Content Template Data ---
const APP_DEV_TEMPLATE = {
    name: "Invoices",
    data: {
        companyName: 'MAHADEV SOLUTIONS',
        companyAddress: '',
        companyEmail: 'mahadevsolution7@gmail.com',
        companyPhone: '9030602967',
        clientName: 'Organics (Client)',
        clientCompany: '',
        clientAddress: '',
        projectSubject: 'App Development Agreement',
        invoiceTitle: 'Invoice',
        date: getCurrentDate(),
        quotationNumber: '',
        items: [
            { service: 'UI/UX Design', description: "Mahadev Solutions will design the user interface and user experience according to the Client's specifications.", cost: 0, quantity: 1 },
            { service: 'App Development', description: 'Development of three separate applications: User App, Delivery Partner App, and Admin/Restaurant App.', cost: 0, quantity: 1 },
            { service: 'Backend Development', description: 'An efficient backend system will be developed to facilitate seamless data communication between the apps.', cost: 0, quantity: 1 },
            { service: 'Monthly Maintenance', description: 'Post-project monthly maintenance services to ensure the smooth operation of the apps.', cost: 7000, quantity: 1 },
        ],
        notes: 'If Mahadev Solutions fails to complete the project or discontinues the work, a full refund of the amount paid by the Client will be provided.',
        template: VISUAL_TEMPLATES.AGREEMENT,
        logoSrc: defaultLogoUrl
    }
};




// Only keep a single preset data template. Visual style remains selectable separately.
const PRESET_DATA_TEMPLATES = [APP_DEV_TEMPLATE];

// The main application component
export default function App() {
    interface Item { service: string; description: string; cost: number; quantity: number }
    const initialItem: Item = { service: '', description: '', cost: 0, quantity: 1 };
    
    // --- All State Management ---
    const [companyName, setCompanyName] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [companyEmail, setCompanyEmail] = useState('');
    const [companyPhone, setCompanyPhone] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientCompany, setClientCompany] = useState('');
    const [clientAddress, setClientAddress] = useState('');
    const [projectSubject, setProjectSubject] = useState('');
    const [date, setDate] = useState(getCurrentDate());
    const [quotationNumber, setQuotationNumber] = useState('');
    const [invoiceTitle, setInvoiceTitle] = useState('');
    const [logoSrc, setLogoSrc] = useState(defaultLogoUrl);
    const [items, setItems] = useState<Item[]>([]);
    const [notes, setNotes] = useState('');
    const [template, setTemplate] = useState(VISUAL_TEMPLATES.DIGITAL_MARKETING);
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [isFormPopulated, setIsFormPopulated] = useState(false);

    const previewRef = useRef<HTMLDivElement>(null);

    const showNotification = (message: string, type = 'error') => {
        setNotification({ message, type });
    };

    // --- Effect for loading scripts ---
    useEffect(() => {
        // Load PDF scripts
        loadPdfScripts(
            () => setScriptsLoaded(true),
            (errorMsg) => showNotification(errorMsg, 'error')
        );
        
        // No DB listeners anymore
        return () => {};
    }, []);

    // --- Form Handlers ---
    const addItem = () => setItems([...items, { ...initialItem }]);
    
    const updateItem = (index: number, field: keyof Item, value: any) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };
    
    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

    const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setLogoSrc(reader.result as string);
            reader.readAsDataURL(file);
        }
    };
    
    const resetForm = () => {
        setCompanyName(''); setCompanyAddress(''); setCompanyEmail(''); setCompanyPhone('');
        setClientName(''); setClientCompany(''); setClientAddress('');
        setProjectSubject(''); setDate(getCurrentDate()); setQuotationNumber('');
        setItems([]); setNotes(''); setInvoiceTitle(''); setLogoSrc(defaultLogoUrl);
        setTemplate(Object.values(VISUAL_TEMPLATES)[0]);
        setIsFormPopulated(false);
    };
    
    const loadContentTemplate = (templateData: any) => {
        setCompanyName(templateData.companyName);
        setCompanyAddress(templateData.companyAddress);
        setCompanyEmail(templateData.companyEmail);
        setCompanyPhone(templateData.companyPhone);
        setClientName(templateData.clientName);
        setClientCompany(templateData.clientCompany);
        setClientAddress(templateData.clientAddress);
        setProjectSubject(templateData.projectSubject);
        setDate(templateData.date);
        setQuotationNumber(templateData.quotationNumber);
        setInvoiceTitle(templateData.invoiceTitle);
        setItems(templateData.items.map((item: any) => ({...item}))); // Deep copy
        setNotes(templateData.notes);
        setTemplate(templateData.template);
        setLogoSrc(templateData.logoSrc);
        setIsFormPopulated(true);
        showNotification(`${templateData.name} loaded!`, 'success');
    };

    // Removed loadInvoice - no database
    
    // --- Data for the preview component ---
    const previewData = { companyName, companyAddress, companyEmail, companyPhone, clientName, clientCompany, clientAddress, projectSubject, date, quotationNumber, items, notes, template, invoiceTitle, logoSrc };

    // --- Main Logic Handlers --- (no database writes)
    
    const handleGeneratePdf = async () => {
        setIsGenerating(true);
        
        // Create footer text from state
    const footerLine = `${companyAddress.split('\n')[0]}, AP | ${companyPhone} | ${companyEmail}`;
        
        await generatePdf(previewRef, clientName, date, logoSrc, footerLine, (errorMsg) => showNotification(errorMsg, 'error'));
        setIsGenerating(false);
    };
    
    const isButtonDisabled = isGenerating;

    // --- Main JSX Layout ---
    return (
        <>
            <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: '' })} />
            <div className="bg-gray-100 min-h-screen font-sans">
                <header className="bg-white shadow-md">
                    <div className="container mx-auto px-4 py-4"><h1 className="text-3xl font-bold text-gray-800">Mahadev Solutions</h1><p className="text-gray-500">The Future You Build, The Expertise We Bring...</p></div>
                </header>
                <main className="container mx-auto p-4 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg h-fit">
                        <div className="mb-6 border-b pb-4">
                            <h2 className="text-2xl font-semibold mb-3">Invoice Templates</h2>
                            <div className="flex flex-col sm:flex-row gap-2">
                                {PRESET_DATA_TEMPLATES.map(ct => (
                                    <button key={ct.name} onClick={() => loadContentTemplate(ct.data)} className="flex-1 p-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition text-sm">{ct.name}</button>
                                ))}
                            </div>
                        </div>
                        {isFormPopulated ? (
                            <>
                                <div className="flex justify-between items-center mb-6 border-b pb-3"><h2 className="text-2xl font-semibold">Edit Details</h2><button onClick={resetForm} className="text-sm text-red-600 hover:underline">Clear Form</button></div>
                                
                                <div className="space-y-4 mb-6">
                                    <h3 className="font-semibold text-lg border-b pb-2">Your Company Details</h3>
                                    <div className="flex items-center space-x-4">
                                        <img src={logoSrc} alt="Current Logo" className="h-12 w-12 object-contain border p-1 rounded-md bg-gray-50"/>
                                        <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 text-sm font-semibold py-2 px-3 rounded-lg hover:bg-gray-50">Upload Logo<input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} /></label>
                                    </div>
                                    <input type="text" placeholder="Company Name" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full p-2 border rounded-md" />
                                    <textarea placeholder="Company Address" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} className="w-full p-2 border rounded-md" rows={2}></textarea>
                                    <input type="email" placeholder="Company Email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} className="w-full p-2 border rounded-md" />
                                    <input type="tel" placeholder="Company Phone" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} className="w-full p-2 border rounded-md" />
                                </div>

                                <div className="space-y-4 mb-6">
                                    <h3 className="font-semibold text-lg border-b pb-2">Client Details</h3>
                                    <input type="text" placeholder="Client Name" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full p-2 border rounded-md" />
                                    <input type="text" placeholder="Client Company (Optional)" value={clientCompany} onChange={e => setClientCompany(e.target.value)} className="w-full p-2 border rounded-md" />
                                    <textarea placeholder="Client Address" value={clientAddress} onChange={e => setClientAddress(e.target.value)} className="w-full p-2 border rounded-md" rows={2}></textarea>
                                </div>
                                
                                <div className="space-y-4 mb-6">
                                    <h3 className="font-semibold text-lg border-b pb-2">Document Details</h3>
                                    <input type="text" placeholder="Invoice Title (e.g., Quotation)" value={invoiceTitle} onChange={e => setInvoiceTitle(e.target.value)} className="w-full p-2 border rounded-md" />
                                    <input type="text" placeholder="Project Subject" value={projectSubject} onChange={e => setProjectSubject(e.target.value)} className="w-full p-2 border rounded-md" />
                                    <div className="flex space-x-2">
                                       <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-1/2 p-2 border rounded-md" />
                                       <input type="text" placeholder="Quote #" value={quotationNumber} onChange={e => setQuotationNumber(e.target.value)} className="w-1/2 p-2 border rounded-md" />
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <h3 className="font-semibold mb-2">Services / Items</h3>
                                    {items.map((item, index) => (
                                        <InvoiceItem 
                                            key={index} 
                                            item={item} 
                                            index={index} 
                                            updateItem={updateItem} 
                                            removeItem={removeItem} 
                                        />
                                    ))}
                                    <button onClick={addItem} className="w-full mt-2 p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition">+ Add Item</button>
                                </div>
                                
                                <div className="space-y-4 mb-6">
                                    <textarea placeholder="Notes / Terms & Conditions" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 border rounded-md" rows={3}></textarea>
                                    <label className="block text-sm font-medium text-gray-700">Visual Style</label>
                                    <select value={template} onChange={e => setTemplate(e.target.value)} className="w-full p-3 border rounded-md bg-white">
                                        {Object.values(VISUAL_TEMPLATES).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <button onClick={handleGeneratePdf} disabled={isButtonDisabled || !scriptsLoaded} className="w-full p-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">
                                        {isGenerating ? 'Generating...' : !scriptsLoaded ? 'Loading Libs...' : 'Generate PDF'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-16 text-gray-500"><p className="font-semibold text-lg">Please select a template above to begin.</p></div>
                        )}
                    </div>
                    <div className="lg:col-span-2 space-y-8">
                         <div>
                            <h2 className="text-2xl font-semibold mb-4">Live Preview</h2>
                            <div className="overflow-x-auto">
                                <div style={{width: '210mm'}}>
                                   {isFormPopulated ? <InvoicePreview ref={previewRef} data={previewData} /> : <div className="bg-white p-8 shadow-lg rounded-xl h-96 flex items-center justify-center text-gray-400">Preview will appear here...</div>}
                                </div>
                            </div>
                        </div>
                        {/* Saved Invoices section removed (no database) */}
                    </div>
                </main>
            </div>
        </>
    );
}