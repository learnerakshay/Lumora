import { Router, Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import { requireApiAuth } from '../lib/auth';
import { AppError } from '../lib/errors';
import { successResponse, errorResponse } from '../lib/api-response';
import { logger } from '../lib/logger';
import { checkAndReserve, commitUsage, discardUsage } from '../lib/usage/service';
import { usageLimitError } from '../lib/usage/errors';
import { parseSourceContent } from '../lib/ingestion/parsers';
import {
  extractProfileFromResumeImage,
  extractProfileFromResumeImages,
  extractProfileFromResumeText,
  SkillExtractionError,
  STABLE_UNREADABLE_RESUME_MESSAGE,
} from '../lib/skills/extraction-provider';
import { detectResumeFileKind, resumeImageMimeType } from '../lib/skills/resume-file-detection';
import {
  isEmptyExtractableTextFailure,
  renderResumePdfPagesToImages,
} from '../lib/skills/resume-pdf-image-fallback';
import { normalizeExtractedProfile } from '../lib/skills/normalize';
import { selectTargetRoles } from '../lib/skills/role-matching';
import { analyzeSkillGaps } from '../lib/skills/gap-analysis';
import { EXTRACTION_CONTRACT_VERSION, GAP_ANALYSIS_ENGINE_VERSION } from '../lib/skills/types';
import {
  createExtractingSkillProfile,
  createRoleAnalysis,
  deleteSkillProfilesForUser,
  getLatestSkillProfile,
  markSkillProfileFailed,
  markSkillProfileReady,
  type SkillProfileSourceKind,
} from '../lib/skills/skill-profile-store';

export const skillsRouter = Router();

const RESUME_FILE_MAX_BYTES = 5 * 1024 * 1024;
const RESUME_TEXT_MIN_CHARS = 50;
const RESUME_TEXT_MAX_CHARS = 60_000;

const ACCEPTED_RESUME_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: RESUME_FILE_MAX_BYTES,
    files: 1,
    fields: 4,
    parts: 5,
    fieldSize: RESUME_TEXT_MAX_CHARS,
    fieldNestingDepth: 0,
  },
  fileFilter: (_req, file, callback) => {
    if (!ACCEPTED_RESUME_MIME_TYPES.has(file.mimetype)) {
      const error: Error & { code?: string } = new Error('Unsupported resume file type');
      error.code = 'UNSUPPORTED_FILE_TYPE';
      callback(error);
      return;
    }
    callback(null, true);
  },
});

const resumeUploadMiddleware: RequestHandler = (req, res, next) => {
  resumeUpload.single('file')(req, res, (error: any) => {
    if (!error) {
      next();
      return;
    }
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded resume file exceeds the 5 MB limit.'
        : error.code === 'UNSUPPORTED_FILE_TYPE'
          ? 'Upload a PDF, JPG, PNG, or WEBP resume.'
          : `Invalid resume upload: ${error.message || 'multipart parsing failed'}`;
    const response = errorResponse(AppError.badRequest(message, 'INVALID_RESUME_UPLOAD'));
    return res.status(response.statusCode).json(response.payload);
  });
};

skillsRouter.use(requireApiAuth);

skillsRouter.post('/profile', resumeUploadMiddleware, async (req: Request, res: Response) => {
  const userId = res.locals.userId;
  let usageEventId: string | null = null;
  let profileId: string | null = null;

  try {
    const file = req.file;
    const pastedResumeText =
      typeof req.body?.resumeText === 'string' ? req.body.resumeText.trim() : '';

    let resumeText: string | null = null;
    let imageInput: { base64: string; mimeType: string } | null = null;
    let pdfFallbackImages: Array<{ base64: string; mimeType: string }> | null = null;
    let sourceKind: SkillProfileSourceKind;

    if (file) {
      const fileKind = detectResumeFileKind(file.buffer);
      if (!fileKind) {
        const response = errorResponse(
          AppError.badRequest(
            'The uploaded file is not a readable PDF, JPG, PNG, or WEBP resume.',
            'INVALID_RESUME_FILE_TYPE',
          ),
        );
        return res.status(response.statusCode).json(response.payload);
      }

      if (fileKind === 'PDF') {
        sourceKind = 'PDF';
        try {
          const parsed = await parseSourceContent({
            type: 'PDF',
            title: file.originalname || 'resume.pdf',
            artifactData: file.buffer,
            artifactMimeType: file.mimetype,
          });
          resumeText = parsed.cleanText;
        } catch (error: any) {
          // A PDF with no text layer at all (a phone "scan to PDF" of a
          // printed resume) is not a parse failure — fall back to rendering
          // its pages and reusing the existing image/vision extraction
          // pipeline. Every other PDF failure (corrupted, encrypted,
          // oversized, wrong MIME) still fails immediately, unchanged.
          if (isEmptyExtractableTextFailure(error)) {
            try {
              pdfFallbackImages = await renderResumePdfPagesToImages(file.buffer);
            } catch (renderError) {
              logger.warn('PDF image fallback rendering failed', {
                userId,
                reason: renderError instanceof Error ? renderError.name : 'unknown',
              });
            }
          }
          if (resumeText === null && (!pdfFallbackImages || pdfFallbackImages.length === 0)) {
            const response = errorResponse(
              AppError.badRequest(
                isEmptyExtractableTextFailure(error)
                  ? STABLE_UNREADABLE_RESUME_MESSAGE
                  : error?.message || 'The uploaded PDF could not be read.',
                'RESUME_PDF_PARSE_FAILED',
              ),
            );
            return res.status(response.statusCode).json(response.payload);
          }
        }
      } else {
        sourceKind = 'IMAGE';
        imageInput = { base64: file.buffer.toString('base64'), mimeType: resumeImageMimeType(fileKind) };
      }
    } else if (pastedResumeText) {
      sourceKind = 'TEXT';
      resumeText = pastedResumeText;
    } else {
      const response = errorResponse(
        AppError.badRequest('Upload a resume PDF, image, or paste resume text.', 'MISSING_RESUME_INPUT'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    if (resumeText !== null) {
      if (resumeText.length < RESUME_TEXT_MIN_CHARS) {
        const response = errorResponse(
          AppError.badRequest('The resume content is too short to analyze.', 'RESUME_TOO_SHORT'),
        );
        return res.status(response.statusCode).json(response.payload);
      }
      if (resumeText.length > RESUME_TEXT_MAX_CHARS) {
        const response = errorResponse(
          AppError.badRequest('The resume content is too long to analyze.', 'RESUME_TOO_LARGE'),
        );
        return res.status(response.statusCode).json(response.payload);
      }
    }

    const reservation = await checkAndReserve(userId, 'SKILL_INTELLIGENCE');
    if ('details' in reservation) {
      const response = errorResponse(usageLimitError(reservation.details));
      return res.status(response.statusCode).json(response.payload);
    }
    usageEventId = reservation.usageEventId;

    const extractingProfile = await createExtractingSkillProfile({
      userId,
      sourceKind,
      contractVersion: EXTRACTION_CONTRACT_VERSION,
    });
    profileId = extractingProfile.id;

    let extraction;
    try {
      extraction = pdfFallbackImages
        ? await extractProfileFromResumeImages({ images: pdfFallbackImages })
        : imageInput
          ? await extractProfileFromResumeImage({ imageBase64: imageInput.base64, imageMimeType: imageInput.mimeType })
          : await extractProfileFromResumeText({ resumeText: resumeText! });
    } catch (error) {
      const message =
        error instanceof SkillExtractionError ? error.message : 'Resume extraction failed.';
      await markSkillProfileFailed(extractingProfile.id, message);
      await discardUsage(usageEventId);
      usageEventId = null;
      const appError =
        error instanceof SkillExtractionError
          ? new AppError(error.message, error.statusCode, error.code)
          : new AppError('Resume extraction failed.', 502, 'SKILL_EXTRACTION_FAILED');
      const response = errorResponse(appError);
      return res.status(response.statusCode).json(response.payload);
    }

    const normalizedSkills = normalizeExtractedProfile(extraction.profile);
    const readyProfile = await markSkillProfileReady(extractingProfile.id, {
      extraction: extraction.profile,
      normalizedSkills,
      extractionModel: extraction.model,
    });

    const roles = selectTargetRoles(normalizedSkills);
    const gaps = analyzeSkillGaps(extraction.profile, normalizedSkills, roles);
    const analysis = await createRoleAnalysis({
      profileId: extractingProfile.id,
      engineVersion: GAP_ANALYSIS_ENGINE_VERSION,
      selectedRoles: roles,
      gaps,
    });

    await commitUsage(usageEventId, {
      provider: 'openai',
      model: extraction.model,
      inputTokens: extraction.usage?.inputTokens ?? null,
      outputTokens: extraction.usage?.outputTokens ?? null,
    });
    usageEventId = null;

    return res.status(200).json(successResponse({ profile: readyProfile, analysis }));
  } catch (error) {
    if (usageEventId) await discardUsage(usageEventId).catch(() => {});
    if (profileId) {
      await markSkillProfileFailed(
        profileId,
        'An unexpected error interrupted Skill Intelligence processing.',
      ).catch(() => {});
    }
    logger.error('Skill profile creation failed', error, { userId });
    const response = errorResponse(error);
    return res.status(response.statusCode).json(response.payload);
  }
});

skillsRouter.get('/profile', async (req: Request, res: Response) => {
  try {
    const latest = await getLatestSkillProfile(res.locals.userId);
    return res.status(200).json(successResponse(latest));
  } catch (error) {
    logger.error('Failed to fetch Skill Profile', error, { userId: res.locals.userId });
    const response = errorResponse(new Error('Failed to retrieve Skill Profile'));
    return res.status(response.statusCode).json(response.payload);
  }
});

skillsRouter.post('/analysis', async (req: Request, res: Response) => {
  try {
    const latest = await getLatestSkillProfile(res.locals.userId);
    if (!latest || latest.profile.status !== 'READY' || !latest.profile.extraction || !latest.profile.normalizedSkills) {
      const response = errorResponse(
        AppError.badRequest('No completed Skill Profile is available to re-analyze.', 'SKILL_PROFILE_NOT_READY'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    const roles = selectTargetRoles(latest.profile.normalizedSkills);
    const gaps = analyzeSkillGaps(latest.profile.extraction, latest.profile.normalizedSkills, roles);
    const analysis = await createRoleAnalysis({
      profileId: latest.profile.id,
      engineVersion: GAP_ANALYSIS_ENGINE_VERSION,
      selectedRoles: roles,
      gaps,
    });

    return res.status(200).json(successResponse({ profile: latest.profile, analysis }));
  } catch (error) {
    logger.error('Failed to re-run Skill Intelligence analysis', error, { userId: res.locals.userId });
    const response = errorResponse(new Error('Failed to re-run analysis'));
    return res.status(response.statusCode).json(response.payload);
  }
});

skillsRouter.delete('/profile', async (req: Request, res: Response) => {
  try {
    await deleteSkillProfilesForUser(res.locals.userId);
    return res.status(200).json(successResponse({ deleted: true }));
  } catch (error) {
    logger.error('Failed to delete Skill Profile', error, { userId: res.locals.userId });
    const response = errorResponse(new Error('Failed to delete Skill Profile'));
    return res.status(response.statusCode).json(response.payload);
  }
});
