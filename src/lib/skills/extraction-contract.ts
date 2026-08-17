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

const shortText = z.string().trim().min(1).max(200);
const longText = z.string().trim().min(1).max(600);

const rawSkillSchema = z.object({
  label: shortText,
  category: z.enum(['language', 'framework', 'tool', 'platform', 'concept']),
  context: z.enum(['SKILLS_SECTION', 'EXPERIENCE', 'PROJECT', 'EDUCATION']),
});

const rawProjectSchema = z.object({
  name: shortText,
  description: longText,
  technologies: z.array(shortText).max(30).default([]),
  hasLink: z.boolean(),
  outcomes: z.array(longText).max(10).default([]),
});

const rawExperienceSchema = z.object({
  title: shortText,
  organization: shortText,
  durationMonths: z.number().int().min(0).max(600).nullable(),
  responsibilities: z.array(longText).max(15).default([]),
  technologies: z.array(shortText).max(30).default([]),
});

const rawEducationSchema = z.object({
  credential: shortText,
  field: shortText,
  institution: shortText,
});

const rawCertificationSchema = z.object({
  name: shortText,
  issuer: shortText,
});

export const rawExtractedProfileSchema = z.object({
  headline: shortText.nullable(),
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

export type ExtractionParseResult =
  | { success: true; data: RawExtractedProfile }
  | { success: false; error: string };

export function parseRawExtractedProfile(payload: unknown): ExtractionParseResult {
  const result = rawExtractedProfileSchema.safeParse(payload);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error.issues.map((issue) => issue.message).join('; ') };
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
    description: project.description,
    technologies: project.technologies,
    hasLink: project.hasLink,
    outcomes: project.outcomes,
  }));
  const experience: ExtractedExperience[] = raw.experience.map((entry, index) => ({
    id: `experience-${index}`,
    title: entry.title,
    organization: entry.organization,
    durationMonths: entry.durationMonths ?? null,
    responsibilities: entry.responsibilities,
    technologies: entry.technologies,
  }));
  const education: ExtractedEducation[] = raw.education.map((entry, index) => ({
    id: `education-${index}`,
    credential: entry.credential,
    field: entry.field,
    institution: entry.institution,
  }));
  const certifications: ExtractedCertification[] = raw.certifications.map((entry, index) => ({
    id: `certification-${index}`,
    name: entry.name,
    issuer: entry.issuer,
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
          description: { type: 'string' },
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
          organization: { type: 'string' },
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
          field: { type: 'string' },
          institution: { type: 'string' },
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
          issuer: { type: 'string' },
        },
      },
    },
  },
} as const;
