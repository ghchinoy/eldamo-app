# Task Completion Protocol

Before declaring any coding task finished:
1. Run `rtk make check` to verify TypeScript type-checking (`tsc`), Vite frontend bundling, and Go compilation.
2. Check `rtk git status` to verify modified files.
3. Update issue status in Beads using `rtk bd close <issue-id> --reason "..." --json`.
