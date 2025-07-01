import type { JSX } from "react";
import type { BundledLanguage } from "shiki/bundle/web";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";

import * as jsxRuntime from "react/jsx-runtime";
import { codeToHast } from "shiki/bundle/web";

export async function highlight(code: string, lang: string) {
  const hast = await codeToHast(code, {
    lang: lang as BundledLanguage,
    theme: "github-dark",
  });

  return toJsxRuntime(hast, {
    ...jsxRuntime,
  }) as JSX.Element;
}
