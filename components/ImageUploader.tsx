import React, { useRef } from 'react';
import type { UploadedImage } from '../types';
import XCircleIcon from '../icons/XCircleIcon';

interface ImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  disabled?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ images, onImagesChange, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;

    const files = Array.from(event.target.files);
    const newImages: UploadedImage[] = [];

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          newImages.push({ file, base64: e.target.result, description: '' });
          if (newImages.length === files.length) {
            onImagesChange([...images, ...newImages]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDescriptionChange = (index: number, description: string) => {
    const updatedImages = [...images];
    updatedImages[index].description = description;
    onImagesChange(updatedImages);
  };

  const handleRemoveImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    onImagesChange(updatedImages);
  };

  return (
    <div className="mt-6">
      <h3 className="mb-2 font-medium text-gray-300">Add Images (Optional)</h3>
      <p className="text-sm text-gray-500 mb-4">
        Include images in your presentation. Add a short description for each to help the AI place them correctly.
      </p>

      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 max-h-64 overflow-y-auto pr-2">
          {images.map((image, index) => (
            <div key={index} className="relative bg-black/20 border border-gray-700 rounded-lg p-3">
              <button
                onClick={() => handleRemoveImage(index)}
                className="absolute -top-2 -right-2 bg-gray-800 text-gray-300 rounded-full p-0.5 hover:bg-red-500 hover:text-white transition-colors z-10"
                aria-label="Remove image"
              >
                <XCircleIcon />
              </button>
              <img src={image.base64} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-md mb-2" />
              <input
                type="text"
                value={image.description}
                onChange={(e) => handleDescriptionChange(index, e.target.value)}
                placeholder={`Description for image ${index + 1}...`}
                className="w-full p-2 bg-black/20 border border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-gray-200"
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="w-full border-2 border-dashed border-gray-600 hover:border-cyan-500 text-gray-400 hover:text-cyan-400 font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Add Images
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
      />
    </div>
  );
};

export default ImageUploader;