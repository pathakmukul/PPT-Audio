import React, { useState } from 'react';
import type { Presentation, UploadedImage, Slide } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import ChevronLeftIcon from '../icons/ChevronLeftIcon';
import ChevronRightIcon from '../icons/ChevronRightIcon';
import DownloadIcon from '../icons/DownloadIcon';
import LoadingSpinner from '../icons/LoadingSpinner';

interface PresentationViewerProps {
  presentation: Presentation;
  currentSlide: number;
  onNextSlide: () => void;
  onPrevSlide: () => void;
  images: UploadedImage[];
}

// A component that renders the visual content of a single slide.
// This is shared between the on-screen viewer and the PDF generator.
const SlideContent: React.FC<{ slide: Slide; images: UploadedImage[] }> = ({ slide, images }) => {
  let slideImage: UploadedImage | undefined;
  if (slide.imagePlaceholder) {
    const match = slide.imagePlaceholder.match(/IMAGE_(\d+)/);
    if (match) {
      const imageIndex = parseInt(match[1], 10) - 1;
      if (imageIndex >= 0 && imageIndex < images.length) {
        slideImage = images[imageIndex];
      }
    }
  }

  return (
    <>
      <h3 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">{slide.title}</h3>
      
      {slideImage && (
        <div className="mb-8 w-full max-w-lg mx-auto">
          <img 
            src={slideImage.base64} 
            alt={slideImage.description || `Slide image`} 
            className="w-full h-auto object-contain rounded-lg shadow-lg"
            style={{ maxHeight: '40vh' }}
          />
        </div>
      )}
      
      <div className="flex-grow space-y-6 px-8">
        {slide.content.map((point, index) => (
          <div key={index} className="flex items-start">
            <span className="text-cyan-400 mr-4 mt-2 text-2xl">•</span>
            <p className="text-gray-200 text-2xl flex-1 leading-relaxed">{point}</p>
          </div>
        ))}
      </div>
      
      {slide.speakerNotes && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <h4 className="font-semibold text-gray-400 mb-2">Speaker Notes:</h4>
          <p className="text-gray-300 italic">{slide.speakerNotes}</p>
        </div>
      )}
    </>
  );
};

// A wrapper component specifically for rendering slides off-screen for PDF capture.
const PrintableSlide: React.FC<{ slide: Slide; images: UploadedImage[] }> = ({ slide, images }) => {
  return (
    <div className="w-full h-full p-12 border border-cyan-500/20 flex flex-col relative text-gray-200 font-sans overflow-hidden" style={{background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"}}>
      <SlideContent slide={slide} images={images} />
    </div>
  );
};

const PresentationViewer: React.FC<PresentationViewerProps> = ({
  presentation,
  currentSlide,
  onNextSlide,
  onPrevSlide,
  images,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    
    const pdfWidth = 1280;
    const pdfHeight = 720;
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [pdfWidth, pdfHeight],
    });

    const captureContainer = document.createElement('div');
    captureContainer.style.position = 'absolute';
    captureContainer.style.left = '-9999px';
    captureContainer.style.width = `${pdfWidth}px`;
    captureContainer.style.height = `${pdfHeight}px`;
    captureContainer.style.fontFamily = "'Poppins', sans-serif";
    document.body.appendChild(captureContainer);
    
    const captureRoot = createRoot(captureContainer);

    try {
      for (let i = 0; i < presentation.length; i++) {
        const slide = presentation[i];
        
        captureRoot.render(<PrintableSlide slide={slide} images={images} />);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const canvas = await html2canvas(captureContainer, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#0f172a",
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        if (i > 0) {
          pdf.addPage([pdfWidth, pdfHeight], 'landscape');
        }
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      pdf.save('presentation.pdf');

    } catch (error) {
        console.error("Failed to generate PDF:", error);
        alert("Sorry, there was an error creating the PDF.");
    } finally {
        captureRoot.unmount();
        document.body.removeChild(captureContainer);
        setIsDownloading(false);
    }
  };

  const slide = presentation[currentSlide];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-gray-200">2. Review Your Presentation</h2>
        <button
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 ease-in-out flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 shadow-[0_0_15px_rgba(0,255,255,0.2)]"
        >
          {isDownloading ? (
            <>
              <LoadingSpinner />
              Downloading...
            </>
          ) : (
            <>
              <DownloadIcon />
              Download PDF
            </>
          )}
        </button>
      </div>

      {/* Full-size slide container */}
      <div className="flex-grow bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-cyan-500/20 shadow-2xl flex flex-col relative overflow-hidden p-8">
        <SlideContent slide={slide} images={images} />
      </div>

      <div className="flex items-center justify-center mt-6">
        <button 
          onClick={onPrevSlide} 
          disabled={currentSlide === 0}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous Slide"
        >
          <ChevronLeftIcon />
        </button>
        <span className="mx-4 font-medium text-gray-300">
          Slide {currentSlide + 1} of {presentation.length}
        </span>
        <button 
          onClick={onNextSlide} 
          disabled={currentSlide === presentation.length - 1}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next Slide"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
};

export default PresentationViewer;