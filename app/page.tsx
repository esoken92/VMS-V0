import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-5xl font-bold mb-4 text-gray-900">VMS Inventory Management</h1>
        <p className="text-xl mb-8 text-gray-700">
          Heavy-Duty Truck Parts Warehouse Inventory Management System
        </p>

        <div className="mb-8">
          <Link
            href="/auth/signup"
            className="inline-flex items-center px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
          >
            Get Started
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/dashboard"
            className="p-6 border-2 border-blue-200 rounded-lg bg-white hover:shadow-xl hover:border-blue-400 transition-all cursor-pointer group"
          >
            <h2 className="text-2xl font-semibold mb-2 text-gray-900 group-hover:text-blue-600">Dashboard</h2>
            <p className="text-gray-600">View inventory analytics and reports</p>
          </Link>
          <Link
            href="/scan"
            className="p-6 border-2 border-blue-200 rounded-lg bg-white hover:shadow-xl hover:border-blue-400 transition-all cursor-pointer group"
          >
            <h2 className="text-2xl font-semibold mb-2 text-gray-900 group-hover:text-blue-600">Scan</h2>
            <p className="text-gray-600">Barcode and QR code scanning</p>
          </Link>
          <Link
            href="/dashboard/stock-takes"
            className="p-6 border-2 border-blue-200 rounded-lg bg-white hover:shadow-xl hover:border-blue-400 transition-all cursor-pointer group"
          >
            <h2 className="text-2xl font-semibold mb-2 text-gray-900 group-hover:text-blue-600">Stock Take</h2>
            <p className="text-gray-600">Perform blind stock audits</p>
          </Link>
        </div>

        <div className="mt-12 text-center text-gray-600">
          <p className="text-sm">Need help? Contact your administrator for access credentials.</p>
        </div>
      </div>
    </main>
  )
}
