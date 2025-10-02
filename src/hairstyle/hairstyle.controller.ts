/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Body, Controller, Post } from '@nestjs/common';
import { HairstyleService } from './hairstyle.service';

@Controller('hairstyle')
export class HairstyleController {
  constructor(private readonly hairstyleService: HairstyleService) {}

  @Post('generate')
  async generate(
    @Body() body: { source: string; styleDescription: string; color: string },
  ) {
    return {
      images: await this.hairstyleService.generateImage(
        body.source,
        body.styleDescription,
        body.color,
      ),
    };
  }
}
