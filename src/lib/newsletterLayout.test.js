import { describe, expect, it } from "vitest";
import {
  LAYOUTS, LAYOUT_KEYS, newsletterText, normalizeContent, renderNewsletterHtml, safeUrl, starterContent
} from "../../supabase/functions/send-outbound/newsletterLayout.js";

const footer = { brand: "New Bridges for Haitian Success", why: "Why", address: "123 Main St", stopLabel: "Unsubscribe", href: "https://app.nb4hs.org/unsubscribe?t=x" };

describe("newsletter layouts", () => {
  it("has the seven layouts from the layout chart", () => {
    expect(LAYOUT_KEYS).toEqual(["single", "f_pattern", "zigzag", "multi", "pyramid", "hybrid", "double"]);
  });

  it("starts each layout with the sections its mock-up shows", () => {
    expect(LAYOUT_KEYS.map((k) => starterContent(k).sections.length)).toEqual([2, 4, 3, 3, 0, 2, 2]);
    expect(starterContent("double").cta.label).toBe("");
    expect(starterContent("multi").subheading).not.toBe("");
  });

  it("keeps only https (and mailto for links) addresses", () => {
    expect(safeUrl("https://x.org/a")).toBe("https://x.org/a");
    expect(safeUrl("http://x.org/a")).toBe("");
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("mailto:a@b.org")).toBe("");
    expect(safeUrl("mailto:a@b.org", true)).toBe("mailto:a@b.org");
    expect(safeUrl('https://x.org/"onload=1')).toBe("");
    expect(safeUrl("http://127.0.0.1:55321/storage/v1/x.png")).not.toBe("");
  });

  it("trims and caps content to the layout", () => {
    const many = Array.from({ length: 20 }).map((_, i) => ({ title: "S" + i }));
    const c = normalizeContent({ headline: "  Hi  ", sections: many, hero: "nope" }, "double");
    expect(c.headline).toBe("Hi");
    expect(c.sections).toHaveLength(LAYOUTS.double.max);
    expect(c.hero).toEqual({ src: "", alt: "" });
  });

  it("renders every layout, escaping text and keeping the footer", () => {
    LAYOUT_KEYS.forEach((layout) => {
      const content = Object.assign(starterContent(layout), { headline: "<b>Fall</b>" });
      const html = renderNewsletterHtml({ layout, content, subject: "S", language: "ht", footer }, { placeholders: true });
      expect(html).toContain("&lt;b&gt;Fall&lt;/b&gt;");
      expect(html).not.toContain("<b>Fall");
      expect(html).toContain('lang="ht"');
      expect(html).toContain("123 Main St");
      expect(html).toContain('href="https://app.nb4hs.org/unsubscribe?t=x"');
      expect(html).toContain("<svg"); // placeholders where images are missing
    });
  });

  it("leaves missing images out of the real email", () => {
    const html = renderNewsletterHtml({ layout: "zigzag", content: starterContent("zigzag"), subject: "S", footer });
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<img");
  });

  it("lays sections out per layout", () => {
    const content = Object.assign(starterContent("multi"), { sections: [{ title: "A" }, { title: "B" }, { title: "C" }, { title: "D" }] });
    const grid3 = renderNewsletterHtml({ layout: "multi", content, subject: "S", footer });
    expect((grid3.match(/width="33%"/g) || []).length).toBe(6); // two rows of three, the second padded
    const pyramid = renderNewsletterHtml({ layout: "pyramid", content, subject: "S", footer });
    expect(pyramid).not.toContain(">A</h3>");
  });

  it("writes a plain-text version with link addresses", () => {
    const text = newsletterText({
      headline: "Fall", intro: "Classes", cta: { label: "Sign up", url: "https://x.org" },
      sections: [{ title: "ESL", text: "Mornings", link: { label: "More", url: "https://x.org/esl" } }]
    }, "single");
    expect(text).toBe("Fall\n\nClasses\n\nSign up: https://x.org\n\nESL\nMornings\nMore: https://x.org/esl");
    expect(newsletterText({ headline: "Only", sections: [{ title: "Hidden" }] }, "pyramid")).toBe("Only");
  });
});
