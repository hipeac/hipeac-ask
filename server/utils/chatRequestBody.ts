import { UIMessage } from "ai";
import { z } from "zod";

export const ChatRequestBodySchema = z.object({
  messages: z.array(z.custom<UIMessage>()).min(1),
  persona: z.string().optional(),
  topic: z.string().optional(),
  visionYear: z.string().optional(),
});

export type ChatRequestBody = z.infer<typeof ChatRequestBodySchema>;
