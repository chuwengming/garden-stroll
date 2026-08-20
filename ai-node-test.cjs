
const fs = require('fs');
const path = require('path');
const envRaw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const key = (envRaw.match(/^DEEPSEEK_API_KEY=(.*)$/m) || [])[1];

async function call(body, label) {
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log(label, 'STATUS', res.status, '=>', JSON.stringify(data).slice(0, 300));
  } catch (e) {
    console.log(label, 'ERROR', e.message);
  }
}

(async () => {
  // classify: json + thinking + json word in prompt
  await call({
    model: 'deepseek-v4-flash',
    messages: [{ role: 'user', content: '你是意圖分類器。輸出 json：{"intent":"booking"|"product"|"smalltalk"|"cancel"|"amend"}\n訊息：你好' }],
    temperature: 0.4, max_tokens: 1000,
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
  }, 'CLASSIFY');

  // reply: thinking disabled
  await call({
    model: 'deepseek-v4-flash',
    messages: [
      { role: 'system', content: '你是客服' },
      { role: 'user', content: '你好' },
    ],
    temperature: 0.4, max_tokens: 1000,
    thinking: { type: 'disabled' },
  }, 'REPLY');
})();
