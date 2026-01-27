// Speech Recognition Hook
import { useEffect, useRef, useState } from "react";

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const finalTranscriptRef = useRef(""); // Track accumulated final transcript

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
    recognition.maxAlternatives = 1;

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
    finalTranscriptRef.current = ""; // Reset accumulated transcript

    let processedFinalTexts = new Set(); // Track processed final texts to prevent duplicates on Android
    // =========================================================
    recognitionRef.current.onresult = (event) => {
      let interimText = "";

      // Process only NEW final results by checking against our set
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();

        if (result.isFinal && text) {
          // Check if we've already processed this exact text
          if (!processedFinalTexts.has(text)) {
            processedFinalTexts.add(text);

            // Add to accumulated transcript
            if (finalTranscriptRef.current) {
              finalTranscriptRef.current += " " + text;
            } else {
              finalTranscriptRef.current = text;
            }

            // Update UI
            setTranscript(finalTranscriptRef.current);

            // Send chunk to handler
            if (onChunk) {
              onChunk(text);
            }

            // Reset silence timer
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (onPause) {
                onPause();
              }
            }, 1500);
          }
        } else if (!result.isFinal) {
          // This is interim - just display it
          interimText += result[0].transcript;
        }
      }

      // Always update interim text display
      setInterimTranscript(interimText);
    };

    recognitionRef.current.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech" || event.error === "aborted") {
        // Restart recognition if no speech detected
        setTimeout(() => {
          if (isListening) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error("Error restarting after error:", e);
            }
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
    finalTranscriptRef.current = ""; // Also reset the ref
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
