import UnifiedOTPLogin from '@/components/auth/unified-otp-login';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="w-full max-w-md px-4">
        <UnifiedOTPLogin />
      </div>
    </div>
  );
}
