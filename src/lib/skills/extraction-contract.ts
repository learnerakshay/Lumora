import { z } from 'zod';
import {
  EXTRACTION_CONTRACT_VERSION,
  type ExtractedCertification,
  type ExtractedEducation,
  type ExtractedExperience,
  type ExtractedProfile,
  type ExtractedProject,
  type ExtractedSkill,
} from './types';

// Atomic values: a single skill name or a single technology token. These are
// never legitimately long, so the tight bound stays strict.
const shortText = z.string().trim().min(1).max(200);
// Resume-authored titles: project names, job titles, degree names,
// certification names. Real resumes routinely tack a tagline or
// specialization onto these ("AI-Powered Resume Analyzer & Skill Gap
// Detection Platform Using GPT-4 and Vector Search"), so 200 chars was an
// arbitrary bound that rejected legitimate content — 300 gives real headroom
// while still being a hard, protective ceiling on an identifying field.
const titleText = z.string().trim().min(1).max(300);
const longText = z.string().trim().min(1).max(600);

// A model asked for a required string with no "not stated" option will fill
// blanks with "" rather than fabricate content. For genuinely optional
// fields, treat that "" (or whitespace) exactly like an omitted value and
// normalize it to null instead of failing the whole extraction over it.
function optionalText(maxLength: number) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? null : value),
    z.string().trim().max(maxLength).nullable(),
  );
}

// Same "" -> omitted normalization, applied per array item, so one blank
// filler entry (e.g. an empty technology or outcome string) is dropped
// instead of invalidating the entire array.
function filteredStringArray(itemSchema: z.ZodString, maxItems: number) {
  return z.preprocess(
    (value) =>
      Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim().length > 0) : value,
    z.array(itemSchema).max(maxItems).default([]),
  );
}

const rawSkillSchema = z.object({
  label: shortText,
  category: z.enum(['language', 'framework', 'tool', 'platform', 'concept']),
  context: z.enum(['SKILLS_SECTION', 'EXPERIENCE', 'PROJECT', 'EDUCATION']),
});

const rawProjectSchema = z.object({
  name: titleText,
  description: optionalText(600),
  technologies: filteredStringArray(shortText, 30),
  hasLink: z.boolean(),
  outcomes: filteredStringArray(longText, 10),
});

const rawExperienceSchema = z.object({
  title: titleText,
  organization: optionalText(200),
  durationMonths: z.number().int().min(0).max(600).nullable(),
  responsibilities: filteredStringArray(longText, 15),
  technologies: filteredStringArray(shortText, 30),
});

const rawEducationSchema = z.object({
  credential: titleText,
  field: optionalText(200),
  institution: optionalText(200),
});

const rawCertificationSchema = z.object({
  name: titleText,
  issuer: optionalText(200),
});

export const rawExtractedProfileSchema = z.object({
  headline: optionalText(300),
  yearsOfExperienceStated: z.number().min(0).max(60).nullable(),
  skills: z.array(rawSkillSchema).max(80),
  projects: z.array(rawProjectSchema).max(30),
  experience: z.array(rawExperienceSchema).max(30),
  education: z.array(rawEducationSchema).max(15),
  certifications: z.array(rawCertificationSchema).max(30),
});

export type RawSkill = z.infer<typeof rawSkillSchema>;
export type RawProject = z.infer<typeof rawProjectSchema>;
export type RawExperience = z.infer<typeof rawExperienceSchema>;
export type RawEducation = z.infer<typeof rawEducationSchema>;
export type RawCertification = z.infer<typeof rawCertificationSchema>;
export type RawExtractedProfile = z.infer<typeof rawExtractedProfileSchema>;

// Safe to log in full: path/code/message describe the shape of the failure
// (e.g. "projects.0.name" / "too_big" / a length constraint), never the
// resume content that triggered it.
export interface ExtractionValidationIssue {
  path: string;
  code: string;
  message: string;
  maximum?: number;
  minimum?: number;
}

export type ExtractionParseResult =
  | { success: true; data: RawExtractedProfile }
  | { success: false; error: string; issues: ExtractionValidationIssue[] };

function toValidationIssue(issue: z.core.$ZodIssue): ExtractionValidationIssue {
  const maximum = 'maximum' in issue && typeof issue.maximum === 'number' ? issue.maximum : undefined;
  const minimum = 'minimum' in issue && typeof issue.minimum === 'number' ? issue.minimum : undefined;
  return {
    path: issue.path.length ? issue.path.join('.') : '(root)',
    code: issue.code,
    message: issue.message,
    ...(maximum !== undefined ? { maximum } : {}),
    ...(minimum !== undefined ? { minimum } : {}),
  };
}

export function parseRawExtractedProfile(payload: unknown): ExtractionParseResult {
  const result = rawExtractedProfileSchema.safeParse(payload);
  if (result.success) return { success: true, data: result.data };
  const issues = result.error.issues.map(toValidationIssue);
  return {
    success: false,
    error: issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
    issues,
  };
}

// A schema-valid but entirely blank extraction means the source had nothing
// legible in it (a non-resume photo, a blank page) — that is a rejection,
// not a resume with zero skills.
export function isEmptyRawExtraction(raw: RawExtractedProfile): boolean {
  return (
    !raw.headline &&
    raw.skills.length === 0 &&
    raw.projects.length === 0 &&
    raw.experience.length === 0 &&
    raw.education.length === 0 &&
    raw.certifications.length === 0
  );
}

// The model never invents ids: they are assigned deterministically here so
// evidence references produced later can never collide or be forged.
export function assignExtractionIds(raw: RawExtractedProfile): ExtractedProfile {
  const skills: ExtractedSkill[] = raw.skills.map((skill, index) => ({
    id: `skill-${index}`,
    label: skill.label,
    category: skill.category,
    context: skill.context,
  }));
  const projects: ExtractedProject[] = raw.projects.map((project, index) => ({
    id: `project-${index}`,
    name: project.name,
    description: project.description ?? null,
    technologies: project.technologies,
    hasLink: project.hasLink,
    outcomes: project.outcomes,
  }));
  const experience: ExtractedExperience[] = raw.experience.map((entry, index) => ({
    id: `experience-${index}`,
    title: entry.title,
    organization: entry.organization ?? null,
    durationMonths: entry.durationMonths ?? null,
    responsibilities: entry.responsibilities,
    technologies: entry.technologies,
  }));
  const education: ExtractedEducation[] = raw.education.map((entry, index) => ({
    id: `education-${index}`,
    credential: entry.credential,
    field: entry.field ?? null,
    institution: entry.institution ?? null,
  }));
  const certifications: ExtractedCertification[] = raw.certifications.map((entry, index) => ({
    id: `certification-${index}`,
    name: entry.name,
    issuer: entry.issuer ?? null,
  }));

  return {
    schemaVersion: EXTRACTION_CONTRACT_VERSION,
    headline: raw.headline ?? null,
    yearsOfExperienceStated: raw.yearsOfExperienceStated ?? null,
    skills,
    projects,
    experience,
    education,
    certifications,
  };
}

export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'yearsOfExperienceStated', 'skills', 'projects', 'experience', 'education', 'certifications'],
  properties: {
    headline: { type: ['string', 'null'] },
    yearsOfExperienceStated: { type: ['number', 'null'] },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'category', 'context'],
        properties: {
          label: { type: 'string' },
          category: { type: 'string', enum: ['language', 'framework', 'tool', 'platform', 'concept'] },
          context: { type: 'string', enum: ['SKILLS_SECTION', 'EXPERIENCE', 'PROJECT', 'EDUCATION'] },
        },
      },
    },
    projects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'description', 'technologies', 'hasLink', 'outcomes'],
        properties: {
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          technologies: { type: 'array', items: { type: 'string' } },
          hasLink: { type: 'boolean' },
          outcomes: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'organization', 'durationMonths', 'responsibilities', 'technologies'],
        properties: {
          title: { type: 'string' },
          organization: { type: ['string', 'null'] },
          durationMonths: { type: ['number', 'null'] },
          responsibilities: { type: 'array', items: { type: 'string' } },
          technologies: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['credential', 'field', 'institution'],
        properties: {
          credential: { type: 'string' },
          field: { type: ['string', 'null'] },
          institution: { type: ['string', 'null'] },
        },
      },
    },
    certifications: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'issuer'],
        properties: {
          name: { type: 'string' },
          issuer: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;
