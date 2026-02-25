import { useEffect } from "react";
import useAuth from "@/shared/hooks/useAuth";

function MainComponent() {
  const { signOut } = useAuth();

  useEffect(() => {
    signOut();
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-gray-300 border-t-[#10A5C3] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Signing out…</p>
      </div>
    </div>
  );
}

export default MainComponent;
