import { Test, TestingModule } from '@nestjs/testing';
import { HairstyleController } from './hairstyle.controller';

describe('HairstyleController', () => {
  let controller: HairstyleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HairstyleController],
    }).compile();

    controller = module.get<HairstyleController>(HairstyleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
