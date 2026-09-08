# MatZero

**MatZero** is a modern BJJ Progression Tracker & Scouting Engine built for Brazilian Jiu-Jitsu practitioners and academies.

## Features
- **Progressive Web App (PWA)**: Installable directly from the browser on desktop, iOS, and Android as **MatZero**.
- **Production Domain**: [https://matzeroapp.com](https://matzeroapp.com)
- **Training Log Notebook**: Structured tracking of training modalities, rounds, techniques, positional transitions, and partners.
- **Academy Kiosk & Staff Deck**: Tablet check-in kiosk and academy management hub for instructors and gym admins.
- **Video & Technique Dictionary**: Official curriculum database with video linking and customizable personal technique libraries.
- **Cryptographic Partner Handshake**: Instant profile and training card sharing via offline/online QR code handshakes.
- **Cross-Platform Mobile**: Native Android and iOS integration powered by Capacitor.

## Tech Stack
- **Framework**: Next.js 15 (App Router, React 19)
- **Styling**: Tailwind CSS with dynamic day/night brightness and multi-color theme support
- **Backend & Database**: Supabase (PostgreSQL, Row-Level Security, Edge Functions, Auth)
- **Mobile Runtime**: Capacitor 8 (Android & iOS)

## Getting Started
1. Clone the repository:
   ```bash
   git clone https://github.com/kodiaksoul/matzero.git
   cd matzero
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Run development server:
   ```bash
   npm run dev
   ```
