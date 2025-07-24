'use client';
import React, { createContext, useContext, useRef, useState, useEffect } from 'react';

interface AudioContextType {
    audioRef: React.RefObject<HTMLAudioElement>;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    setVolume: (volume: number) => void;
    play: () => void;
    pause: () => void;
    toggle: () => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.5);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        // Auto-play when loaded
        const handleCanPlay = () => {
            audio.play().catch(console.error);
        };

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('canplay', handleCanPlay);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('canplay', handleCanPlay);
        };
    }, []);

    const play = () => audioRef.current?.play();
    const pause = () => audioRef.current?.pause();
    const toggle = () => isPlaying ? pause() : play();

    const handleVolumeChange = (newVolume: number) => {
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    };

    return (
        <AudioContext.Provider value={{
            audioRef,
            isPlaying,
            currentTime,
            duration,
            volume,
            setVolume: handleVolumeChange,
            play,
            pause,
            toggle
        }}>
            {children}
            <audio
                ref={audioRef}
                src="/music/MrSuicideSheep_Best_of_2023_Music_Mix.mp3"
                loop
                preload="auto"
                volume={volume}
            />
        </AudioContext.Provider>
    );
}

export const useAudio = () => {
    const context = useContext(AudioContext);
    if (!context) {
        throw new Error('useAudio must be used within AudioProvider');
    }
    return context;
};