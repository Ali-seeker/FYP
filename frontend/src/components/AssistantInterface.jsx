import { useState, useRef, useContext, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useOfflineSync } from '../hooks/useOfflineSync';

const AssistantInterface = ({ onActionSuccess }) => {
  const { user } = useContext(AuthContext);
  const { isOnline } = useOfflineSync();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [confirmationData, setConfirmationData] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    // If we have a pending confirmation and unmount, we could clear it on backend, 
    // but HTTP is stateless mostly.
  }, []);

  const toggleRecording = async () => {
    if (!isOnline) {
      setErrorStatus("Voice AI is currently offline. Please use manual entry.");
      speakOut("Voice assistant is currently offline.");
      return;
    }

    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
             const base64Audio = reader.result.split(',')[1];
             processAudioWithBackend(base64Audio);
          };
          stream.getTracks().forEach(track => track.stop()); // cleanup
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        setErrorStatus(null);
        setResponse(null);
        setConfirmationData(null);
      } catch (err) {
        console.error("Mic access error", err);
        setErrorStatus("Microphone access denied or unavailable.");
      }
    }
  };

  const processAudioWithBackend = async (base64Audio) => {
    setIsProcessing(true);
    try {
      const res = await axios.post(
        'http://localhost:5000/api/assistant/command',
        { audioBase64: base64Audio },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );
      handleBackendResponse(res.data);
    } catch (err) {
      console.error(err);
      setErrorStatus("Server error or unknown intent.");
      speakOut("I encountered a system error.");
    } finally {
      setIsProcessing(false);
    }
  };

  const processTextWithBackend = async (text) => {
      setIsProcessing(true);
      try {
          const res = await axios.post(
              'http://localhost:5000/api/assistant/command',
              { command: text },
              { headers: { Authorization: `Bearer ${user?.token}` } }
          );
          handleBackendResponse(res.data);
      } catch(err) {
          setErrorStatus("Server error.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleBackendResponse = (data) => {
      if (data.requiresConfirmation) {
          setConfirmationData(data);
          speakOut(data.textResponse);
          return;
      }

      if (data.success) {
          setResponse(data.textResponse);
          speakOut(data.textResponse);
          onActionSuccess();
      } else {
          setErrorStatus(data.textResponse || "Failed to process command.");
          speakOut(data.textResponse || "There was an error.");
      }
  };

  const confirmAction = () => {
      // In a real flow, we send back a confirmation 'Yes' to the dialogue stack
      processTextWithBackend("yes");
      setConfirmationData(null);
  };

  const cancelAction = () => {
      processTextWithBackend("no");
      setConfirmationData(null);
      setResponse("Action cancelled.");
      speakOut("Action cancelled.");
  };

  const speakOut = (text) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    // Use Urdu voice if available and text contains urdu characters
    const hasUrdu = /[\u0600-\u06FF]/.test(text);
    if(hasUrdu) utterance.lang = 'ur-PK';
    else utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="glass-panel assistant-panel fade-in">
      <h2>AI Assistant</h2>
      <p className="status-text">
        {!isOnline ? '🔴 Offline Mode' : isRecording ? '🎙️ Recording...' : isProcessing ? '⏳ Processing AI...' : 'Tap the mic to speak'}
      </p>

      {/* Mic Button */}
      <button
        className={`mic-button ${isRecording ? 'listening' : ''} ${!isOnline ? 'disabled' : ''}`}
        onClick={toggleRecording}
        disabled={isProcessing || !isOnline}
      >
        <svg className="mic-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </button>

      {/* Confirmation Box */}
      {confirmationData && (
          <div className="confirmation-box fade-in" style={{ marginTop: '16px', background: 'var(--accent)', color: 'white', padding: '12px', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 12px 0' }}>{confirmationData.textResponse}</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button onClick={confirmAction} style={{ background: 'white', color: 'black', padding: '6px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Yes</button>
                  <button onClick={cancelAction} style={{ background: 'transparent', color: 'white', padding: '6px 16px', borderRadius: '4px', border: '1px solid white', cursor: 'pointer' }}>No</button>
              </div>
          </div>
      )}

      {/* Response */}
      {response && !confirmationData && (
        <div className="response-box fade-in" style={{ marginTop: '16px' }}>
          <strong>System:</strong> {response}
        </div>
      )}

      {/* Error */}
      {errorStatus && !confirmationData && (
        <div className="error-box fade-in" style={{ marginTop: '16px', color: 'red' }}>
          {errorStatus}
        </div>
      )}

      <p style={{ fontSize: '0.72rem', opacity: 0.45, marginTop: '16px', textAlign: 'center', lineHeight: 1.5 }}>
        Supports local offline AI (Whisper/Rasa) and Bilingual input.
      </p>
    </div>
  );
};

export default AssistantInterface;
