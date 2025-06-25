"use client";

import * as React from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";

interface LogoUploaderProps {
  children: React.ReactNode;
  onLogoUpload: (base64: string | null) => void;
}

export function LogoUploader({ children, onLogoUpload }: LogoUploaderProps) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ variant: 'destructive', title: 'Fichier trop volumineux', description: 'Veuillez choisir un fichier de moins de 2MB.' });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/svg+xml'].includes(file.type)) {
        toast({ variant: 'destructive', title: 'Type de fichier non supporté', description: 'Veuillez choisir un fichier JPEG, PNG, ou SVG.' });
        return;
      }
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (preview) {
      onLogoUpload(preview);
    }
  };

  const handleRemove = () => {
    onLogoUpload(null);
  };

  return (
    <Dialog onOpenChange={() => { setPreview(null); setFile(null); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Télécharger le logo</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/png, image/jpeg, image/svg+xml"
          />
          <div
            className="flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <Image src={preview} alt="Logo preview" width={100} height={100} className="max-h-full object-contain" />
            ) : (
              <div className="text-center text-muted-foreground">
                <Upload className="mx-auto h-10 w-10" />
                <p>Cliquez pour télécharger</p>
                <p className="text-xs">PNG, JPG, SVG (max 2MB)</p>
              </div>
            )}
          </div>
          {preview && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setPreview(null); setFile(null); }}>
              <X className="mr-2 h-4 w-4" />
              Retirer l'image
            </Button>
          )}
        </div>
        <DialogFooter>
            <Button variant="destructive" onClick={handleRemove}>
                Supprimer le logo actuel
            </Button>
            <DialogClose asChild>
                <Button onClick={handleSave} disabled={!file}>Sauvegarder</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
