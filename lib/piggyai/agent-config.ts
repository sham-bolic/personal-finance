import { stepCountIs } from 'ai';
import { buildPiggyaiTools } from './tools';
import { buildSystemPrompt } from './system-prompt';

export const MAX_STEPS = 5;

// Shared between the live chat route and the model-eval script, so eval
// runs exercise the exact same tool budget / forced-final-answer behavior
// production traffic gets — never redefine this shape in a second place.
export function buildAgentConfig(
    userId: string,
    today: string = new Date().toISOString().slice(0, 10)
) {
    return {
        system: buildSystemPrompt(today),
        tools: buildPiggyaiTools(userId),
        stopWhen: stepCountIs(MAX_STEPS),
        // Some models keep choosing to call a tool again rather than ever
        // answering, silently burning the whole step budget and ending the
        // turn with no text at all. Forcing toolChoice: 'none' on the last
        // step makes answering with whatever's already in context the only
        // option, so the user always gets a reply.
        prepareStep: ({ stepNumber }: { stepNumber: number }) =>
            stepNumber === MAX_STEPS - 1
                ? ({ toolChoice: 'none' } as const)
                : {},
    };
}
