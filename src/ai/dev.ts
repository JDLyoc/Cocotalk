import { config } from 'dotenv';
config();

import '@/ai/flows/multilingual-chat.ts';
import '@/ai/flows/summarize-document.ts';
import '@/ai/flows/image-decoder.ts';
import '@/ai/tools/web-search.ts';
