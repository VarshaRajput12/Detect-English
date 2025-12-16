// Speech Recognition Hook
import { useEffect, useRef, useState } from 'react';

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);

  // Check browser support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const IS_SUPPORTED = !!SpeechRecognition;

  useEffect(() => {
    if (!SpeechRecognition) {
      console.error('Speech Recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [SpeechRecognition]);

  const startListening = (onChunk, onPause) => {
    if (!recognitionRef.current) return;

    setTranscript('');
    setInterimTranscript('');
    setIsListening(true);

    let lastFinalTranscript = '';
// =========================================================
    recognitionRef.current.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        const newTranscript = lastFinalTranscript + ' ' + final;
        lastFinalTranscript = newTranscript;
        setTranscript(newTranscript.trim());
        
        // Call onChunk with new speech
        if (onChunk && final.trim()) {
          onChunk(final.trim());
        }

        // Reset silence timer
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (onPause) {
            onPause();
          }
        }, 1500); // 1.5 second pause detection
      }

      setInterimTranscript(interim);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Restart recognition if no speech detected
        setTimeout(() => {
          if (isListening) {
            recognitionRef.current.start();
          }
        }, 100);
      }
    };

    recognitionRef.current.onend = () => {
      if (isListening) {
        // Restart if still in listening mode
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error('Error restarting recognition:', e);
        }
      }
    };

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error('Error starting recognition:', e);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      setIsListening(false);
      clearTimeout(silenceTimerRef.current);
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
  };

  const resetTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: IS_SUPPORTED
  };
};
