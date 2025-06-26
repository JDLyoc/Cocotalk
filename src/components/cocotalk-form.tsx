
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
    .min(1, { message: 'Title is required.' })
    .refine(wordCount(15), { message: 'Title must not exceed 15 words.' }),
  description: z
    .string()
    .min(1, { message: 'Description is required.' })
    .refine(wordCount(30), { message: 'Description must not exceed 30 words.' }),
  persona: z
    .string()
    .refine(wordCount(300), { message: 'Persona must not exceed 300 words.' })
    .optional()
    .or(z.literal('')),
  instructions: z
    .string()
    .min(1, { message: 'Instructions are required.' })
    .max(5000, { message: 'Instructions must not exceed 5000 characters.' }),
  starterMessage: z
    .string()
    .min(1, { message: "Starter message is required." }),
  greetingMessage: z
    .string()
    .max(500, { message: "Greeting message must not exceed 500 characters." })
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

  const title = cocotalkToEdit ? 'Edit Cocotalk' : 'Create a new Cocotalk';
  const description = cocotalkToEdit
    ? 'Modify the details of your custom assistant.'
    : 'Fill out the fields below to create your custom assistant.';

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
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Digital Marketing Expert" {...field} />
                    </FormControl>
                    <FormDescription>Max 15 words.</FormDescription>
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
                      <Input placeholder="An assistant that generates ad campaign ideas." {...field} />
                    </FormControl>
                    <FormDescription>Max 30 words.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions (Agent's Brain)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Define the agent's entire behavior. Ex: 'Step 1: Greet the user and ask for their goal. Step 2: Based on their goal, offer options A, B, C...'"
                        className="min-h-[200px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>This is the most important field. Define the entire scenario, logic, and personality of your agent here. Use clear, step-by-step instructions to guide its behavior.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="persona"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Persona (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="The tone should be friendly but formal. Use emojis moderately..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Max 300 words.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="greetingMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Greeting Message (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Hello! I'm your marketing expert. What's your campaign idea for today?" {...field} className="min-h-[80px]" />
                    </FormControl>
                    <FormDescription>
                      The first message the assistant will display. If empty, a default greeting will be used.
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
                    <FormLabel>Starter Message</FormLabel>
                    <FormControl>
                      <Input placeholder="What's your campaign idea for today?" {...field} />
                    </FormControl>
                    <FormDescription>
                      A suggested message to start the conversation, which will appear as a button.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
