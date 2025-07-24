'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AudioWaveform from '@/components/AudioWaveform';
import { useRouter } from 'next/navigation';
import { useAudio } from '@/contexts/AudioContext';

type Asset = {
  id: string;
  name: string;
  image: string;
  description: string;
  category?: string;
  price?: string;
};

const AVATAR_SCREENSHOTS = [
  '/avatars/avatar1.png',
  '/avatars/avatar2.png',
  '/avatars/avatar3.png',
];

const FLOATING_EMOJIS = ['✨', '💅', '🔥', '💎', '🌟', '💫', '🦄', '👑'];

export default function HomePage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const { toggle, isPlaying, volume, setVolume } = useAudio();

  useEffect(() => {
    setIsClient(true);
    fetch('/assets.json')
      .then(r => r.json())
      .then(setAssets);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isClient]);

  const filteredAssets = selectedCategory === 'all'
    ? assets
    : assets.filter(a => a.category === selectedCategory);

  return (
    <main className="relative min-h-screen px-6 py-12 bg-gradient-to-br from-background via-background/95 to-[var(--accent)]/5 text-foreground overflow-x-hidden">
      {/* Animated cursor glow - Only render on client */}
      {isClient && (
        <div
          className="fixed w-96 h-96 rounded-full bg-[var(--accent)]/10 blur-3xl pointer-events-none z-0 transition-all duration-300 ease-out"
          style={{
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
          }}
        />
      )}

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none z-10">
        {FLOATING_EMOJIS.map((emoji, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl opacity-20"
            animate={{
              y: [0, -20, 0],
              x: [0, Math.sin(i) * 10, 0],
              rotate: [0, 360],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              delay: i * 0.5,
            }}
            style={{
              left: `${10 + (i * 12)}%`,
              top: `${20 + (i * 8)}%`,
            }}
          >
            {emoji}
          </motion.div>
        ))}
      </div>

      {/* Enhanced sparkle BG with animation */}
      <div className="absolute inset-0 -z-10 opacity-5">
        <div className="absolute inset-0 bg-[url('/sparkles.svg')] bg-cover animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 via-transparent to-[var(--accent)]/5 animate-pulse" />
      </div>

      {/* Audio Waveform - Behind everything - Only render on client */}
      {isClient && <AudioWaveform src="/music/MrSuicideSheep_Best_of_2023_Music_Mix.mp3" />}

      {/* Enhanced Marquee with proper gradient borders */}
      <div className="relative overflow-hidden mb-8 bg-[var(--accent)]/5 backdrop-blur-sm rounded-lg">
        {/* Top gradient border */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />

        {/* Marquee content */}
        <div className="relative py-4 px-4">
          <div className="animate-marquee text-[var(--accent)] font-mono text-lg tracking-[0.3em] uppercase font-bold whitespace-nowrap">
            <span className="inline-block mx-8">💅 DABZ DESIGNS</span>
            <span className="inline-block mx-8">·</span>
            <span className="inline-block mx-8">SL BADDIES ONLY</span>
            <span className="inline-block mx-8">·</span>
            <span className="inline-block mx-8">ASSETS MADE WITH LOVE</span>
            <span className="inline-block mx-8">·</span>
            <span className="inline-block mx-8">🔊 TURN THE MUSIC UP</span>
            <span className="inline-block mx-8">·</span>
            <span className="inline-block mx-8">PREMIUM QUALITY</span>
            <span className="inline-block mx-8">·</span>
            <span className="inline-block mx-8">EXCLUSIVE DROPS</span>
            <span className="inline-block mx-8">💅</span>
          </div>

          {/* Fade edges */}
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
        </div>

        {/* Bottom gradient border */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
      </div>


      {/* Enhanced Hero with more animations */}
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="text-center space-y-6 relative z-20"
      >
        <motion.div
          animate={{
            textShadow: [
              "0 0 20px var(--accent)",
              "0 0 40px var(--accent)",
              "0 0 20px var(--accent)"
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <h1 className="text-7xl md:text-8xl font-black tracking-tight text-[var(--accent)] drop-shadow-2xl bg-gradient-to-r from-[var(--accent)] via-[var(--accent)]/80 to-[var(--accent)] bg-clip-text">
            DABZ's Second Life Assets
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
        >
          Clothing, accessories, in-world screenshots and more. Welcome to my curated world of SL chaos & Catppuccin glow. ✨
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex justify-center gap-4 mt-8 flex-wrap"
        >
          {['all', 'tops', 'bottoms', 'accessories', 'set', 'body'].map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className={`
                border-2 border-[var(--accent)] text-[var(--accent)] 
                hover:bg-[var(--accent)] hover:text-[var(--background)] 
                transition-all duration-300 hover:scale-105 hover:shadow-lg
                ${selectedCategory === category ? 'bg-[var(--accent)] text-[var(--background)] shadow-lg' : ''}
                px-6 py-2 font-semibold uppercase tracking-wide
              `}
            >
              {category}
            </Button>
          ))}
        </motion.div>
      </motion.div>



      {/* Enhanced Screenshot Gallery */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="mt-24 text-center space-y-8 relative z-20"
      >
        <motion.h2
          className="text-4xl font-bold text-[var(--accent)] relative"
          whileHover={{ scale: 1.05 }}
        >
          Avatars / In-Game Screenshots
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
        </motion.h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {AVATAR_SCREENSHOTS.map((src, i) => (
            <motion.div
              key={src}
              initial={{ opacity: 0, scale: 0.8, rotateY: 90 }}
              whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
              whileHover={{
                scale: 1.05,
                rotateY: 5,
                boxShadow: "0 20px 40px rgba(var(--accent-rgb), 0.3)"
              }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="group relative rounded-2xl overflow-hidden shadow-xl border-2 border-[var(--accent)]/30 hover:border-[var(--accent)] transition-all duration-300"
            >
              <img src={src} alt={`Avatar ${i + 1}`} className="w-full h-56 object-cover transition-transform duration-300 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-4 left-4 text-white font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Avatar {i + 1}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Enhanced Assets Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-24 relative z-20"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCategory}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredAssets.map((a, index) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 30, rotateX: 45 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                whileHover={{
                  y: -10,
                  rotateY: 5,
                  boxShadow: "0 25px 50px rgba(var(--accent-rgb), 0.2)"
                }}
                transition={{ delay: 0.1 * index, duration: 0.6 }}
                className="group"
              >
                <Card className="bg-[var(--card)]/80 border-2 border-[var(--accent)]/30 backdrop-blur-xl shadow-2xl hover:shadow-[0_0_30px_rgba(var(--accent-rgb),0.3)] transition-all duration-500 hover:scale-[1.02] rounded-3xl overflow-hidden relative z-20">
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 via-transparent to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <CardHeader className="p-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10" />
                    <img
                      src={a.image}
                      alt={a.name}
                      className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute top-4 right-4 bg-[var(--accent)]/90 text-[var(--background)] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide z-20">
                      {a.category || 'New'}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 p-6 relative z-10">
                    <CardTitle className="text-2xl text-[var(--accent)] font-bold group-hover:text-[var(--accent)]/80 transition-colors">
                      {a.name}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground text-sm leading-relaxed">
                      {a.description}
                    </CardDescription>
                    {a.price && (
                      <div className="text-[var(--accent)] font-bold text-lg">
                        L$ {a.price}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="p-6 pt-0 relative z-30">
                  <Button
                    variant="ghost"
                    onClick={() => router.push(`/details/${a.id}`)}
                    className="w-full text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all duration-300 font-semibold border border-[var(--accent)]/30 hover:border-[var(--accent)] rounded-xl relative z-40 cursor-pointer"
                  >
                    View Details ✨
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Enhanced Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="mt-32 border-t-2 border-[var(--accent)]/30 pt-8 text-center relative z-20"
      >
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            made with ✦ catppuccin, shadcn, and too many hours in SL
          </div>
          <div className="text-[var(--accent)] font-bold">
            dabz.dev · Premium SL Assets · Est. 2024
          </div>
        </div>
      </motion.footer>
    </main>
  );
}

