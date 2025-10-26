import React from 'react';

export const AgreementTemplate = ({ data, total }: { data: any, total: number }) => {
    const subtotal = data.items.reduce((acc: number, item: any) => acc + (item.cost || 0) * (item.quantity || 1), 0);
    const tax = subtotal * 0.18;
    
    return (
     <div className="font-serif text-sm leading-relaxed">
        <header className="flex justify-between items-start pb-1 border-b-4 border-red-400">
            <div className="flex items-start space-x-3 mb-4">
                <img src={data.logoSrc} alt="Company Logo" className="h-16 object-contain" />
                <div>
                    <h1 className="text-[28px] font-bold">{data.companyName}</h1>
                </div>
            </div>
        </header>


        <h2 className="text-center text-xl font-bold mb-6">{data.invoiceTitle}</h2>
        <p className="mb-4">This Agreement is made on <strong>{data.date || 'Date'}</strong> between <strong>{data.companyName}</strong> ("Company") and <strong>{data.clientName || 'Client'}</strong> ("Client").</p>
        <h2 className="font-bold text-lg mt-6 mb-3">1. Scope of Work</h2>
        <p>The Company agrees to perform the following services for the Client related to the project: <strong>{data.projectSubject || 'Project Subject'}</strong>.</p>
        <ul className="list-disc pl-6 my-3 bg-gray-50 p-4 rounded">
            {data.items.map((item: any, i: number) => (
                 <li key={i}><strong>{item.service}:</strong> {item.description}</li>
            ))}
        </ul>
        <h2 className="font-bold text-lg mt-6 mb-3">2. Payment and Costs</h2>
        <div className="bg-gray-50 p-4 rounded-lg mb-3">
            <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Subtotal:</span>
                <span className="font-semibold">₹{subtotal.toLocaleString('en-IN')} INR</span>
            </div>
            <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">GST (18%):</span>
                <span className="font-semibold">₹{tax.toLocaleString('en-IN')} INR</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                <span className="font-bold text-base">Total Cost:</span>
                <span className="font-bold text-base">₹{total.toLocaleString('en-IN')} INR</span>
            </div>
        </div>
        <p>The total cost for the development services outlined in this agreement is <strong>₹{total.toLocaleString('en-IN')} INR</strong> (including 18% GST).</p>
        <h2 className="font-bold text-lg mt-6 mb-3">3. Maintenance and Support</h2>
        <p>{data.notes || 'Terms and conditions for maintenance will be discussed separately.'}</p>
        <div className="mt-16 grid grid-cols-2 gap-16">
            <div>
                <p className="border-t pt-2">{data.companyName} (Company)</p>
                <p className="mt-12">Signature:</p>
            </div>
            <div>
                <p className="border-t pt-2">{data.clientName || 'Client Name'} (Client)</p>
                <p className="mt-12">Signature:</p>
            </div>
        </div>
    </div>
    );
};