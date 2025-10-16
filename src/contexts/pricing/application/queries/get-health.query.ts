import { Injectable } from "@nestjs/common";

@Injectable()
export class GetHealthQuery {
  execute() {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
    };
  }
}
