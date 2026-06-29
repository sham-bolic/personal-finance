// TEMPORARY in-memory token store for local testing only.
// Holds a single user's access_token in server memory.
// Limitations: lost on server restart, single-user, not shared reliably
// across serverless instances. Replace with a database before building features.

let accessToken: string | null = null;

export function setAccessToken(token: string) {
    accessToken = token;
}

export function getAccessToken() {
    return accessToken;
}
