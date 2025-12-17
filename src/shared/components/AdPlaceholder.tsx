import { useEffect, useState } from 'react';

type CurrentUser = {
  plan?: string;
};

export default function AdPlaceholder() {
  const [showAd, setShowAd] = useState(true);

  useEffect(() => {
    async function checkUserPlan() {
      try {
        const res = await fetch('/api/users/current');
        if (res.ok) {
          const user = (await res.json()) as CurrentUser;
          if (user.plan === 'premium' || user.plan === 'gold') {
            setShowAd(false);
          }
        }
      } catch (err) {
        console.error('Error checking user plan:', err);
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
