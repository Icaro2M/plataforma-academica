import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AcademicContent } from './academic-content';

describe('conteúdo acadêmico em Markdown', () => {
  const render = (source: string) => renderToStaticMarkup(<AcademicContent>{source}</AcademicContent>);

  it('mostra formatação, fórmulas e código', () => {
    const html = render('**Importante** e $x^2$.\n\n```js\nconst x = 2\n```');
    expect(html).toContain('<strong>Importante</strong>');
    expect(html).toContain('class="katex"');
    expect(html).toContain('language-js');
  });

  it('não executa HTML bruto nem links com JavaScript', () => {
    const html = render('<script>alert(1)</script>\n\n[clique](javascript:alert(1))');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('href="javascript:');
  });

  it('não incorpora imagens externas', () => {
    const html = render('![rastreador](https://example.com/image.png)');
    expect(html).not.toContain('<img');
    expect(html).toContain('Imagem externa não exibida');
  });
});
