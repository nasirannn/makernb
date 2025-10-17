"use client";

import React from "react";
import { useRouter } from "next/navigation";

export const CTASection = () => {
  const router = useRouter();

  const handleStudioClick = () => {
    // 直接跳转到studio页面，不需要检查登录状态
    router.push('/studio');
  };

  return (
    <section className="py-16 sm:py-20 bg-background">
      <div className="container">
        <div className="text-center max-w-4xl mx-auto">
          {/* Main Heading */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
            Start Creating The Contemporary and The Old School R&B Songs Today
          </h2>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Join thousands of creators generating viral content with AI-powered R&B music.
          </p>

          {/* CTA Button with Tutorial Style */}
          <div className="text-center">
            <div className="relative inline-block">
              <div onClick={handleStudioClick} className="block cursor-pointer">
                <h3 className="text-sm md:text-lg lg:text-xl font-bold relative overflow-hidden leading-tight animate-text-highlight cursor-pointer hover:scale-105 transition-transform duration-300">
                  Creating Your R&B Tracks
                </h3>
              </div>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="mt-8 text-sm text-muted-foreground">
            <p>✨ Free daily credits • 🎵 Professional quality • 🚀 No experience needed</p>
          </div>
        </div>
      </div>
    </section>
  );
};
