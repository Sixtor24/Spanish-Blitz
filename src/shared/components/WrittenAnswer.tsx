import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, PenLine, ArrowRight, CornerDownLeft } from 'lucide-react';

/**
 * Normalize text for flexible Spanish comparison.
 * - Lowercase
 * - Strip accents (á→a, é→e, í→i, ó→o, ú→u, ü→u)
 * - Strip punctuation (¿?¡!.,;:"')
 * - Collapse whitespace
 * - Keep ñ intact
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[¿?¡!.,;:\-"'()]/g, '')
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/\s+/g, ' ');
}

/**
 * Strip optional Spanish articles for more lenient matching.
 * "el gato" → "gato", "la casa" → "casa"
 */
function stripArticles(text: string): string {
  return text.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '').trim();
}

/**
 * Levenshtein distance for typo tolerance.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export type WrittenResult = {
  isCorrect: boolean;
  isAlmostCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
};

/**
 * Compare user input against the correct Spanish answer with flexible matching.
 */
export function evaluateWrittenAnswer(userInput: string, correctAnswer: string): WrittenResult {
  const normUser = normalize(userInput);
  const normCorrect = normalize(correctAnswer);

  // Exact match (after normalization)
  if (normUser === normCorrect) {
    return { isCorrect: true, isAlmostCorrect: false, userAnswer: userInput, correctAnswer };
  }

  // Match ignoring articles
  if (stripArticles(normUser) === stripArticles(normCorrect)) {
    return { isCorrect: true, isAlmostCorrect: false, userAnswer: userInput, correctAnswer };
  }

  // Typo tolerance: allow 1 error for words ≤6 chars, 2 for longer
  const maxDistance = normCorrect.length <= 6 ? 1 : 2;
  const dist = levenshtein(normUser, normCorrect);
  if (dist <= maxDistance) {
    return { isCorrect: true, isAlmostCorrect: true, userAnswer: userInput, correctAnswer };
  }

  // Also check without articles + typo tolerance
  const distNoArticles = levenshtein(stripArticles(normUser), stripArticles(normCorrect));
  if (distNoArticles <= maxDistance) {
    return { isCorrect: true, isAlmostCorrect: true, userAnswer: userInput, correctAnswer };
  }

  return { isCorrect: false, isAlmostCorrect: false, userAnswer: userInput, correctAnswer };
}

interface WrittenAnswerProps {
  correctAnswer: string;
  onResult: (result: WrittenResult) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export default function WrittenAnswer({
  correctAnswer,
  onResult,
  disabled = false,
  autoFocus = true,
}: WrittenAnswerProps) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<WrittenResult | null>(null);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  // Reset state when correctAnswer changes (new question)
  useEffect(() => {
    setInput('');
    setResult(null);
    setShaking(false);
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [correctAnswer]);

  const handleSubmit = useCallback(() => {
    if (disabled || !input.trim() || result) return;

    const evaluation = evaluateWrittenAnswer(input, correctAnswer);
    setResult(evaluation);

    if (!evaluation.isCorrect) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }

    onResult(evaluation);
  }, [input, correctAnswer, disabled, result, onResult]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasResult = result !== null;
  const isCorrect = result?.isCorrect ?? false;
  const isAlmostCorrect = result?.isAlmostCorrect ?? false;

  return (
    <div className="w-full space-y-4">
      {/* Input area */}
      <div
        className={`
          relative rounded-2xl border-2 transition-all duration-300
          ${hasResult && isCorrect
            ? 'border-emerald-400 bg-emerald-50/50'
            : hasResult && !isCorrect
              ? 'border-red-400 bg-red-50/50'
              : 'border-gray-200 bg-white focus-within:border-purple-400 focus-within:shadow-[0_0_0_3px_rgba(147,51,234,0.1)]'
          }
          ${shaking ? 'animate-[shake_0.5s_ease-in-out]' : ''}
        `}
      >
        <div className="flex items-center gap-3 px-4 py-1">
          <PenLine
            size={20}
            className={`flex-shrink-0 transition-colors ${
              hasResult && isCorrect
                ? 'text-emerald-500'
                : hasResult && !isCorrect
                  ? 'text-red-400'
                  : 'text-gray-300'
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || hasResult}
            placeholder="Type in Spanish..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className={`
              flex-1 py-3 text-lg font-medium bg-transparent outline-none placeholder:text-gray-300
              ${hasResult && isCorrect ? 'text-emerald-700' : ''}
              ${hasResult && !isCorrect ? 'text-red-600 line-through decoration-2' : ''}
              ${!hasResult ? 'text-gray-900' : ''}
              disabled:cursor-not-allowed
            `}
          />
          {!hasResult && input.trim() && (
            <button
              onClick={handleSubmit}
              className="flex-shrink-0 bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-4 py-2 font-semibold text-sm transition-all active:scale-95 flex items-center gap-1.5"
            >
              <CornerDownLeft size={14} />
              Check
            </button>
          )}
          {hasResult && isCorrect && (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check size={18} className="text-white" strokeWidth={3} />
            </div>
          )}
          {hasResult && !isCorrect && (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
              <X size={18} className="text-white" strokeWidth={3} />
            </div>
          )}
        </div>
      </div>

      {/* Feedback area */}
      {hasResult && (
        <div
          className={`
            rounded-xl px-5 py-4 transition-all duration-300 animate-in slide-in-from-bottom-2
            ${isCorrect && !isAlmostCorrect
              ? 'bg-emerald-50 border border-emerald-200'
              : isCorrect && isAlmostCorrect
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-red-50 border border-red-200'
            }
          `}
        >
          {isCorrect && !isAlmostCorrect && (
            <div className="flex items-center gap-2">
              <span className="text-lg">🎉</span>
              <p className="font-bold text-emerald-700">Excellent!</p>
            </div>
          )}
          {isCorrect && isAlmostCorrect && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">👍</span>
                <p className="font-bold text-amber-700">Almost correct!</p>
              </div>
              <p className="text-sm text-amber-600">
                Correct spelling: <strong className="text-amber-800">{correctAnswer}</strong>
              </p>
            </div>
          )}
          {!isCorrect && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💡</span>
                <p className="font-bold text-red-700">Not quite</p>
              </div>
              <p className="text-sm text-gray-600">
                Correct answer:
              </p>
              <p className="font-bold text-gray-900 text-lg mt-0.5">{correctAnswer}</p>
            </div>
          )}
        </div>
      )}

      {/* Keyboard hint */}
      {!hasResult && !input.trim() && (
        <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
          <CornerDownLeft size={12} />
          Press Enter to check your answer
        </p>
      )}
    </div>
  );
}
