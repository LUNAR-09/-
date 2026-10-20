export default async function handler(req, res) {
  // 1. POST 요청(데이터 전달 요청)만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Vercel 환경변수(GEMINI_API_KEY) 우선 확인
  let apiKey = process.env.GEMINI_API_KEY;

  // 3. 환경변수가 없으면 웹페이지 사용자가 직접 입력한 API 키 확인
  if (!apiKey) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7).trim();
    }
  }

  // API 키가 둘 다 없는 경우 예외 처리
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API 키가 필요합니다. 상단 입력창에 Gemini API Key를 입력하거나 Vercel 환경변수(GEMINI_API_KEY)를 설정해주세요.' 
    });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: '올바른 데이터 수집 계획을 입력해주세요.' });
  }

  // 4. AI에게 전달할 시스템 프롬프트 (규칙 및 응답 양식 고정)
  const SYSTEM_INSTRUCTION = `<task>
당신은 AI 데이터셋 편향성 탐지기입니다. 사용자가 입력한 데이터 수집 시나리오를 분석하여, 통계적/윤리적 편향성(Bias)이 발생할 위험을 진단하세요.
</task>
<constraints>
- 차분하고 객관적인 전문가의 어조를 사용할 것.
- 사용자가 엉뚱한 내용을 입력하면 "올바른 데이터 수집 계획을 입력해주세요."라고만 답할 것.
- 반드시 아래의 <format>에 제시된 4가지 항목 형태로만 답변할 것.
</constraints>
<format>
[위험도] 높음 / 중간 / 낮음 중 택 1
[소외 그룹] (소외되거나 과소 대표될 수 있는 집단 명시)
[과대 대표 그룹] (과대 대표될 수 있는 집단 명시)
[분석 결과] (어떤 편향성이 발생할 수 있는지 3문장 이내로 요약)
</format>`;

  try {
    // 5. 구글 Gemini API 서버로 요청 보내기
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
        return res.status(response.status).json({ error: '유효하지 않은 API 키이거나 권한이 없습니다. API 키를 다시 확인해주세요.' });
      }
      return res.status(response.status).json({ error: '다시 시도해주세요' });
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      return res.status(500).json({ error: '다시 시도해주세요' });
    }

    // 6. 정상적인 AI 진단 결과를 웹페이지(index.html)로 전송
    return res.status(200).json({ result: resultText });

  } catch (error) {
    console.error('Serverless Function Error:', error);
    return res.status(500).json({ error: '다시 시도해주세요' });
  }
}