import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/workflow.ts", "lib/metrics.ts", "lib/time.ts", "lib/auth/lockout.ts", "lib/urls.ts", "lib/period-params.ts", "lib/commands.ts", "lib/csv.ts", "lib/report-rows.ts", "lib/calendar.ts", "lib/request-form.ts", "lib/command-preview.ts", "lib/staff-rules.ts"],
      thresholds: {
        "lib/workflow.ts": { branches: 100, functions: 100, lines: 100, statements: 100 },
        "lib/metrics.ts": { branches: 100, functions: 100, lines: 100, statements: 100 },
      },
    },
  },
});
