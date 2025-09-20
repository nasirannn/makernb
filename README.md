# 90s R&B Music Generator

A complete AI-powered music generation platform for creating authentic 90s R&B and Contemporary R&B music. Generate professional-quality tracks with custom prompts, multiple genres, and real-time playback.

![90s R&B Generator](./public/only-90s-rnb-background.png)

## ✨ Features

- **🎵 AI Music Generation**: Create authentic 90s R&B tracks using advanced AI
- **🎭 Multiple Genres**: New Jack Swing, Hip-Hop Soul, Contemporary R&B, Quiet Storm, Neo-Soul
- **🎨 Custom Prompts**: Add specific details to customize your music generation
- **🎧 Real-time Playback**: Built-in audio player with waveform visualization
- **💾 Download & Save**: Save your favorite tracks to your device
- **👤 User Authentication**: Secure login with Supabase
- **💳 Credit System**: Manage generation credits and daily rewards
- **📱 Responsive Design**: Works seamlessly on desktop and mobile
- **🖼️ Cover Generation**: AI-generated cover art for your tracks
- **📝 Lyrics Generation**: Generate lyrics for your music
- **📚 Music Library**: Organize and manage your generated tracks
- **🔍 Explore Section**: Discover and listen to community tracks

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Suno API key from [Kie.ai](https://kie.ai)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/nasirannn/rnb-music-gen.git
cd rnb-music-gen
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env.local
```

4. **Configure your environment variables in `.env.local`:**
```env
# Database
DATABASE_URL=your_postgresql_connection_string

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Suno API
SUNO_API_KEY=your_suno_api_key

# R2 Storage (optional)
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_r2_bucket_name
R2_PUBLIC_URL=your_r2_public_url
```

5. **Set up the database:**
```bash
# Run the SQL scripts in the sql/ directory
# Or use the migration script if available
```

6. **Start the development server:**
```bash
npm run dev
```

7. **Open [http://localhost:3000](http://localhost:3000) in your browser**

## 🎯 How to Use

1. **Sign Up/Login**: Create an account or sign in
2. **Select Genre**: Choose from 5 authentic 90s R&B subgenres
3. **Pick Style**: Select the musical style and mood
4. **Add Prompt**: Customize with specific details (optional)
5. **Generate**: Click to create your unique 90s R&B track
6. **Play & Download**: Listen to your creation and save it
7. **Manage Library**: Organize your tracks and pin favorites

## 🎼 Supported Genres

| Genre | Description |
|-------|-------------|
| **New Jack Swing** | Fusion of R&B, hip hop, and dance-pop with swing beats |
| **Hip-Hop Soul** | R&B with hip-hop influenced beats and urban production |
| **Contemporary R&B** | Modern R&B with sophisticated production and smooth vocals |
| **Quiet Storm** | Smooth, mellow R&B perfect for late-night listening |
| **Neo-Soul** | Soulful R&B with jazz and funk influences |

## 🎭 Available Styles

- **Smooth & Soulful** - Classic R&B with rich vocals
- **Upbeat & Energetic** - Danceable tracks with driving beats
- **Romantic & Intimate** - Love songs and ballads
- **Urban & Street** - Hip-hop influenced R&B
- **Jazz-Influenced** - Sophisticated arrangements with jazz elements

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **UI Components**: Shadcn/ui, Tailwind CSS
- **Database**: PostgreSQL with Neon
- **Authentication**: Supabase Auth
- **Storage**: Cloudflare R2
- **API**: Suno API via Kie.ai
- **Audio**: HTML5 Audio API with custom player
- **Icons**: Lucide React
- **Styling**: Tailwind CSS with custom animations

## 📁 Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── generate-music/ # Music generation
│   │   ├── generate-cover/ # Cover generation
│   │   ├── generate-lyrics/ # Lyrics generation
│   │   ├── music-status/   # Status checking
│   │   └── user-music/     # User library
│   ├── studio/            # Music studio page
│   ├── explore/           # Community tracks
│   └── blog/              # Blog posts
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   ├── layout/           # Layout components
│   └── icons/            # Custom icons
├── lib/                  # Utilities and services
│   ├── music-api.ts      # Suno API service
│   ├── supabase.ts       # Supabase client
│   ├── neon.ts           # Database connection
│   └── r2-storage.ts     # File storage
├── hooks/                # Custom React hooks
├── contexts/             # React contexts
├── types/                # TypeScript definitions
└── public/               # Static assets
```

## 🔧 API Configuration

### Suno API Setup

1. Sign up at [Kie.ai](https://kie.ai)
2. Get your API key
3. Add it to your environment variables

### Database Setup

1. Create a PostgreSQL database (Neon recommended)
2. Run the SQL scripts in the `sql/` directory
3. Update your `DATABASE_URL` environment variable

### Supabase Setup

1. Create a Supabase project
2. Enable authentication
3. Set up your database tables
4. Add your Supabase credentials to environment variables

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect to Vercel
3. Add all environment variables
4. Deploy

### Environment Variables for Production

Make sure to set all required environment variables in your deployment platform:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUNO_API_KEY`
- `R2_*` (if using R2 storage)

## 🎨 Customization

You can customize the application by editing:

- **Genres & Styles**: `data/music-options.json`
- **UI Components**: `components/ui/`
- **API Logic**: `lib/music-api.ts`
- **Database Schema**: `sql/` directory

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Powered by [Suno API](https://docs.kie.ai/suno-api/quickstart)
- Built with [Shadcn/ui](https://ui.shadcn.com/)
- Database hosted on [Neon](https://neon.tech/)
- Storage powered by [Cloudflare R2](https://www.cloudflare.com/products/r2/)
- Authentication by [Supabase](https://supabase.com/)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

If you have any questions or need help, please:

1. Check the [Issues](https://github.com/nasirannn/rnb-music-gen/issues) page
2. Create a new issue if your problem isn't already addressed
3. Contact us for support

---

**Made with ❤️ for 90s R&B music lovers**

*Bringing back the golden era of R&B, one AI-generated track at a time.*