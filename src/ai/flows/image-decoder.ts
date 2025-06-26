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
  model: z.string().optional().describe('The specific AI model to use for the generation.'),
});
export type DecodeImageInput = z.infer<typeof DecodeImageInputSchema>;

const DecodeImageOutputSchema = z.object({
  description: z.string().describe('A detailed description of the image.'),
});
export type DecodeImageOutput = z.infer<typeof DecodeImageOutputSchema>;

export async function decodeImage(input: DecodeImageInput): Promise<DecodeImageOutput> {
  return decodeImageFlow(input);
}

const decodeImageFlow = ai.defineFlow(
  {
    name: 'decodeImageFlow',
    inputSchema: DecodeImageInputSchema,
    outputSchema: DecodeImageOutputSchema,
  },
  async (input) => {
    const activeModel = input.model || 'googleai/gemini-2.0-flash';
    
    const { output } = await ai.generate({
      model: activeModel,
      prompt: [
        { text: `You are an expert in image recognition and description. You will receive an image and you will need to describe it in detail so that a chatbot can understand the context of the image.\n\nImage:` },
        { media: { url: input.photoDataUri } }
      ],
      output: { schema: DecodeImageOutputSchema },
    });
    return output!;
  }
);
