"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal from "@/components/ui/auth-modal";
import { useRouter } from "next/navigation";

export const TutorialSection = () => {
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

  const steps = [
    {
      icon: "/icons/01-Choose Style & Parameters.svg",
      title: "Choose Style & Options",
      description: "Select your favorite R&B style, instruments, and customize your unique music preferences.",
    },
    {
      icon: "/icons/02-Generate Music Instantly.svg",
      title: "Generate Music Instantly",
      description: "Click generate and let AI compose, arrange, create lyrics and vocals in seconds.",
    },
    {
      icon: "/icons/03-Listen & Download.svg",
      title: "Listen & Download",
      description: "Preview your generated music online and download high-quality audio files when satisfied.",
    },
  ];

  return (
    <section id="tutorial" className="py-20 bg-muted/20">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            How To Create a R&B Song With AI
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Create your own R&B music in just three simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={index}
              className="text-center"
            >
              {/* Icon */}
              <div className="mb-6 flex justify-center">
                <Image
                  src={step.icon}
                  alt={step.title}
                  width={128}
                  height={128}
                  className="w-32 h-32"
                />
              </div>
              
              {/* Title with Step Number */}
              <h3 className="text-xl font-semibold text-foreground mb-4">
                {index + 1}.
                {step.title}
              </h3>
              
              {/* Description */}
              <p className="text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* Highlighted Text */}
        <div className="text-center mt-12">
          <div className="relative inline-block">
            <div onClick={handleStudioClick} className="block cursor-pointer">
              <h3 className="text-sm md:text-lg lg:text-xl font-bold relative overflow-hidden leading-tight animate-text-highlight cursor-pointer hover:scale-105 transition-transform duration-300">
                Start Creating The Contemporary and The Old School R&B Songs
              </h3>
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
