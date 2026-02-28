import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ConflictException, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { SeparationsController } from '../separations.controller';
import { SeparationsService } from '../separations.service';
import { FirebaseAuthGuard } from '../../../auth/firebase-auth.guard';

describe('SeparationsController (POST /songs/:songId/separations)', () => {
  let app: INestApplication;
  let service: SeparationsService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SeparationsController],
      providers: [
        {
          provide: SeparationsService,
          useValue: {
            submitSeparation: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = { uid: 'test-user' };
          return true;
        },
      })
      .compile();

    service = moduleFixture.get<SeparationsService>(SeparationsService);
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 202 with task metadata on success', async () => {
    jest.spyOn(service, 'submitSeparation').mockResolvedValue({
      taskId: 'task-123',
      status: 'queued',
      provider: 'poyo',
    });

    await request(app.getHttpServer())
      .post('/songs/song-123/separations')
      .send({})
      .expect(HttpStatus.ACCEPTED)
      .expect((res) => {
        expect(res.body).toEqual({
          success: true,
          data: {
            taskId: 'task-123',
            status: 'queued',
            createdTime: undefined,
            provider: 'poyo',
          },
        });
      });

    expect(service.submitSeparation).toHaveBeenCalledWith(
      'song-123',
      expect.any(Object),
      expect.objectContaining({ userId: 'test-user' }),
    );
  });

  it('should map conflict error to 409', async () => {
    jest
      .spyOn(service, 'submitSeparation')
      .mockRejectedValue(new ConflictException('exists'));

    await request(app.getHttpServer())
      .post('/songs/song-123/separations')
      .send({})
      .expect(HttpStatus.CONFLICT);
  });
});
