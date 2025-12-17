import { useCallback } from 'react';
import { signIn, signOut } from '@auth/create/react';

type SignInProvider = 'credentials-signin' | 'credentials-signup' | 'google' | 'facebook' | 'twitter';
type SignInOptions = Record<string, unknown>;

const getCallbackUrl = () => {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('callbackUrl');
};

function useAuth() {
  const callbackUrl = getCallbackUrl();

  const withCallback = useCallback(
    (provider: SignInProvider, options: SignInOptions = {}) => {
      return signIn(provider, {
        ...options,
        callbackUrl: callbackUrl ?? (options.callbackUrl as string | undefined),
      });
    },
    [callbackUrl]
  );

  const signInWithCredentials = useCallback(
    (options: SignInOptions = {}) => withCallback('credentials-signin', options),
    [withCallback]
  );

  const signUpWithCredentials = useCallback(
    (options: SignInOptions = {}) => withCallback('credentials-signup', options),
    [withCallback]
  );

  const signInWithGoogle = useCallback(
    (options: SignInOptions = {}) => withCallback('google', options),
    [withCallback]
  );

  const signInWithFacebook = useCallback(
    (options: SignInOptions = {}) => withCallback('facebook', options),
    [withCallback]
  );

  const signInWithTwitter = useCallback(
    (options: SignInOptions = {}) => withCallback('twitter', options),
    [withCallback]
  );

  return {
    signInWithCredentials,
    signUpWithCredentials,
    signInWithGoogle,
    signInWithFacebook,
    signInWithTwitter,
    signOut,
  };
}

export { useAuth };
export default useAuth;