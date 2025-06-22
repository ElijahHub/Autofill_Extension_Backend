import jsdom from "jsdom";
import axios from "axios";

export async function detectHiddenFormsWithJSDOM(
  url: string
): Promise<ApiResponse> {
  const { JSDOM } = jsdom;

  try {
    if (!url.startsWith("http")) {
      throw new Error("Invalid URL format. URL must start with http or https.");
    }

    const res = await axios.get(url);
    const html = await res.data;
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const hiddenFields: Array<{
      selector: string;
      suspicious: boolean;
      reason: string;
    }> = [];
    const win = document.defaultView;

    if (!win)
      return {
        hiddenFields,
        metadata: { riskLevel: "low", recommendations: ["Window not found."] },
      };

    const forms = document.querySelectorAll<HTMLFormElement>("form");

    forms.forEach((form) => {
      const inputs = form.querySelectorAll<HTMLElement>(
        "input, textarea, select"
      );

      inputs.forEach((input) => {
        const type = (input as HTMLInputElement).type || "text";

        if (type === "hidden") return;

        const { isHidden, reason } = isStaticallyHiddenWithReason(input, win);

        if (isHidden) {
          hiddenFields.push({
            selector: `form[action="${
              form.action
            }"] input[name="${input.getAttribute("name")}"]`,
            suspicious: true,
            reason: `${reason} (within form: ${
              form.action || url || "unknown"
            })`,
          });
        }
      });
    });

    // Check orphan inputs not in a form
    const allInputs = Array.from(
      document.querySelectorAll<HTMLElement>("input, textarea, select")
    );

    allInputs.forEach((input) => {
      const type = (input as HTMLInputElement).type || "text";

      if (type === "hidden") return;

      const { isHidden, reason } = isStaticallyHiddenWithReason(input, win);

      if (isHidden && !input.closest("form")) {
        hiddenFields.push({
          selector: input.outerHTML.slice(0, 100),
          suspicious: true,
          reason: `${reason} (orphan input)`,
        });
      }
    });

    // Calculate risk level
    let riskLevel: "low" | "medium" | "high" = "low";
    if (hiddenFields.length >= 5 && hiddenFields.length < 10) {
      riskLevel = "medium";
    } else if (hiddenFields.length >= 10) {
      riskLevel = "high";
    }

    const recommendations: string[] = [];
    if (hiddenFields.length > 0) {
      recommendations.push(
        "Review hidden fields to ensure they are not used for malicious autofill."
      );
      recommendations.push(
        "Consider blocking autofill on suspicious or hidden fields."
      );
    } else {
      recommendations.push("No suspicious hidden fields detected.");
    }

    return {
      hiddenFields,
      metadata: {
        riskLevel,
        recommendations,
      },
    };
  } catch (error) {
    console.error("Error in detectHiddenFormsWithJSDOM:", error);

    return {
      hiddenFields: [],
      metadata: {
        riskLevel: "low",
        recommendations: [
          "Scan failed. Please retry or check the page manually.",
        ],
      },
    };
  }
}

// Only detect statically verifiable hidden properties in jsdom
function isStaticallyHiddenWithReason(
  el: Element,
  window: Window
): { isHidden: boolean; reason: string } {
  const style = window.getComputedStyle(el);

  if (style.display === "none")
    return { isHidden: true, reason: "Hidden via display: none" };
  if (style.visibility === "hidden")
    return { isHidden: true, reason: "Hidden via visibility: hidden" };
  if (style.opacity === "0")
    return { isHidden: true, reason: "Hidden via opacity: 0" };
  if (el.getAttribute("aria-hidden") === "true")
    return { isHidden: true, reason: "Hidden via aria-hidden attribute" };

  const ancestor = hasStaticallyHiddenAncestor(el, window);
  if (ancestor.isHidden)
    return { isHidden: true, reason: `Ancestor: ${ancestor.reason}` };

  return { isHidden: false, reason: "" };
}

function hasStaticallyHiddenAncestor(
  el: Element,
  window: Window
): { isHidden: boolean; reason: string } {
  let parent = el.parentElement;
  while (parent) {
    const { isHidden, reason } = isStaticallyHiddenWithReason(parent, window);
    if (isHidden) return { isHidden: true, reason };
    parent = parent.parentElement;
  }
  return { isHidden: false, reason: "" };
}

// Response Type
export interface ApiResponse {
  hiddenFields: Array<{
    selector: string;
    suspicious: boolean;
    reason: string;
  }>;
  metadata: {
    riskLevel: "low" | "medium" | "high";
    recommendations: string[];
  };
}
