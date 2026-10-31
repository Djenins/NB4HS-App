import { describe, expect, it } from "vitest";
import {
  LAYOUTS, LAYOUT_KEYS, MAX_BLOCKS, newBlock, newsletterText, normalizeBlocks, normalizeContent, renderNewsletterHtml, safeUrl, starterContent
} from "../../supabase/functions/send-outbound/newsletterLayout.js";

const footer = { brand: "New Bridges for Haitian Success", why: "Why", address: "123 Main St", stopLabel: "Unsubscribe", href: "https://app.nb4hs.org/unsubscribe?t=x" };

describe("newsletter layouts", () => {
  it("has the seven layouts from the layout chart, plus Build your own", () => {
    expect(LAYOUT_KEYS).toEqual(["single", "f_pattern", "zigzag", "multi", "pyramid", "hybrid", "double", "custom"]);
  });

  it("starts each layout with the sections its mock-up shows", () => {
    expect(LAYOUT_KEYS.filter((k) => k !== "custom").map((k) => starterContent(k).sections.length)).toEqual([2, 4, 3, 3, 0, 2, 2]);
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
      const content = layout === "custom"
        ? { blocks: [Object.assign(newBlock("title"), { text: "<b>Fall</b>" }), newBlock("image")] }
        : Object.assign(starterContent(layout), { headline: "<b>Fall</b>" });
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

  it("builds an email from blocks, in order", () => {
    const blocks = [
      Object.assign(newBlock("title"), { text: "Fall classes", align: "center" }),
      Object.assign(newBlock("header"), { text: "ESL" }),
      Object.assign(newBlock("text"), { text: "Mornings\n\nAfternoons too" }),
      Object.assign(newBlock("image"), { src: "https://x.org/a.png", alt: "Class", url: "https://x.org/go" }),
      Object.assign(newBlock("link"), { label: "Sign up", url: "https://x.org/s", style: "text" }),
      Object.assign(newBlock("link"), { label: "No address", url: "javascript:x" })
    ];
    const html = renderNewsletterHtml({ layout: "custom", content: { blocks }, subject: "S", footer });
    const order = ["Fall classes", "ESL", "Afternoons too", "a.png", "Sign up"].map((t) => html.indexOf(t));
    expect(order.every((n, i) => n > 0 && (i === 0 || n > order[i - 1]))).toBe(true);
    expect(html).toContain('<h1 style="margin:0;font-size:26px;line-height:1.25;color:#0b1f3a;text-align:center">Fall classes</h1>');
    expect(html).toContain('<a href="https://x.org/go"');
    expect(html).not.toContain("No address");
    expect(html).not.toContain("javascript:");
    expect(newsletterText({ blocks }, "custom")).toBe("Fall classes\n\nESL\n\nMornings\n\nAfternoons too\n\nClass: https://x.org/go\n\nSign up: https://x.org/s");
  });

  it("drops unknown block types, caps the count and keeps ids", () => {
    const many = Array.from({ length: 50 }).map(() => newBlock("text"));
    expect(normalizeBlocks(many)).toHaveLength(MAX_BLOCKS);
    const out = normalizeBlocks([{ type: "video" }, { id: "keep", type: "link", style: "weird" }]);
    expect(out).toEqual([{ id: "keep", type: "link", align: "left", label: "", url: "", style: "button" }]);
    expect(starterContent("custom").blocks.map((b) => b.type)).toEqual(["title", "text", "image", "link"]);
  });
});
