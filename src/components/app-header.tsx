
"use client";

import { LayoutGrid, Radio } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Dashboard } from "./dashboard";
import { Avatar, AvatarFallback } from "./ui/avatar";
import Image from "next/image";
import { Skeleton } from "./ui/skeleton";
import * as React from "react";

interface AppHeaderProps {
    logo: string | null;
    onLogoUpload: (base64: string | null) => void;
}

interface LogoProps {
    logo: string | null;
}

function Logo({ logo }: LogoProps) {
    const [hasMounted, setHasMounted] = React.useState(false);

    React.useEffect(() => {
        setHasMounted(true);
    }, []);

    if (!hasMounted) {
        return <Skeleton className="h-14 w-44" />;
    }

    if (logo) {
        return (
            <div className="flex items-center gap-2 h-14 bg-transparent">
                <Image
                    src={logo}
                    alt="Uploaded Logo"
                    width={140}
                    height={56}
                    className="object-contain h-full w-auto bg-transparent"
                />
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 h-14">
            <Radio className="h-8 w-8 text-accent" />
            <span className="text-2xl font-bold text-primary">
                CocoTalk
            </span>
        </div>
    )
}

export function AppHeader({ logo, onLogoUpload }: AppHeaderProps) {
  const userEmail = "contentredac@gmail.com";
  const getInitials = (email: string) => {
      const namePart = email.split('@')[0];
      return namePart.substring(0, 2).toUpperCase();
  };
  const initials = getInitials(userEmail);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 z-10">
      <div className="flex items-center gap-6">
        <Logo logo={logo} />
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
                <DialogHeader className="bg-accent text-accent-foreground p-4 rounded-t-lg" style={{backgroundColor: "#fcd306"}}>
                    <DialogTitle className="text-white" style={{color: "#FFFFFF"}}>Profil Utilisateur</DialogTitle>
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
