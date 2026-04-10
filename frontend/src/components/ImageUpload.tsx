import React, { useCallback } from 'react';
import { motion } from 'framer-motion';

interface ImageUploadProps {
  label: string;
  onImageUpload: (base64: string) => void;
  currentImage: string | null;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ label, onImageUpload, currentImage }) => {
  const convertToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          let { width, height } = img;
          const scale = Math.min(1, maxDim / Math.max(width, height));
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to process image canvas'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const isPng = file.type === 'image/png';
          const mime = isPng ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(mime, isPng ? 0.92 : 0.88);
          const base64 = dataUrl.split(',')[1];
          resolve(base64);
        };
        img.onerror = () => reject(new Error('Failed to decode image'));
        img.src = result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    try {
      const base64 = await convertToBase64(file);
      onImageUpload(base64);
    } catch (error) {
      console.error('Error converting file to base64:', error);
      alert('Error processing image file');
    }
  }, [convertToBase64, onImageUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (!imageFile) {
      alert('Please drop a valid image file');
      return;
    }

    try {
      const base64 = await convertToBase64(imageFile);
      onImageUpload(base64);
    } catch (error) {
      console.error('Error converting dropped file to base64:', error);
      alert('Error processing dropped image');
    }
  }, [convertToBase64, onImageUpload]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-200">{label}</label>
      
      <motion.div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative border-2 border-dashed border-cyan-200/30 rounded-xl p-4 hover:border-cyan-200/50 transition-colors bg-slate-900/45"
        whileHover={{ y: -2 }}
      >
        {currentImage ? (
          <div className="relative">
            <img
              src={`data:image/png;base64,${currentImage}`}
              alt={`Uploaded ${label}`}
              className="w-full h-32 object-cover rounded"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded flex items-center justify-center">
              <span className="text-white text-sm">Click to change</span>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-3xl text-cyan-200/70 mb-2">📷</div>
            <p className="text-sm text-slate-300">Drop image here or click to browse</p>
          </div>
        )}
        
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </motion.div>
    </div>
  );
};

export default ImageUpload;
