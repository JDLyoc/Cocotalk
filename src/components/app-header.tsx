
"use client";

import { LayoutGrid, LogOut, User } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Dashboard } from "./dashboard";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";

interface AppHeaderProps {
    onLogoUpload: (base64: string | null) => void;
}

function Logo() {
    return (
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <div className="flex flex-col items-start leading-tight">
                <span className="font-extrabold">iaChat<span className="text-primary">MG</span></span>
                <span className="text-xs font-normal text-muted-foreground">WorldWide</span>
            </div>
        </div>
    )
}

export function AppHeader({ onLogoUpload }: AppHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 z-10">
      <div className="flex items-center gap-6">
        <Logo />
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

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10 border">
                        <AvatarFallback className="bg-accent text-accent-foreground">CO</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">Utilisateur</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            contentredac@gmail.com
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => alert("Fonction de déconnexion à implémenter")}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Se déconnecter</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
