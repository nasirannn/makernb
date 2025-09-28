"use client";

import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

export const FooterSection = () => {
  const handleGithubClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast("🎁 Daily Login Bonus!", {
      description: "You have received 15 credits as a daily login bonus. They are only valid today (UTC) - just use them up.",
      duration: 5000,
      className: 'bg-purple-600 text-white border-none shadow-2xl',
    });
  };

  return (
    <footer id="footer" className="container py-24 sm:py-32">
      <div className="p-10 bg-card rounded-2xl">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-x-4 gap-y-8">
          <div className="col-span-full md:col-span-3">
            <Link href="/" className="flex font-bold items-center mb-4">
              <Image
                src="/logo.svg"
                alt="R&B Logo"
                width={44}
                height={44}
                className="mr-3"
              />
              <h3 className="text-2xl">R&B  Music Generator</h3>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
              Professional AI-powered R&B music generator specializing in authentic soul, contemporary vibes, and smooth ballads. Create original R&B tracks with the signature sound and emotion that defines the genre.
            </p>
          </div>

          {/* 空列用于间距控制 */}
          <div className="hidden md:block"></div>

          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-lg">Contact</h3>
            <div>
              <Link 
                href="#" 
                className="opacity-60 hover:opacity-100 cursor-pointer"
                onClick={handleGithubClick}
              >
                Github
              </Link>
            </div>

            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Twitter
              </Link>
            </div>

            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Instagram
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-lg">Help</h3>
            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Contact Us
              </Link>
            </div>

            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                FAQ
              </Link>
            </div>

            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Feedback
              </Link>
            </div>
          </div>
        </div>

        <Separator className="my-6" />
        <section className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="">
            &copy; 2025 R&B  Music Generator. All rights reserved.
          </h3>
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
