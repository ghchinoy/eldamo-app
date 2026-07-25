# Coding & Architecture Conventions

- **Tengwar Scoping**: Lit components rendering Tengwar must import `tengwarStyles` from `../styles/tengwar-styles` and include it in `static styles = [tengwarStyles, css`...`]` because Lit Shadow DOM prevents global CSS rules from crossing element boundaries.
- **Glaemscribe Charsets**: Always use `tengwar_guni_*` charsets. Never use `tengwar_ds_*` (Dan Smith ASCII encoding), which produces garbled text with Unicode PUA web fonts.
- **Header Navigation**: View switching in `eldamo-app.ts` must use explicit `this.viewMode === "..."` guards for every header-bar ternary branch to avoid leaking controls across tabs.
- **Go IPC**: Exported Go methods on `*App` in `app.go` are called from TS via `invokeApi(cmd, args)` in `api.ts`.
