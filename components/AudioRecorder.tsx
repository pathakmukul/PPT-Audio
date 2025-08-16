import React, { useState, useRef, useEffect } from 'react';
import type { RecordingState, UploadedImage, TranscriptionMode } from '../types';
import { transcribeAudio } from '../services/geminiService';
import MicrophoneIcon from './icons/MicrophoneIcon';
import StopIcon from './icons/StopIcon';
import LoadingSpinner from './icons/LoadingSpinner';
import ImageUploader from './ImageUploader';

interface AudioRecorderProps {
  recordingState: RecordingState;
  setRecordingState: (state: RecordingState) => void;
  onStopRecording: () => void;
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  recordingState,
  setRecordingState,
  onStopRecording,
  transcript,
  onTranscriptChange,
  onGenerate,
  isLoading,
  images,
  onImagesChange,
}) => {
  const [isLiveTranscriptionSupported, setIsLiveTranscriptionSupported] = useState(false);
  const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionMode>('live');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const finalTranscriptRef = useRef<string>('');
  
  // Check for Web Speech API support on component mount
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setIsLiveTranscriptionSupported(true);
    } else {
      setTranscriptionMode('high-accuracy'); // Default to high-accuracy if not supported
    }
  }, []);


  useEffect(() => {
    if (!isLiveTranscriptionSupported || transcriptionMode !== 'live') {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.abort();
        speechRecognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = finalTranscriptRef.current;
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      finalTranscriptRef.current = finalTranscript;
      onTranscriptChange(finalTranscript + interimTranscript);
    };
    
    recognition.onend = () => {
      // This can be triggered by the browser on long pauses. The main stop logic
      // is handled by the user clicking the stop button.
      if (recordingState === 'recording') {
          setRecordingState('stopped');
          onStopRecording();
      }
    };

    speechRecognitionRef.current = recognition;
    
    return () => {
        speechRecognitionRef.current?.abort();
    };
  }, [transcriptionMode, isLiveTranscriptionSupported, onTranscriptChange]);

  const handleGeminiTranscription = async () => {
    if (audioChunksRef.current.length === 0) {
      onStopRecording();
      return;
    };

    setIsTranscribing(true);
    onTranscriptChange('Transcribing audio with Gemini AI, please wait...');

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;
      try {
        const transcribedText = await transcribeAudio(base64Audio, 'audio/webm');
        onTranscriptChange(transcribedText);
      } catch (error) {
        console.error(error);
        const errorMessage = `Error during transcription: ${error instanceof Error ? error.message : 'Unknown error'}`;
        onTranscriptChange(errorMessage);
        alert(errorMessage);
      } finally {
        setIsTranscribing(false);
        onStopRecording();
      }
    };
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      const errorMessage = 'Error reading audio file for transcription.';
      onTranscriptChange(errorMessage);
      alert(errorMessage);
      setIsTranscribing(false);
      onStopRecording();
    };
  };

  const startRecording = async () => {
    onTranscriptChange('');
    finalTranscriptRef.current = '';
    setRecordingState('recording');

    if (transcriptionMode === 'live') {
      if (speechRecognitionRef.current) {
        try {
            speechRecognitionRef.current.start();
        } catch(e) {
            console.error("Error starting speech recognition:", e);
            alert('Could not start live transcription. Please try again.');
            setRecordingState('idle');
        }
      } else {
         alert('Live transcription is not available. Try High-Accuracy mode.');
         setRecordingState('idle');
      }
    } else {
      // High-Accuracy mode
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        recorder.onstop = handleGeminiTranscription;
        mediaRecorderRef.current = recorder;
        mediaRecorderRef.current.start();
      } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Could not access microphone. Please ensure you have given permission.');
        setRecordingState('idle');
      }
    }
  };

  const stopRecording = () => {
    if (transcriptionMode === 'live') {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
    setRecordingState('stopped');
    onStopRecording();
  };
  
  const handleRecordClick = () => {
    if (recordingState === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const isBusy = isLoading || isTranscribing;

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-semibold mb-4 text-gray-200">1. Input Your Content</h2>
      <div className="flex justify-center items-center mb-2">
        <button
          onClick={handleRecordClick}
          disabled={isBusy}
          title='Start/Stop Recording'
          className={`relative w-24 h-24 rounded-full flex justify-center items-center transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-gray-800
            ${recordingState === 'recording' ? 'bg-gradient-to-br from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 focus:ring-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 focus:ring-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.3)]'}
            ${isBusy ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          {recordingState === 'recording' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          )}
          {recordingState === 'recording' ? <StopIcon /> : <MicrophoneIcon />}
        </button>
      </div>

      {/* Transcription Mode Toggle */}
      <div className="flex flex-col items-center justify-center mb-4">
        <div className="flex items-center justify-center space-x-2">
          <span className={`text-sm font-medium ${transcriptionMode === 'live' ? 'text-cyan-400' : 'text-gray-400'}`}>Live</span>
          <button
              onClick={() => setTranscriptionMode(prev => prev === 'live' ? 'high-accuracy' : 'live')}
              disabled={isBusy || recordingState === 'recording' || !isLiveTranscriptionSupported}
              className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title={isLiveTranscriptionSupported ? 'Toggle transcription mode' : 'Live transcription not supported on this browser'}
          >
              <span className={`${transcriptionMode === 'high-accuracy' ? 'bg-purple-600' : 'bg-gray-600'} absolute w-full h-full rounded-full`}></span>
              <span className={`${transcriptionMode === 'high-accuracy' ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ease-in-out`}/>
          </button>
          <span className={`text-sm font-medium ${transcriptionMode === 'high-accuracy' ? 'text-purple-400' : 'text-gray-400'}`}>High-Accuracy</span>
        </div>
        {!isLiveTranscriptionSupported && (
            <p className="text-xs text-gray-500 mt-2">Live mode not supported by your browser.</p>
        )}
      </div>


      <p className="text-center text-gray-400 mb-4 min-h-[24px]">
        {isTranscribing ? (
          <span className="flex items-center justify-center text-yellow-400">
            <LoadingSpinner /> Transcribing...
          </span>
        ) : recordingState === 'idle' ? (
          'Click the microphone to start recording'
        ) : recordingState === 'recording' ? (
          'Recording... Click to stop'
        ) : (
          'Recording finished. Review transcript below.'
        )}
      </p>

      <div className="flex-grow flex flex-col">
        <label htmlFor="transcript" className="mb-2 font-medium text-gray-300">
          Speech Transcript
        </label>
        <textarea
          id="transcript"
          value={transcript}
          onChange={(e) => onTranscriptChange(e.target.value)}
          placeholder={
            transcriptionMode === 'live'
              ? 'Your live transcript will appear here as you speak.'
              : 'Record your audio first. Your transcript will appear here after you stop.'
          }
          className="w-full p-3 bg-black/20 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 resize-none text-gray-200"
          rows={8}
          disabled={isBusy}
        />
      </div>

      <ImageUploader 
        images={images}
        onImagesChange={onImagesChange}
        disabled={isBusy}
      />

      <button
        onClick={onGenerate}
        disabled={isBusy || (!transcript.trim() && images.length === 0)}
        className="w-full mt-6 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 shadow-[0_0_15px_rgba(0,255,255,0.2)]"
      >
        {isLoading ? (
          <>
            <LoadingSpinner />
            Generating...
          </>
        ) : (
          '✨ Generate Presentation'
        )}
      </button>
    </div>
  );
};

export default AudioRecorder;