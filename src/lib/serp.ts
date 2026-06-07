// Analyse SERP via SERPAPI. Sert a nourrir le brief (titres concurrents,
// questions "People also ask", recherches associees).

export type SerpAnalysis = {
  keyword: string;
  organic: { title: string; snippet: string; link: string }[];
  questions: string[];
  related: string[];
};

export async function analyzeSerp(keyword: string, gl = "fr", hl = "fr"): Promise<SerpAnalysis> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY manquante");
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("q", keyword);
  url.searchParams.set("engine", "google");
  url.searchParams.set("gl", gl);
  url.searchParams.set("hl", hl);
  url.searchParams.set("num", "10");
  url.searchParams.set("api_key", key);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`serpapi_error:${res.status}`);
  }
  const data = await res.json();

  const organic = (data.organic_results || []).slice(0, 8).map((r: any) => ({
    title: r.title || "",
    snippet: r.snippet || "",
    link: r.link || "",
  }));
  const questions = (data.related_questions || []).map((q: any) => q.question).filter(Boolean);
  const related = (data.related_searches || []).map((r: any) => r.query).filter(Boolean);

  return { keyword, organic, questions, related };
}
