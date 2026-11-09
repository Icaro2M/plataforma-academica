const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3102';
const password = process.env.SMOKE_PASSWORD;
if (!password || password.length < 12) throw new Error('Defina SMOKE_PASSWORD com pelo menos 12 caracteres.');

class Session {
  cookies = new Map();

  cookieHeader() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  rememberCookies(response) {
    const values = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
    for (const value of values) {
      const pair = value.split(';', 1)[0];
      const separator = pair.indexOf('=');
      if (separator > 0) this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  async request(path, options = {}) {
    const headers = new Headers(options.headers);
    const cookie = this.cookieHeader();
    if (cookie) headers.set('cookie', cookie);
    if (options.method === 'POST') headers.set('origin', new URL(baseUrl).origin);
    const response = await fetch(new URL(path, baseUrl), { ...options, headers, redirect: 'manual' });
    this.rememberCookies(response);
    return response;
  }

  async page(path) {
    const response = await this.request(path);
    if (response.status !== 200) throw new Error(`GET ${path} retornou ${response.status}.`);
    return response.text();
  }

  async submit(path, marker, fields) {
    const html = await this.page(path);
    const forms = html.match(/<form[\s\S]*?<\/form>/g) || [];
    const form = forms.find(item => item.includes(marker) && item.includes('$ACTION_ID_'));
    if (!form) throw new Error(`Formulário ${marker} não encontrado em ${path}.`);
    const action = form.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
    if (!action) throw new Error(`Server Action não encontrada em ${path}.`);
    const body = new FormData();
    body.append(action, '');
    for (const [name, value] of Object.entries(fields)) body.append(name, String(value));
    const response = await this.request(path, { method: 'POST', body });
    if (![303, 307, 308].includes(response.status)) {
      const details = (await response.text()).slice(0, 500);
      throw new Error(`POST ${path} retornou ${response.status}: ${details}`);
    }
    return response.headers.get('location') || '';
  }
}

async function login(email) {
  const session = new Session();
  const location = await session.submit('/entrar', 'name="email"', { email, password });
  if (!location.endsWith('/')) throw new Error(`Login de ${email} redirecionou para ${location}.`);
  return session;
}

async function verify(email, questionId, expectedAnswer) {
  const session = await login(email);
  const html = await session.page(`/perguntas/${questionId}`);
  if (!html.includes(expectedAnswer)) throw new Error('A resposta não permaneceu disponível após novo login/reinício.');
  console.log(JSON.stringify({ mode: 'verify', email, questionId, persistence: true }));
}

async function inspectForms(email, path) {
  const session = await login(email);
  const html = await session.page(path);
  const forms = html.match(/<form[\s\S]*?<\/form>/g) || [];
  console.log(JSON.stringify(forms.map((form, index) => ({
    index,
    fields: [...form.matchAll(/name="([^"]+)"/g)].map(match => match[1]),
    text: form.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160),
  })), null, 2));
}

async function answerExisting(email, questionId, body) {
  const session = await login(email);
  const location = await session.submit(`/perguntas/${questionId}`, '<textarea', { questionId, body });
  if (location.includes('error=')) throw new Error(`Resposta rejeitada: ${location}`);
  console.log(JSON.stringify({ mode: 'answer', email, questionId, location }));
}

async function fullSmoke() {
  const stamp = Date.now();
  const emailA = `validacao-a-${stamp}@example.invalid`;
  const emailB = `validacao-b-${stamp}@example.invalid`;
  const expectedAnswer = 'Uma boa estratégia é dividir o problema em casos e montar uma tabela verdade antes de simplificar a expressão.';

  const userA = new Session();
  await userA.submit('/cadastrar', 'name="institutionId"', {
    name: 'Validação Beta A', email: emailA, password, institutionId: 1, courseId: 1,
  });
  const questionLocation = await userA.submit('/perguntas/nova', 'name="title"', {
    courseId: 1,
    subjectId: 1,
    title: 'Como organizar a resolução de uma expressão lógica?',
    body: 'Estou revisando raciocínio lógico e gostaria de entender uma sequência confiável para analisar proposições e simplificar uma expressão antes da prova.',
  });
  const questionId = questionLocation.match(/\/perguntas\/([^?]+)/)?.[1];
  if (!questionId) throw new Error(`ID da pergunta não encontrado no redirect ${questionLocation}.`);

  const userB = new Session();
  await userB.submit('/cadastrar', 'name="institutionId"', {
    name: 'Validação Beta B', email: emailB, password, institutionId: 1, courseId: 1,
  });
  await userB.submit(`/perguntas/${questionId}`, '<textarea', {
    questionId,
    body: expectedAnswer,
  });

  await verify(emailA, questionId, expectedAnswer);
  console.log(JSON.stringify({ mode: 'full', emailA, emailB, questionId, expectedAnswer, success: true }));
}

const [mode, email, questionId, ...answerParts] = process.argv.slice(2);
if (mode === 'verify') await verify(email, questionId, answerParts.join(' '));
else if (mode === 'inspect') await inspectForms(email, questionId);
else if (mode === 'answer') await answerExisting(email, questionId, answerParts.join(' '));
else await fullSmoke();
