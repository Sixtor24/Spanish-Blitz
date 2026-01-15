import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth-context';
import '@/app/global.css';

// Pages
import HomePage from '@/app/homepage/page';
import SignInPage from '@/app/account/signin/page';
import SignUpPage from '@/app/account/signup/page';
import LogoutPage from '@/app/account/logout/page';
import ForgotPasswordPage from '@/app/account/forgot-password/page';
import ResetPasswordPage from '@/app/account/reset-password/page';
import DashboardPage from '@/app/dashboard/page';
import ProfilePage from '@/app/profile/page';
import StudyPage from '@/app/study/page';
import DeckDetailPage from '@/app/decks/[id]/page';
import CreateSetPage from '@/app/admin/create-set/page';
import AdminUsersPage from '@/app/admin/users/page';
import SoloBlitzPage from '@/app/play/solo/page';
import BlitzChallengePage from '@/app/blitz-challenge/page';
import BlitzChallengeCreateWithIdPage from '@/app/blitz-challenge/create/[id]/page';
import BlitzChallengeSessionPage from '@/app/blitz-challenge/session/[code]/page';
import PricingPage from '@/app/pricing/page';
import PrivacyPage from '@/app/privacy/page';
import ClassroomsPage from '@/app/classrooms/page';
import ClassroomDetailPage from '@/app/classrooms/[id]/page';
import TeacherPage from '@/app/teacher/page';
import TeacherClassroomDetailPage from '@/app/teacher/classrooms/[id]/page';
import NotFoundPage from '@/app/__create/not-found';

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="bottom-right" />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/account/signin" element={<SignInPage />} />
        <Route path="/account/signup" element={<SignUpPage />} />
        <Route path="/account/logout" element={<LogoutPage />} />
        <Route path="/account/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/account/reset-password" element={<ResetPasswordPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/study" element={<StudyPage />} />
        <Route path="/decks/:id" element={<DeckDetailPage />} />
        
        {/* Admin routes */}
        <Route path="/admin/create-set" element={<CreateSetPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        
        {/* Play routes */}
        <Route path="/play/solo" element={<SoloBlitzPage />} />
        
        {/* Blitz Challenge routes */}
        <Route path="/blitz-challenge" element={<BlitzChallengePage />} />
        <Route path="/blitz-challenge/create/:id" element={<BlitzChallengeCreateWithIdPage />} />
        <Route path="/blitz-challenge/session/:code" element={<BlitzChallengeSessionPage />} />
        
        {/* Classrooms routes */}
        <Route path="/classrooms" element={<ClassroomsPage />} />
        <Route path="/classrooms/:id" element={<ClassroomDetailPage />} />
        
        {/* Teacher routes */}
        <Route path="/teacher" element={<TeacherPage />} />
        <Route path="/teacher/classrooms/:id" element={<TeacherClassroomDetailPage />} />

        {/* 404 catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <script src="https://kit.fontawesome.com/2c15cc0cc7.js" crossOrigin="anonymous" async />
    </AuthProvider>
  );
}
