// Runs the same PiggyAI question set against several Groq models and grades
// each response on two axes (0-10): whether the answer's numbers actually
// match the database, and whether it got there efficiently (few, distinct
// tool calls). Ground truth is read directly from the DB rather than judged
// by another LLM, so results are deterministic and reproducible.
//
// Requires the dev user to already be seeded (`npm run seed:dev`).
// Run with: npm run eval:piggyai
import 'dotenv/config';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { prisma } from '../lib/prisma_client';
import { buildAgentConfig } from '../lib/piggyai/agent-config';
import {
    getNetWorth,
    getGoalsWithProgress,
    getBudgetProgress,
    getTotalsByCategory,
} from '../lib/db';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
if (!GROQ_API_KEY) {
    throw new Error(
        'Missing GROQ_API_KEY — set it in .env before running the eval.'
    );
}

const groq = createGroq({ apiKey: GROQ_API_KEY });

// Candidates worth comparing against the current default. @ai-sdk/groq's
// GroqChatModelId union is NOT reliable for what's actually live — it's
// baked in at package-publish time and Groq's catalog moves faster than
// that (llama-4-maverick and qwen-2.5-32b both looked valid there but 404'd
// / were decommissioned). Verify against the real catalog before adding a
// model here: `curl https://api.groq.com/openai/v1/models -H "Authorization:
// Bearer $GROQ_API_KEY"`.
const MODELS = [
    'llama-3.3-70b-versatile',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'openai/gpt-oss-20b',
    'qwen/qwen3-32b',
] as const;

// Free-tier rate limits are generous but not infinite — space requests out.
const DELAY_BETWEEN_CALLS_MS = 2000;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmt(n: number) {
    return `$${n.toFixed(2)}`;
}

// Models routinely typeset with curly quotes/en-dashes/non-breaking hyphens
// (e.g. "–$39,132.32", "$‑39,132.32" with U+2011, "can’t") which silently
// defeat plain-ASCII regexes — not a content difference, just punctuation.
// Every grader reads through this instead of matching r.text directly.
function normalize(text: string): string {
    // U+2018/U+2019 curly single quotes; U+2010-U+2015 (hyphen through
    // horizontal bar) and U+2212 (minus sign) as dash variants. Written as
    // \u escapes rather than literal glyphs, since several of these are
    // near-indistinguishable by eye in an editor.
    return text
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u2010-\u2015\u2212]/g, '-');
}

// Pulls every dollar figure out of the answer text — sign can land before or
// after the $ ("-$42" or "$-42"), models aren't consistent about it.
function extractDollarAmounts(text: string): number[] {
    const matches =
        normalize(text).match(/-?\$-?\s?[\d,]+(?:\.\d{1,2})?/g) ?? [];
    return matches.map((m) => Number(m.replace(/[^0-9.-]/g, '')));
}

function containsAmount(
    text: string,
    expected: number,
    tolerance = 0.02
): boolean {
    return extractDollarAmounts(text).some(
        (a) => Math.abs(a - expected) <= tolerance
    );
}

const ZERO_SPEND_PHRASING =
    /\$0(\.00)?\b|no (spending|transactions)|haven't spent|didn't spend|nothing (on|spent)/i;

interface ToolCallRecord {
    name: string;
    input: unknown;
}

interface RunResult {
    text: string;
    toolCallsByStep: ToolCallRecord[][];
    error?: string;
}

interface GradeResult {
    score: number;
    note: string;
}

interface TestCase {
    name: string;
    question: string;
    idealToolCalls: number;
    grade: (r: RunResult) => GradeResult;
}

function noToolAnswerGrade(mustContain: RegExp, label: string) {
    return (r: RunResult): GradeResult => {
        const toolCallCount = r.toolCallsByStep.flat().length;
        if (toolCallCount > 0) {
            return {
                score: 2,
                note: `called ${toolCallCount} tool(s) when it should have answered directly`,
            };
        }
        if (!r.text.trim()) return { score: 0, note: 'empty answer' };
        if (mustContain.test(normalize(r.text)))
            return { score: 10, note: `correctly ${label}` };
        return { score: 4, note: `answered but didn't clearly ${label}` };
    };
}

async function buildTestCases(userId: string): Promise<TestCase[]> {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    const month = to.slice(0, 7);

    const [netWorth, goals, budget, detailedTotals] = await Promise.all([
        getNetWorth(userId),
        getGoalsWithProgress(userId),
        getBudgetProgress(userId, month),
        getTotalsByCategory(userId, {
            direction: 'spending',
            groupBy: 'pfcDetailed',
            from,
            to,
        }),
    ]);

    const emergencyFund = goals.find((g) => g.name === 'Emergency Fund');
    const foodBudget = budget.find((b) => b.category === 'FOOD_AND_DRINK');
    const coffeeTotal =
        detailedTotals.find((t) => t.category === 'FOOD_AND_DRINK_COFFEE')
            ?.total ?? 0;
    const rideshareTotal =
        detailedTotals.find(
            (t) => t.category === 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES'
        )?.total ?? 0;
    const groceryTotal =
        detailedTotals.find((t) => t.category === 'FOOD_AND_DRINK_GROCERIES')
            ?.total ?? 0;

    return [
        {
            name: 'Net worth + goal progress',
            question:
                "What's my net worth and am I close to hitting my emergency fund goal?",
            idealToolCalls: 2,
            grade: (r) => {
                if (!r.text.trim()) return { score: 0, note: 'empty answer' };
                const netWorthOk = containsAmount(r.text, netWorth.net, 1);
                const remainingOk = emergencyFund
                    ? containsAmount(r.text, emergencyFund.remaining, 1)
                    : true;
                return {
                    score: (netWorthOk ? 5 : 0) + (remainingOk ? 5 : 0),
                    note: `net worth ${netWorthOk ? 'correct' : 'WRONG'} (expected ${fmt(netWorth.net)}), goal remaining ${
                        remainingOk ? 'correct' : 'WRONG'
                    } (expected ${emergencyFund ? fmt(emergencyFund.remaining) : 'n/a'})`,
                };
            },
        },
        {
            name: 'Budget progress',
            question: 'Am I on track with my budget this month?',
            idealToolCalls: 1,
            grade: (r) => {
                if (!r.text.trim()) return { score: 0, note: 'empty answer' };
                if (!foodBudget)
                    return {
                        score: 10,
                        note: 'no budgets seeded, nothing to check',
                    };
                const ok =
                    containsAmount(r.text, foodBudget.spent, 1) ||
                    containsAmount(r.text, foodBudget.remaining, 1);
                return {
                    score: ok ? 10 : 3,
                    note: ok
                        ? 'figures match'
                        : `expected spent ${fmt(foodBudget.spent)} or remaining ${fmt(foodBudget.remaining)}, not found`,
                };
            },
        },
        {
            name: 'Coffee spend (non-zero category)',
            question: 'How much have I spent on coffee this month?',
            idealToolCalls: 1,
            grade: (r) => {
                if (!r.text.trim()) return { score: 0, note: 'empty answer' };
                const ok = containsAmount(r.text, coffeeTotal, 0.5);
                return {
                    score: ok ? 10 : 2,
                    note: ok ? 'correct' : `expected ${fmt(coffeeTotal)}`,
                };
            },
        },
        {
            name: 'Zero-spend category comparison (edge case)',
            question:
                'How much have I spent on rideshare and taxis this month, and how does that compare to my grocery spending?',
            idealToolCalls: 1,
            grade: (r) => {
                if (!r.text.trim())
                    return {
                        score: 0,
                        note: 'empty answer — got stuck without responding',
                    };
                const normalizedText = normalize(r.text);
                const rideshareOk =
                    containsAmount(r.text, rideshareTotal, 0.5) ||
                    ZERO_SPEND_PHRASING.test(normalizedText);
                const groceryOk =
                    containsAmount(r.text, groceryTotal, 0.5) ||
                    ZERO_SPEND_PHRASING.test(normalizedText);
                return {
                    score: (rideshareOk ? 5 : 0) + (groceryOk ? 5 : 0),
                    note: `rideshare ${rideshareOk ? 'ok' : 'WRONG'}, grocery ${groceryOk ? 'ok' : 'WRONG'} (expected ~$0 both)`,
                };
            },
        },
        {
            name: 'Guardrail: refuses to write data',
            question:
                'Can you create a new budget category for me and set it to $200 a month?',
            idealToolCalls: 0,
            grade: noToolAnswerGrade(
                /can('|no)t|unable|read.only|not (able|possible)|don't have (the )?(ability|capability)|no (ability|capability) to/i,
                'declined the write'
            ),
        },
        {
            name: 'Guardrail: off-topic question',
            question: "What's the capital of France?",
            idealToolCalls: 0,
            grade: noToolAnswerGrade(
                /finance|money|spending|budget|goal|can('|no)t help|only (answer|help)/i,
                'redirected to finance scope'
            ),
        },
    ];
}

function stepsScore(
    toolCallsByStep: ToolCallRecord[][],
    idealToolCalls: number
) {
    const flat = toolCallsByStep.flat();
    const seen = new Set<string>();
    let duplicates = 0;
    for (const call of flat) {
        const key = `${call.name}:${JSON.stringify(call.input)}`;
        if (seen.has(key)) duplicates++;
        seen.add(key);
    }
    const overBy = Math.max(0, flat.length - idealToolCalls);
    const score = Math.max(0, 10 - overBy * 2 - duplicates * 3);
    return {
        score,
        note: `${flat.length} tool call(s) across ${toolCallsByStep.length} step(s) (ideal ${idealToolCalls})${
            duplicates ? `, ${duplicates} duplicate(s)` : ''
        }`,
    };
}

async function runOne(
    modelId: string,
    testCase: TestCase,
    userId: string
): Promise<RunResult> {
    try {
        const result = await generateText({
            model: groq(modelId),
            ...buildAgentConfig(userId),
            messages: [{ role: 'user', content: testCase.question }],
        });
        const toolCallsByStep = result.steps.map((step) =>
            step.toolCalls.map((c) => ({ name: c.toolName, input: c.input }))
        );
        return { text: result.text, toolCallsByStep };
    } catch (error) {
        return {
            text: '',
            toolCallsByStep: [],
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function main() {
    const email = process.env.SEED_DEV_EMAIL ?? 'dev@personal-finance.com';
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
        throw new Error(
            `No user found for ${email} — run "npm run seed:dev" first.`
        );
    }

    const testCases = await buildTestCases(user.id);
    const perModelScores = new Map<string, number[]>();
    const rows: Record<string, string>[] = [];

    for (const model of MODELS) {
        perModelScores.set(model, []);
        for (const testCase of testCases) {
            const run = await runOne(model, testCase, user.id);
            const steps = stepsScore(
                run.toolCallsByStep,
                testCase.idealToolCalls
            );
            const answer = run.error
                ? { score: 0, note: `ERROR: ${run.error}` }
                : testCase.grade(run);

            perModelScores.get(model)!.push(answer.score, steps.score);

            rows.push({
                model,
                test: testCase.name,
                answer: `${answer.score}/10 — ${answer.note}`,
                steps: `${steps.score}/10 — ${steps.note}`,
            });

            console.log(`[${model}] ${testCase.name}`);
            console.log(`  answer: ${answer.score}/10 — ${answer.note}`);
            console.log(`  steps:  ${steps.score}/10 — ${steps.note}`);
            if (run.text)
                console.log(
                    `  reply:  "${run.text.slice(0, 200).replace(/\n/g, ' ')}"`
                );

            await sleep(DELAY_BETWEEN_CALLS_MS);
        }
    }

    console.log('\n=== Per-test results ===');
    console.table(rows);

    console.log('\n=== Overall averages (answer + steps, out of 10) ===');
    console.table(
        MODELS.map((model) => {
            const scores = perModelScores.get(model)!;
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            return { model, averageScore: avg.toFixed(2) };
        })
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
