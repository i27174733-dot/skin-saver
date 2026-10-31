// Cloudflare Worker: POST /api/analyze (Gemini API 사용)
const SYSTEM = `너는 화장품 성분 분석 도우미야. 사용자가 보낸 사진에서 전성분 표를 읽고, 사용자 프로필에 맞춰 궁합을 분석해.
규칙:
- 반드시 JSON만 출력해. 설명문, 마크다운, 코드블록 금지.
- 성분표가 보이지 않거나 읽을 수 없으면 {"error":"성분표를 읽을 수 없어요. 전성분이 선명하게 보이는 사진으로 다시 올려주세요."} 만 출력해.
- 확실하지 않은 성분 정보는 단정하지 말고 reason에 "확실하지 않음"이라고 적어.
- 임신·수유 중이면 레티노이드, 고농도 살리실산 등 주의 성분을 warnings에 꼭 반영해.
- 알레르기 성분이나 기피 조건(무향, 무알코올 등)에 해당하면 warnings에 넣어.
- 현재 쓰는 활성 성분과 겹치거나 충돌하는 조합은 conflicts에 넣어. 여드름 고민이 있으면 코메도제닉 가능 성분을 comedogenic에 넣어.
- 의학적 진단은 하지 마.
출력 형식:
{"product_type":"","overall_score":0,"verdict":"추천|주의|비추천","summary":"한 줄 총평","ingredients":[{"name":"","role":"","fit":"맞음|보통|주의","reason":""}],"warnings":[],"comedogenic":[],"conflicts":[],"usage_tip":""}
ingredients는 핵심 성분 위주로 최대 15개, 한국어로.`;

const MODEL = "gemini-3.8-flash";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
async function fetchRetry(url, opts, tries = 3) {
  let res;
  for (let i = 0; i < tries; i++) {
    res = await fetch(url, opts);
    if (res.status !== 503 && res.status !== 429) return res;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return res;
}
async function analyze(request, env) {
  if (!env.GEMINI_API_KEY) return json({ error: "서버에 API 키가 설정되지 않았어요." }, 500);
  let body;
  try { body = await request.json(); } catch { return json({ error: "잘못된 요청이에요." }, 400); }
  const { image, profile } = body || {};
  if (!image || typeof image !== "string" || image.length > 6_000_000)
    return json({ error: "이미지가 없거나 너무 커요." }, 400);

  const res = await fetchRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: image } },
            { text: "사용자 프로필: " + JSON.stringify(profile || {}) + "\n위 사진의 성분표를 분석해줘." },
          ],
        }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096 },
      }),
    }
  );
    if (!res.ok) { const t = await res.text(); return json({ error: "AI 호출 실패 (" + res.status + "): " + t.slice(0, 300) }, 502); }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").replace(/```json|```/g, "").trim();
  try { return json(JSON.parse(text)); }
  catch { return json({ error: "분석 결과를 해석하지 못했어요. 다시 시도해주세요." }, 502); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/analyze") {
      if (request.method !== "POST") return json({ error: "POST 요청만 가능해요." }, 405);
      return analyze(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
