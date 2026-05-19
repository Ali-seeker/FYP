import React, { useState, useEffect, useRef, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const AssistantInterface = ({ onActionSuccess }) => {
  const { user } = useContext(AuthContext);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [response, setResponse] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorStatus("Your browser does not support Speech Recognition. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true; // show live transcript while speaking
    recognition.lang = ''; // auto-detect language

    recognition.onstart = () => {
      setIsListening(true);
      setErrorStatus(null);
      setTranscript('');
      setTranslatedText('');
      setResponse(null);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Show live transcript (interim or final)
      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        handleFinalTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'no-speech') {
        setErrorStatus("No speech detected. Please try again.");
      } else {
        setErrorStatus("Error listening. Please try again.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const handleFinalTranscript = async (text) => {
    setIsProcessing(true);
    try {
      // Detect if Urdu (contains Urdu unicode range) or just transliterated Urdu
      const hasUrduScript = /[\u0600-\u06FF]/.test(text);
      
      let commandText = text;

      if (hasUrduScript) {
        // Translate Urdu → English using MyMemory (free, no API key)
        try {
          const encoded = encodeURIComponent(text);
          const transRes = await axios.get(
            `https://api.mymemory.translated.net/get?q=${encoded}&langpair=ur|en`
          );
          const translated = transRes.data?.responseData?.translatedText;
          if (translated) {
            commandText = translated;
            setTranslatedText(translated);
          }
        } catch (transErr) {
          console.warn("Translation failed, using original text", transErr);
        }
      }

      await processCommandWithBackend(commandText);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleListen = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const processCommandWithBackend = async (text) => {
    try {
      const res = await axios.post(
        'http://localhost:5000/api/assistant/command',
        { command: text },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );
      const data = res.data;

      if (data.success) {
        setResponse(data.textResponse);
        speakOut(data.textResponse);
        onActionSuccess();
      } else {
        setErrorStatus(data.textResponse || "Failed to process command.");
        speakOut(data.textResponse || "There was an error.");
      }
    } catch (err) {
      console.error(err);
      setErrorStatus("Server error or unknown intent.");
      speakOut("I encountered a system error.");
    }
  };

  const speakOut = (text) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="glass-panel assistant-panel fade-in">
      <h2>AI Assistant</h2>
      <p className="status-text">
        {isListening ? '🎙️ Listening...' : isProcessing ? '⏳ Processing...' : 'Tap the mic to speak'}
      </p>

      {/* Mic Button */}
      <button
        className={`mic-button ${isListening ? 'listening' : ''}`}
        onClick={toggleListen}
        disabled={isProcessing || (!recognitionRef.current && !errorStatus)}
      >
        <svg className="mic-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </button>

      {/* Live transcript below mic */}
      {transcript && (
        <div className="transcript-box fade-in" style={{ marginTop: '12px', textAlign: 'center' }}>
          <span style={{ opacity: 0.6, fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>You said:</span>
          {transcript}
        </div>
      )}

      {/* Translated text if Urdu was detected */}
      {translatedText && (
        <div className="transcript-box fade-in" style={{ marginTop: '8px', textAlign: 'center', borderColor: 'var(--accent)' }}>
          <span style={{ opacity: 0.6, fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>Translated (EN):</span>
          {translatedText}
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="response-box fade-in">
          <strong>System:</strong> {response}
        </div>
      )}

      {/* Error */}
      {errorStatus && (
        <div className="error-box fade-in">
          {errorStatus}
        </div>
      )}

      <p style={{ fontSize: '0.72rem', opacity: 0.45, marginTop: '16px', textAlign: 'center', lineHeight: 1.5 }}>
        Supports English &amp; Urdu. Speak naturally — e.g. "sell 2 milk" or "دودھ بیچو"
      </p>
    </div>
  );
};

export default AssistantInterface;
