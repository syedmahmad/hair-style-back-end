import { Test, TestingModule } from '@nestjs/testing';
import { HairstyleService } from './hairstyle.service';

describe('HairstyleService', () => {
  let service: HairstyleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HairstyleService],
    }).compile();

    service = module.get<HairstyleService>(HairstyleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
