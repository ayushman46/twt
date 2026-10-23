import {
  MAX_TWEETS_PER_REQUEST,
  type AiCategoryInput,
  type AiTweetInput,
  type CategorizeApiRequest,
} from "@twtdash/shared";
import { isRecord } from "./cors";

export const MAX_CATEGORIES = 40;

const LIMITS = {
  id: 64,
  categoryName: 80,
  categoryDescription: 500,
  author: 200,
  // X long posts / notes can be long; the prompt builder clips them anyway.
  text: 30_000,
  links: 20,
  link: 2_048,
  quoted: 10_000,
  media: 200,
  cardTitle: 500,
} as const;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string };

function fail<T>(message: string): ValidationResult<T> {
  return { ok: false, message };
}

function isString(value: unknown, max: number, { allowEmpty = true } = {}): value is string {
  return typeof value === "string" && value.length <= max && (allowEmpty || value.trim().length > 0);
}

function optionalString(
  obj: Record<string, unknown>,
  field: string,
  max: number,
  where: string,
): ValidationResult<string | undefined> {
  const value = obj[field];
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (!isString(value, max)) return fail(`${where}.${field} must be a string of at most ${max} characters.`);
  return { ok: true, value };
}

function validateCategory(raw: unknown, index: number): ValidationResult<AiCategoryInput> {
  const where = `categories[${index}]`;
  if (!isRecord(raw)) return fail(`${where} must be an object.`);
  if (!isString(raw.id, LIMITS.id, { allowEmpty: false })) return fail(`${where}.id must be a non-empty string of at most ${LIMITS.id} characters.`);
  if (!isString(raw.name, LIMITS.categoryName, { allowEmpty: false })) return fail(`${where}.name must be a non-empty string of at most ${LIMITS.categoryName} characters.`);
  const description = raw.description ?? "";
  if (!isString(description, LIMITS.categoryDescription)) return fail(`${where}.description must be a string of at most ${LIMITS.categoryDescription} characters.`);
  return { ok: true, value: { id: raw.id, name: raw.name, description } };
}

function validateTweet(raw: unknown, index: number): ValidationResult<AiTweetInput> {
  const where = `tweets[${index}]`;
  if (!isRecord(raw)) return fail(`${where} must be an object.`);
  if (!isString(raw.id, LIMITS.id, { allowEmpty: false })) return fail(`${where}.id must be a non-empty string of at most ${LIMITS.id} characters.`);
  if (!isString(raw.author, LIMITS.author)) return fail(`${where}.author must be a string of at most ${LIMITS.author} characters.`);
  if (!isString(raw.text, LIMITS.text)) return fail(`${where}.text must be a string of at most ${LIMITS.text} characters.`);

  const tweet: AiTweetInput = { id: raw.id, author: raw.author, text: raw.text };

  if (raw.links !== undefined && raw.links !== null) {
    if (!Array.isArray(raw.links) || raw.links.length > LIMITS.links) {
      return fail(`${where}.links must be an array of at most ${LIMITS.links} strings.`);
    }
    for (const link of raw.links) {
      if (!isString(link, LIMITS.link)) return fail(`${where}.links must only contain strings of at most ${LIMITS.link} characters.`);
    }
    tweet.links = raw.links as string[];
  }

  for (const [field, max] of [
    ["quoted", LIMITS.quoted],
    ["media", LIMITS.media],
    ["cardTitle", LIMITS.cardTitle],
  ] as const) {
    const result = optionalString(raw, field, max, where);
    if (!result.ok) return fail(result.message);
    if (result.value !== undefined) tweet[field] = result.value;
  }

  return { ok: true, value: tweet };
}

/**
 * Validate a `CategorizeApiRequest` body. Unknown fields are dropped so only
 * known, size-checked data reaches the prompt builder.
 */
export function validateCategorizeRequest(body: unknown): ValidationResult<CategorizeApiRequest> {
  if (!isRecord(body)) return fail("Body must be a JSON object.");

  const { categories, tweets, summaries } = body;

  if (!Array.isArray(categories) || categories.length === 0 || categories.length > MAX_CATEGORIES) {
    return fail(`categories must be an array of 1 to ${MAX_CATEGORIES} items.`);
  }
  if (!Array.isArray(tweets) || tweets.length === 0 || tweets.length > MAX_TWEETS_PER_REQUEST) {
    return fail(`tweets must be an array of 1 to ${MAX_TWEETS_PER_REQUEST} items.`);
  }
  if (summaries !== undefined && typeof summaries !== "boolean") {
    return fail("summaries must be a boolean.");
  }

  const cleanCategories: AiCategoryInput[] = [];
  const categoryIds = new Set<string>();
  for (let i = 0; i < categories.length; i++) {
    const result = validateCategory(categories[i], i);
    if (!result.ok) return fail(result.message);
    if (categoryIds.has(result.value.id)) return fail(`Duplicate category id "${result.value.id}".`);
    categoryIds.add(result.value.id);
    cleanCategories.push(result.value);
  }

  const cleanTweets: AiTweetInput[] = [];
  const tweetIds = new Set<string>();
  for (let i = 0; i < tweets.length; i++) {
    const result = validateTweet(tweets[i], i);
    if (!result.ok) return fail(result.message);
    if (tweetIds.has(result.value.id)) return fail(`Duplicate tweet id at tweets[${i}].`);
    tweetIds.add(result.value.id);
    cleanTweets.push(result.value);
  }

  return {
    ok: true,
    value: { categories: cleanCategories, tweets: cleanTweets, summaries: summaries ?? false },
  };
}

/** Validate a short required string field (license key, instance name…). */
export function requireString(obj: Record<string, unknown>, field: string, max = 200): ValidationResult<string> {
  const value = obj[field];
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    return fail(`${field} must be a non-empty string of at most ${max} characters.`);
  }
  return { ok: true, value: value.trim() };
}
