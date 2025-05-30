// This file provides both Puppeteer and jsdom-based hidden form detection services

import puppeteer from "puppeteer";
import jsdom from "jsdom";

const { JSDOM } = jsdom;

export type FieldDetail = {
  name: string | null;
  type: string;
  reason: string;
  location?: string; // "main page" or "iframe"
  selector?: string;
  boundingBox?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
};

// Advanced Scan using Puppeteer
export async function detectHiddenFormsWithPuppeteer(
  url: string
): Promise<{ hiddenFields: FieldDetail[] }> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const hiddenFields = await page.evaluate(() => {
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

      const result: FieldDetail[] = [];
      const inputs = Array.from(document.querySelectorAll("input"));
      for (const input of inputs) {
        if (isHidden(input)) {
          const rect = input.getBoundingClientRect();
          result.push({
            name: input.getAttribute("name"),
            type: input.getAttribute("type") || "text",
            reason: "Hidden via CSS or input type",
            selector: input?.outerHTML.slice(0, 100),
            boundingBox: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            },
            location: "main page",
          });
        }
      }
      return result;
    });

    const frames = page.frames().filter((f) => f.url() !== page.url());
    for (const frame of frames) {
      try {
        const iframeHidden = await frame.evaluate(() => {
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

          const result: FieldDetail[] = [];
          const inputs = Array.from(document.querySelectorAll("input"));
          for (const input of inputs) {
            if (isHidden(input)) {
              const rect = input.getBoundingClientRect();
              result.push({
                name: input.getAttribute("name"),
                type: input.getAttribute("type") || "text",
                reason: "Hidden via CSS or input type",
                selector: input?.outerHTML.slice(0, 100),
                boundingBox: {
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                },
                location: "iframe",
              });
            }
          }
          return result;
        });

        hiddenFields.push(...iframeHidden);
      } catch (err) {
        console.warn("Could not evaluate iframe:", frame.url(), err);
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

// Simple Scan using jsdom
export async function detectHiddenFormsWithJSDOM(
  url: string
): Promise<{ hiddenFields: FieldDetail[] }> {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const hiddenFields: FieldDetail[] = [];

    const inputs = Array.from(document.querySelectorAll("input"));
    for (const input of inputs) {
      const type = input.getAttribute("type") || "text";
      const display = input.style.display;
      const visibility = input.style.visibility;
      const ariaHidden = input.getAttribute("aria-hidden");

      const isHidden =
        display === "none" ||
        visibility === "hidden" ||
        type === "hidden" ||
        ariaHidden === "true";

      if (isHidden) {
        hiddenFields.push({
          name: input.getAttribute("name"),
          type,
          reason: "Hidden via inline CSS or type",
          location: "main page",
          selector: input?.outerHTML.slice(0, 100),
        });
      }
    }

    return { hiddenFields };
  } catch (error) {
    console.error("Error in detectHiddenFormsWithJSDOM:", error);
    return { hiddenFields: [] };
  }
}

//controller
import { Request, Response } from "express";
import puppeteer from "puppeteer";
import jsdom from "jsdom";

const { JSDOM } = jsdom;

export async function scanPageHandler(req: Request, res: Response) {
  const { url, level = "simple" } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    let result;

    switch (level) {
      case "simple":
        result = await simpleJsdomScan(url);
        break;
      case "medium":
        result = await puppeteerScan(url, "shell");
        break;
      case "advanced":
        result = await puppeteerScan(url, true);
        break;
      default:
        return res.status(400).json({ error: "Invalid scan level" });
    }

    return res.json({ scanLevel: level, ...result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Scan failed", details: error.message });
  }
}

//other
async function simpleJsdomScan(url: string) {
  const res = await fetch(url);
  const html = await res.text();

  const dom = new JSDOM(html);
  const document = dom.window.document;

  const forms = [...document.querySelectorAll("form")];

  const hiddenFields = forms.flatMap((form) => {
    const inputs = [...form.querySelectorAll("input")];
    return inputs
      .filter((input) => {
        const type = input.getAttribute("type");
        const style = input.getAttribute("style");
        return (
          type === "hidden" ||
          (style && style.includes("display: none")) ||
          input.hasAttribute("hidden")
        );
      })
      .map((input) => ({
        name: input.name,
        type: input.type,
        cssSelector: getCssSelector(input),
      }));
  });

  return { hiddenFields };
}

//other2
async function puppeteerScan(url: string, headless: boolean | "shell") {
  const browser = await puppeteer.launch({ headless });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });
  await page.waitForTimeout(2000);

  const hiddenFields = await page.evaluate(() => {
    const forms = [...document.querySelectorAll("form")];

    return forms.flatMap((form) => {
      const inputs = [...form.querySelectorAll("input")];
      return inputs
        .filter((input) => {
          const style = window.getComputedStyle(input);
          return (
            input.type === "hidden" ||
            style.display === "none" ||
            style.visibility === "hidden" ||
            input.hasAttribute("hidden")
          );
        })
        .map((input) => ({
          name: input.name,
          type: input.type,
          cssSelector: getCssPath(input),
          boundingRect: input.getBoundingClientRect(),
        }));
    });

    function getCssPath(el: Element): string {
      if (!(el instanceof Element)) return "";
      const path = [];
      while (el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.id) {
          selector += "#" + el.id;
          path.unshift(selector);
          break;
        } else {
          let sib = el,
            nth = 1;
          while ((sib = sib.previousElementSibling)) {
            if (sib.nodeName.toLowerCase() === selector) nth++;
          }
          selector += `:nth-of-type(${nth})`;
        }
        path.unshift(selector);
        el = el.parentElement!;
      }
      return path.join(" > ");
    }
  });

  await browser.close();
  return { hiddenFields };
}

//what
import puppeteer from "puppeteer";

type FieldDetail = {
  name: string | null;
  type: string;
  reason: string;
  location?: string; // iframe origin or page
};

export async function detectHiddenFormsWithPuppeteer(
  url: string
): Promise<{ hiddenFields: FieldDetail[] }> {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait a few seconds in case forms load late
    await page.waitForTimeout(3000);

    const hiddenFields = await page.evaluate(() => {
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

      const inputs = Array.from(document.querySelectorAll("input"));
      const hidden = inputs
        .filter((input) => isHidden(input))
        .map((input) => ({
          name: input.getAttribute("name"),
          type: input.getAttribute("type") || "text",
          reason: "Hidden via CSS or input type",
          location: "main page",
        }));

      return hidden;
    });

    // Also check iframes
    const frames = page.frames().filter((f) => f.url() !== page.url());
    for (const frame of frames) {
      try {
        const iframeHidden = await frame.evaluate(() => {
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

          const inputs = Array.from(document.querySelectorAll("input"));
          const hidden = inputs
            .filter((input) => isHidden(input))
            .map((input) => ({
              name: input.getAttribute("name"),
              type: input.getAttribute("type") || "text",
              reason: "Hidden via CSS or input type",
              location: "iframe",
            }));

          return hidden;
        });

        hiddenFields.push(...iframeHidden);
      } catch (err) {
        console.warn("Could not evaluate iframe:", frame.url(), err);
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

//jsdom
import { JSDOM } from "jsdom";
import axios from "axios";

type FieldDetail = {
  name: string | null;
  type: string;
  reason: string;
};

export async function detectHiddenFormsFromUrl(url: string): Promise<{
  hiddenFields: FieldDetail[];
}> {
  const { data: html } = await axios.get(url);
  return detectHiddenFieldsFromHtml(html);
}

export function detectHiddenFieldsFromHtml(html: string): {
  hiddenFields: FieldDetail[];
} {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const inputs = Array.from(document.querySelectorAll("input"));
  const hiddenFields: FieldDetail[] = [];

  inputs.forEach((input) => {
    const style = dom.window.getComputedStyle(input);

    const isHidden =
      input.type === "hidden" ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      input.offsetWidth === 0 ||
      input.offsetHeight === 0 ||
      input.getAttribute("aria-hidden") === "true";

    if (isHidden) {
      hiddenFields.push({
        name: input.name || null,
        type: input.type,
        reason: "Element is visually or programmatically hidden",
      });
    }
  });

  return { hiddenFields };
}

//xkkxlax
import puppeteer from "puppeteer";

export interface FieldDetail {
  name: string | null;
  type: string;
  reason: string;
  selector: string;
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  location: string;
}

export async function detectHiddenFormsWithPuppeteer(
  url: string,
  headless: boolean | "shell"
): Promise<{ hiddenFields: FieldDetail[] }> {
  const browser = await puppeteer.launch({
    headless: headless === "shell" ? false : headless,
  });

  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForTimeout(3000);

    const hiddenFields: FieldDetail[] = [];

    const evaluateHiddenFields = () => {
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
      );

      for (const input of inputs) {
        const isInputHidden = isHidden(input) || hasHiddenAncestor(input);
        if (isInputHidden) {
          const rect = input.getBoundingClientRect();
          result.push({
            name: input.getAttribute("name"),
            type: input.getAttribute("type") || "text",
            reason: "Hidden via CSS, type, or hidden ancestor",
            selector: input.outerHTML.slice(0, 100),
            boundingBox: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            },
            location: "main page",
          });
        }
      }

      return result;
    };

    const pageHiddenFields = await page.evaluate(evaluateHiddenFields);
    hiddenFields.push(...pageHiddenFields);

    const frames = page.frames().filter((f) => f.url() !== page.url());
    for (const frame of frames) {
      try {
        const iframeHiddenFields = await frame.evaluate(evaluateHiddenFields);
        iframeHiddenFields.forEach((field) => (field.location = "iframe"));
        hiddenFields.push(...iframeHiddenFields);
      } catch (err) {
        console.warn(`Could not evaluate iframe (${frame.url()}):`, err);
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
