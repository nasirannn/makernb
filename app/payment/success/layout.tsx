import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment Successful | MakeRNB",
  description: "Confirm your MakeRNB payment, review subscription details, and return to the studio to keep creating new AI R&B tracks with full access and updated credits.",
  alternates: {
    canonical: "https://makernb.com/payment/success",
  },
};

export default function PaymentSuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
