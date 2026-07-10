import {
    streamText,
    convertToModelMessages,
    stepCountIs,
    smoothStream,
    type UIMessage,
} from 'ai';
import { getCurrentUser } from '@/lib/db';
import { piggyaiModel } from '@/lib/piggyai/model';
import { buildPiggyaiTools } from '@/lib/piggyai/tools';
import { buildSystemPrompt } from '@/lib/piggyai/system-prompt';

export async function POST(request: Request) {
    let user;
    try {
        user = await getCurrentUser();
    } catch (e) {
        console.error('PiggyAI chat: authentication failed', e);
        return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { messages }: { messages: UIMessage[] } = await request.json();

    // userId is bound here, once, server-side — never read from the request
    // body, so the model has no parameter through which to supply one.
    const tools = buildPiggyaiTools(user.id);

    const result = streamText({
        model: piggyaiModel,
        system: buildSystemPrompt(new Date().toISOString().slice(0, 10)),
        messages: await convertToModelMessages(messages),
        tools,
        stopWhen: stepCountIs(5),
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
        // Left at its default thinking level, the model spends many seconds
        // of internal chain-of-thought before each tool call and again
        // before the final answer — the dominant share of response latency,
        // traced at ~75% of total time on a two-tool query. Every factual
        // claim is already forced through a tool call result (see system
        // prompt), so answer correctness doesn't depend on deep reasoning
        // here. This model only accepts a discrete thinkingLevel (a numeric
        // thinkingBudget errors as unsupported), and 'minimal' is the
        // lowest level it accepts ('low'/'medium' are rejected too).
        providerOptions: {
            google: {
                thinkingConfig: { thinkingLevel: 'minimal' },
            },
        },
    });

    return result.toUIMessageStreamResponse();
}
