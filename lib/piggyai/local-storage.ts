import type { UIMessage } from 'ai';

const STORAGE_KEY = 'piggyai:chat-history';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type StoredChat = { savedAt: number; messages: UIMessage[] };

export function loadChatHistory(): UIMessage[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
        const parsed: StoredChat = JSON.parse(raw);
        if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
            localStorage.removeItem(STORAGE_KEY);
            return [];
        }
        return parsed.messages;
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return [];
    }
}

export function saveChatHistory(messages: UIMessage[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), messages })
    );
}

export function clearChatHistory(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
}
