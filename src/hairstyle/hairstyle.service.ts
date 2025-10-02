/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import sharp from 'sharp';
import * as fs from 'fs';
import { writeFile } from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class HairstyleService {
  private ngrokUrl = 'https://f829acc1ca3f.ngrok-free.app'; // your ngrok URL

  private saveBase64AsFile(base64Image: string): string {
    const matches = base64Image.match(/^data:image\/\w+;base64,(.+)$/);
    if (!matches) throw new Error('Invalid base64 image');

    const buffer = Buffer.from(matches[1], 'base64');
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}.jpg`;
    const filePath = path.join(__dirname, '..', '..', 'public', fileName);

    // Ensure public dir exists
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);

    // Return public URL that Replicate can access
    return `${this.ngrokUrl}/public/${fileName}`;
  }

  async normalizeBase64Image(base64Image: string): Promise<string> {
    const matches = base64Image.match(/^data:image\/\w+;base64,(.+)$/);
    if (!matches) throw new Error('Invalid base64 image');

    const buffer = Buffer.from(matches[1], 'base64');

    // Convert to RGB, strip alpha, and resize to 1024x1024
    const rgbBuffer = await sharp(buffer)
      .removeAlpha()
      .resize(1024, 1024, { fit: 'cover' })
      .jpeg()
      .toBuffer();

    return `data:image/jpeg;base64,${rgbBuffer.toString('base64')}`;
  }

  async generateImage(
    base64Source: string,
    styleDescription: string,
    color: string,
  ) {
    // 1️⃣ Normalize base64 (resize + clean alpha)
    const normalized = await this.normalizeBase64Image(base64Source);

    // 2️⃣ Save locally and expose via ngrok
    const sourceUrl = this.saveBase64AsFile(normalized);

    // 3️⃣ Prepare input for Replicate
    const input = {
      image: sourceUrl,
      editing_type: 'both',
      hairstyle_description: styleDescription,
      color_description: color,
    };

    if (!process.env.REPLICATE_API_TOKEN) {
      console.error(
        '[generateImage] ❌ Missing REPLICATE_API_TOKEN env variable!',
      );
    } else {
      console.log(
        '[generateImage] using token (length only for safety):',
        process.env.REPLICATE_API_TOKEN.length,
      );
    }

    // 4️⃣ Create prediction
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version:
          'b95cb2a16763bea87ed7ed851d5a3ab2f4655e94bcfb871edba029d4814fa587',
        input,
      }),
    });

    const prediction: any = await response.json();
    console.log('prediction:', prediction);

    if (!prediction.urls?.get) {
      throw new Error(
        'Failed to create prediction: ' + JSON.stringify(prediction),
      );
    }

    // 5️⃣ Poll until finished
    let result: any = prediction;
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(result.urls.get, {
        headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` },
      });
      result = await pollRes.json();
    }

    // 6️⃣ Save or return result
    if (result.status === 'succeeded') {
      let urls: string[] = [];

      if (Array.isArray(result.output)) {
        urls = result.output;
      } else if (typeof result.output === 'string') {
        urls = [result.output];
      } else {
        throw new Error(
          'Unexpected output format: ' + JSON.stringify(result.output),
        );
      }

      // Save first result locally with unique filename
      const uniqueName = `output-${randomUUID()}.png`;
      const outputPath = path.join(__dirname, '..', '..', 'public', uniqueName);

      const imageResp = await fetch(urls[0]);
      const buffer = await imageResp.arrayBuffer();
      await writeFile(outputPath, Buffer.from(buffer));

      return {
        replicateUrls: urls,
        localUrl: `${this.ngrokUrl}/public/${uniqueName}`,
      };
    } else {
      throw new Error('Prediction failed: ' + JSON.stringify(result));
    }
  }
}
