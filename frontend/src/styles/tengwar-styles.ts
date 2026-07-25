import { css } from "lit";

export const tengwarStyles = css`
  @font-face {
    font-family: "Tengwar Annatar";
    src: url("/fonts/tengwar-annatar-glaemunicode.woff") format("woff"),
         url("/fonts/tengwar-annatar-glaemunicode.ttf") format("truetype");
    font-weight: normal;
    font-style: normal;
  }

  @font-face {
    font-family: "Tengwar Annatar";
    src: url("/fonts/tengwar-annatar-glaemunicode-bold.woff") format("woff"),
         url("/fonts/tengwar-annatar-glaemunicode-bold.ttf") format("truetype");
    font-weight: bold;
    font-style: normal;
  }

  @font-face {
    font-family: "Tengwar Annatar";
    src: url("/fonts/tengwar-annatar-glaemunicode-italic.woff") format("woff"),
         url("/fonts/tengwar-annatar-glaemunicode-italic.ttf") format("truetype");
    font-weight: normal;
    font-style: italic;
  }

  @font-face {
    font-family: "Tengwar Eldamar";
    src: url("/fonts/tengwar-eldamar-glaemunicode.woff") format("woff"),
         url("/fonts/tengwar-eldamar-glaemunicode.ttf") format("truetype");
  }

  @font-face {
    font-family: "Tengwar Parmaite";
    src: url("/fonts/tengwar-parmaite-glaemunicode.woff") format("woff"),
         url("/fonts/tengwar-parmaite-glaemunicode.ttf") format("truetype");
  }

  .tengwar-text, .tengwar {
    font-family: "Tengwar Annatar", "Tengwar Eldamar", "Tengwar Parmaite", sans-serif;
    color: var(--eldamo-gold-bright, #f0d193);
    line-height: 1.2;
  }
`;
