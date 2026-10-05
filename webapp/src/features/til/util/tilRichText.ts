// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import DOMPurify from "dompurify";

// Everything to do with the "What did you learn?" rich-text field: the HTML
// sanitizing every value goes through whether it's being edited or read
// back, and the plain-text helpers that let the 5000-char limit and the
// "is this actually empty" check reason about content, not markup. Mirrors
// promotion's own promotionRichText.ts (same library, same allowlist); kept
// as its own copy rather than a shared import because PAR's and Promotion's
// equivalents are already separate per-feature copies, not one shared util.

// Sanitized on both write and read: `what` is written by one employee and
// read by every OTHER employee who opens the feed, so the read side never
// trusts that the editor sanitized it either.
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "ol", "ul", "li", "a"],
  ALLOWED_ATTR: ["href", "target"],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

export function sanitizeTilHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

// Converts to plain text for the two things that must count characters, not
// markup: the 0/5000 counter and the max-length check. Block-level tags
// become a space first so "<p>One</p><p>Two</p>" doesn't read as "OneTwo".
export function tilPlainText(html: string): string {
  return html
    .replace(/<\/(p|li|br)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function tilPlainTextLength(html: string): number {
  return tilPlainText(html).length;
}

/** A Quill editor with nothing typed still returns markup (`<p><br></p>`,
 * not `""`), so `.trim() === ""` on the raw HTML never catches an empty
 * entry — check the plain-text content instead. */
export function isEmptyTilHtml(html: string): boolean {
  return tilPlainText(html) === "";
}

const EXCERPT_LENGTH = 180;

/** A plain-text preview for the feed list — formatting (bold, lists) is
 * what's lost in a one-line excerpt anyway, so this trims at a word
 * boundary near EXCERPT_LENGTH rather than mid-word, and only appends "…"
 * when something was actually cut. The full rich version still shows on
 * the entry's own page. */
export function tilExcerpt(html: string, maxLength: number = EXCERPT_LENGTH): string {
  const text = tilPlainText(html);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}
