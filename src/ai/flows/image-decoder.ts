'use server';

/**
 * @fileOverview Image decoding AI agent.
 *
 * - decodeImage - A function that handles the image decoding process.
 * - DecodeImageInput - The input type for the decodeImage function.
 * - DecodeImageOutput - The return type for the decodeImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DecodeImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type DecodeImageInput = z.infer<typeof DecodeImageInputSchema>;

const DecodeImageOutputSchema = z.object({
  description: z.string().describe('A detailed description of the image.'),
});
export type DecodeImageOutput = z.infer<typeof DecodeImageOutputSchema>;

export async function decodeImage(input: DecodeImageInput): Promise<DecodeImageOutput> {
  return decodeImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'decodeImagePrompt',
  input: {schema: DecodeImageInputSchema},
  output: {schema: DecodeImageOutputSchema},
  prompt: `You are an expert in image recognition and description.

You will receive an image and you will need to describe it in detail so that a chatbot can understand the context of the image.

Image: {{media url=photoDataUri}}`,
});

const decodeImageFlow = ai.defineFlow(
  {
    name: 'decodeImageFlow',
    inputSchema: DecodeImageInputSchema,
    outputSchema: DecodeImageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
