import React, { useState, useCallback } from 'react';
import type { Presentation, RecordingState, UploadedImage } from './types';
import { generatePresentationFromText } from './services/geminiService';
import AudioRecorder from './components/AudioRecorder';
import PresentationViewer from './components/PresentationViewer';
  import PresentationIcon from './icons/PresentationIcon';
const App: React.FC = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState<number>(0);

  const handleGeneratePresentation = useCallback(async () => {
    if (!transcript.trim() && uploadedImages.length === 0) {
      setError('A transcript or at least one image must be provided.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setPresentation(null);
    setCurrentSlide(0);

    try {
      const result = await generatePresentationFromText(transcript, uploadedImages);
      if (result && result.length > 0) {
        setPresentation(result);
      } else {
        setError('The AI could not generate a presentation from the provided text. Please try again with a more detailed transcript.');
      }
    } catch (e) {
      console.error(e);
      setError(`An error occurred while generating the presentation: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [transcript, uploadedImages]);

  const handleNextSlide = () => {
    if (presentation && currentSlide < presentation.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleStopRecording = () => {
    setRecordingState('stopped');
  };

  return (
    <div className="min-h-screen text-gray-100 flex flex-col p-4">
      <header className="mb-4 text-center">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">
          Voice to Presentation Generator
        </h1>
        <p className="mt-2 text-lg text-gray-300">
          Record your thoughts, confirm the transcript, and let AI build your slides.
        </p>
      </header>
      
      <main className="flex-1 flex gap-4">
        <div className="w-80 bg-black/30 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-lg p-4 flex flex-col">
          <AudioRecorder
            recordingState={recordingState}
            setRecordingState={setRecordingState}
            onStopRecording={handleStopRecording}
            transcript={transcript}
            onTranscriptChange={setTranscript}
            onGenerate={handleGeneratePresentation}
            isLoading={isLoading}
            images={uploadedImages}
            onImagesChange={setUploadedImages}
          />
        </div>
        
        <div className="flex-1 bg-black/30 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-lg p-6 flex flex-col">
          {error && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{error}</div>}
          {isLoading && !presentation && (
            <div className="flex flex-col items-center text-center">
                <h2 className="text-2xl font-semibold mb-4 text-gray-200">Generating your presentation...</h2>
                <p className="text-gray-400">AI is crafting your slides. This might take a moment.</p>
            </div>
          )}
          {presentation ? (
            <PresentationViewer 
              presentation={presentation}
              currentSlide={currentSlide}
              onNextSlide={handleNextSlide}
              onPrevSlide={handlePrevSlide}
              images={uploadedImages}
            />
          ) : (
            !isLoading && !error && (
              <div className="text-center text-gray-500 flex flex-col items-center">
                <PresentationIcon />
                <h2 className="text-2xl font-semibold mt-6 mb-2 text-gray-300">Your Presentation Will Appear Here</h2>
                <p>Start by recording your voice or typing a transcript on the left.</p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
