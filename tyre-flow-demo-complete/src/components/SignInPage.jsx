import React from "react";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <header className="w-full bg-blue-800 text-white py-6 shadow-md text-center rounded-2xl mb-6">
        <h1 className="text-3xl font-bold">Wellington Tyre Flow System</h1>
        <p className="text-sm mt-1">Secure Sign In Portal</p>
      </header>

      {/* Sign In Form */}
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold text-center">Sign In</h2>

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-300"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-300"
            required
          />
        </div>

        <button className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
          Sign In
        </button>
      </div>
    </div>
  );
}
