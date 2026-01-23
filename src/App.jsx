import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { 
  generateFillerPhrase, 
  generateQASummary, 
  generateFinalSummary,
  checkOllamaConnection 
} from './services/ollamaService';
import InterviewPanel from './components/InterviewPanel';
import MetricsDisplay from './components/MetricsDisplay';
import SummaryDisplay from './components/SummaryDisplay';
import questionsData from './data/questions.json';

function App() {
  // Interview state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [finalSummary, setFinalSummary] = useState(null);
  const [interviewComplete, setInterviewComplete] = useState(false);
  
  // UI state
  const [lastFiller, setLastFiller] = useState('');
  const [fillerHistory, setFillerHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [ttsInitialized, setTtsInitialized] = useState(false);
  
  // Rate limiting for API calls
  const lastFillerTimeRef = useRef(0);
  const FILLER_COOLDOWN_MS = 5000; // Only generate filler every 5 seconds
  
  // Metrics
  const [metrics, setMetrics] = useState({
    loadTime: null,
    avgResponseTime: 0,
    lastResponseTime: 0,
    fillerCount: 0,
    questionsAnswered: 0,
    totalQuestions: questionsData.length,
    ollamaConnected: false
  });

  // Hooks
  const { 
    isListening, 
    transcript, 
    interimTranscript, 
    startListening, 
    stopListening, 
    resetTranscript,
    isSupported: speechRecognitionSupported 
  } = useSpeechRecognition();

  const { 
    speakQuestion, 
    speakFiller, 
    isSpeaking,
    isSupported: speechSynthesisSupported 
  } = useSpeechSynthesis();

  // Check Ollama connection on mount
  useEffect(() => {
    const startTime = performance.now();
    
    const checkConnection = async () => {
      const connected = await checkOllamaConnection();
      const loadTime = Math.round(performance.now() - startTime);
      
      setOllamaConnected(connected);
      setMetrics(prev => ({ 
        ...prev, 
        ollamaConnected: connected,
        loadTime 
      }));

      if (!connected) {
        console.warn('⚠️ AI service connection check failed. The app will still attempt to use the API when needed.');
      }
    };

    checkConnection();
  }, []);

  // Initialize TTS on first user interaction
  const initializeTTS = useCallback(() => {
    if (!ttsInitialized) {
      // Speak a silent phrase to initialize TTS (browser requirement)
      speakQuestion('').then(() => {
        setTtsInitialized(true);
        console.log('✅ TTS initialized');
      });
    }
  }, [ttsInitialized, speakQuestion]);

  // Speak current question on load (with user interaction)
  useEffect(() => {
    if (currentQuestionIndex < questionsData.length && ttsInitialized) {
      const question = questionsData[currentQuestionIndex];
      speakQuestion(question.question);
    }
  }, [currentQuestionIndex, ttsInitialized, speakQuestion]);

  // Handle speech chunks and generate fillers
  const handleSpeechChunk = useCallback(async (chunk) => {
    if (!chunk || chunk.length < 10) return; // Ignore very short chunks

    // Rate limiting: prevent too many API calls
    const now = Date.now();
    const timeSinceLastFiller = now - lastFillerTimeRef.current;
    
    if (timeSinceLastFiller < FILLER_COOLDOWN_MS) {
      console.log(`⏱️ Rate limited: waiting ${Math.round((FILLER_COOLDOWN_MS - timeSinceLastFiller) / 1000)}s before next filler`);
      return;
    }

    lastFillerTimeRef.current = now;
    const startTime = performance.now();
    
    try {
      const currentQuestion = questionsData[currentQuestionIndex];
      const filler = await generateFillerPhrase(chunk, currentQuestion.question);
      
      const responseTime = Math.round(performance.now() - startTime);
      
      setLastFiller(filler);
      setFillerHistory(prev => [...prev, { text: filler, timestamp: new Date().toISOString(), chunk }]);
      setMetrics(prev => ({
        ...prev,
        fillerCount: prev.fillerCount + 1,
        lastResponseTime: responseTime,
        avgResponseTime: Math.round((prev.avgResponseTime * prev.fillerCount + responseTime) / (prev.fillerCount + 1))
      }));

      // Play filler phrase
      await speakFiller(filler);
      
    } catch (error) {
      console.error('Error handling speech chunk:', error);
    }
  }, [currentQuestionIndex, speakFiller]);

  // Handle pause detection
  const handlePause = useCallback(() => {
    // Optional: trigger filler on pause
    console.log('⏸️ Pause detected');
  }, []);

  // Start answering
  const handleStartAnswer = () => {
    // Initialize TTS if not already done
    if (!ttsInitialized) {
      initializeTTS();
      setTtsInitialized(true);
    }
    
    resetTranscript();
    setLastFiller('');
    startListening(handleSpeechChunk, handlePause);
  };

  // Stop answering
  const handleStopAnswer = async () => {
    stopListening();
    setIsProcessing(true);

    try {
      const currentQuestion = questionsData[currentQuestionIndex];
      const answer = transcript;

      // Save Q&A
      const qa = {
        question: currentQuestion.question,
        answer: answer
      };
      setAnswers(prev => [...prev, qa]);

      // Generate Q&A summary
      const startTime = performance.now();
      const summary = await generateQASummary(currentQuestion.question, answer);
      const responseTime = Math.round(performance.now() - startTime);
      
      console.log('✅ Q&A Summary generated:', summary);
      
      setSummaries(prev => [...prev, summary]);
      setMetrics(prev => ({
        ...prev,
        questionsAnswered: prev.questionsAnswered + 1,
        lastResponseTime: responseTime
      }));

      // Check if interview is complete
      if (currentQuestionIndex === questionsData.length - 1) {
        console.log('🎯 Interview complete! Generating final summary...');
        console.log('📋 All answers:', [...answers, qa]);
        console.log('📝 All summaries:', [...summaries, summary]);
        
        // Generate final summary - include current qa with previous answers
        const allQAs = [...answers, qa];
        const allSummaries = [...summaries, summary];
        const final = await generateFinalSummary(allQAs, allSummaries);
        
        console.log('✅ Final summary generated:', final);
        
        setFinalSummary(final);
        setInterviewComplete(true);
      }

    } catch (error) {
      console.error('❌ Error processing answer:', error);
      alert('Error processing answer. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Next question
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questionsData.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      resetTranscript();
      setLastFiller('');
    }
  };

  // Check browser support
  if (!speechRecognitionSupported) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-800 mb-2">❌ Browser Not Supported</h2>
          <p className="text-red-700">
            Your browser doesn't support Web Speech API. Please use Chrome, Edge, or Safari.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🤖 AI Voice Interview System
          </h1>
          <p className="text-gray-600">
            Ultra-lightweight client-side AI with real-time filler phrases
          </p>
          {!ollamaConnected && (
            <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 inline-block">
              <span className="text-yellow-800 text-sm font-semibold">
                ⚠️ Ollama not connected - Using fallback responses
              </span>
            </div>
          )}
        </div>

        {/* Metrics */}
        <MetricsDisplay metrics={metrics} />

        {/* Interview Panel */}
        <InterviewPanel
          currentQuestion={questionsData[currentQuestionIndex]}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={questionsData.length}
          transcript={transcript}
          interimTranscript={interimTranscript}
          isListening={isListening}
          lastFiller={lastFiller}
          fillerHistory={fillerHistory}
          onStart={handleStartAnswer}
          onStop={handleStopAnswer}
          onNext={handleNextQuestion}
          isProcessing={isProcessing}
          interviewComplete={interviewComplete}
        />

        {/* Summaries */}
        <SummaryDisplay 
          summaries={summaries} 
          finalSummary={finalSummary} 
        />

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 mt-8">
          <p>Powered by Ollama (qwen:0.5b) • Web Speech API • React</p>
          <p className="mt-1">Client-side AI • Fully Offline • Real-time Processing</p>
        </div>
      </div>
    </div>
  );
}

export default App;
