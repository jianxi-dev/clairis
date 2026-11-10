删除前全量单测：116 文件 / 1465 用例通过
删除后 tsc：exit 0
现行机制覆盖确认：immersive-per-pane-tabs 3 passed + immersive-chrome 5 passed（1 flaky 重跑通过）
git ls-files 确认：e2e/immersive-peek.spec.ts 与 src/components/ImmersivePeekBar.tsx 已删除
