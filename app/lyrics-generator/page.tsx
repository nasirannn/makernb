'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, RefreshCw, AlertCircle, Music, Wand2, Copy, Download, Check } from 'lucide-react';
import AuthModal from '@/components/ui/auth-modal';
import { FooterSection } from '@/components/layout/sections/footer';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CLIENT_FEATURE_CREDITS } from '@/lib/credits-config';
import { useAuth } from '@/contexts/AuthContext';
import presetsData from '@/data/lyrics-presets.json';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export default function LyricsGeneratorPage() {
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLyrics, setGeneratedLyrics] = useState<Array<{title: string, text: string}>>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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
    setGeneratedLyrics([]);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        if (refreshedSession?.access_token) {
          return await makeApiCall(refreshedSession.access_token);
        }
        throw new Error('Failed to get session. Please try logging in again.');
      }

      if (!session?.access_token) {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        if (refreshedSession?.access_token) {
          return await makeApiCall(refreshedSession.access_token);
        }
        throw new Error('Please log in to generate lyrics.');
      }

      await makeApiCall(session.access_token);

    } catch (err) {
      console.error('Error generating lyrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate lyrics');
      setIsGenerating(false);
    }
  };

  const makeApiCall = async (token: string) => {
    try {
      const response = await fetch('/api/generate-lyrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const result = await response.json();

      if (response.status === 401) {
        throw new Error('Your session has expired. Please log in again.');
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate lyrics');
      }

      if (result.data?.taskId) {
        await pollLyricsStatus(result.data.taskId);
      } else {
        throw new Error('No task ID received');
      }
    } catch (err) {
      throw err;
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
          if (result.data?.status === 'complete' && result.data?.lyrics) {
            setGeneratedLyrics(result.data.lyrics);
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
    setGeneratedLyrics([]);
    setError(null);
    setSelectedTheme('');
    setSelectedMood('');
    setSelectedStyle('');
  };

  const handlePresetClick = (type: 'theme' | 'mood' | 'style', value: string) => {
    let newTheme = selectedTheme;
    let newMood = selectedMood;
    let newStyle = selectedStyle;

    if (type === 'theme') {
      newTheme = selectedTheme === value ? '' : value;
    } else if (type === 'mood') {
      newMood = selectedMood === value ? '' : value;
    } else if (type === 'style') {
      newStyle = selectedStyle === value ? '' : value;
    }

    setSelectedTheme(newTheme);
    setSelectedMood(newMood);
    setSelectedStyle(newStyle);

    const parts = [];
    if (newTheme) parts.push(newTheme);
    if (newMood) parts.push(newMood);
    if (newStyle) parts.push(newStyle);

    setPrompt(parts.join(', '));
  };

  const handleCopyLyrics = async (lyrics: { title: string; text: string }, index: number) => {
    try {
      const textToCopy = `${lyrics.title}\n\n${lyrics.text}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy lyrics:', err);
    }
  };

  const handleDownloadLyrics = (lyrics: { title: string; text: string }) => {
    const content = `${lyrics.title}\n\n${lyrics.text}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${lyrics.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              AI LYRICS GENERATOR TOOLS
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight">
            AI Lyrics Generator Free Online
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
              Craft expressive lyrics instantly with our fast, AI-powered writing assistant.
            </p>
          </div>

          {/* Main Section */}
          <div className="space-y-8">
            <section className="rounded-[32px] bg-background/60 backdrop-blur-sm border border-border/30 p-4 sm:p-6 md:p-8 space-y-6">
                {/* Prompt Input Section */}
                <div className="bg-muted/20 rounded-2xl p-4 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                      <Wand2 className="h-5 w-5 text-primary" />
                      Describe Your Song
                    </h3>
                    {prompt && (
                      <Button
                        onClick={handleClearAll}
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Clear All
                      </Button>
                    )}
                  </div>

                  <div className="relative">
                    <Textarea
                      placeholder="Type your themes, moods, and styles... e.g., Love and Romance, Romantic and Intimate, R&B"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-[140px] resize-none pr-16 pb-12 border border-border bg-background/70 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 rounded-xl"
                      disabled={isGenerating}
                    />
                    <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      {prompt.length}/200
                    </div>
                  </div>
                </div>

                {/* Preset Options */}
                <div className="space-y-4">
                  {/* Themes */}
                  <div className="rounded-2xl border border-border/30 bg-background/40 p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Popular Themes</h4>
                    <div className="flex flex-wrap gap-2">
                      {presetsData.themes.map((theme) => (
                        <button
                          key={theme}
                          onClick={() => handlePresetClick('theme', theme)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                            selectedTheme === theme
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                              : 'bg-muted/40 text-foreground hover:bg-muted/60 border border-white/5'
                          }`}
                          disabled={isGenerating}
                        >
                          {theme}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Moods */}
                  <div className="rounded-2xl border border-border/30 bg-background/40 p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Moods</h4>
                    <div className="flex flex-wrap gap-2">
                      {presetsData.moods.map((mood) => (
                        <button
                          key={mood}
                          onClick={() => handlePresetClick('mood', mood)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                            selectedMood === mood
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                              : 'bg-muted/40 text-foreground hover:bg-muted/60 border border-white/5'
                          }`}
                          disabled={isGenerating}
                        >
                          {mood}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Styles */}
                  <div className="rounded-2xl border border-border/30 bg-background/40 p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Musical Styles</h4>
                    <div className="flex flex-wrap gap-2">
                      {presetsData.styles.map((style) => (
                        <button
                          key={style}
                          onClick={() => handlePresetClick('style', style)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                            selectedStyle === style
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                              : 'bg-muted/40 text-foreground hover:bg-muted/60 border border-white/5'
                          }`}
                          disabled={isGenerating}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

            {/* Action Panel */}
            <section className="rounded-[32px] border border-border/30 bg-muted/20 backdrop-blur-sm p-6 sm:p-8 flex flex-col gap-5">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">
                  Start creating
                </p>
                <h3 className="text-2xl font-bold text-foreground tracking-tight mb-2">
                  Generate polished lyrics in one click
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Describe your story, mood, or genre. Our AI writer delivers structured lyrics ready for any project.
                </p>
              </div>

              <Button
                onClick={handleGenerateLyrics}
                disabled={!prompt.trim() || isGenerating}
                className="w-full h-12 bg-gradient-create text-white text-base font-semibold hover:opacity-90 transition-opacity rounded-2xl"
                size="lg"
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    Generating Lyrics...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Generate Lyrics
                  </div>
                )}
              </Button>

              <div className="rounded-2xl border border-border/20 bg-background/40 p-4">
                <p className="text-sm font-semibold text-foreground mb-1">
                  Generation details
                </p>
                <p className="text-xs text-muted-foreground">
                  Estimated time: 30-60 seconds • Cost: {CLIENT_FEATURE_CREDITS.generate_lyrics.credits} credits
                </p>
              </div>

              {error && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Generated Lyrics Section */}
          {(isGenerating || generatedLyrics.length > 0) && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Music className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                  Generated Lyrics
                </h2>
              </div>

              {isGenerating && generatedLyrics.length === 0 && (
                <div className="bg-[#05060b] border border-white/5 rounded-[32px] shadow-[0_20px_60px_rgba(4,6,15,0.45)] p-8">
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <p className="text-muted-foreground">Crafting your lyrics...</p>
                  </div>
                </div>
              )}

              {generatedLyrics.length > 0 && (
                <div className={`grid gap-6 ${generatedLyrics.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                  {generatedLyrics.map((lyrics, index) => (
                    <div key={index} className="bg-[#05060b] border border-white/5 rounded-[32px] shadow-[0_20px_60px_rgba(4,6,15,0.45)] overflow-hidden">
                      {/* Header */}
                      <div className="bg-muted/20 px-6 py-4 border-b border-white/5">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-lg font-semibold text-foreground tracking-tight">
                            {lyrics.title}
                          </h3>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              onClick={() => handleCopyLyrics(lyrics, index)}
                              variant="ghost"
                              size="sm"
                              className="h-8 px-3 text-xs hover:bg-muted/30"
                            >
                              {copiedIndex === index ? (
                                <>
                                  <Check className="h-3.5 w-3.5 mr-1.5" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                                  Copy
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={() => handleDownloadLyrics(lyrics)}
                              variant="ghost"
                              size="sm"
                              className="h-8 px-3 text-xs hover:bg-muted/30"
                            >
                              <Download className="h-3.5 w-3.5 mr-1.5" />
                              Download
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6">
                        <pre className="whitespace-pre-wrap text-foreground/90 font-mono text-sm leading-relaxed">
                          {lyrics.text}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* About Section */}
      <section className="py-16 px-4 bg-muted/10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 lg:w-3/5 space-y-6">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground leading-tight tracking-tight">
                About MakeRNB&apos;s Lyrics Generator
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Our advanced AI lyrics generator transforms your creative vision into compelling song lyrics. Whether you&apos;re a songwriter seeking inspiration, a musician looking for the perfect words, or a content creator needing original lyrics, our tool delivers professional-quality results in seconds.
              </p>
            </div>

            <div className="flex-1 lg:w-2/5 flex justify-center">
              <Image
                src="/icons/Custom-Lyrics-Support.svg"
                alt="Lyrics Generator"
                width={320}
                height={320}
                className="h-80 w-80 object-contain opacity-90"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
              Features
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
              Key Features
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Discover the capabilities that make our AI lyrics generator stand out
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 flex items-center justify-center mx-auto bg-primary/10 rounded-2xl">
                <Image
                  src="/icons/AI-Powered-Creativity.svg"
                  alt="AI-Powered Creativity"
                  width={40}
                  height={40}
                  className="h-10 w-10"
                />
              </div>
              <h3 className="text-xl font-semibold text-foreground tracking-tight">
                AI-Powered Creativity
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Advanced AI creates compelling lyrics that understand context, emotion, and musical structure.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 flex items-center justify-center mx-auto bg-primary/10 rounded-2xl">
                <Image
                  src="/icons/Multiple-Genres.svg"
                  alt="Multiple Genres"
                  width={40}
                  height={40}
                  className="h-10 w-10"
                />
              </div>
              <h3 className="text-xl font-semibold text-foreground tracking-tight">
                Multiple Genres
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Generate lyrics for any style - pop, rock, hip-hop, country, jazz, and more.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 flex items-center justify-center mx-auto bg-primary/10 rounded-2xl">
                <Image
                  src="/icons/Customizable-Mood.svg"
                  alt="Customizable Mood"
                  width={40}
                  height={40}
                  className="h-10 w-10"
                />
              </div>
              <h3 className="text-xl font-semibold text-foreground tracking-tight">
                Customizable Mood
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Set the emotional tone - happy, sad, romantic, or energetic.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How To Use Section */}
      <section className="py-16 px-4 bg-muted/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
              How To Generate Lyrics With AI
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Create compelling lyrics in just three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center shadow-lg">
                    <span className="text-white text-lg font-bold">1</span>
                  </div>
                  <div className="absolute inset-0 w-12 h-12 rounded-full bg-gradient-to-r from-primary to-primary/70 opacity-20 blur-lg"></div>
                </div>
                <h3 className="text-xl font-semibold text-foreground tracking-tight">
                  Choose Your Style
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-16">
                Select themes, moods, and musical styles from our preset options or type your own creative prompt.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center shadow-lg">
                    <span className="text-white text-lg font-bold">2</span>
                  </div>
                  <div className="absolute inset-0 w-12 h-12 rounded-full bg-gradient-to-r from-primary to-primary/70 opacity-20 blur-lg"></div>
                </div>
                <h3 className="text-xl font-semibold text-foreground tracking-tight">
                  Generate Lyrics
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-16">
                Click generate and let our AI create professional-quality lyrics that match your vision and style.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center shadow-lg">
                    <span className="text-white text-lg font-bold">3</span>
                  </div>
                  <div className="absolute inset-0 w-12 h-12 rounded-full bg-gradient-to-r from-primary to-primary/70 opacity-20 blur-lg"></div>
                </div>
                <h3 className="text-xl font-semibold text-foreground tracking-tight">
                  Use Your Lyrics
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-16">
                Copy your generated lyrics and use them for your songs, or regenerate with different options.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
              FAQ
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-base text-muted-foreground">
              Get answers to common questions about our AI-powered lyrics generator
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            <AccordionItem value="item-1" className="bg-[#05060b] border border-white/5 rounded-2xl px-6 overflow-hidden">
              <AccordionTrigger className="text-left text-base font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
                How does AI lyrics generation work?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                Our AI analyzes your prompt, genre, and mood preferences to understand the context and emotional tone you want. It then generates lyrics that follow proper song structure (verses, chorus, bridge) while maintaining coherence and creativity.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-[#05060b] border border-white/5 rounded-2xl px-6 overflow-hidden">
              <AccordionTrigger className="text-left text-base font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
                Can I customize the generated lyrics?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                Yes! The generated lyrics serve as a foundation that you can edit, modify, and personalize. You can regenerate with different prompts or manually adjust any part of the lyrics to better match your vision.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-[#05060b] border border-white/5 rounded-2xl px-6 overflow-hidden">
              <AccordionTrigger className="text-left text-base font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
                Can I use the generated lyrics commercially?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                Yes, you have full rights to use the generated lyrics for commercial purposes. However, we recommend reviewing and potentially modifying the lyrics to ensure they meet your specific needs and standards.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
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
