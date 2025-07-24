'use client';
import { useAudio } from '@/contexts/AudioContext';
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

export default function AudioWaveform({ src }: { src: string }) {
  const { audioRef, isPlaying, volume, setVolume, toggle } = useAudio();
  const { dataArray, initializeAudio } = useAudioVisualizer(src);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [volumeArray, setVolumeArray] = useState([0.5]);

  // Fix SSR issue
  useEffect(() => {
    setIsClient(true);
    setVolumeArray([volume]);
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volumeArray[0];
      setVolume(volumeArray[0]);
    }
  }, [volumeArray, audioRef, setVolume]);

  // Set up audio event listeners
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    const handleCanPlay = () => setIsAudioReady(true);
    const handleLoadStart = () => setIsAudioReady(false);

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
  }, [audioRef]);

  const togglePlayPause = async () => {
    if (!audioRef.current) return;

    try {
      await initializeAudio();
      toggle();
    } catch (error) {
      console.warn('Playback failed:', error);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    setVolumeArray(newVolume);
  };

  // Auto-play setup with user interaction requirement
  useEffect(() => {
    if (!audioRef.current || !isClient) return;

    const handleFirstInteraction = async () => {
      try {
        await initializeAudio();
        if (audioRef.current && audioRef.current.readyState >= 2) {
          await audioRef.current.play();
        }
      } catch (error) {
        console.warn('Auto-play failed:', error);
      }
    };

    // Try to auto-play after first user interaction
    const events = ['click', 'touchstart', 'keydown'];
    const addListeners = () => {
      events.forEach(event => {
        document.addEventListener(event, handleFirstInteraction, { once: true });
      });
    };

    addListeners();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleFirstInteraction);
      });
    };
  }, [isClient, initializeAudio]);

  // Don't render anything until we're on the client
  if (!isClient) {
    return null;
  }

  // Create bars from the frequency data - take every 2nd element to reduce count
  const bars = Array.from({ length: 64 }, (_, i) => {
    const dataIndex = i * 2;
    return dataArray[dataIndex] || 50; // fallback value
  });

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        loop
        className="hidden"
        preload="auto"
        crossOrigin="anonymous"
      />

      {/* Waveform - Behind all content */}
      <div className="fixed bottom-0 left-0 w-full h-40 flex items-end gap-[2px] z-0 pointer-events-none px-2">
        {/* Gradient overlay for smooth blend */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-background/50" />
        {bars.map((value, i) => {
          const height = Math.max((value / 255) * 300, 3);
          return (
            <motion.div
              key={i}
              style={{ height: `${height}%` }}
              className="flex-1 bg-gradient-to-t from-[var(--accent)]/60 via-[var(--accent)]/40 to-[var(--accent)]/20 rounded-t-sm"
              animate={{
                height: `${height}%`,
                opacity: [0.4, 0.8, 0.4],
                scaleY: [0.9, 1.1, 0.9],
              }}
              transition={{
                height: { duration: 0.1 },
                opacity: { duration: 0.5, repeat: Infinity },
                scaleY: { duration: 0.5, repeat: Infinity, delay: i * 0.02 },
              }}
            />
          );
        })}
      </div>

      {/* Audio Controls */}
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
        initial={{ opacity: 0.7 }}
        whileHover={{ opacity: 1 }}
      >
        <div className="bg-[var(--card)]/90 backdrop-blur-xl border-2 border-[var(--accent)]/30 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center gap-4">
            {/* Play/Pause Button */}
            <Button
              onClick={togglePlayPause}
              variant="ghost"
              size="sm"
              disabled={!isAudioReady}
              className="w-12 h-12 rounded-full bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40 border-2 border-[var(--accent)]/50 hover:border-[var(--accent)] transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <motion.div
                animate={{ rotate: isPlaying ? 0 : 180 }}
                transition={{ duration: 0.3 }}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-[var(--accent)]" />
                ) : (
                  <Play className="w-5 h-5 text-[var(--accent)]" />
                )}
              </motion.div>
            </Button>

            <AnimatePresence>
              {showControls && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-3 overflow-hidden"
                >
                  {/* Mute Button */}
                  <Button
                    onClick={toggleMute}
                    variant="ghost"
                    size="sm"
                    className="w-10 h-10 rounded-full hover:bg-[var(--accent)]/20 transition-all duration-300"
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-[var(--accent)]" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-[var(--accent)]" />
                    )}
                  </Button>

                  {/* Volume Slider */}
                  <div className="w-24">
                    <Slider
                      value={volumeArray}
                      onValueChange={handleVolumeChange}
                      max={1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  {/* Volume Percentage */}
                  <span className="text-xs text-[var(--accent)] font-mono min-w-[3ch]">
                    {Math.round(volumeArray[0] * 100)}%
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Now Playing Info */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-3 pt-3 border-t border-[var(--accent)]/20 overflow-hidden"
              >
                <div className="text-xs text-muted-foreground">Now Playing:</div>
                <div className="text-sm text-[var(--accent)] font-semibold truncate">
                  MrSuicideSheep - Best of 2023 Mix
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1 h-3 bg-[var(--accent)]/60 rounded-full"
                        animate={{
                          scaleY: [0.5, 1.5, 0.5],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-[var(--accent)]/80">
                    {!isAudioReady ? 'Loading...' : isPlaying ? 'Playing' : 'Paused'}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Floating music notes */}
      {isPlaying && (
        <div className="fixed inset-0 pointer-events-none z-10">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-[var(--accent)]/20 text-2xl"
              initial={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
                y: typeof window !== 'undefined' ? window.innerHeight + 50 : 1000,
                rotate: 0,
                scale: 0
              }}
              animate={{
                y: -50,
                rotate: 360,
                scale: [0, 1, 0],
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              }}
              transition={{
                duration: 8 + Math.random() * 4,
                repeat: Infinity,
                delay: i * 2,
                ease: "linear"
              }}
            >
              {['♪', '♫', '♬', '♩'][Math.floor(Math.random() * 4)]}
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}
