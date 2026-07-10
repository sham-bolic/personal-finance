import {
    streamText,
    convertToModelMessages,
    stepCountIs,
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
    });

    return result.toUIMessageStreamResponse();
}
