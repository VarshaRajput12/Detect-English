// Speech Recognition Hook
import { useEffect, useRef, useState } from "react";

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const finalTranscriptRef = useRef(""); // Track accumulated final transcript
  const processedFinalTextsRef = useRef(new Set()); // Persist across restarts to prevent duplicates
  const onChunkCallbackRef = useRef(null); // Store callback to avoid stale closures
  const onPauseCallbackRef = useRef(null); // Store pause callback

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

    // Set up event handlers that will use refs (avoiding stale closures)
    recognition.onresult = (event) => {
      let interimText = "";

      // Process only NEW final results by checking against our persisted set
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();

        if (result.isFinal && text) {
          // Check if we've already processed this exact text
          if (!processedFinalTextsRef.current.has(text)) {
            processedFinalTextsRef.current.add(text);

            // Add to accumulated transcript
            if (finalTranscriptRef.current) {
              finalTranscriptRef.current += " " + text;
            } else {
              finalTranscriptRef.current = text;
            }

            // Update UI
            setTranscript(finalTranscriptRef.current);

            // Send chunk to handler using the ref to get current callback
            if (onChunkCallbackRef.current) {
              onChunkCallbackRef.current(text);
            }

            // Reset silence timer
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (onPauseCallbackRef.current) {
                onPauseCallbackRef.current();
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

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech" || event.error === "aborted") {
        // Restart recognition if no speech detected
        setTimeout(() => {
          if (recognitionRef.current && isListening) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error("Error restarting after error:", e);
            }
          }
        }, 100);
      }
    };

    recognition.onend = () => {
      // Only restart if still in listening mode
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Error restarting recognition:", e);
        }
      }
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, [SpeechRecognition, isListening]);

  const startListening = (onChunk, onPause) => {
    if (!recognitionRef.current) return;

    setTranscript("");
    setInterimTranscript("");
    setIsListening(true);
    finalTranscriptRef.current = ""; // Reset accumulated transcript
    processedFinalTextsRef.current.clear(); // Clear processed texts for new session

    // Store callbacks in refs to avoid stale closures
    onChunkCallbackRef.current = onChunk;
    onPauseCallbackRef.current = onPause;

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

      // Clear callback refs
      onChunkCallbackRef.current = null;
      onPauseCallbackRef.current = null;

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
    processedFinalTextsRef.current.clear(); // Clear the processed texts set
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
