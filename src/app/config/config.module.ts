import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";

import { validateEnv } from "./env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
