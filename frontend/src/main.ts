import "@shoelace-style/shoelace/dist/themes/dark.css";
import "@shoelace-style/shoelace/dist/themes/light.css";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";
import "@shoelace-style/shoelace";
import { applyTheme } from "./services/theme";
import "./components/eldamo-app";

setBasePath("/shoelace/");
applyTheme();
