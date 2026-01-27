// Speech Recognition Hook
import { useEffect, useRef, useState } from "react";

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);

  // Check browser support
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const IS_SUPPORTED = !!SpeechRecognition;

  useEffect(() => {
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [SpeechRecognition]);

  const startListening = (onChunk, onPause) => {
    if (!recognitionRef.current) return;

    setTranscript("");
    setInterimTranscript("");
    setIsListening(true);

    let lastFinalTranscript = "";
    let processedResultsCount = 0; // Track processed results to prevent duplicates
    // =========================================================
    recognitionRef.current.onresult = (event) => {
      let interim = "";
      let final = "";
      let newFinalResults = "";

      // Process all results, but only accumulate final results we haven't seen yet
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          // Only add this result if we haven't processed it before
          if (i >= processedResultsCount) {
            newFinalResults += result[0].transcript + " ";
            processedResultsCount = i + 1;
          }
        } else {
          // For interim results, always get the latest
          interim += result[0].transcript;
        }
      }

      if (newFinalResults.trim()) {
        lastFinalTranscript = lastFinalTranscript + " " + newFinalResults;
        setTranscript(lastFinalTranscript.trim());

        // Call onChunk with new speech
        if (onChunk && newFinalResults.trim()) {
          onChunk(newFinalResults.trim());
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
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech") {
        // Restart recognition if no speech detected
        setTimeout(() => {
          if (isListening) {
            processedResultsCount = 0; // Reset counter on restart
            recognitionRef.current.start();
          }
        }, 100);
      }
    };

    recognitionRef.current.onend = () => {
      if (isListening) {
        // Restart if still in listening mode
        try {
          processedResultsCount = 0; // Reset counter on restart
          recognitionRef.current.start();
        } catch (e) {
          console.error("Error restarting recognition:", e);
        }
      }
    };

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Error starting recognition:", e);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      setIsListening(false);
      clearTimeout(silenceTimerRef.current);
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Error stopping recognition:", e);
      }
    }
  };

  const resetTranscript = () => {
    setTranscript("");
    setInterimTranscript("");
  };

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: IS_SUPPORTED,
  };
};
