// Shared quiz utilities for Solo and Blitz Challenge
// Centralizes question types, card normalization, option building, and helpers.

export const QUESTION_TYPES = {
  SPANISH_TEXT_TO_ENGLISH_TEXT: "spanish_text_to_english_text",
  SPANISH_AUDIO_TO_ENGLISH_TEXT: "spanish_audio_to_english_text",
  ENGLISH_TEXT_TO_SPANISH_TEXT: "english_text_to_spanish_text",
  ENGLISH_TEXT_TO_SPANISH_SPEECH: "english_text_to_spanish_speech",
} as const;

export const QUESTION_TYPE_LIST = Object.values(QUESTION_TYPES);

export type QuestionType = (typeof QUESTION_TYPE_LIST)[number];

export type Card = {
  id: string | number;
  question?: string;
  answer?: string;
  prompt_es?: string;
  answer_es?: string;
  translation_en?: string;
  position?: number;
  [key: string]: any;
};

const safeTrim = (val: any) => (typeof val === "string" ? val.trim() : "");

export const getSpanishPrompt = (card: Card) => safeTrim(card?.prompt_es || card?.question || "");
export const getSpanishAnswer = (card: Card) =>
  safeTrim(card?.answer_es || card?.prompt_es || card?.question || card?.answer || "");
export const getEnglishAnswer = (card: Card) => safeTrim(card?.translation_en || card?.answer || "");

export function normalizeSpanish(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\wñ\s]/g, "")
    .trim();
}

export function deriveQuestionTypeByPosition(card: Card | null | undefined): QuestionType | null {
  if (!card) return null;
  const idx = (card.position ?? 0) % QUESTION_TYPE_LIST.length;
  return QUESTION_TYPE_LIST[idx];
}

export type BuildOptionsParams = {
  question: Card;
  questions: Card[];
  questionType: QuestionType | null;
};

export function buildOptions({ question, questions, questionType }: BuildOptionsParams) {
  if (!question || !questionType) return [] as string[];

  let correctAnswer: string | undefined;
  let distractorType: "english" | "spanish" | undefined;

  switch (questionType) {
    case QUESTION_TYPES.SPANISH_TEXT_TO_ENGLISH_TEXT:
    case QUESTION_TYPES.SPANISH_AUDIO_TO_ENGLISH_TEXT:
      {
        const spanishSide = normalizeSpanish(getSpanishAnswer(question));
        const englishCandidates = [question.translation_en, question.answer, question.question]
          .map((v) => (v ?? "").toString().trim())
          .filter(Boolean)
          .filter((v) => normalizeSpanish(v) !== spanishSide);

        correctAnswer = englishCandidates[0] || getEnglishAnswer(question);
      }
      distractorType = "english";
      break;
    case QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_TEXT:
    case QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_SPEECH:
      correctAnswer = getSpanishAnswer(question);
      distractorType = "spanish";
      break;
    default:
      return [];
  }

  // Fallback to opposite side if empty
  if (!correctAnswer) {
    correctAnswer = distractorType === "english" ? getSpanishAnswer(question) : getEnglishAnswer(question);
  }

  const spanishSideCurrent = normalizeSpanish(getSpanishAnswer(question));

  const otherCards = (questions || []).filter((c) => c.id !== question.id);

  // Primary pool: same language as question type
  const primaryPool = otherCards
    .map((c) => (distractorType === "english" ? getEnglishAnswer(c) : getSpanishAnswer(c)))
    .filter(Boolean)
    .filter((v) => (distractorType === "english" ? normalizeSpanish(v) !== spanishSideCurrent : true));

  // Secondary pool: opposite side, useful when the main side is sparse
  const secondaryPool = otherCards
    .map((c) => (distractorType === "english" ? getSpanishAnswer(c) : getEnglishAnswer(c)))
    .filter(Boolean)
    .filter((v) => (distractorType === "english" ? normalizeSpanish(v) !== spanishSideCurrent : true));

  // Build a unique pool of wrong answers (exclude the correct answer always)
  const uniquePool = Array.from(new Set([...primaryPool, ...secondaryPool])).filter(
    (val) => val && val !== correctAnswer,
  );

  const shuffled = uniquePool.sort(() => Math.random() - 0.5);
  let distractors = shuffled.slice(0, 3);

  // If we still have fewer than 3, duplicate existing WRONG distractors (never the correct one)
  let j = 0;
  while (distractors.length < 3 && distractors.length > 0) {
    distractors.push(distractors[j % distractors.length]);
    j += 1;
  }

  // Absolute fallback: if there were zero wrong options at all, synthesize placeholders that are not equal to the correct answer
  if (distractors.length === 0) {
    const fillers = ["Option A", "Option B", "Option C"].filter((f) => f !== correctAnswer);
    distractors = fillers.slice(0, 3);
  }

  const options = [correctAnswer, ...distractors].slice(0, 4);
  return options.sort(() => Math.random() - 0.5);
}

export function getQuestionPrompt(question: Card, questionType: QuestionType | null) {
  switch (questionType) {
    case QUESTION_TYPES.SPANISH_TEXT_TO_ENGLISH_TEXT:
      return getSpanishPrompt(question);
    case QUESTION_TYPES.SPANISH_AUDIO_TO_ENGLISH_TEXT:
      return ""; // audio prompt handled via TTS
    case QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_TEXT:
      return getEnglishAnswer(question) || getSpanishPrompt(question);
    case QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_SPEECH:
      return getEnglishAnswer(question) || getSpanishPrompt(question) || "Translate to Spanish";
    default:
      return "";
  }
}

export function getQuestionTypeLabel(questionType: QuestionType | null) {
  switch (questionType) {
    case QUESTION_TYPES.SPANISH_TEXT_TO_ENGLISH_TEXT:
      return "Spanish → English (Text)";
    case QUESTION_TYPES.SPANISH_AUDIO_TO_ENGLISH_TEXT:
      return "Spanish → English (Audio)";
    case QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_TEXT:
      return "English → Spanish (Text)";
    case QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_SPEECH:
      return "English → Spanish (Speak)";
    default:
      return "";
  }
}

export const isSpeechQuestion = (qt: QuestionType | null) => qt === QUESTION_TYPES.ENGLISH_TEXT_TO_SPANISH_SPEECH;
export const isAudioQuestion = (qt: QuestionType | null) => qt === QUESTION_TYPES.SPANISH_AUDIO_TO_ENGLISH_TEXT;
