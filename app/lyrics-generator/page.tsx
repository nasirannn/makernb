'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, RefreshCw, AlertCircle, Music, Wand2, Heart } from 'lucide-react';
import AuthModal from '@/components/ui/auth-modal';
import { FooterSection } from '@/components/layout/sections/footer';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { CLIENT_FEATURE_CREDITS } from '@/lib/credits-config';
import { useAuth } from '@/contexts/AuthContext';
import presetsData from '@/data/lyrics-presets.json';
import Image from 'next/image';

export default function LyricsGeneratorPage() {
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLyrics, setGeneratedLyrics] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // 预选项状态
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');

  const handleGenerateLyrics = async () => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a song theme or prompt');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedLyrics('');

    try {
      const response = await fetch('/api/generate-lyrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate lyrics');
      }

      if (result.data?.taskId) {
        await pollLyricsStatus(result.data.taskId);
      } else {
        throw new Error('No task ID received');
      }
    } catch (err) {
      console.error('Error generating lyrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate lyrics');
    } finally {
      setIsGenerating(false);
    }
  };

  const pollLyricsStatus = async (taskId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/lyrics-status/${taskId}`);
        const result = await response.json();

        if (result.success) {
          if (result.data?.status === 'completed' && result.data?.content) {
            setGeneratedLyrics(result.data.content);
            return;
          } else if (result.data?.status === 'error') {
            setError(result.data.error || 'Lyrics generation failed');
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setError('Lyrics generation timed out. Please try again.');
        }
      } catch (err) {
        console.error('Error polling lyrics status:', err);
        setError('Failed to check lyrics generation status');
      }
    };

    poll();
  };

  const handleClearAll = () => {
    setPrompt('');
    setGeneratedLyrics('');
    setError(null);
    setSelectedTheme('');
    setSelectedMood('');
    setSelectedStyle('');
  };

  // 处理预选项点击
  const handlePresetClick = (type: 'theme' | 'mood' | 'style', value: string) => {
    let newTheme = selectedTheme;
    let newMood = selectedMood;
    let newStyle = selectedStyle;
    
    if (type === 'theme') {
      newTheme = value;
    } else if (type === 'mood') {
      newMood = value;
    } else if (type === 'style') {
      newStyle = value;
    }
    
    // 更新状态
    setSelectedTheme(newTheme);
    setSelectedMood(newMood);
    setSelectedStyle(newStyle);
    
    // 更新输入框内容
    const parts = [];
    if (newTheme) parts.push(newTheme);
    if (newMood) parts.push(newMood);
    if (newStyle) parts.push(newStyle);
    
    setPrompt(parts.join(', '));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-32 pb-6 sm:pb-12">
        <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
            AI MUSIC TOOLS
          </p>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight">
            AI Lyrics Generator Free Online
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
            Create compelling lyrics with AI. Describe your vision and let our advanced technology craft the perfect words for your music.
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-4">
          {/* Prompt Input */}
          <div className="w-full space-y-2">
            <div className="relative">
              <textarea
                placeholder="Type or select themes, moods, and styles... e.g., Love and Romance, Romantic and Intimate, R&B"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-4 py-3 bg-muted rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors min-h-[100px] resize-none"
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Preset Options */}
          <div className="space-y-4">
            <Accordion type="single" collapsible className="space-y-2" defaultValue="themes">
              {/* Themes */}
              <AccordionItem value="themes" className="border-b border-border/20">
                <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]]:text-primary">
                  <span className="text-sm font-medium">Popular Themes</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {presetsData.themes.map((theme) => (
                      <button
                        key={theme}
                        onClick={() => handlePresetClick('theme', theme)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors border ${
                          selectedTheme === theme
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted hover:bg-primary hover:text-primary-foreground border-border/20'
                        }`}
                        disabled={isGenerating}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Moods */}
              <AccordionItem value="moods" className="border-b border-border/20">
                <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]]:text-primary">
                  <span className="text-sm font-medium">Moods</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {presetsData.moods.map((mood) => (
                      <button
                        key={mood}
                        onClick={() => handlePresetClick('mood', mood)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors border ${
                          selectedMood === mood
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted hover:bg-primary hover:text-primary-foreground border-border/20'
                        }`}
                        disabled={isGenerating}
                      >
                        {mood}
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Styles */}
              <AccordionItem value="styles" className="border-b border-border/20">
                <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]]:text-primary">
                  <span className="text-sm font-medium">Musical Styles</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {presetsData.styles.map((style) => (
                      <button
                        key={style}
                        onClick={() => handlePresetClick('style', style)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors border ${
                          selectedStyle === style
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted hover:bg-primary hover:text-primary-foreground border-border/20'
                        }`}
                        disabled={isGenerating}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <Button
                onClick={handleGenerateLyrics}
                disabled={!prompt.trim() || isGenerating}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    Generating...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Generate Lyrics
                  </div>
                )}
              </Button>
              
              <Button
                onClick={handleClearAll}
                variant="outline"
                disabled={isGenerating}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="text-center text-sm text-muted-foreground">
              <p>Estimated time: 30-60 seconds • This action will cost {CLIENT_FEATURE_CREDITS.generate_lyrics.credits} credits</p>
            </div>
          </div>

          {/* Generated Lyrics Section */}
          {(isGenerating || generatedLyrics) && (
            <div className="w-full">
              <Separator className="mb-8" />
              <h3 className="text-xl font-semibold text-foreground mb-6 text-left">
                Generated Lyrics
              </h3>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {isGenerating && !generatedLyrics && (
                <div className="bg-background/80 backdrop-blur-sm rounded-xl p-6 border border-border/20">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    Generating lyrics...
                  </div>
                </div>
              )}

              {generatedLyrics && (
                <div className="bg-background/80 backdrop-blur-sm rounded-xl p-6 border border-border/20">
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-foreground font-mono text-sm leading-relaxed">
                      {generatedLyrics}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        </div>
      </div>

      {/* What is MakeRNB's Lyrics Generator Section */}
      <section className="py-16 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Left Side - Text Content */}
            <div className="flex-1 lg:w-3/5 space-y-6">
              <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                About MakeRNB&apos;s Lyrics Generator
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Our advanced AI lyrics generator transforms your creative vision into compelling song lyrics. Whether you&apos;re a songwriter seeking inspiration, a musician looking for the perfect words, or a content creator needing original lyrics, our tool delivers professional-quality results in seconds. Perfect for artists, producers, and creative professionals who want to bring their musical ideas to life with powerful, emotive lyrics.
              </p>
            </div>
            
            {/* Right Side - Visual Content */}
            <div className="flex-1 lg:w-2/5 flex justify-center">
              <div className="flex items-center justify-center">
                <Image 
                  src="/icons/Custom-Lyrics-Support.svg" 
                  alt="Lyrics Generator" 
                  width={384}
                  height={384}
                  className="h-96 w-96 object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-16 px-4 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          {/* Section Title */}
          <div className="text-center mb-12">
            <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
              Features
            </h2>

            <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
              Key Features of MakeRNB Lyrics Generator
            </h2>

            <h3 className="md:w-1/2 mx-auto text-lg text-center text-muted-foreground mb-8">
              Discover the capabilities that make our AI lyrics generator stand out
            </h3>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: AI-Powered Creativity */}
            <div className="text-center">
              <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <Image 
                  src="/icons/AI-Powered-Creativity.svg" 
                  alt="AI-Powered Creativity" 
                  width={48}
                  height={48}
                  className="h-12 w-12"
                />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                AI-Powered Creativity
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Advanced AI creates compelling lyrics that understand context, emotion, and musical structure.
              </p>
            </div>

            {/* Feature 2: Multiple Genres */}
            <div className="text-center">
              <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <Image 
                  src="/icons/Multiple-Genres.svg" 
                  alt="Multiple Genres" 
                  width={48}
                  height={48}
                  className="h-12 w-12"
                />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Multiple Genres
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Generate lyrics for any style - pop, rock, hip-hop, country, jazz, and more.
              </p>
            </div>

            {/* Feature 3: Customizable Mood */}
            <div className="text-center">
              <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <Image 
                  src="/icons/Customizable-Mood.svg" 
                  alt="Customizable Mood" 
                  width={48}
                  height={48}
                  className="h-12 w-12"
                />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Customizable Mood
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Set the emotional tone - happy, sad, romantic, or energetic.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How To Use Section */}
      <section className="py-20 bg-muted/20">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-foreground mb-4">
                How To Generate Lyrics With AI
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Create compelling lyrics in just three simple steps
              </p>
            </div>

            {/* Steps */}
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-left">
                {/* Step Number and Title in same row */}
                <div className="mb-4 flex items-center justify-start gap-3">
                  {/* Step Number */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center shadow-lg">
                      <span className="text-white text-sm font-bold">1</span>
                    </div>
                    {/* Glow effect */}
                    <div className="absolute inset-0 w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 opacity-30 blur-md"></div>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-xl font-semibold text-foreground">
                    Choose Your Style
                  </h3>
                </div>
                
                {/* Description */}
                <p className="text-muted-foreground leading-relaxed">
                  Select themes, moods, and musical styles from our preset options or type your own creative prompt.
                </p>
              </div>

              <div className="text-left">
                {/* Step Number and Title in same row */}
                <div className="mb-4 flex items-center justify-start gap-3">
                  {/* Step Number */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center shadow-lg">
                      <span className="text-white text-sm font-bold">2</span>
                    </div>
                    {/* Glow effect */}
                    <div className="absolute inset-0 w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 opacity-30 blur-md"></div>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-xl font-semibold text-foreground">
                    Generate Lyrics
                  </h3>
                </div>
                
                {/* Description */}
                <p className="text-muted-foreground leading-relaxed">
                  Click generate and let our AI create professional-quality lyrics that match your vision and style.
                </p>
              </div>

              <div className="text-left">
                {/* Step Number and Title in same row */}
                <div className="mb-4 flex items-center justify-start gap-3">
                  {/* Step Number */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center shadow-lg">
                      <span className="text-white text-sm font-bold">3</span>
                    </div>
                    {/* Glow effect */}
                    <div className="absolute inset-0 w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 opacity-30 blur-md"></div>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-xl font-semibold text-foreground">
                    Use Your Lyrics
                  </h3>
                </div>
                
                {/* Description */}
                <p className="text-muted-foreground leading-relaxed">
                  Copy your generated lyrics and use them for your songs, or regenerate with different options.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="container max-w-4xl py-12 sm:py-16">
        <div className="text-center mb-8">
          <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
            Frequently Asked Questions
          </h2>

          <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
            Everything You Need to Know
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get answers to common questions about our AI-powered lyrics generator
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="item-1" className="border-b border-border px-4 py-1">
            <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
              How does AI lyrics generation work?
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
              Our AI analyzes your prompt, genre, and mood preferences to understand the context and emotional tone you want. It then generates lyrics that follow proper song structure (verses, chorus, bridge) while maintaining coherence and creativity.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border-b border-border px-4 py-1">
            <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
              Can I customize the generated lyrics?
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
              Yes! The generated lyrics serve as a foundation that you can edit, modify, and personalize. You can regenerate with different prompts or manually adjust any part of the lyrics to better match your vision.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border-b border-border px-4 py-1">
            <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
              Can I use the generated lyrics commercially?
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
              Yes, you have full rights to use the generated lyrics for commercial purposes. However, we recommend reviewing and potentially modifying the lyrics to ensure they meet your specific needs and standards.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Footer */}
      <FooterSection />

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </div>
  );
}