import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/workflow.ts", "lib/metrics.ts", "lib/time.ts", "lib/auth/lockout.ts", "lib/urls.ts"],
      thresholds: {
        "lib/workflow.ts": { branches: 100, functions: 100, lines: 100, statements: 100 },
        "lib/metrics.ts": { branches: 100, functions: 100, lines: 100, statements: 100 },
      },
    },
  },
});
