import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import useUser from '@/shared/hooks/useUser';
import heroImg from '@/assets/hero-image.png';
import step1Img from '@/assets/step1.png';
import step2Img from '@/assets/step2.png';
import step3Img from '@/assets/step3.png';
import logoSvg from '@/assets/logo.svg';


interface BenefitItem {
  emoji: string;
  title: string;
  desc: string;
}

function BenefitList({ items, titleColor }: { items: BenefitItem[]; titleColor: string }) {
  return (
    <ul className="space-y-5">
      {items.map((item) => (
        <li key={item.title} className="flex items-start gap-4">
          <span className="text-2xl leading-tight mt-0.5">{item.emoji}</span>
          <div>
            <p className="font-bold text-lg" style={{ color: titleColor }}>{item.title}</p>
            <p className="text-gray-500 mt-0.5">{item.desc}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FadeIn({
  children, delay = 0, direction = 'up', className = '',
}: {
  children: ReactNode; delay?: number; direction?: 'up' | 'left' | 'right'; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const translate = direction === 'left' ? 'translateX(-32px)' : direction === 'right' ? 'translateX(32px)' : 'translateY(28px)';
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : translate,
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function HomePage() {
  const { data: user, loading } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const DARK_BLUE = '#084178';
  const LIGHT_BLUE = '#10A5C3';
  const DARK_BLUE_HOVER = '#063260';

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Quicksand', sans-serif" }}>

      {/* ── NAVIGATION ── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/" className="flex-shrink-0">
            <img src={logoSvg} alt="The Spanish Blitz" className="h-12 w-auto" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#students" className="text-sm font-bold tracking-widest uppercase transition-colors" style={{ color: DARK_BLUE }} onMouseEnter={e => (e.currentTarget.style.color = LIGHT_BLUE)} onMouseLeave={e => (e.currentTarget.style.color = DARK_BLUE)}>For Students</a>
            <a href="#teachers" className="text-sm font-bold tracking-widest uppercase transition-colors" style={{ color: DARK_BLUE }} onMouseEnter={e => (e.currentTarget.style.color = LIGHT_BLUE)} onMouseLeave={e => (e.currentTarget.style.color = DARK_BLUE)}>For Teachers</a>
            {!loading && user && (
              <Link to="/dashboard" className="text-sm font-bold tracking-widest uppercase transition-colors" style={{ color: LIGHT_BLUE }}>Dashboard</Link>
            )}
          </div>

          {/* Hamburger (mobile only) */}
          <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu">
            {isMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: DARK_BLUE }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: DARK_BLUE }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile dropdown */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-5">
            <a href="#students" className="text-sm font-bold tracking-widest uppercase" style={{ color: DARK_BLUE }} onClick={() => setIsMenuOpen(false)}>For Students</a>
            <a href="#teachers" className="text-sm font-bold tracking-widest uppercase" style={{ color: DARK_BLUE }} onClick={() => setIsMenuOpen(false)}>For Teachers</a>
            {!loading && user && (
              <Link to="/dashboard" className="text-sm font-bold tracking-widest uppercase" style={{ color: LIGHT_BLUE }} onClick={() => setIsMenuOpen(false)}>Dashboard</Link>
            )}
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center gap-6 md:gap-12 md:min-h-[calc(100vh-64px)]">
          {/* Image — order-1 on mobile (top), order-1 on desktop (left) */}
          <div className="flex-1 flex items-center justify-center pt-8 pb-4 md:py-8 order-1">
            <img
              src={heroImg}
              alt="Learn Spanish with The Spanish Blitz"
              className="w-full object-contain"
              style={{ maxHeight: '55vh' }}
            />
          </div>

          {/* Text + CTAs — order-2 on mobile (bottom), order-2 on desktop (right) */}
          <div className="flex-1 flex flex-col justify-center items-center md:items-start text-center md:text-left pb-10 md:py-12 order-2">
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
              style={{ color: DARK_BLUE }}
            >
              Master Spanish For Real.
            </h1>
            <p className="text-lg text-gray-500 mb-10 max-w-md leading-relaxed">
              Practice vocabulary, pronunciation, listening, and writing — all in one place.
              The perfect companion to your Spanish classes.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-sm">
              <Link
                to="/account/signup"
                className="block text-center text-white font-bold uppercase tracking-widest text-sm px-8 py-4 rounded-xl transition-colors"
                style={{ backgroundColor: DARK_BLUE }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = DARK_BLUE_HOVER)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = DARK_BLUE)}
              >
                Get Started Free
              </Link>
              <Link
                to="/account/signin"
                className="block text-center font-bold uppercase tracking-widest text-sm px-8 py-4 rounded-xl border-2 transition-colors"
                style={{ borderColor: LIGHT_BLUE, color: LIGHT_BLUE }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = LIGHT_BLUE;
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = LIGHT_BLUE;
                }}
              >
                I Already Have an Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS / STEPS ── */}

      {/* Steps headline */}
      <div className="bg-white border-t border-gray-100 pt-16">
        <h2
          className="text-3xl md:text-4xl font-bold text-center px-6"
          style={{ color: DARK_BLUE }}
        >
          Learn Spanish in 3 Simple Steps
        </h2>
      </div>

      {/* Step 1 — image left, text right */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center gap-6 md:gap-16 md:py-16">
          <FadeIn className="flex-1 flex flex-col justify-center py-8 order-1 md:order-2" direction="right">
            <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: LIGHT_BLUE }}>Step 1</p>
            <h3 className="text-4xl md:text-5xl font-bold mb-6 leading-tight" style={{ color: DARK_BLUE }}>Practice</h3>
            <p className="text-gray-500 text-xl leading-relaxed">
              Students study vocabulary in Study Mode. Learn at your own pace with real Spanish prompts and instant feedback.
            </p>
          </FadeIn>
          <FadeIn className="flex-1 flex items-center justify-center pb-8 md:py-8 order-2 md:order-1" direction="left" delay={100}>
            <img src={step1Img} alt="Step 1 – Practice vocabulary in Study Mode" className="w-full object-contain" style={{ maxHeight: '60vh' }} />
          </FadeIn>
        </div>
      </section>

      {/* Step 2 — text left, image right */}
      <section className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center gap-6 md:gap-16 md:py-16">
          <FadeIn className="flex-1 flex flex-col justify-center py-8 order-1" direction="left">
            <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: LIGHT_BLUE }}>Step 2</p>
            <h3 className="text-4xl md:text-5xl font-bold mb-6 leading-tight" style={{ color: DARK_BLUE }}>Use All 4 Skills</h3>
            <p className="text-gray-500 text-xl leading-relaxed">
              Type answers, listen to prompts, read content, and speak with voice feedback. A complete language practice experience.
            </p>
          </FadeIn>
          <FadeIn className="flex-1 flex items-center justify-center pb-8 md:py-8 order-2" direction="right" delay={100}>
            <img src={step2Img} alt="Step 2 – Use all 4 language skills" className="w-full object-contain" style={{ maxHeight: '60vh' }} />
          </FadeIn>
        </div>
      </section>

      {/* Step 3 — image left, text right */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center gap-6 md:gap-16 md:py-16">
          <FadeIn className="flex-1 flex flex-col justify-center py-8 order-1 md:order-2" direction="right">
            <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: LIGHT_BLUE }}>Step 3</p>
            <h3 className="text-4xl md:text-5xl font-bold mb-6 leading-tight" style={{ color: DARK_BLUE }}>Compete &amp; Improve</h3>
            <p className="text-gray-500 text-xl leading-relaxed">
              Earn XP, join Blitz Challenges, and track your progress. Make learning a habit with friendly competition.
            </p>
          </FadeIn>
          <FadeIn className="flex-1 flex items-center justify-center pb-8 md:py-8 order-2 md:order-1" direction="left" delay={100}>
            <img src={step3Img} alt="Step 3 – Compete and improve your Spanish" className="w-full object-contain" style={{ maxHeight: '60vh' }} />
          </FadeIn>
        </div>
      </section>

      {/* ── FOR STUDENTS ── */}
      <section id="students" className="py-20 bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-16">
            {/* Text — order-2 on mobile (below circle), order-1 on desktop (left) */}
            <div className="flex-1 order-2 md:order-1">
              <p
                className="text-sm font-bold uppercase tracking-widest mb-3"
                style={{ color: LIGHT_BLUE }}
              >
                🎓 For Students
              </p>
              <h2
                className="text-4xl font-bold leading-tight mb-10"
                style={{ color: DARK_BLUE }}
              >
                Show Up Ready<br />to Speak.
              </h2>
              <BenefitList
                titleColor={DARK_BLUE}
                items={[
                  { emoji: '🎧', title: 'Listen with purpose', desc: 'Train your ear with real Spanish prompts — not random phrases.' },
                  { emoji: '✍️', title: 'Write what you\'ve learned', desc: 'Type answers to strengthen memory and spelling.' },
                  { emoji: '🗣', title: 'Speak with confidence', desc: 'Practice pronunciation with voice recognition feedback.' },
                  { emoji: '🏆', title: 'Compete and level up', desc: 'Earn XP, improve your streak, and climb the Blitz rankings.' },
                ]}
              />
              <p className="mt-8 font-semibold text-gray-700">
                Stop memorizing. Start using Spanish.
              </p>
              <Link
                to="/account/signup"
                className="block w-full md:inline-block md:w-auto text-center mt-5 text-white font-bold uppercase tracking-widest text-sm px-8 py-4 rounded-xl transition-colors"
                style={{ backgroundColor: DARK_BLUE }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = DARK_BLUE_HOVER)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = DARK_BLUE)}
              >
                Start Learning Free
              </Link>
            </div>

            {/* Decorative visual — order-1 on mobile (above text), order-2 on desktop (right) */}
            <FadeIn className="flex-1 flex justify-center order-1 md:order-2" direction="right" delay={150}>
              <div
                className="w-72 h-72 md:w-80 md:h-80 rounded-full flex items-center justify-center"
                style={{ background: `radial-gradient(circle at 30% 40%, ${LIGHT_BLUE}33 0%, ${DARK_BLUE}18 100%)` }}
              >
                <span className="text-8xl select-none">🎓</span>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── FOR TEACHERS ── */}
      <section id="teachers" className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row-reverse items-center gap-16">
            {/* Text — order-2 on mobile (below circle), order-1 on desktop (right via flex-row-reverse) */}
            <div className="flex-1 order-2 md:order-1">
              <p
                className="text-sm font-bold uppercase tracking-widest mb-3"
                style={{ color: LIGHT_BLUE }}
              >
                👩‍🏫 For Teachers
              </p>
              <h2
                className="text-4xl font-bold leading-tight mb-10"
                style={{ color: DARK_BLUE }}
              >
                Turn Practice Into<br />Accountability.
              </h2>
              <BenefitList
                titleColor={DARK_BLUE}
                items={[
                  { emoji: '📚', title: 'Create classrooms in seconds', desc: 'Organize students and manage vocabulary sets effortlessly.' },
                  { emoji: '📝', title: 'Assign targeted study work', desc: 'Send specific sets with deadlines and XP goals.' },
                  { emoji: '📊', title: 'Track real progress', desc: 'Monitor completion, XP earned, and student improvement.' },
                  { emoji: '⚡', title: 'Run live Blitz Challenges', desc: 'Bring energy and competition into your classroom.' },
                ]}
              />
              <p className="mt-8 text-gray-500 leading-relaxed">
                You teach the lesson.<br />
                <span className="font-semibold" style={{ color: DARK_BLUE }}>
                  We reinforce it between classes.
                </span>
              </p>
              <Link
                to="/account/signup"
                className="block w-full md:inline-block md:w-auto text-center mt-5 text-white font-bold uppercase tracking-widest text-sm px-8 py-4 rounded-xl transition-colors"
                style={{ backgroundColor: DARK_BLUE }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = DARK_BLUE_HOVER)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = DARK_BLUE)}
              >
                Create Your Classroom Free
              </Link>
            </div>

            {/* Decorative visual — order-1 on mobile (above text), order-2 on desktop (left via flex-row-reverse) */}
            <FadeIn className="flex-1 flex justify-center order-1 md:order-2" direction="left" delay={150}>
              <div
                className="w-72 h-72 md:w-80 md:h-80 rounded-full flex items-center justify-center"
                style={{ background: `radial-gradient(circle at 70% 30%, ${DARK_BLUE}18 0%, ${LIGHT_BLUE}33 100%)` }}
              >
                <span className="text-8xl select-none">👩‍🏫</span>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section className="py-20 bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2
            className="text-4xl font-bold mb-3"
            style={{ color: DARK_BLUE }}
          >
            Trusted in Real Spanish Classrooms
          </h2>
          <p className="text-gray-400 text-base mb-16">
            Students Practice More. Teachers See the Difference.
          </p>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              {
                quote: 'My students come to class more prepared and confident. The Blitz Challenge has completely changed how we review vocabulary.',
                author: 'Spanish Teacher', delay: 0,
              },
              {
                quote: 'Typing the answers and practicing pronunciation actually helps the words stick.',
                author: 'Intermediate Student', delay: 150,
              },
              {
                quote: 'I like that it uses the exact vocabulary from our class. It makes studying feel purposeful.',
                author: 'Beginner Student', delay: 300,
              },
            ].map((t) => (
              <FadeIn key={t.author} direction="up" delay={t.delay}
                className="bg-white rounded-2xl p-8 text-left shadow-sm border border-gray-100"
              >
                <p className="text-gray-600 leading-relaxed italic mb-5">"{t.quote}"</p>
                <p className="font-bold text-sm" style={{ color: DARK_BLUE }}>— {t.author}</p>
              </FadeIn>
            ))}
          </div>

          {/* Stats */}
          <div className="flex flex-col md:flex-row justify-center gap-12 md:gap-20 mb-10">
            {[
              { stat: '100+', label: 'Active Students' },
              { stat: '10+', label: 'Spanish Teachers' },
              { stat: '1,000s', label: 'Vocabulary Reviews Completed' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-4xl font-bold" style={{ color: LIGHT_BLUE }}>{s.stat}</p>
                <p className="text-gray-500 mt-1 text-sm">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="text-gray-400 text-sm">
            Built for real teachers. Used by real students. Designed to make Spanish stick.
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 border-t border-gray-100" style={{ backgroundColor: DARK_BLUE }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
            Bring Spanish to Life —<br />In and Beyond the Classroom.
          </h2>
          <p className="text-blue-200 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Whether you're a student building confidence or a teacher guiding your class,
            The Spanish Blitz is your perfect companion.
          </p>
          <Link
            to="/account/signup"
            className="inline-block font-bold uppercase tracking-widest text-sm px-12 py-5 rounded-xl transition-colors"
            style={{ backgroundColor: '#fff', color: DARK_BLUE }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e8f4fb')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff')}
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} The Spanish Blitz. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  );
}
