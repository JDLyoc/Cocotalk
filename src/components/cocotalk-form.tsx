
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { StoredCocotalk } from '@/app/page';

const wordCount = (max: number) => (val: string) => val.trim().split(/\s+/).filter(Boolean).length <= max;

const formSchema = z.object({
  title: z
    .string()
    .min(1, { message: 'Le titre est obligatoire.' })
    .refine(wordCount(15), { message: 'Le titre ne doit pas dépasser 15 mots.' }),
  description: z
    .string()
    .min(1, { message: 'La description est obligatoire.' })
    .refine(wordCount(30), { message: 'La description ne doit pas dépasser 30 mots.' }),
  persona: z
    .string()
    .refine(wordCount(300), { message: 'Le persona ne doit pas dépasser 300 mots.' })
    .optional()
    .or(z.literal('')),
  instructions: z
    .string()
    .min(1, { message: 'Les instructions sont obligatoires.' })
    .max(5000, { message: 'Les instructions ne doivent pas dépasser 5000 caractères.' }),
  starterMessage: z
    .string()
    .min(1, { message: "Le message d'amorce est obligatoire." }),
  greetingMessage: z
    .string()
    .max(500, { message: "Le message d'accueil ne doit pas dépasser 500 caractères." })
    .optional()
    .or(z.literal('')),
});

export type CocotalkFormValues = z.infer<typeof formSchema>;

interface CocotalkFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CocotalkFormValues) => void;
  cocotalkToEdit?: StoredCocotalk | null;
  isLoading: boolean;
}

export function CocotalkForm({ open, onOpenChange, onSubmit, cocotalkToEdit, isLoading }: CocotalkFormProps) {
  const form = useForm<CocotalkFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      persona: '',
      instructions: '',
      starterMessage: '',
      greetingMessage: '',
    },
  });

  React.useEffect(() => {
    if (open) {
        if (cocotalkToEdit) {
        form.reset({
            title: cocotalkToEdit.title,
            description: cocotalkToEdit.description,
            persona: cocotalkToEdit.persona || '',
            instructions: cocotalkToEdit.instructions,
            starterMessage: cocotalkToEdit.starterMessage,
            greetingMessage: cocotalkToEdit.greetingMessage || '',
        });
        } else {
        form.reset({
            title: '',
            description: '',
            persona: '',
            instructions: '',
            starterMessage: '',
            greetingMessage: '',
        });
        }
    }
  }, [open, cocotalkToEdit, form]);

  const title = cocotalkToEdit ? 'Modifier le Cocotalk' : 'Créer un nouveau Cocotalk';
  const description = cocotalkToEdit
    ? 'Modifiez les détails de votre assistant personnalisé.'
    : 'Remplissez les champs ci-dessous pour créer votre assistant personnalisé.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-4 space-y-4 py-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Expert en Marketing Digital" {...field} />
                    </FormControl>
                    <FormDescription>15 mots maximum.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Un assistant qui génère des idées de campagnes publicitaires." {...field} />
                    </FormControl>
                    <FormDescription>30 mots maximum.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tu es un expert en marketing... Agis de manière concise et professionnelle. Réponds toujours en 3 points clés..."
                        className="min-h-[200px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>5000 caractères maximum.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="persona"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Persona (Optionnel)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Le ton doit être amical mais formel. Utilise des emojis de manière modérée..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>300 mots maximum.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="greetingMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message d'accueil (Optionnel)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Bonjour ! Je suis votre expert en marketing. Quelle est votre idée de campagne pour aujourd'hui ?" {...field} className="min-h-[80px]" />
                    </FormControl>
                    <FormDescription>
                      Le premier message que l'assistant affichera. 500 caractères max.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="starterMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message d'amorce</FormLabel>
                    <FormControl>
                      <Input placeholder="Quelle est ton idée de campagne pour aujourd'hui ?" {...field} />
                    </FormControl>
                    <FormDescription>
                      Une suggestion de message pour lancer la conversation, qui apparaîtra comme un bouton.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Enregistrement...' : 'Sauvegarder'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
