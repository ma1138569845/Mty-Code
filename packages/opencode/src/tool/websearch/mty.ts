import { Effect, Stream } from "effect"

export const QUOTA_EXCEEDED = "Web search quota exhausted. Use `webfetch` with a relevant URL instead."

export function call(
  _http: unknown,
  _url: string,
  _key: string,
  _query: string,
  _model: string,
  _timeout: string,
): Effect.Effect<string[], Error> {
  return Effect.fail(new Error("MtyCoder web search is not configured. Use a different web search provider."))
}
