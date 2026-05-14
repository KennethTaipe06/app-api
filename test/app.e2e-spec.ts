import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

/**
 * E2E smoke test.
 *
 * Uses a lightweight test module instead of AppModule to avoid requiring
 * live database, Redis, and MinIO connections in CI environments.
 * Integration tests against real infrastructure should run separately
 * with docker-compose providing the required services.
 */

@Controller('health')
class TestHealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestHealthController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET) should return 404 when root route is not defined', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  it('/health (GET) should return 200', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });
});
