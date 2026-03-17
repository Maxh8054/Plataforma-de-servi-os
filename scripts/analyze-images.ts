import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

async function analyzeImage(zai: any, imagePath: string) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extraia todas as informações desta imagem: nomes completos, cargos/funções, locais de trabalho. Liste cada pessoa com seus dados no formato: Nome Completo | Cargo | Local'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`
            }
          }
        ]
      }
    ],
    thinking: { type: 'disabled' }
  });

  return response.choices[0]?.message?.content;
}

async function main() {
  const zai = await ZAI.create();
  const uploadDir = '/home/z/my-project/upload';
  const images = fs.readdirSync(uploadDir).filter(f => f.endsWith('.png'));

  for (const img of images) {
    const imagePath = path.join(uploadDir, img);
    console.log(`\n=== Analisando: ${img} ===\n`);
    try {
      const result = await analyzeImage(zai, imagePath);
      console.log(result);
    } catch (error: any) {
      console.log('Erro:', error.message);
    }
  }
}

main();
