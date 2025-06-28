import * as assert from 'assert';
import fetch from 'node-fetch';
import { suite, test } from 'mocha';

suite('Ollama API Connection', () => {
  test('Debe responder Ollama sin timeout', async () => {
	
    const baseUrl = 'http://localhost:11434'; // cambia por tu URL Ollama
    const model = 'codellama:7b';

   const payload = {
  model,
  messages: [
    { role: "user", content: "print('Hola mundo')" }
  ]
};

    const controller = new AbortController();
    const timeout = 10000; // 10 segundos para la prueba

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        assert.fail(
          `Respuesta no exitosa: status=${response.status} ${response.statusText}, body=${text}`
        );
      }

      const data = await response.json();
      assert.ok(data, 'No se recibió data');

      console.log('Respuesta de Ollama:', data);
    } catch (error) {
      if (error === 'AbortError') {
        assert.fail(`Timeout de ${timeout / 1000} segundos alcanzado.`);
      } else {
        assert.fail(`Error en la solicitud: ${error}`);
      }
    }
  });
}).timeout(10000);
