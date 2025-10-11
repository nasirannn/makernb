"use client";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal from "@/components/ui/auth-modal";
import { useRouter } from "next/navigation";

export const HeroSection = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  const handleStudioClick = () => {
    if (user) {
      // User is logged in, navigate to studio
      router.push('/studio');
    } else {
      // User is not logged in, show auth modal
      setIsAuthModalOpen(true);
    }
  };

  return (
    <section className="relative w-full min-h-screen pt-20">

      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/only-90s-rnb-background.webp"
          alt="R&B Background"
          fill
          className="object-cover object-center select-none"
          priority
          quality={100}
          sizes="100vw"
        />
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40"></div>
        
        {/* Animated Background Effects */}
        <AnimatedBackground>
          <div></div>
        </AnimatedBackground>
        
        {/* Twinkling Stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Star 1 */}
          <div className="absolute top-16 left-16 w-1 h-1 bg-white rounded-full animate-twinkle opacity-60"></div>
          {/* Star 2 */}
          <div className="absolute top-28 right-24 w-1 h-1 bg-white rounded-full animate-twinkle-delay opacity-80"></div>
          {/* Star 3 */}
          <div className="absolute top-40 left-1/3 w-0.5 h-0.5 bg-white rounded-full animate-twinkle-slow opacity-70"></div>
          {/* Star 4 */}
          <div className="absolute top-56 right-1/4 w-1.5 h-1.5 bg-white rounded-full animate-twinkle opacity-50"></div>
          {/* Star 5 */}
          <div className="absolute top-72 left-1/2 w-1 h-1 bg-white rounded-full animate-twinkle-delay opacity-90"></div>
          {/* Star 6 */}
          <div className="absolute top-88 right-16 w-0.5 h-0.5 bg-white rounded-full animate-twinkle-slow opacity-60"></div>
          {/* Star 7 */}
          <div className="absolute top-1/3 left-12 w-1 h-1 bg-white rounded-full animate-twinkle opacity-80"></div>
          {/* Star 8 */}
          <div className="absolute top-1/2 right-1/3 w-1 h-1 bg-white rounded-full animate-twinkle-delay opacity-70"></div>
          {/* Star 9 */}
          <div className="absolute top-2/3 left-1/4 w-0.5 h-0.5 bg-white rounded-full animate-twinkle-slow opacity-50"></div>
          {/* Star 10 */}
          <div className="absolute top-5/6 right-1/2 w-1 h-1 bg-white rounded-full animate-twinkle opacity-90"></div>
        </div>
      </div>
      
      {/* Content */}
      <div className="relative z-10 container mx-auto">
        <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-16 md:py-24">
          <div className="text-center space-y-8">
            <span className="relative mb-4 inline-block rounded-full border border-zinc-700 bg-zinc-900/20 px-2 py-2 text-xs text-zinc-50 md:mb-0 animate-border-marquee">
              <span className="text-white/90 font-medium"> AI-Powered Music Generator </span>
              <span className="absolute bottom-0 left-3 right-3 h-[1px] bg-gradient-to-r from-zinc-500/0 via-zinc-300 to-zinc-500/0"></span>
            </span>

            <div className="max-w-screen-lg mx-auto text-center">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
                Free Online
                AI
                <span className="text-transparent px-2 bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 bg-clip-text">
                  R&B
                </span>Music Generator
              </h1>
            </div>

            <p className="max-w-screen-md mx-auto text-base md:text-xl text-white/90 leading-relaxed mb-8">
              Generate professional-quality R&B music with AI. Choose from New Jack Swing, Hip-Hop Soul, Quiet Storm, and Neo-Soul genres with customizable styles and instruments.
            </p>

            {/* User Avatars */}
            <div className="flex items-center justify-center mb-6">
              <div className="flex -space-x-2">
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <Image src="/avatars/avatar1.svg" alt="User 1" width={40} height={40} className="w-full h-full object-cover" />
                </div>
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <Image src="/avatars/avatar2.svg" alt="User 2" width={40} height={40} className="w-full h-full object-cover" />
                </div>
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <Image src="/avatars/avatar3.svg" alt="User 3" width={40} height={40} className="w-full h-full object-cover" />
                </div>
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <Image src="/avatars/avatar4.svg" alt="User 4" width={40} height={40} className="w-full h-full object-cover" />
                </div>
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <Image src="/avatars/avatar5.svg" alt="User 5" width={40} height={40} className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="ml-3 flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                <span className="text-sm text-white/80 font-medium">Join Thousands of Creators</span>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <button
                onClick={handleStudioClick}
                className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary/80 transition-all duration-300 transform hover:shadow-none overflow-hidden shadow-[2px_2px_0_0_rgba(255,255,255,0.8)] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[0px_0px_0_0_rgba(255,255,255,0)] border border-primary/20 text-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span>Try It On</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </section>
  );
};
