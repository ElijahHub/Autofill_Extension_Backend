import jsdom from "jsdom";
import axios from "axios";
import puppeteer, { Frame, Puppeteer } from "puppeteer";
import { FieldDetail, HiddenField } from "../types";

//Simple Scan using jsdom
export async function detectHiddenFormsWithJSDOM(
  url: string
): Promise<{ hiddenFields: HiddenField[] }> {
  const { JSDOM } = jsdom;

  try {
    // Fetch the HTML content of the page

    if (!url.startsWith("http")) {
      throw new Error("Invalid URL format. URL must start with http or https.");
    }

    const res = await axios.get(url);
    const html = await res.data;
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const hiddenFields: HiddenField[] = [];

    // Get the window object from the document
    const win = document.defaultView;

    if (!win) return { hiddenFields };

    // Find all form elements
    const forms = document.querySelectorAll<HTMLFormElement>("form");
    forms.forEach((form) => {
      const inputs = form.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >("input, textarea, select");

      inputs.forEach((input) => {
        const type = (input as HTMLInputElement).type || "text";
        const hiddenByStyle =
          isElementHidden(input, win) || hasHiddenAncestor(input, win);

        const isHidden =
          type === "hidden" ||
          input.offsetHeight === 0 ||
          input.offsetWidth === 0 ||
          input.style.display === "none" ||
          input.style.visibility === "hidden" ||
          hiddenByStyle;

        if (isHidden) {
          hiddenFields.push({
            name: input.name || null,
            type: type,
            reason: "Element is hidden",
            location: form.action || url || "unknown",
            selector: `form[action="${form.action}"] input[name="${input.name}"]`,
          });
        }
      });
    });

    //Orphan inputs detection
    const allInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>("input")
    );
    allInputs.forEach((input) => {
      const type = input.getAttribute("type") || "text";
      const display = input.style.display;
      const visibility = input.style.visibility;
      const ariaHidden = input.getAttribute("aria-hidden");
      const hiddenByStyle =
        isElementHidden(input, win) || hasHiddenAncestor(input, win);

      // Check if the input is hidden
      const isHidden =
        type === "hidden" ||
        input.offsetHeight === 0 ||
        input.offsetWidth === 0 ||
        display === "none" ||
        visibility === "hidden" ||
        ariaHidden === "true" ||
        hiddenByStyle;

      if (isHidden && !input.closest("form")) {
        hiddenFields.push({
          name: input.getAttribute("name"),
          type: type,
          reason: "Hidden input not within a form",
          location: "main page",
          selector: input.outerHTML.slice(0, 100), // Limit to first 100 characters
        });
      }
    });

    return { hiddenFields: hiddenFields };
  } catch (error) {
    console.error("Error in detectHiddenFormsWithJSDOM:", error);
    return { hiddenFields: [] };
  }
}

//Advance scan using puppeteer

export async function detectHiddenFormsWithPuppeteer(
  url: string,
  headless: boolean | "shell" = true
): Promise<{ hiddenFields: FieldDetail[] }> {
  const browser = await puppeteer.launch({ headless });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 3000)); // wait for any dynamic content

    // Function to evaluate hidden fields in a frame
    const evaluateHiddenFields = async (
      frame: Frame,
      location: string
    ): Promise<FieldDetail[]> => {
      return await frame.evaluate((location: any) => {
        function isHidden(el: HTMLElement): boolean {
          const style = window.getComputedStyle(el);
          return (
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.opacity === "0" ||
            el.offsetWidth === 0 ||
            el.offsetHeight === 0 ||
            el.getAttribute("type") === "hidden" ||
            el.getAttribute("aria-hidden") === "true"
          );
        }

        function hasHiddenAncestor(el: HTMLElement): boolean {
          let parent = el.parentElement;
          while (parent) {
            if (isHidden(parent)) return true;
            parent = parent.parentElement;
          }
          return false;
        }

        const result: FieldDetail[] = [];

        const inputs = Array.from(
          document.querySelectorAll("input, textarea, select")
        ) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];

        inputs.forEach((input) => {
          const type = (input as HTMLInputElement).type || "text";
          const isInputHidden = isHidden(input) || hasHiddenAncestor(input);

          if (isInputHidden) {
            const boundingBox = input.getBoundingClientRect();
            result.push({
              name: input.getAttribute("name"),
              type,
              reason: "Hidden via CSS, type, or hidden ancestor",
              selector: `${input.tagName.toLowerCase()}[name="${input.getAttribute(
                "name"
              )}"]`,
              location,
              boundingBox: {
                top: boundingBox.top,
                left: boundingBox.left,
                width: boundingBox.width,
                height: boundingBox.height,
              },
            });
          }
        });

        return result;
      }, location);
    };

    // Collect hidden fields from main frame
    const hiddenFields: FieldDetail[] = await evaluateHiddenFields(
      page.mainFrame(),
      "main page"
    );

    // Collect hidden fields from iframes
    const frames = page.frames().filter((f) => f !== page.mainFrame());
    for (const frame of frames) {
      try {
        const iframeHiddenFields = await evaluateHiddenFields(
          frame,
          `iframe (${frame.url()})`
        );
        hiddenFields.push(...iframeHiddenFields);
      } catch (error: any) {
        console.warn(`Skipping iframe (${frame.url()}):`, error.message);
      }
    }

    return { hiddenFields };
  } catch (error) {
    console.error("Error in detectHiddenFormsWithPuppeteer:", error);
    return { hiddenFields: [] };
  } finally {
    await browser.close();
  }
}

// Helper functions to check if an element is hidden or has a hidden ancestor
function hasHiddenAncestor(el: Element, window: Window): boolean {
  let parent = el.parentElement;
  while (parent) {
    if (isElementHidden(parent, window)) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

// Function to check if an element is hidden based on its computed style
function isElementHidden(el: Element, window: Window): boolean {
  const style = window.getComputedStyle(el);

  return (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0" ||
    parseFloat(style.width) === 0 ||
    parseFloat(style.height) === 0
  );
}
