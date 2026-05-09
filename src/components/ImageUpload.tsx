// components/ImageUpload.tsx
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface ImageUploadProps {
  onImagesSelected: (files: File[]) => void;
  initialImages?: string[];
  maxImages?: number;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onImagesSelected, 
  initialImages = [], 
  maxImages = 5 
}) => {
  const [previews, setPreviews] = useState<string[]>(initialImages);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.slice(0, maxImages - previews.length);
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    
    setPreviews(prev => [...prev, ...newPreviews]);
    onImagesSelected(newFiles);
  }, [previews.length, maxImages, onImagesSelected]);

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] },
    maxSize: 5242880, // 5MB
    disabled: previews.length >= maxImages
  });

  return (
    <div className="image-upload-container">
      <div {...getRootProps()} className={`image-upload-area ${isDragActive ? 'drag-active' : ''}`}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>📸 Déposez les images ici...</p>
        ) : (
          <p>📷 Glissez/déposez ou cliquez pour sélectionner (max {maxImages})</p>
        )}
      </div>
      
      {previews.length > 0 && (
        <div className="image-preview-grid">
          {previews.map((src, idx) => (
            <div key={idx} className="image-preview-item">
              <img src={src} alt={`Preview ${idx + 1}`} />
              <button type="button" className="remove-image-btn" onClick={() => removeImage(idx)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;