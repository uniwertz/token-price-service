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
          expect(res.body).toHaveProperty("tokensCount");
          expect(res.body).toHaveProperty("timestamp");
          expect(typeof res.body.tokensCount).toBe("number");
        });
    });

    it("/pricing/status (GET)", () => {
      return request(app.getHttpServer())
        .get("/pricing/status")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("status", "ready");
          expect(res.body).toHaveProperty("tokensCount");
          expect(res.body).toHaveProperty("timestamp");
          expect(typeof res.body.tokensCount).toBe("number");
        });
    });

    it("/pricing/tokens (GET)", () => {
      return request(app.getHttpServer())
        .get("/pricing/tokens")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("tokens");
          expect(res.body).toHaveProperty("totalCount");
          expect(res.body).toHaveProperty("timestamp");
          expect(Array.isArray(res.body.tokens)).toBe(true);
          expect(typeof res.body.totalCount).toBe("number");

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

    it("/pricing/trigger-update (POST)", () => {
      return request(app.getHttpServer())
        .post("/pricing/trigger-update")
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty("status", "completed");
          expect(res.body).toHaveProperty("message");
          expect(res.body).toHaveProperty("timestamp");
          expect(res.body).toHaveProperty("duration");
        });
    });
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
