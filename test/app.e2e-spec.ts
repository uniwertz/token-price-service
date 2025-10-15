import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { setupTestDatabase, cleanupTestDatabase } from "./setup-e2e";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Настраиваем тестовую базу данных
    await setupTestDatabase();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    // Очищаем тестовую базу данных
    await cleanupTestDatabase();
  });

  describe("Pricing Controller", () => {
    it("/pricing/health (GET)", () => {
      return request(app.getHttpServer())
        .get("/pricing/health")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("status", "healthy");
          expect(res.body).toHaveProperty("timestamp");
        });
    });

    it("/pricing/status (GET)", () => {
      return request(app.getHttpServer())
        .get("/pricing/status")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("status", "ready");
          expect(res.body).toHaveProperty("hasData");
          expect(res.body).toHaveProperty("timestamp");
        });
    });

    it("/pricing/tokens (GET) - pagination", () => {
      return request(app.getHttpServer())
        .get("/pricing/tokens?page=1&limit=10")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("tokens");
          expect(res.body).toHaveProperty("pagination");
          expect(res.body).toHaveProperty("timestamp");
          expect(Array.isArray(res.body.tokens)).toBe(true);
          
          const { pagination } = res.body;
          expect(pagination).toHaveProperty("page", 1);
          expect(pagination).toHaveProperty("pageSize");
          expect(pagination).toHaveProperty("total");
          expect(pagination).toHaveProperty("totalPages");

          // Проверяем структуру токена, если есть токены
          if (res.body.tokens.length > 0) {
            const token = res.body.tokens[0];
            expect(token).toHaveProperty("id");
            expect(token).toHaveProperty("symbol");
            expect(token).toHaveProperty("displayName");
            expect(token).toHaveProperty("currentPrice");
            expect(token).toHaveProperty("lastPriceUpdateDateTime");
            expect(token).toHaveProperty("chain");
            expect(token.chain).toHaveProperty("name");
          }
        });
    });

    // Убран тест /pricing/trigger-update - слишком долгий для e2e (15k токенов)
  });

  describe("Application Health", () => {
    it("should start the application successfully", () => {
      expect(app).toBeDefined();
    });

    it("should have HTTP server running", () => {
      expect(app.getHttpServer()).toBeDefined();
    });
  });
});
