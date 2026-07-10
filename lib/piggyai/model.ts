import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createProviderRegistry } from 'ai';

const GOOGLE_GENERATIVE_AI_API_KEY =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';

if (!GOOGLE_GENERATIVE_AI_API_KEY)
    throw new Error(
        'Error creating Gemini client due to missing ENV variable, check GOOGLE_GENERATIVE_AI_API_KEY'
    );

// Each provider is constructed explicitly from its own env var (not the
// package's implicit default lookup), matching lib/plaid_client.ts's
// throw-early-on-missing-config convention. This registry is the one and
// only place a provider package should be imported — add more `providerId:
// createXxx({...})` entries here as new provider families are adopted.
// Everything downstream (route handlers, tools) imports `piggyaiModel` as
// an opaque LanguageModel and never touches this file.
const registry = createProviderRegistry({
    google: createGoogleGenerativeAI({ apiKey: GOOGLE_GENERATIVE_AI_API_KEY }),
});

// 'provider:model-id', e.g. 'google:gemma-4-31b-it'. Switching to another
// model already on a registered provider is a pure env var edit; switching
// to a new provider family needs that provider registered above first.
// Cast needed because this string is read from env (widened to `string`),
// while the registry's literal-union type only knows models baked into the
// installed @ai-sdk/google version at publish time — newer model ids (like
// Gemma 4's) are still accepted at runtime via that package's own
// `${string}` escape hatch, just not by the stale literal union.
const PIGGYAI_MODEL = (process.env.PIGGYAI_MODEL ||
    'google:gemma-4-31b-it') as Parameters<typeof registry.languageModel>[0];

export const piggyaiModel = registry.languageModel(PIGGYAI_MODEL);
