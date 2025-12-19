import { useState, type FormEvent } from 'react';
import Navigation from '../../../shared/components/Navigation';
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
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white shadow-sm rounded-2xl p-8 border border-slate-100">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Forgot Password</h1>
          <p className="text-sm text-slate-600 mb-6">
            Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="tucorreo@ejemplo.com"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 text-white font-semibold py-2.5 transition hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>

          {message && <p className="mt-4 text-sm text-green-600">{message}</p>}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-6 text-sm text-slate-600">
            <a href="/account/signin" className="text-blue-600 hover:text-blue-700 font-medium">
              Volver a iniciar sesión
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
