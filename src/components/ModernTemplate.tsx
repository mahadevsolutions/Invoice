import React from 'react';

export const ModernTemplate = ({ data, total }: { data: any, total: number }) => {
    const subtotal = data.items.reduce((acc: number, item: any) => acc + (item.cost || 0) * (item.quantity || 1), 0);
    const tax = subtotal * 0.18;
    
    return (
    <div className="font-sans text-gray-800">
        <header className="flex justify-between items-start pb-6 border-b-4 border-red-500">
            <div>
                 <div className="flex items-center space-x-3">
                    <img src={data.logoSrc} alt="Company Logo" className="h-16 object-contain" />
                    <div>
                        <h1 className="text-2xl font-bold text-red-600">{data.companyName || 'YOUR COMPANY'}</h1>
                        <p className="text-gray-500">YOUR VISION, OUR INNOVATION</p>
                    </div>
                 </div>
            </div>
            <div className="text-right">
                <p className="text-lg"><strong>To:</strong> {data.clientName || 'Client Name'}</p>
                <p><strong>Date:</strong> {data.date || 'YYYY-MM-DD'}</p>
                <p><strong>Quote #:</strong> {data.quotationNumber || '001'}</p>
            </div>
        </header>

        <main className="mt-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Subject: {data.projectSubject || 'Project Subject'}</h2>
            <div className="bg-red-50 p-6 rounded-lg">
                {data.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-red-200 last:border-b-0">
                        <span className="font-semibold text-lg">&#8226; {item.service}</span>
                        <span className="font-bold text-lg">₹{((item.cost || 0) * (item.quantity || 1)).toLocaleString('en-IN')}</span>
                    </div>
                ))}
            </div>
            <div className="flex justify-end mt-8">
                <div className="w-1/3 text-right space-y-3">
                    <div className="flex justify-between items-center text-gray-700">
                        <span className="font-semibold text-lg">Subtotal:</span>
                        <span className="font-bold text-lg">₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-700">
                        <span className="font-semibold text-lg">GST (18%):</span>
                        <span className="font-bold text-lg">₹{tax.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="bg-red-600 text-white p-6 rounded-lg text-center">
                        <p className="text-xl font-light mb-1">Total Cost</p>
                        <p className="text-4xl font-bold">₹{total.toLocaleString('en-IN')}</p>
                    </div>
                </div>
            </div>
        </main>
        <footer className="mt-12 text-center text-sm text-gray-500 border-t pt-4 no-print-footer">
            <p>{data.companyAddress.split('\n')[0]}, AP | {data.companyPhone} | {data.companyEmail}</p>
        </footer>
    </div>
    );
};