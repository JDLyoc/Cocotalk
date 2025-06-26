
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LogOut, MessageSquare, Sparkles, MoreHorizontal, Edit, Trash2, Cog } from "lucide-react";
import { Button, buttonVariants } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import type { DisplayConversation, StoredCocotalk } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { CocotalkForm, type CocotalkFormValues } from "./cocotalk-form";

interface AppSidebarProps {
  conversations: DisplayConversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  createNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  cocotalks: StoredCocotalk[];
  activeCocotalkId: string | null;
  setActiveCocotalkId: (id: string | null) => void;
  createNewCocotalk: (values: CocotalkFormValues) => Promise<void>;
  updateCocotalk: (id: string, values: CocotalkFormValues) => Promise<void>;
  deleteCocotalk: (id: string) => void;
}

export function AppSidebar({
  conversations,
  activeConversationId,
  setActiveConversationId,
  createNewChat,
  onDeleteConversation,
  onRenameConversation,
  cocotalks,
  activeCocotalkId,
  setActiveCocotalkId,
  createNewCocotalk,
  updateCocotalk,
  deleteCocotalk,
}: AppSidebarProps) {
  const router = useRouter();
  const [renameTarget, setRenameTarget] = React.useState<DisplayConversation | null>(null);
  const [newTitle, setNewTitle] = React.useState("");
  const [isCocotalkFormOpen, setIsCocotalkFormOpen] = React.useState(false);
  const [cocotalkToEdit, setCocotalkToEdit] = React.useState<StoredCocotalk | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const handleRenameClick = (conv: DisplayConversation) => {
    setRenameTarget(conv);
    setNewTitle(conv.title.endsWith("...") ? "" : conv.title);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameTarget && newTitle.trim()) {
      onRenameConversation(renameTarget.id, newTitle.trim());
      setRenameTarget(null);
      setNewTitle("");
    }
  };

  const handleCreateCocotalkClick = () => {
    setCocotalkToEdit(null);
    setIsCocotalkFormOpen(true);
  };

  const handleEditCocotalkClick = (cocotalk: StoredCocotalk) => {
    setCocotalkToEdit(cocotalk);
    setIsCocotalkFormOpen(true);
  };

  const handleFormSubmit = async (values: CocotalkFormValues) => {
    setIsSubmitting(true);
    if (cocotalkToEdit) {
      await updateCocotalk(cocotalkToEdit.id, values);
    } else {
      await createNewCocotalk(values);
    }
    setIsSubmitting(false);
    setIsCocotalkFormOpen(false);
  };


  return (
    <>
      <aside className="flex h-full w-full max-w-[280px] flex-col bg-sidebar text-sidebar-foreground p-4">
        <div className="space-y-2 mb-4">
          <Button size="lg" className="w-full justify-center font-semibold bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg" onClick={createNewChat}>
            <Sparkles className="mr-2 h-4 w-4" />
            Nouveau Chat
          </Button>
          <Button variant="outline" size="lg" className="w-full justify-center font-semibold rounded-lg" onClick={handleCreateCocotalkClick}>
            <Cog className="mr-2 h-4 w-4" />
            Créer Cocotalk
          </Button>
        </div>
        
        <div className="flex-1 flex flex-col overflow-y-hidden">
            {cocotalks.length > 0 && (
                <div className="mb-4">
                    <h3 className="px-2 pt-4 pb-2 text-xs font-semibold uppercase text-muted-foreground/80 tracking-wider">
                    Mes Cocotalks
                    </h3>
                    <div className="bg-white rounded-lg my-2 overflow-hidden">
                        <ScrollArea className="h-full w-full max-h-48">
                            <div className="p-2 space-y-1">
                            {cocotalks.map((cocotalk) => (
                                <AlertDialog key={cocotalk.id}>
                                <div className="group relative flex items-center w-full">
                                    <Button
                                    variant={cocotalk.id === activeCocotalkId ? "secondary" : "ghost"}
                                    className="w-full justify-start font-normal rounded-lg pr-10"
                                    onClick={() => setActiveCocotalkId(cocotalk.id)}
                                    >
                                    <Sparkles className="mr-2 h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">{cocotalk.title}</span>
                                    </Button>
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Options</span>
                                        </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent side="right">
                                        <DropdownMenuItem onSelect={() => handleEditCocotalkClick(cocotalk)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            <span>Modifier</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            <span>Supprimer</span>
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    </div>
                                </div>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Êtes-vous sûr(e) ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Cette action est irréversible et supprimera définitivement le Cocotalk "{cocotalk.title}".
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                        className={cn(buttonVariants({ variant: "destructive" }))}
                                        onClick={() => deleteCocotalk(cocotalk.id)}
                                    >
                                        Supprimer
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                                </AlertDialog>
                            ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            )}

            <h3 className="px-2 pt-4 pb-2 text-xs font-semibold uppercase text-muted-foreground/80 tracking-wider">
                Conversations Récentes
            </h3>

            <div className="flex-1 bg-white rounded-lg my-2 overflow-hidden">
                <ScrollArea className="h-full w-full">
                    <div className="p-2 space-y-1">
                    {conversations.map((conv) => (
                        <AlertDialog key={conv.id}>
                        <div className="group relative flex items-center w-full">
                            <Button
                            variant={conv.id === activeConversationId ? "secondary" : "ghost"}
                            className="w-full justify-start font-normal rounded-lg pr-10"
                            onClick={() => setActiveConversationId(conv.id)}
                            >
                            <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{conv.title}</span>
                            </Button>
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Options</span>
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="right">
                                <DropdownMenuItem onSelect={() => handleRenameClick(conv)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    <span>Renommer</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Supprimer</span>
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            </div>
                        </div>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Êtes-vous sûr(e) ?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Cette action est irréversible et supprimera définitivement la conversation "{conv.title}".
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                                className={cn(buttonVariants({ variant: "destructive" }))}
                                onClick={() => onDeleteConversation(conv.id)}
                            >
                                Supprimer
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                        </AlertDialog>
                    ))}
                    </div>
                </ScrollArea>
            </div>
        </div>
        <div className="mt-auto border-t -mx-4 p-4 bg-[#2A4D8F]">
          <Button variant="ghost" className="w-full justify-start rounded-lg text-white hover:bg-white/20 hover:text-white" onClick={handleLogout}>
              <LogOut className="mr-3 h-5 w-5" />
              <span className="font-medium">Se déconnecter</span>
          </Button>
        </div>
      </aside>

      <CocotalkForm
        open={isCocotalkFormOpen}
        onOpenChange={setIsCocotalkFormOpen}
        onSubmit={handleFormSubmit}
        cocotalkToEdit={cocotalkToEdit}
        isLoading={isSubmitting}
      />

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer la conversation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-title" className="text-right">Titre</Label>
                <Input
                  id="new-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="col-span-3"
                  placeholder="Nouveau titre de la conversation"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Sauvegarder</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
