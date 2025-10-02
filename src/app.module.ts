import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HairstyleModule } from './hairstyle/hairstyle.module';
import * as dotenv from 'dotenv';
dotenv.config();

@Module({
  imports: [HairstyleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
