import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/config/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await api.auth.forgotPassword(email);
      setMessage('Si el correo existe, hemos enviado instrucciones para restablecer tu contraseña.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 text-center">
          Forgot Password
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mb-6 text-center">
          Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white px-4 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-base sm:text-lg outline-none"
                placeholder="tucorreo@ejemplo.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 text-white font-semibold py-3 sm:py-3.5 text-base sm:text-lg transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>

        {message && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3">
            <p className="text-sm text-green-700 text-center">{message}</p>
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-700 text-center">{error}</p>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/account/signin"
            className="text-sm sm:text-base text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
