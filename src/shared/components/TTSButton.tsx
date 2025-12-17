import { useState } from 'react';
import { Volume2 } from 'lucide-react';

type TTSButtonProps = {
  text: string;
  locale?: string;
  slow?: boolean;
  size?: 'medium' | 'large';
  className?: string;
};

export default function TTSButton({
  text,
  locale = 'es-ES',
  slow = false,
  size = 'medium',
  className = '',
}: TTSButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  const speak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.rate = slow ? 0.7 : 1.0;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const sizeClasses: Record<NonNullable<TTSButtonProps['size']>, string> = {
    medium: 'px-4 py-2',
    large: 'px-6 py-4 text-lg',
  };

  return (
    <button
      onClick={speak}
      disabled={speaking}
      className={`inline-flex items-center gap-2 ${sizeClasses[size]} bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      type="button"
    >
      <Volume2 size={size === 'large' ? 24 : 20} />
      {slow ? 'Hear it (slow)' : '🔊 Hear it'}
    </button>
  );
}
