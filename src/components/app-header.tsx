
"use client";

import { LayoutGrid } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Dashboard } from "./dashboard";
import { Avatar, AvatarFallback } from "./ui/avatar";
import Image from "next/image";
import { Skeleton } from "./ui/skeleton";

interface AppHeaderProps {
    logo: string | null;
    onLogoUpload: (base64: string | null) => void;
    hasMounted: boolean;
}

interface LogoProps {
    logo: string | null;
    hasMounted: boolean;
}

function Logo({ logo, hasMounted }: LogoProps) {
    if (!hasMounted) {
        return <Skeleton className="h-8 w-36" />;
    }

    if (logo) {
        return (
            <div className="flex items-center gap-2 h-8">
                <Image src={logo} alt="Uploaded Logo" width={140} height={32} className="object-contain h-full w-auto" />
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <div className="flex flex-col items-start leading-tight">
                <span className="font-extrabold">iaChat<span className="text-primary">MG</span></span>
                <span className="text-xs font-normal text-muted-foreground">WorldWide</span>
            </div>
        </div>
    )
}

export function AppHeader({ logo, onLogoUpload, hasMounted }: AppHeaderProps) {
  const userEmail = "contentredac@gmail.com";
  const getInitials = (email: string) => {
      const namePart = email.split('@')[0];
      return namePart.substring(0, 2).toUpperCase();
  };
  const initials = getInitials(userEmail);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 z-10">
      <div className="flex items-center gap-6">
        <Logo logo={logo} hasMounted={hasMounted} />
      </div>
      
      <div className="flex items-center gap-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
              <LayoutGrid className="h-5 w-5" />
              <span className="hidden sm:inline font-medium">Tableau de bord</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl h-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Tableau de bord</DialogTitle>
            </DialogHeader>
            <Dashboard onLogoUpload={onLogoUpload} />
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
                <DialogHeader className="bg-accent text-white p-4 rounded-t-lg">
                    <DialogTitle>Profil Utilisateur</DialogTitle>
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
