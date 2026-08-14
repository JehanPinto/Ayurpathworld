import React, { useCallback, useState } from "react";
import { CloudUpload, FileText, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export interface LocalFile {
  id: string;
  file: File;
  previewUrl: string;
}

interface ImageUploadProps {
  title: string;
  description: string;
  required?: boolean;
  value: LocalFile[];
  onChange: (files: LocalFile[]) => void;
  maxFiles?: number;
}

export function ImageUpload({
  title,
  description,
  required,
  value,
  onChange,
  maxFiles = 5,
}: ImageUploadProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  // 🔒 STRICT SECURITY VALIDATION
  const validateFile = (file: File): boolean => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "pdf"];
    
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: `${file.name} exceeds 10MB limit.`, variant: "destructive" });
      return false;
    }
    
    if (!allowedMimeTypes.includes(file.type) || !extension || !allowedExtensions.includes(extension)) {
      toast({ 
        title: "Security Alert", 
        description: `${file.name} is an invalid file type. Only JPG, PNG, WEBP, and PDF are allowed. Scripts are blocked.`, 
        variant: "destructive" 
      });
      return false;
    }

    return true;
  };

  const handleFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(validateFile);
    
    if (value.length + validFiles.length > maxFiles) {
      toast({ title: "Limit reached", description: `You can only upload up to ${maxFiles} files here.`, variant: "destructive" });
      return;
    }

    const newLocalFiles: LocalFile[] = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    onChange([...value, ...newLocalFiles]);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [value, onChange]);

  const removeFile = (idToRemove: string) => {
    const fileToRemove = value.find(f => f.id === idToRemove);
    if (fileToRemove) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    onChange(value.filter((f) => f.id !== idToRemove));
  };

  return (
    <div className="border border-border bg-card p-5 sm:p-6 rounded-xl shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-bold text-foreground">
          {title} {required && <span className="text-destructive">*</span>}
        </h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      {/* Drag & Drop Area */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => document.getElementById(`upload-${title}`)?.click()}
        className={`border-2 border-dashed transition-all duration-200 rounded-lg p-6 sm:p-8 text-center cursor-pointer group
          ${isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary bg-muted/20 hover:bg-primary/5"}
        `}
      >
        <CloudUpload className={`w-8 h-8 mx-auto transition-colors mb-3 ${isDragging ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
        <p className="text-sm font-medium text-foreground">
          Drag & Drop your files <br className="hidden sm:block" /> or Click to Browse
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Secure Upload: PDF, JPG, PNG (Max 10MB)
        </p>
      </div>
      
      <input
        type="file"
        id={`upload-${title}`}
        className="hidden"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = ''; // Reset input
        }}
      />

      {/* Preview Area */}
      {value.length > 0 && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {value.map((localFile) => (
            <div key={localFile.id} className="relative rounded-xl border border-primary/20 bg-card text-card-foreground shadow-sm overflow-hidden group">
              {/* Image / PDF Preview */}
              <div className="w-full h-32 bg-muted relative flex items-center justify-center overflow-hidden">
                {localFile.file.type === "application/pdf" ? (
                  // PDF eke 1st page preview eka
                  <object 
                    data={`${localFile.previewUrl}#page=1&view=FitH&toolbar=0&navpanes=0`} 
                    type="application/pdf" 
                    className="w-full h-full object-cover pointer-events-none"
                  >
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                       <FileText className="h-8 w-8 mb-2" />
                       <span className="text-xs font-medium">PDF Document</span>
                    </div>
                  </object>
                ) : (
                  <img src={localFile.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                )}
                
                {/* Delete Overlay Button */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); removeFile(localFile.id); }}>
                    <X className="h-4 w-4 mr-2" /> Remove
                  </Button>
                </div>
              </div>
              
              <div className="p-2 bg-primary/5 border-t border-primary/10 flex flex-col">
                <span className="text-xs font-semibold text-foreground truncate w-full" title={localFile.file.name}>
                  {localFile.file.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {(localFile.file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}