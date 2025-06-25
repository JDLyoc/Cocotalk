
"use client";

import * as React from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { storage, db } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { Progress } from "./ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function LogoUploaderFirebase() {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ variant: 'destructive', title: 'Fichier trop volumineux', description: 'Veuillez choisir un fichier de moins de 2MB.' });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/svg+xml', 'image/gif'].includes(selectedFile.type)) {
        toast({ variant: 'destructive', title: 'Type de fichier non supporté', description: 'Veuillez choisir un fichier JPEG, PNG, GIF ou SVG.' });
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };
  
  const resetState = () => {
      setFile(null);
      setPreview(null);
      setIsUploading(false);
      setUploadProgress(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleUpload = async () => {
    if (!file) {
        toast({ variant: 'destructive', title: 'Aucun fichier sélectionné' });
        return;
    };
    
    setIsUploading(true);
    setUploadProgress(0);

    const storageRef = ref(storage, `logos/custom_logo_${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      }, 
      (error) => {
        console.error("Upload error:", error);
        toast({ variant: 'destructive', title: 'Erreur de téléversement', description: "Une erreur est survenue." });
        setIsUploading(false);
      }, 
      async () => {
        try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const logoDocRef = doc(db, "settings", "logo");
            await setDoc(logoDocRef, { url: downloadURL, uploadedAt: new Date() });
            
            toast({ title: 'Succès', description: 'Votre nouveau logo a été enregistré.' });
            resetState();
        } catch (error) {
            console.error("Error saving URL to Firestore:", error);
            toast({ variant: 'destructive', title: 'Erreur de sauvegarde', description: "Impossible d'enregistrer l'URL du logo." });
            setIsUploading(false);
        }
      }
    );
  };
  
  const handleRemove = async () => {
    try {
        const logoDocRef = doc(db, "settings", "logo");
        await deleteDoc(logoDocRef);
        toast({ title: 'Succès', description: 'Le logo personnalisé a été supprimé.' });
    } catch(error) {
        console.error("Error removing logo:", error);
        toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de supprimer le logo." });
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/svg+xml, image/gif"
        disabled={isUploading}
      />
      <div
        className={`flex h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card transition-colors ${!isUploading && 'hover:border-primary cursor-pointer'}`}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        {preview ? (
          <Image src={preview} alt="Aperçu du logo" width={100} height={100} className="max-h-full object-contain" />
        ) : (
          <div className="text-center text-muted-foreground">
            <Upload className="mx-auto h-10 w-10" />
            <p>Cliquez pour télécharger</p>
            <p className="text-xs">PNG, JPG, GIF, SVG (max 2MB)</p>
          </div>
        )}
      </div>
      {preview && !isUploading && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={resetState}>
          <X className="mr-2 h-4 w-4" />
          Retirer l'image
        </Button>
      )}

      {isUploading && uploadProgress !== null && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-center text-muted-foreground">Téléversement : {Math.round(uploadProgress)}%</p>
          </div>
      )}
      
      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={handleUpload} disabled={!file || isUploading} className="w-full">
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Téléverser et sauvegarder
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              <X className="mr-2 h-4 w-4" />
              Supprimer le logo
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Le logo personnalisé sera supprimé et l'application utilisera le logo par défaut.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemove}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
