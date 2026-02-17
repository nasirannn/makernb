# MakerNB

**MakerNB** is an AI-powered smart music generation platform that creates personalized, creative, and professional-quality R&B music in seconds. It supports multiple R&B music styles from New Jack Swing to Contemporary R&B, Hip-Hop Soul to Neo-Soul, providing a one-stop music creation solution for music lovers and creators.

## ✨ Features

- **🎵 AI Music Generation** - Create authentic R&B tracks using advanced AI technology
- **🎭 Multiple Genres** - New Jack Swing, Hip-Hop Soul, Contemporary R&B, Quiet Storm, Neo-Soul
- **🎨 Custom Prompts** - Customize your music generation with detailed descriptions
- **🖼️ AI Cover Generation** - Automatically generate beautiful cover art for your tracks
- **📝 Lyrics Generation** - AI-powered intelligent lyrics creation
- **🎧 Real-time Playback** - Built-in audio player with waveform visualization
- **📚 Music Library** - Organize and manage your music collection
- **🔍 Explore Community** - Discover and listen to community-created music
- **💾 Download & Save** - Easily save and share your favorite tracks
- **📱 Responsive Design** - Seamlessly works on desktop and mobile devices
- **🎤 Vocal Separation Studio** - Professional vocal and instrumental separation
- **✂️ Audio Editing** - Upload audio and replace music sections

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (Neon)
- Supabase account
- KIE (Suno) API key from [Kie.ai](https://kie.ai)
- Cloudflare R2 account (optional)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/nasirannn/makernb.git
cd makernb
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
# Database (PostgreSQL / Neon)
DATABASE_URL=your_postgresql_connection_string

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# KIE API (Suno)
KIE_API_KEY=your_kie_api_key
KIE_API_BASE_URL=https://api.kie.ai
CallBackURL=https://yourdomain.com

# R2 Storage (optional)
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_r2_bucket_name
R2_PUBLIC_DOMAIN=https://your-cdn-domain.com

# Site / SEO (optional)
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
INDEXNOW_KEY=your_indexnow_key

# Payments (optional)
CREEM_API_KEY=your_creem_api_key
CREEM_WEBHOOK_SECRET=your_creem_webhook_secret
CREEM_API_BASE_URL=https://api.creem.io
NEXT_PUBLIC_MONTHLY_BASIC=your_monthly_basic_product_id
NEXT_PUBLIC_MONTHLY_PREMIUM=your_monthly_premium_product_id
NEXT_PUBLIC_YEARLY_BASIC=your_yearly_basic_product_id
NEXT_PUBLIC_YEARLY_PREMIUM=your_yearly_premium_product_id
```

5. **Set up the database:**
```bash
# Create the required tables in your PostgreSQL instance
# (schema/migrations are managed outside this repo)
```

6. **Start the development server:**
```bash
npm run dev
```

7. **Open [http://localhost:3000](http://localhost:3000) in your browser**

## 🎯 How to Use

1. **Sign Up/Login** - Create an account or sign in
2. **Select Genre** - Choose from 5 authentic R&B subgenres
3. **Pick Style** - Select the musical style and mood
4. **Add Prompt** - Customize with specific details (optional)
5. **Generate** - Click to create your unique R&B track
6. **Play & Download** - Listen to your creation and save it
7. **Manage Library** - Organize your tracks and pin favorites

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
- **Database**: PostgreSQL (Neon)
- **Authentication**: Supabase Auth
- **Storage**: Cloudflare R2
- **Music API**: Suno API (via Kie.ai)
- **Audio Processing**: HTML5 Audio API, WaveSurfer.js
- **Icons**: Lucide React
- **State Management**: Zustand
- **Styling**: Tailwind CSS with custom animations

## 📁 Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes (music, cover, lyrics, callbacks, billing)
│   ├── studio/            # Music studio page
│   ├── explore/           # Community tracks
│   └── blog/              # Blog posts
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   ├── layout/           # Layout components
│   └── icons/            # Custom icons
├── lib/                  # Utilities and services
│   ├── music-api.ts      # KIE/Suno API service
│   ├── supabase.ts       # Supabase client
│   ├── db-pool.ts        # Database connection pool (Neon)
│   └── r2-storage.ts     # File storage
├── hooks/                # Custom React hooks
├── contexts/             # React contexts
├── types/                # TypeScript definitions
└── public/               # Static assets
```

## 🔧 API Configuration

### KIE (Suno) API Setup

1. Sign up at [Kie.ai](https://kie.ai)
2. Get your API key
3. Add it to your environment variables
4. Set `CallBackURL` to your public base URL for callbacks

### Database Setup

1. Create a PostgreSQL database (Neon)
2. Apply your schema/migrations (not included in this repo)
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

- **Required**: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `KIE_API_KEY`, `CallBackURL`
- **Optional**: `KIE_API_BASE_URL`, `R2_*`, `NEXT_PUBLIC_BASE_URL`, `INDEXNOW_KEY`, `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET`, `CREEM_API_BASE_URL`, `NEXT_PUBLIC_MONTHLY_BASIC`, `NEXT_PUBLIC_MONTHLY_PREMIUM`, `NEXT_PUBLIC_YEARLY_BASIC`, `NEXT_PUBLIC_YEARLY_PREMIUM`, `CRON_SECRET`

## 🎨 Customization

You can customize the application by editing:

- **Genres & Styles**: `data/music-options.json`
- **UI Components**: `components/ui/`
- **API Logic**: `lib/music-api.ts`

## 📜 Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Code linting
npm run lint

# Physical deletion scripts
npm run physical-delete:preview  # Preview items to be deleted
npm run physical-delete:db-only  # Delete database records only
npm run physical-delete:r2-only  # Delete R2 storage files only
npm run physical-delete:execute  # Execute complete deletion
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Music Generation: [Suno API](https://docs.kie.ai/suno-api/quickstart)
- UI Components: [Shadcn/ui](https://ui.shadcn.com/)
- Database Hosting: [Neon](https://neon.tech/)
- File Storage: [Cloudflare R2](https://www.cloudflare.com/products/r2/)
- Authentication: [Supabase](https://supabase.com/)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

If you have any questions or need help, please:

1. Check the [Issues](https://github.com/nasirannn/makernb/issues) page
2. Create a new issue if your problem isn't already addressed
3. Contact us for support

---

**Made with ❤️ for R&B music lovers**

*MakerNB - Creating authentic R&B music with AI*
