import type { UrlState } from "./types";

export function readUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get("page") ?? "1");
  return {
    petId: params.get("pet"),
    query: params.get("q") ?? "",
    group: params.get("group") ?? "",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

export function writeUrlState(state: Partial<UrlState>, { replace = true } = {}) {
  const params = new URLSearchParams(window.location.search);

  if ("petId" in state) {
    if (state.petId) params.set("pet", state.petId);
    else params.delete("pet");
  }
  if ("query" in state) {
    if (state.query) params.set("q", state.query);
    else params.delete("q");
  }
  if ("group" in state) {
    if (state.group) params.set("group", state.group);
    else params.delete("group");
  }
  if ("page" in state) {
    if (state.page && state.page > 1) params.set("page", String(state.page));
    else params.delete("page");
  }

  const search = params.toString();
  const next = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
  if (replace) window.history.replaceState(null, "", next);
  else window.history.pushState(null, "", next);
}

export function buildShareUrl(petId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("pet", petId);
  return url.toString();
}
