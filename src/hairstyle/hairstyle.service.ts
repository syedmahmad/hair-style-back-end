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
    sourceUrl: string,
    styleDescription: string,
    color: string,
  ) {
    // 1️⃣ Prepare input for Replicate
    const input = {
      image: sourceUrl, // ✅ Cloudinary public URL
      editing_type: 'both',
      hairstyle_description: styleDescription,
      color_description: color,
    };

    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error(
        '[generateImage] ❌ Missing REPLICATE_API_TOKEN env variable!',
      );
    }

    // 2️⃣ Create prediction
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
    console.log('prediction created:', prediction);

    if (!prediction.urls?.get) {
      throw new Error(
        'Failed to create prediction: ' + JSON.stringify(prediction),
      );
    }

    // 3️⃣ Poll until finished
    let result: any = prediction;
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(result.urls.get, {
        headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` },
      });
      result = await pollRes.json();
    }

    // 4️⃣ Return result
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

      return { replicateUrls: urls }; // ✅ Only return Replicate URLs now
    } else {
      throw new Error('Prediction failed: ' + JSON.stringify(result));
    }
  }
}
