# R&B Music Generator - AI Music Generator

## 🎵 Generate Authentic 90s Black R&B Music with AI

Create professional-quality 90s Black R&B music using AI. Choose from various subgenres and moods to generate music that captures the essence of 1990s R&B.

![90s R&B Generator](./public/demo-img.jpg)

## ✨ Features

- **5 Authentic Genres**: New Jack Swing, Hip-Hop Soul, Contemporary R&B, Quiet Storm, and Neo-Soul
- **8 Mood Options**: Joyful (快乐), Melancholic (忧郁), Romantic (浪漫), Nostalgic (怀旧), Mysterious (神秘), Chill (放松), Energetic (兴奋), Confident (自信)
- **Custom Prompts**: Add specific details to customize your music generation
- **Built-in Audio Player**: Play generated music directly in the browser
- **Download Capability**: Save generated tracks to your device
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Suno API key from [Kie.ai](https://kie.ai)

### Installation

1. Clone this repository:
```bash
git clone https://github.com/your-username/only-90s-rnb.git
cd only-90s-rnb
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Add your Suno API key to `.env.local`:
```env
SUNO_API_KEY=your_api_key_here
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🎯 How to Use

1. **Select Genre**: Choose from 5 authentic 90s R&B subgenres
2. **Pick Mood**: Select the emotional tone for your track
3. **Optional**: Add custom prompt for specific details
4. **Generate**: Click to create your unique 90s R&B track
5. **Play & Download**: Listen to your creation and download it

## 🎼 Supported Genres

| Genre | Description |
|-------|-------------|
| **New Jack Swing** | Fusion of R&B, hip hop, and dance-pop |
| **Hip-Hop Soul** | R&B with hip-hop influenced beats |
| **Contemporary R&B** | Modern R&B with sophisticated production |
| **Quiet Storm** | Smooth, mellow R&B for late-night listening |
| **Neo-Soul** | Soulful R&B with jazz and funk influences |

## 🎭 Available Moods

- 😊 **Joyful (快乐)** - Upbeat and celebratory
- 😔 **Melancholic (忧郁)** - Introspective and emotional
- 💕 **Romantic (浪漫)** - Intimate and loving
- 🌅 **Nostalgic (怀旧)** - Reminiscent and wistful
- 🌙 **Mysterious (神秘)** - Enigmatic and sultry
- 😌 **Chill (放松)** - Relaxed and laid-back
- 🔥 **Energetic (兴奋)** - Vibrant and dynamic
- 💪 **Confident (自信)** - Empowering and strong

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **UI Components**: Shadcn/ui, Tailwind CSS
- **API**: Suno API via Kie.ai
- **Audio**: HTML5 Audio API
- **Icons**: Lucide React

## 📁 Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── generate-music/ # Music generation endpoint
│   │   └── status/        # Generation status endpoint
│   ├── page.tsx           # Main page
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   └── layout/sections/  # Page sections
├── lib/                  # Utilities and services
│   ├── music-api.ts      # Suno API service
│   └── utils.ts          # Helper functions
└── public/               # Static assets
```

## 🔧 API Configuration

The app uses the Suno API through Kie.ai. You'll need to:

1. Sign up at [Kie.ai](https://kie.ai)
2. Get your API key
3. Add it to your environment variables

### API Endpoints

- `POST /api/generate-music` - Generate new music
- `GET /api/status/[taskId]` - Check generation status

## 🎨 Customization

You can customize the genres and moods by editing:
- `components/layout/sections/music-generator.tsx`
- `lib/music-api.ts`

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy

### Other Platforms

Make sure to set the `SUNO_API_KEY` environment variable on your deployment platform.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Powered by [Suno API](https://docs.kie.ai/suno-api/quickstart)
- Built with [Shadcn/ui](https://ui.shadcn.com/)
- Inspired by the golden age of 90s R&B music

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Made with ❤️ for 90s R&B music lovers**
