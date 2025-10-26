import React from 'react';

export const WebsiteTemplate = ({ data, subtotal, tax, total }: { data: any, subtotal: number, tax: number, total: number }) => {
	return (
		<div className="font-sans text-sm text-gray-800">
			<div className="text-center p-2 bg-blue-100 border-b">
				<p>{data.companyPhone} | {data.companyEmail}</p>
			</div>

			{/* 2. PDF-Friendly Title Section (Use Grid) */}
			<div className="grid grid-cols-2 items-center my-8 mt-6 px-8">
				<div>
					{/* <img src={data.logoSrc} alt="Logo" className="h-16 mb-2" /> */}
					<h1 className="text-3xl font-bold text-blue-700 mt-4 p-2">{data.companyName}</h1>
					<p className="text-gray-500">YOUR VISION, OUR INNOVATION</p>
				</div>
				<div className="text-right">
					<h2 className="text-4xl font-bold text-right">PRICE QUOTATION</h2>
					<p className="mt-2"><strong>Subject:</strong> {data.projectSubject}</p>
					<p><strong>Date:</strong> {data.date}</p>
					<p><strong>Quote #:</strong> {data.quotationNumber || '-'}</p>
				</div>
			</div>

			{/* 3. Client Section */}
			<div className="px-8 mb-6">
				<h3 className="text-lg font-semibold text-gray-600">To:</h3>
				<p className="text-xl font-bold">{data.clientName}</p>
			</div>

			{/* 4. Items Table (Crucial for Customization & PDF) */}
			<div className="px-8">
				<table className="w-full border-collapse">
					<thead>
						<tr className="bg-red-100 border-b">
							<th className="text-left p-3 font-bold uppercase">Service</th>
							<th className="text-right p-3 font-bold uppercase">Cost</th>
						</tr>
					</thead>
					<tbody>
						{/* THIS IS THE CUSTOMIZABLE PART */}
						{data.items.map((item: any, i: number) => (
							<tr key={i} className="border-b">
								<td className="p-3 align-top">
									<p className="font-semibold text-base">{item.service}</p>
									<p className="text-xs text-gray-600 whitespace-pre-line">{item.description}</p>
								</td>
								<td className="p-3 text-right align-top font-semibold text-base">
									₹{(item.cost || 0).toLocaleString('en-IN')}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* 5. Totals Table (Separate from Items) */}
			<div className="flex justify-end px-8 mt-6">
				<div className="w-1/2">
					<table className="w-full">
						<tbody>
							<tr>
								<td className="p-2">Subtotal</td>
								<td className="text-right p-2">₹{subtotal.toLocaleString('en-IN')}</td>
							</tr>
							<tr>
								<td className="p-2">GST (18%)</td>
								<td className="text-right p-2">₹{tax.toLocaleString('en-IN')}</td>
							</tr>
							<tr className="font-bold text-lg bg-blue-100">
								<td className="p-2">Total</td>
								<td className="text-right p-2">₹{total.toLocaleString('en-IN')}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			{/* 6. Terms Section */}
			<div className="px-10 mt-8">
				<h3 className="font-bold text-sm mb-2 border-b pb-1">Terms & Conditions</h3>
				<p className="text-sm text-gray-700 whitespace-pre-line">
					{data.notes}
				</p>
			</div>

			{/* 7. Footer (with 'no-print-footer' class for PDF layout fix) */}
			<footer className="mt-12 text-center text-xs text-gray-900 border-t pt-4 no-print-footer">
				<p className="font-bold">{data.companyName} | {data.companyAddress}</p>
				<p>{data.companyPhone} | {data.companyEmail}</p>
			</footer>
		</div>
	);
};
