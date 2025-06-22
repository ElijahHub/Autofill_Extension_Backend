import puppeteer, { Frame } from "puppeteer";

export async function detectHiddenFormsWithPuppeteer(
  url: string
): Promise<ApiResponse> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

    const evaluateHiddenFields = async (frame: Frame, location: string) => {
      return await frame.evaluate((location: any) => {
        function getHiddenReason(el: HTMLElement): string | null {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();

          if (style.display === "none") return "Hidden via display: none";
          if (style.visibility === "hidden")
            return "Hidden via visibility: hidden";
          if (style.opacity === "0") return "Hidden via opacity: 0";
          if (
            style.clip !== "auto" &&
            style.clip !== "rect(auto, auto, auto, auto)"
          )
            return "Hidden via clip property";
          if (style.clipPath !== "none") return "Hidden via clip-path property";
          if (style.fontSize === "0px") return "Hidden via font-size: 0";
          if (style.position === "absolute" && parseInt(style.left) <= -9999)
            return "Hidden via absolute off-screen positioning";
          if (
            style.position === "fixed" &&
            (rect.bottom <= 0 || rect.top >= window.innerHeight)
          )
            return "Hidden via fixed off-screen positioning";
          if (
            rect.width <= 10 ||
            rect.height <= 10 ||
            el.offsetWidth <= 10 ||
            el.offsetHeight <= 10
          )
            return "Hidden via zero size";
          if (el.getAttribute("aria-hidden") === "true")
            return "Hidden via aria-hidden attribute";
          if (
            style.overflow === "hidden" &&
            (rect.bottom <= 0 || rect.top >= window.innerHeight)
          )
            return "Hidden via overflow hidden and off-screen";
          if (style.color === style.backgroundColor && style.color !== "")
            return "Hidden via color matching background";

          return null;
        }

        function hasHiddenAncestor(el: HTMLElement): {
          hidden: boolean;
          reason: string | null;
        } {
          let parent = el.parentElement;
          while (parent) {
            const reason = getHiddenReason(parent);
            if (reason) return { hidden: true, reason: `Ancestor: ${reason}` };
            parent = parent.parentElement;
          }
          return { hidden: false, reason: null };
        }

        const results: {
          selector: string;
          suspicious: boolean;
          reason: string;
        }[] = [];
        const inputs = Array.from(
          document.querySelectorAll("input, textarea, select")
        ) as HTMLElement[];

        inputs.forEach((input) => {
          const inputType = (input as HTMLInputElement).type || "text";
          if (inputType === "hidden") return; // Skip explicitly hidden input fields

          const reason = getHiddenReason(input);
          if (reason) {
            results.push({
              selector: `${input.tagName.toLowerCase()}[name="${input.getAttribute(
                "name"
              )}"]`,
              suspicious: true,
              reason: `${reason} (${location})`,
            });
            return;
          }

          const ancestorCheck = hasHiddenAncestor(input);
          if (ancestorCheck.hidden) {
            results.push({
              selector: `${input.tagName.toLowerCase()}[name="${input.getAttribute(
                "name"
              )}"]`,
              suspicious: true,
              reason: `${ancestorCheck.reason} (${location})`,
            });
          }
        });

        return results;
      }, location);
    };

    let allHiddenFields: {
      selector: string;
      suspicious: boolean;
      reason: string;
    }[] = [];

    // Main page check
    const mainHiddenFields = await evaluateHiddenFields(
      page.mainFrame(),
      "main page"
    );
    allHiddenFields.push(...mainHiddenFields);

    // Check iframes
    const frames = page.frames().filter((f) => f !== page.mainFrame());
    const iframeResults = await Promise.all(
      frames.map((frame) =>
        evaluateHiddenFields(frame, `iframe (${frame.url()})`).catch(
          (err: any) => {
            console.warn(`Skipping iframe (${frame.url()}):`, err.message);
            return [];
          }
        )
      )
    );

    iframeResults.forEach((result) => allHiddenFields.push(...result));

    // Calculate risk level
    let riskLevel: "low" | "medium" | "high" = "low";
    if (allHiddenFields.length >= 3 && allHiddenFields.length < 6) {
      riskLevel = "medium";
    } else if (allHiddenFields.length >= 7) {
      riskLevel = "high";
    }

    const recommendations: string[] = [];
    if (allHiddenFields.length > 0) {
      recommendations.push(
        "Review hidden fields to ensure they are not used for malicious autofill."
      );
      recommendations.push("Block autofill on hidden or suspicious fields.");
    } else {
      recommendations.push("No suspicious hidden fields detected.");
    }

    const response: ApiResponse = {
      hiddenFields: allHiddenFields,
      metadata: {
        riskLevel,
        recommendations,
      },
    };

    return response;
  } catch (error) {
    console.error("Error in detectHiddenFormsWithPuppeteer:", error);

    return {
      hiddenFields: [],
      metadata: {
        riskLevel: "low",
        recommendations: [
          "Scan failed. Please retry or check the page manually.",
        ],
      },
    };
  } finally {
    await browser.close();
  }
}

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
