
"use client";

import { LayoutGrid } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Dashboard } from "./dashboard";
import { Avatar, AvatarFallback } from "./ui/avatar";
import Image from "next/image";
import * as React from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { Skeleton } from "./ui/skeleton";

export function AppHeader() {
  const userEmail = "contentredac@gmail.com";
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [isLoadingLogo, setIsLoadingLogo] = React.useState(true);

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "logo"), (doc) => {
      if (doc.exists()) {
        setLogoUrl(doc.data().url);
      } else {
        setLogoUrl(null); 
      }
      setIsLoadingLogo(false);
    }, (error) => {
        console.error("Error fetching logo:", error);
        setIsLoadingLogo(false);
    });

    return () => unsub();
  }, []);

  const getInitials = (email: string) => {
      const namePart = email.split('@')[0];
      return namePart.substring(0, 2).toUpperCase();
  };
  const initials = getInitials(userEmail);

  const defaultLogoDataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAEgAmADASIAAhEBAxEB/8QAGwABAQEBAQEBAQAAAAAAAAAAAAECAwQFBgf/xAA1EAEAAQMDAgQFAwQCAgIDAAAAAQIDEQQhEjFBUQUTImFxMoGRoQYUscHR8BVS4SNicuHxkv/EABcBAQEBAQAAAAAAAAAAAAAAAAABAgP/xAAgEQEBAAIDAQEAAwEAAAAAAAAAAQIRAxIhEzFBBCJR/9oADAMBAAIRAxEAPwD9xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAe0aRpGv3h4l5JmZ7QzCgIgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAgCAIAg-";

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 z-10">
      <div className="flex items-center gap-6">
        <div className="flex items-center h-10">
          {isLoadingLogo ? (
            <Skeleton className="h-10 w-28" />
          ) : (
            <Image
                src={logoUrl || defaultLogoDataUri}
                alt="CocoTalk Logo"
                width={126}
                height={50}
                className="object-contain h-full w-auto"
                data-ai-hint="logo"
                unoptimized
            />
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
              <LayoutGrid className="h-5 w-5" />
              <span className="hidden sm:inline font-medium">Tableau de bord</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl h-auto max-h-[90vh] p-0 gap-0">
            <DialogHeader className="p-4 text-center rounded-t-lg" style={{backgroundColor: '#fcd306'}}>
              <DialogTitle className="text-white">Tableau de bord</DialogTitle>
            </DialogHeader>
            <div className="p-6">
                <Dashboard />
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10 border">
                        <AvatarFallback className="bg-accent text-accent-foreground">{initials}</AvatarFallback>
                    </Avatar>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md p-0 gap-0">
                <DialogHeader className="bg-accent text-accent-foreground p-4 rounded-t-lg" style={{backgroundColor: "#fcd306"}}>
                    <DialogTitle className="text-white">Profil Utilisateur</DialogTitle>
                </DialogHeader>
                <div className="p-6">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-muted-foreground">Email:</span>
                        <span className="text-sm font-semibold">{userEmail}</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
