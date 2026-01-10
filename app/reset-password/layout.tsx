import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password | MakeRNB",
  description: "Reset your MakeRNB password securely. Verify your email, set a new password, and regain access to your studio and library so you can keep creating today.",
  alternates: {
    canonical: "https://makernb.com/reset-password",
  },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
