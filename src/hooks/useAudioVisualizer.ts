'use client';
import { useRef, useEffect, useState, useCallback } from 'react';

export function useAudioVisualizer(src: string) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [dataArray, setDataArray] = useState<Uint8Array>(new Uint8Array(128).fill(50));
  const [isClient, setIsClient] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const isSetupRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const setupAudioContext = useCallback(() => {
    if (!audioRef.current || isSetupRef.current) return;

    try {
      // Create audio context with better browser compatibility
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();

      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      analyserRef.current = audioContextRef.current.createAnalyser();

      // Better analyzer settings for reliability
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.7;
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;

      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const newDataArray = new Uint8Array(bufferLength);
      setDataArray(newDataArray);

      isSetupRef.current = true;

      const updateFrequencyData = () => {
        if (analyserRef.current && audioContextRef.current?.state === 'running') {
          analyserRef.current.getByteFrequencyData(newDataArray);
          setDataArray(new Uint8Array(newDataArray));
        }
        animationRef.current = requestAnimationFrame(updateFrequencyData);
      };

      updateFrequencyData();
    } catch (error) {
      console.warn('Audio context setup failed:', error);
      // Fallback remains the same
      const fakeUpdate = () => {
        const fakeData = new Uint8Array(128);
        for (let i = 0; i < fakeData.length; i++) {
          fakeData[i] = Math.random() * 100 + 50;
        }
        setDataArray(fakeData);
        animationRef.current = requestAnimationFrame(fakeUpdate);
      };
      fakeUpdate();
    }
  }, []);

  const handleUserInteraction = useCallback(async () => {
    if (!audioContextRef.current) {
      setupAudioContext();
    }

    if (audioContextRef.current?.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
      }
    }
  }, [setupAudioContext]);

  const handleCanPlay = useCallback(() => {
    if (!isSetupRef.current) {
      setupAudioContext();
    }
  }, [setupAudioContext]);

  const handleLoadedData = useCallback(() => {
    if (!isSetupRef.current) {
      setupAudioContext();
    }
  }, [setupAudioContext]);

  useEffect(() => {
    if (!isClient || !audioRef.current) return;

    const audio = audioRef.current;

    // Multiple event listeners for better reliability
    audio.addEventListener('play', handleUserInteraction);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('click', handleUserInteraction);

    // Handle audio context state changes
    const handleVisibilityChange = () => {
      if (document.hidden && audioContextRef.current?.state === 'running') {
        audioContextRef.current.suspend();
      } else if (!document.hidden && audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Cleanup
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }

      audio.removeEventListener('play', handleUserInteraction);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // Reset refs
      isSetupRef.current = false;
      audioContextRef.current = null;
      sourceRef.current = null;
      analyserRef.current = null;
    };
  }, [isClient, src, handleUserInteraction, handleCanPlay, handleLoadedData]);

  // Helper function to manually trigger audio context setup
  const initializeAudio = useCallback(async () => {
    await handleUserInteraction();
  }, [handleUserInteraction]);

  return {
    audioRef,
    dataArray,
    initializeAudio // Export this so you can call it on user interaction
  };
}

