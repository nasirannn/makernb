import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const BLOG_ROOT = path.join(process.cwd(), "content/posts");
const LOCALES = ["en", "zh-CN", "ja"];
const BASE_LOCALE = "en";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BLOG_CATEGORY_KEYS = new Set(["music_history", "artist_spotlight"]);
const REQUIRED_FIELDS = [
  "title",
  "excerpt",
  "date",
  "category",
  "categoryKey",
  "image",
  "featured",
];

function fail(message) {
  console.error(`[blog-check] ${message}`);
}

function readLocaleSlugs(locale) {
  const localeDirectory = path.join(BLOG_ROOT, locale);
  if (!fs.existsSync(localeDirectory) || !fs.statSync(localeDirectory).isDirectory()) {
    return [];
  }

  return fs
    .readdirSync(localeDirectory)
    .filter((fileName) => fileName.endsWith(".mdx"))
    .map((fileName) => fileName.replace(/\.mdx$/, ""))
    .sort();
}

function compareSlugSets(baseSlugs, targetSlugs) {
  const baseSet = new Set(baseSlugs);
  const targetSet = new Set(targetSlugs);

  return {
    missing: baseSlugs.filter((slug) => !targetSet.has(slug)),
    extra: targetSlugs.filter((slug) => !baseSet.has(slug)),
  };
}

function validateFrontmatter(locale, slug) {
  const filePath = path.join(BLOG_ROOT, locale, `${slug}.mdx`);
  const fileContents = fs.readFileSync(filePath, "utf8");
  const { data } = matter(fileContents);
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) {
      errors.push(`${locale}/${slug}: missing frontmatter field "${field}"`);
    }
  }

  if (typeof data.date !== "string" || !ISO_DATE_PATTERN.test(data.date)) {
    errors.push(`${locale}/${slug}: "date" must use ISO format YYYY-MM-DD`);
  }

  if (typeof data.categoryKey !== "string" || !BLOG_CATEGORY_KEYS.has(data.categoryKey)) {
    errors.push(
      `${locale}/${slug}: "categoryKey" must be one of ${Array.from(BLOG_CATEGORY_KEYS).join(", ")}`
    );
  }

  return errors;
}

function main() {
  let hasErrors = false;
  const baseSlugs = readLocaleSlugs(BASE_LOCALE);

  if (baseSlugs.length === 0) {
    fail(`No posts found under ${path.join("content/posts", BASE_LOCALE)}`);
    process.exit(1);
  }

  for (const locale of LOCALES) {
    const localeSlugs = readLocaleSlugs(locale);
    const { missing, extra } = compareSlugSets(baseSlugs, localeSlugs);

    if (missing.length > 0) {
      hasErrors = true;
      fail(`${locale}: missing slugs -> ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      hasErrors = true;
      fail(`${locale}: extra slugs -> ${extra.join(", ")}`);
    }

    for (const slug of localeSlugs) {
      const errors = validateFrontmatter(locale, slug);
      if (errors.length > 0) {
        hasErrors = true;
        for (const error of errors) {
          fail(error);
        }
      }
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(
    `[blog-check] OK. Locales ${LOCALES.join(", ")} are aligned with ${
      baseSlugs.length
    } slug(s), and frontmatter validation passed.`
  );
}

main();
