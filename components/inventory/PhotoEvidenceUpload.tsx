'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Camera, AlertCircle } from 'lucide-react';

interface PhotoEvidenceUploadProps {
  onUpload: (files: File[]) => void;
  maxFiles?: number;
  required?: boolean;
}

export default function PhotoEvidenceUpload({ onUpload, maxFiles = 3, required = false }: PhotoEvidenceUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = [...uploadedFiles, ...acceptedFiles].slice(0, maxFiles);
      setUploadedFiles(newFiles);

      // Create previews
      const newPreviews = acceptedFiles.map((file) => URL.createObjectURL(file));
      setPreviews((prev) => [...prev, ...newPreviews].slice(0, maxFiles));

      onUpload(newFiles);
    },
    [uploadedFiles, maxFiles, onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    maxFiles: maxFiles - uploadedFiles.length,
    disabled: uploadedFiles.length >= maxFiles,
  });

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    setPreviews(newPreviews);
    onUpload(newFiles);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Photo Evidence {required && <span className="text-red-500">*</span>}
        </label>
        {required && (
          <p className="text-xs text-gray-500 mb-2">Photos are required for scrap movements</p>
        )}
      </div>

      {/* Upload Area */}
      {uploadedFiles.length < maxFiles && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            {isDragActive ? (
              <>
                <Upload className="h-8 w-8 text-blue-500" />
                <p className="text-sm text-blue-600">Drop the files here...</p>
              </>
            ) : (
              <>
                <Camera className="h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Drag & drop photos here, or click to select
                </p>
                <p className="text-xs text-gray-500">
                  {maxFiles - uploadedFiles.length} of {maxFiles} slots remaining
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-xs text-gray-600 mt-1 truncate">
                {uploadedFiles[index]?.name}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Warning if required and no files */}
      {required && uploadedFiles.length === 0 && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Photo Evidence Required</p>
            <p className="text-xs text-yellow-700">
              You must upload at least one photo to document this scrap movement
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
