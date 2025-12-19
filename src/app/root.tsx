import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from 'react-router';
import { Toaster } from 'sonner';
import './global.css';
import { AuthProvider } from '@/lib/auth-context';
import type { ReactNode } from 'react';

export const links = () => [];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Toaster position="bottom-right" />
        {children}
        <ScrollRestoration />
        <Scripts />
        <script src="https://kit.fontawesome.com/2c15cc0cc7.js" crossOrigin="anonymous" async />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Oops! Something went wrong</h1>
            <p className="text-gray-700 mb-4">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
            <a
              href="/"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Go Home
            </a>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
