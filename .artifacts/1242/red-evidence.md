npm warn Unknown user config "electron_mirror". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
[WebServer] npm warn Unknown env config "electron-mirror". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
[WebServer] npm warn Unknown user config "electron_mirror". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

Running 1 test using 1 worker
××F

  1) e2e/doc-property-panel.spec.ts:1020:1 › #1242 形态切换图标按当前态显示对应形态（L 三横线 / T 双竖栏） ─────────────────

    Error: expect(locator).toHaveCount(expected) failed

    Locator:  locator('[data-testid="dpb-a"]').locator('[data-testid="dpb-variant-toggle"]').locator('svg path')
    Expected: 1
    Received: 2
    Timeout:  5000ms

    Call log:
      - Expect "toHaveCount" with timeout 5000ms
      - waiting for locator('[data-testid="dpb-a"]').locator('[data-testid="dpb-variant-toggle"]').locator('svg path')
        14 × locator resolved to 2 elements
           - unexpected value "2"


      1031 |
      1032 |   const pathsA = toggleA.locator("svg path");
    > 1033 |   await expect(pathsA).toHaveCount(1);
           |                        ^
      1034 |   const dA = await pathsA.first().getAttribute("d");
      1035 |   expect(dA).toBe("M3.5 7h6 M3.5 12h4.5 M3.5 17h3");
      1036 |   await dpbRecord(page, "1242", "01-a-icon-l");
        at /Users/mason/ToHighs/clairis/e2e/doc-property-panel.spec.ts:1033:24

    Error Context: test-results/doc-property-panel--1242-形态切换图标按当前态显示对应形态（L-三横线-T-双竖栏）/error-context.md

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: expect(locator).toHaveCount(expected) failed

    Locator:  locator('[data-testid="dpb-a"]').locator('[data-testid="dpb-variant-toggle"]').locator('svg path')
    Expected: 1
    Received: 2
    Timeout:  5000ms

    Call log:
      - Expect "toHaveCount" with timeout 5000ms
      - waiting for locator('[data-testid="dpb-a"]').locator('[data-testid="dpb-variant-toggle"]').locator('svg path')
        14 × locator resolved to 2 elements
           - unexpected value "2"


      1031 |
      1032 |   const pathsA = toggleA.locator("svg path");
    > 1033 |   await expect(pathsA).toHaveCount(1);
           |                        ^
      1034 |   const dA = await pathsA.first().getAttribute("d");
      1035 |   expect(dA).toBe("M3.5 7h6 M3.5 12h4.5 M3.5 17h3");
      1036 |   await dpbRecord(page, "1242", "01-a-icon-l");
        at /Users/mason/ToHighs/clairis/e2e/doc-property-panel.spec.ts:1033:24

    Error Context: test-results/doc-property-panel--1242-形态切换图标按当前态显示对应形态（L-三横线-T-双竖栏）-retry1/error-context.md

    Retry #2 ───────────────────────────────────────────────────────────────────────────────────────

    Error: expect(locator).toHaveCount(expected) failed

    Locator:  locator('[data-testid="dpb-a"]').locator('[data-testid="dpb-variant-toggle"]').locator('svg path')
    Expected: 1
    Received: 2
    Timeout:  5000ms

    Call log:
      - Expect "toHaveCount" with timeout 5000ms
      - waiting for locator('[data-testid="dpb-a"]').locator('[data-testid="dpb-variant-toggle"]').locator('svg path')
        14 × locator resolved to 2 elements
           - unexpected value "2"


      1031 |
      1032 |   const pathsA = toggleA.locator("svg path");
    > 1033 |   await expect(pathsA).toHaveCount(1);
           |                        ^
      1034 |   const dA = await pathsA.first().getAttribute("d");
      1035 |   expect(dA).toBe("M3.5 7h6 M3.5 12h4.5 M3.5 17h3");
      1036 |   await dpbRecord(page, "1242", "01-a-icon-l");
        at /Users/mason/ToHighs/clairis/e2e/doc-property-panel.spec.ts:1033:24

    Error Context: test-results/doc-property-panel--1242-形态切换图标按当前态显示对应形态（L-三横线-T-双竖栏）-retry2/error-context.md

  1 failed
    e2e/doc-property-panel.spec.ts:1020:1 › #1242 形态切换图标按当前态显示对应形态（L 三横线 / T 双竖栏） ──────────────────
