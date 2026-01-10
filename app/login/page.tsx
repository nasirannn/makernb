import type { Metadata } from "next";
import UnifiedOTPLogin from '@/components/auth/unified-otp-login';

export const metadata: Metadata = {
  title: "Login | MakeRNB",
  description: "Sign in to MakeRNB to access your studio, credits, and library. Use secure email verification to start creating AI R&B music in minutes and manage saved tracks.",
  alternates: {
    canonical: "https://makernb.com/login",
  },
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="w-full max-w-md px-4">
        <UnifiedOTPLogin />
      </div>
    </div>
  );
}
