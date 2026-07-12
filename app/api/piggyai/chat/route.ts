import {
    streamText,
    convertToModelMessages,
    smoothStream,
    type UIMessage,
} from 'ai';
import { getCurrentUser } from '@/lib/db';
import { piggyaiModel } from '@/lib/piggyai/model';
import { buildAgentConfig } from '@/lib/piggyai/agent-config';

export async function POST(request: Request) {
    let user;
    try {
        user = await getCurrentUser();
    } catch (e) {
        console.error('PiggyAI chat: authentication failed', e);
        return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { messages }: { messages: UIMessage[] } = await request.json();

    // Reasoning traces are one model's internal chain-of-thought, meaningless
    // as input to a different (or non-reasoning) model — and some providers
    // reject a 'reasoning' part outright for models that don't support it.
    // Clients may still be holding history saved under a prior provider, so
    // this strips it at the boundary rather than trusting the client only
    // ever sends parts the current model understands.
    const sanitizedMessages = messages.map((message) => ({
        ...message,
        parts: message.parts.filter((part) => part.type !== 'reasoning'),
    }));

    // userId is bound here, once, server-side — never read from the request
    // body, so the model has no parameter through which to supply one.
    const result = streamText({
        model: piggyaiModel,
        ...buildAgentConfig(user.id),
        messages: await convertToModelMessages(sanitizedMessages),
        // The underlying model emits only a handful of large text chunks
        // (whole clauses at a time) rather than small token deltas, so
        // without this the UI visibly jumps between big blocks of text.
        // This re-buffers the stream into word-sized increments. The
        // default 10ms delay drains each buffered chunk almost instantly
        // (a burst of words, then a stall for the next chunk) which reads
        // as jittery rather than an even pace, so it's slowed down here.
        experimental_transform: smoothStream({
            chunking: 'word',
            delayInMs: 35,
        }),
    });

    return result.toUIMessageStreamResponse();
}
