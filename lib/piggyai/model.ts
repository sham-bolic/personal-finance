import { createGroq } from '@ai-sdk/groq';
import { createProviderRegistry } from 'ai';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

if (!GROQ_API_KEY)
    throw new Error(
        'Error creating Groq client due to missing ENV variable, check GROQ_API_KEY'
    );

// Each provider is constructed explicitly from its own env var (not the
// package's implicit default lookup), matching lib/plaid_client.ts's
// throw-early-on-missing-config convention. This registry is the one and
// only place a provider package should be imported — add more `providerId:
// createXxx({...})` entries here as new provider families are adopted.
// Everything downstream (route handlers, tools) imports `piggyaiModel` as
// an opaque LanguageModel and never touches this file.
//
// Groq over a hosted Gemini key on purpose: Groq's free tier has no billing
// path attached (no card on file, so no surprise-bill exposure from key
// abuse) and Groq states API inputs/outputs aren't used to train models.
const registry = createProviderRegistry({
    groq: createGroq({ apiKey: GROQ_API_KEY }),
});

// 'provider:model-id', e.g. 'groq:openai/gpt-oss-20b'. Switching to another
// model already on a registered provider is a pure env var edit; switching
// to a new provider family needs that provider registered above first.
// Cast needed because this string is read from env (widened to `string`),
// while the registry's literal-union type only knows models baked into the
// installed @ai-sdk/groq version at publish time — newer model ids are
// still accepted at runtime via that package's own `${string}` escape
// hatch, just not by the stale literal union.
//
// openai/gpt-oss-20b chosen over llama-3.3-70b-versatile per
// scripts/piggyai-eval.ts: it was the only model with zero defects across
// every test case (accuracy + tool-call efficiency), and its single-call
// tool use burns less of Groq's free-tier token budget per request than
// llama-3.3-70b-versatile's occasional duplicate calls did.
const PIGGYAI_MODEL = (process.env.PIGGYAI_MODEL ||
    'groq:openai/gpt-oss-20b') as Parameters<typeof registry.languageModel>[0];

export const piggyaiModel = registry.languageModel(PIGGYAI_MODEL);
