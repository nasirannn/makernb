"use client";

import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

export const FooterSection = () => {
  const handleGithubClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast("🎁 Daily Login Bonus!", {
      description: "You have received 15 credits as a daily login bonus. They are only valid today (UTC) - use them up ASAP.",
      duration: 5000,
      className: 'bg-purple-600 text-white border-none shadow-2xl',
    });
  };

  return (
    <footer id="footer" className="container py-24 sm:py-32">
      <div className="p-10 bg-card rounded-2xl">
        <div className="flex flex-col items-center justify-between gap-10 text-center lg:flex-row lg:text-left">
          <div className="flex w-full max-w-96 shrink flex-col items-center justify-between gap-6 lg:items-start">
            <Link href="/" className="flex font-bold items-center mb-4">
              <Image
                src="/logo.svg"
                alt="MakeRNB Logo"
                width={32}
                height={32}
                className="mr-3"
              />
              <h3 className="text-xl">MakeRNB</h3>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
              Create authentic R&B music with AI. From soulful ballads to contemporary grooves, generate professional tracks that capture the essence of rhythm and blues.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 lg:gap-20">
            {/* About */}
            <div className="flex flex-col gap-3 sm:gap-4 items-start text-left">
              <h3 className="font-bold text-lg">About</h3>
              <div>
                <Link 
                  href="/#features" 
                  className="opacity-60 hover:opacity-100"
                >
                  Features
                </Link>
              </div>

              <div>
                <Link href="/#tutorial" className="opacity-60 hover:opacity-100">
                  How It Works
                </Link>
              </div>
            </div>

            {/* Help */}
            <div className="flex flex-col gap-3 sm:gap-4 items-start text-left">
              <h3 className="font-bold text-lg">Help</h3>
              <div>
                <Link href="#" className="opacity-60 hover:opacity-100">
                  Contact Us
                </Link>
              </div>


              <div>
                <Link href="#" className="opacity-60 hover:opacity-100">
                  Feedback
                </Link>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-6" />
        <section className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; 2025 MakeRNB. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-sm opacity-60 hover:opacity-100 transition-opacity">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm opacity-60 hover:opacity-100 transition-opacity">
              Terms of Service
            </Link>
          </div>
        </section>
      </div>
    </footer>
  );
};
