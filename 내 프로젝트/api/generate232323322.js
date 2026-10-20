export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // GEMINI_API_KEY 환경변수에서만 API 키를 안전하게 읽어옵니다.
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: '서버 환경변수(GEMINI_API_KEY)가 설정되지 않았습니다. Vercel 설정에서 GEMINI_API_KEY를 추가해주세요.' 
    });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: '올바른 데이터 수집 계획을 입력해주세요.' });
  }

  const SYSTEM_INSTRUCTION = `<task>
당신은 AI 데이터셋 편향성 탐지기 및 데이터 윤리 컨설턴트입니다. 사용자가 입력한 데이터 수집 시나리오를 분석하여, 통계적/윤리적 편향성(Bias) 위험을 진단하고 이를 해결하기 위한 실질적인 편향성 완화 방안 3가지를 제안하세요.
</task>
<constraints>
- 차분하고 객관적인 전문가의 어조를 사용할 것.
- 사용자가 엉뚱한 내용을 입력하면 "올바른 데이터 수집 계획을 입력해주세요."라고만 답할 것.
- 반드시 아래의 <format>에 제시된 5가지 항목 형태로만 답변할 것.
</constraints>
<format>
[위험도] 높음 / 중간 / 낮음 중 택 1
[소외 그룹] (소외되거나 과소 대표될 수 있는 집단 명시)
[과대 대표 그룹] (과대 대표될 수 있는 집단 명시)
[분석 결과] (어떤 편향성이 발생할 수 있는지 3문장 이내로 요약)
[완화 방안]
1. (첫 번째 완화 방안 명시)
2. (두 번째 완화 방안 명시)
3. (세 번째 완화 방안 명시)
</format>`;

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API Error details:', errorData);

      if (response.status === 400 || response.status === 403) {
        return res.status(response.status).json({ error: '유효하지 않은 API 키이거나 권한이 없습니다. Vercel 환경변수 GEMINI_API_KEY를 확인해주세요.' });
      }
      return res.status(response.status).json({ error: '다시 시도해주세요' });
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      return res.status(500).json({ error: '다시 시도해주세요' });
    }

    return res.status(200).json({ result: resultText });

  } catch (error) {
    console.error('Serverless Function Error:', error);
    return res.status(500).json({ error: '다시 시도해주세요' });
  }
}