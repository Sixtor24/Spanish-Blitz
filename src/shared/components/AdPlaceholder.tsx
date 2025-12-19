import { useEffect, useState } from 'react';
import { api } from '@/config/api';

type CurrentUser = {
  plan?: string;
};

export default function AdPlaceholder() {
  const [showAd, setShowAd] = useState(true);

  useEffect(() => {
    async function checkUserPlan() {
      try {
        const user = await api.users.current() as CurrentUser;
        if (user.plan === 'premium' || user.plan === 'gold') {
          setShowAd(false);
        }
      } catch (err: any) {
        // 401 is expected when user is not logged in
        if (!err?.message?.includes('401') && !err?.message?.includes('Unauthorized')) {
          console.error('Error checking user plan:', err);
        }
        // Show ads if not premium/gold or not logged in
        setShowAd(true);
      }
    }

    checkUserPlan();
  }, []);

  if (!showAd) return null;

  return (
    <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
      <p className="text-gray-500 font-medium">Ad Placeholder</p>
      <p className="text-sm text-gray-400 mt-1">Upgrade to premium to remove ads</p>
    </div>
  );
}
