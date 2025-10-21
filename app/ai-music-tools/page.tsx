'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Music, Mic, Wand2, ArrowRight, Sparkles } from 'lucide-react';

const aiTools = [
  {
    title: 'AI Music Generator',
    description: 'Create original music with advanced AI technology. Generate complete songs, instrumentals, and melodies in any genre within minutes.',
    href: '/studio',
    icon: <Music className="h-8 w-8" />,
    features: ['R&B Style Focus', 'Custom Prompts', 'Multiple Genres', 'High Quality Audio'],
    color: 'from-purple-500 to-pink-500'
  },
  {
    title: 'AI Vocal Remover',
    description: 'Separate vocals from music using cutting-edge AI. Get professional quality separated tracks for remixing and karaoke.',
    href: '/vocal-remover',
    icon: <Mic className="h-8 w-8" />,
    features: ['Vocal + Instrumental', 'Multi-Stem Separation', 'Professional Quality', 'Fast Processing'],
    color: 'from-blue-500 to-cyan-500'
  },
  {
    title: 'Explore Music',
    description: 'Discover trending tracks and explore the community. Find inspiration from other creators and share your own music.',
    href: '/explore',
    icon: <Wand2 className="h-8 w-8" />,
    features: ['Trending Tracks', 'Community Discovery', 'Music Sharing', 'Inspiration Gallery'],
    color: 'from-green-500 to-emerald-500'
  }
];

export default function AIMusicToolsPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      {/* Hero Section */}
      <div className="text-center space-y-6 mb-16">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            AI Music Tools
          </h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Powerful AI-powered tools for music creation, editing, and discovery. 
          Transform your musical ideas into reality with cutting-edge technology.
        </p>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
        {aiTools.map((tool, index) => (
          <Card key={index} className="group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="pb-4">
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300`}>
                {tool.icon}
              </div>
              <CardTitle className="text-xl">{tool.title}</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                {tool.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Key Features:</h4>
                <ul className="space-y-1">
                  {tool.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Button asChild className="w-full group-hover:bg-primary/90 transition-colors">
                <Link href={tool.href} className="flex items-center gap-2">
                  Try Now
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <Card className="border-0 bg-gradient-to-br from-primary/5 to-purple-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Why Choose Our AI Tools?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">Professional Quality</h4>
                  <p className="text-sm text-muted-foreground">Industry-leading AI technology for studio-quality results</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">Fast Processing</h4>
                  <p className="text-sm text-muted-foreground">Get results in minutes, not hours</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">Easy to Use</h4>
                  <p className="text-sm text-muted-foreground">Intuitive interface designed for creators of all levels</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">R&B Focused</h4>
                  <p className="text-sm text-muted-foreground">Specialized for R&B and soul music creation</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-blue-500" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium flex-shrink-0">1</div>
                <div>
                  <h4 className="font-medium">Choose Your Tool</h4>
                  <p className="text-sm text-muted-foreground">Select the AI tool that matches your creative needs</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium flex-shrink-0">2</div>
                <div>
                  <h4 className="font-medium">Upload or Create</h4>
                  <p className="text-sm text-muted-foreground">Upload your audio or create new music from scratch</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium flex-shrink-0">3</div>
                <div>
                  <h4 className="font-medium">AI Processing</h4>
                  <p className="text-sm text-muted-foreground">Let our AI work its magic and process your request</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium flex-shrink-0">4</div>
                <div>
                  <h4 className="font-medium">Download & Share</h4>
                  <p className="text-sm text-muted-foreground">Download your results and share with the community</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA Section */}
      <Card className="text-center border-0 bg-gradient-to-r from-primary/10 to-purple-500/10">
        <CardContent className="py-12">
          <h2 className="text-3xl font-bold mb-4">Ready to Create Amazing Music?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of creators who are already using our AI tools to bring their musical visions to life.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
              <Link href="/studio" className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Start Creating Music
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/vocal-remover" className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Try Vocal Remover
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
