import {
  RESOURCE_TOPICS,
  RESOURCE_USE_CASES,
  type Creator,
  type LearningResource,
  type Organization,
  type Provider,
  type RankingPreferenceRule,
  type ResourcePlatform,
} from './domain';

const VERIFIED_AT = '2026-08-15';
const PHASE_3_VERIFIED_AT = '2026-08-16';

export const RESOURCE_CREATORS: readonly Creator[] = [
  {
    id: 'hitesh-choudhary',
    name: 'Hitesh Choudhary',
    aliases: ['HiteshCodeLab', 'Chai aur Code'],
  },
  {
    id: 'piyush-garg',
    name: 'Piyush Garg',
  },
  {
    id: 'suraj-jha',
    name: 'Suraj Jha',
    aliases: ['Suraj Kumar Jha'],
  },
  {
    id: 'piyush-sachdeva',
    name: 'Piyush Sachdeva',
  },
];

export const RESOURCE_ORGANIZATIONS: readonly Organization[] = [
  {
    id: 'chaicode',
    name: 'ChaiCode',
    url: 'https://chaicode.com/',
  },
];

export const RESOURCE_PROVIDERS: readonly Provider[] = [
  {
    id: 'hitesh-choudhary-english',
    creatorId: 'hitesh-choudhary',
    name: 'HiteshCodeLab / Hitesh Choudhary English',
    platform: 'YouTube',
    language: 'en',
    url: 'https://youtube.com/@hiteshcodelab?si=yNivMdKOyPKTd-RW',
  },
  {
    id: 'chai-aur-code-hindi',
    creatorId: 'hitesh-choudhary',
    name: 'Chai aur Code',
    platform: 'YouTube',
    language: 'hi',
  },
  {
    id: 'piyush-garg-youtube',
    creatorId: 'piyush-garg',
    name: 'Piyush Garg YouTube',
    platform: 'YouTube',
  },
  {
    id: 'suraj-jha-youtube',
    creatorId: 'suraj-jha',
    name: 'Suraj Jha YouTube',
    platform: 'YouTube',
  },
  {
    id: 'chaicode-website',
    organizationId: 'chaicode',
    name: 'ChaiCode Website',
    platform: 'Website',
    url: 'https://chaicode.com/',
  },
  {
    id: 'chaicode-udemy',
    organizationId: 'chaicode',
    name: 'ChaiCode on Udemy',
    platform: 'Udemy',
  },
];

const english = 'hitesh-choudhary-english';
const hindi = 'chai-aur-code-hindi';
const piyush = 'piyush-garg-youtube';
const suraj = 'suraj-jha-youtube';
const chaicodeWebsite = 'chaicode-website';
const chaicodeUdemy = 'chaicode-udemy';

function curatedFor(
  creatorId: string,
  resource: Omit<LearningResource, 'creatorId' | 'accessType' | 'status' | 'verifiedAt' | 'sourceOrigin'>,
): LearningResource {
  return {
    ...resource,
    creatorId,
    accessType: 'free',
    status: 'ACTIVE',
    verifiedAt: VERIFIED_AT,
    sourceOrigin: 'CURATED',
  };
}

function curated(
  resource: Omit<LearningResource, 'creatorId' | 'accessType' | 'status' | 'verifiedAt' | 'sourceOrigin'>,
): LearningResource {
  return curatedFor('hitesh-choudhary', resource);
}

function paidCurated(
  resource: Omit<LearningResource, 'accessType' | 'status' | 'verifiedAt' | 'sourceOrigin'>,
): LearningResource {
  return {
    ...resource,
    accessType: 'paid',
    status: 'ACTIVE',
    verifiedAt: PHASE_3_VERIFIED_AT,
    sourceOrigin: 'CURATED',
  };
}

export const CURATED_LEARNING_RESOURCES: readonly LearningResource[] = [
  curated({
    id: 'hitesh-react-native-crash-course',
    title: 'React Native crash course',
    providerId: english,
    type: 'video',
    url: 'https://youtu.be/nvHeB32ICDM?si=PRWbkb4HDT4u82MN',
    topics: ['react-native', 'mobile-development'],
    level: 'beginner',
    useCases: ['technical-gap', 'roadmap'],
    language: 'en',
    description: 'A focused English crash course for starting React Native development.',
  }),
  curated({
    id: 'hitesh-javascript-playlist',
    title: 'JavaScript',
    providerId: english,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLRAV69dS1uWSxUIk5o3vQY2-_VKsOpXLD&si=jeljhXI_5ZhMTAhB',
    topics: ['javascript'],
    level: 'beginner',
    useCases: ['roadmap'],
    language: 'en',
    description: 'A structured English JavaScript learning playlist.',
  }),
  curated({
    id: 'hitesh-golang-playlist',
    title: 'Golang playlist',
    providerId: english,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLRAV69dS1uWQGDQoBYMZWKjzuhCaOnBpa&si=OEZMqxNj9NiURcxk',
    topics: ['golang'],
    level: 'beginner',
    useCases: ['roadmap'],
    language: 'en',
    description: 'A structured English playlist for learning Go.',
  }),
  curated({
    id: 'hitesh-nextjs-clerk-neon-full-stack',
    title: 'Full Stack NextJS with Clerk, Neon (PostgreSQL)',
    providerId: english,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLRAV69dS1uWRH0QDzQaKLQEYD26YCQ5eS&si=7ohHcdjnpU9vW5Oi',
    topics: ['nextjs', 'full-stack', 'authentication', 'postgresql', 'project-building'],
    level: 'intermediate',
    useCases: ['project-proof'],
    language: 'en',
    description: 'A project-oriented Next.js series using Clerk authentication and Neon PostgreSQL.',
  }),
  curated({
    id: 'hitesh-nextjs-authentication-course',
    title: 'Nextjs Fullstack course on Authentication',
    providerId: english,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLRAV69dS1uWR7KF-zV6YPYtKYEHENETyE&si=5uWkJc8nNdMxhgvX',
    topics: ['nextjs', 'authentication', 'full-stack', 'project-building'],
    level: 'intermediate',
    useCases: ['project-proof', 'technical-gap'],
    language: 'en',
    description: 'A full-stack Next.js course centered on implementing authentication.',
  }),
  curated({
    id: 'hitesh-google-photos-clone-spring-react',
    title: 'Build Google Photos Clone with Spring Boot, React & ImageKit | Full Course',
    providerId: english,
    type: 'video',
    url: 'https://youtu.be/sP1km4m1CrY?si=qIuKjjauFFqducqS',
    topics: ['spring-boot', 'react', 'full-stack', 'project-building'],
    level: 'intermediate',
    useCases: ['project-proof'],
    language: 'en',
    description: 'A complete Spring Boot and React project building a Google Photos-style application.',
  }),
  curated({
    id: 'chai-aur-javascript-hindi',
    title: 'Chai aur Javascript | हिन्दी',
    providerId: hindi,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLu71SKxNbfoBuX3f4EOACle2y-tRC5Q37&si=_3VLq0oXnqol1O1n',
    topics: ['javascript'],
    level: 'beginner',
    useCases: ['roadmap'],
    language: 'hi',
    description: 'A Hindi JavaScript learning playlist.',
  }),
  curated({
    id: 'chai-aur-react-projects',
    title: 'Chai aur React | with projects',
    providerId: hindi,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLu71SKxNbfoDqgPchmvIsL4hTnJIrtige&si=f3Te12hyklEbQprh',
    topics: ['react', 'project-building'],
    level: 'beginner',
    useCases: ['roadmap', 'project-proof'],
    language: 'hi',
    description: 'A Hindi React playlist that teaches through projects.',
  }),
  curated({
    id: 'chai-aur-javascript-backend',
    title: 'Chai aur Javascript Backend | Hindi',
    providerId: hindi,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLu71SKxNbfoBGh_8p_NS-ZAh6v7HhYqHW&si=yoEdWTTlUpCINMIl',
    topics: ['javascript', 'nodejs', 'backend'],
    level: 'intermediate',
    useCases: ['roadmap'],
    language: 'hi',
    description: 'A Hindi JavaScript backend development playlist.',
  }),
  curated({
    id: 'chai-aur-python',
    title: 'Chai aur Python',
    providerId: hindi,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLu71SKxNbfoBsMugTFALhdLlZ5VOqCg2s&si=OynSdo5CNw76kOKB',
    topics: ['python'],
    level: 'beginner',
    useCases: ['roadmap'],
    language: 'hi',
    description: 'A Hindi playlist for learning Python.',
  }),
  curated({
    id: 'chai-aur-cpp',
    title: 'Chai aur C++',
    providerId: hindi,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLu71SKxNbfoCPfgKZS8UE0MDuwiKvL8zi&si=uGrY-7YF3kju5y9T',
    topics: ['cpp'],
    level: 'beginner',
    useCases: ['roadmap'],
    language: 'hi',
    description: 'A Hindi playlist for learning C++.',
  }),
  curated({
    id: 'chai-nextjs-music-academy',
    title: 'NextJS Music Academy Project | Chai aur NextJS',
    providerId: hindi,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLu71SKxNbfoDWGIwaEwhTUR40AbH8qsTo&si=nfeHVVfGgux4T2R3',
    topics: ['nextjs', 'full-stack', 'project-building'],
    level: 'intermediate',
    useCases: ['project-proof'],
    language: 'hi',
    description: 'A Hindi project series for building a full-stack Next.js music academy application.',
  }),
  curated({
    id: 'chai-aur-recursion',
    title: 'Chai aur Recursion',
    providerId: hindi,
    type: 'video',
    url: 'https://youtu.be/l8X9nhgZyoA?si=Y_j6US8bwhswLKXk',
    topics: ['recursion'],
    level: 'beginner',
    useCases: ['technical-gap'],
    language: 'hi',
    description: 'A focused Hindi lesson on recursion.',
  }),
  curated({
    id: 'chai-aur-typescript',
    title: 'Chai aur Typescript',
    providerId: hindi,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLu71SKxNbfoBkkr8lblqtsJvxrw3j1tWC&si=CJJlzj-_h-LJ7Z6n',
    topics: ['typescript'],
    level: 'beginner',
    useCases: ['roadmap'],
    language: 'hi',
    description: 'A Hindi TypeScript learning playlist.',
  }),
  curated({
    id: 'chai-aur-computer-network',
    title: 'Chai aur Computer Network',
    providerId: hindi,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLd1s-PEC5Pio&si=tuHStFk41NT6CB0w',
    topics: ['computer-networks'],
    level: 'beginner',
    useCases: ['roadmap'],
    language: 'hi',
    description: 'A Hindi playlist covering computer networking foundations.',
  }),
  curated({
    id: 'chai-aur-springboot',
    title: 'Chai aur Springboot',
    providerId: hindi,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLAtsKd9vhf5M&si=Te45eNiq_HW7YK20',
    topics: ['spring-boot'],
    level: 'beginner',
    useCases: ['roadmap'],
    language: 'hi',
    description: 'A Hindi Spring Boot learning playlist.',
  }),
  curated({
    id: 'chai-aur-full-stack-nextjs',
    title: 'Chai aur Full Stack NextJS',
    providerId: hindi,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLu71SKxNbfoBAaWGtn9GA2PTw0HO0tXzq&si=EHIV1WKpTx2IOEX4',
    topics: ['nextjs', 'full-stack', 'project-building'],
    level: 'intermediate',
    useCases: ['roadmap', 'project-proof'],
    language: 'hi',
    description: 'A Hindi full-stack Next.js learning and project-building playlist.',
  }),
  curated({
    id: 'chai-aur-mobile-dev',
    title: 'Chai aur Mobile Dev',
    providerId: hindi,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLu71SKxNbfoBLai4myIIkzhZFL4SiL9EA&si=W3QDuzXJgeQqPf6r',
    topics: ['mobile-development'],
    level: 'beginner',
    useCases: ['roadmap'],
    language: 'hi',
    description: 'A Hindi playlist about mobile development.',
  }),
  curated({
    id: 'chai-build-openclaw-ai-project',
    title: 'Build Your Own OpenClaw | Complete AI Project',
    providerId: hindi,
    type: 'video',
    url: 'https://youtu.be/nGareZEhdpI?si=AJG1bgu1js-epAki',
    topics: ['generative-ai', 'project-building'],
    level: 'intermediate',
    useCases: ['project-proof'],
    language: 'hi',
    description: 'A complete AI project walkthrough for building OpenClaw.',
  }),
  curated({
    id: 'chai-gamma-ai-presentation-platform',
    title: "Let's build Gamma like AI presentation platform with Tanstack Start",
    providerId: hindi,
    type: 'video',
    url: 'https://youtu.be/BNm3UoxSAho?si=j--6hKVYOxvyeRAf',
    topics: ['generative-ai', 'full-stack', 'project-building'],
    level: 'intermediate',
    useCases: ['project-proof'],
    language: 'hi',
    description: 'A project walkthrough for building a Gamma-like AI presentation platform.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-claude-agent-sdk-typescript',
    title: 'Claude Agent SDK — TypeScript',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sCZ3oyfEYh8pLRdHdsISNfG&si=jwo_cf2lL7UYcob0',
    topics: ['ai-agents', 'typescript'],
    level: 'intermediate',
    useCases: ['technical-gap'],
    description: 'A TypeScript playlist focused on building with the Claude Agent SDK.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-dead-series',
    title: 'The DEAD Series',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sCaD2wxnjJs26o3rTFdNah_&si=vQGA5FxQtyXBDsHN',
    topics: ['developer-mindset'],
    level: 'intermediate',
    useCases: ['developer-mindset'],
    description: 'A series about developer mindset, choosing a niche, and growing beyond tutorial-only development.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-building-ai-agents-typescript-openai',
    title: 'Building AI Agents with TypeScript and OpenAI Agent SDK',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sA-XUqy01s8yrZ0r0QZMpQT&si=BBOcKu8xnLZLYPaD',
    topics: ['ai-agents', 'generative-ai', 'typescript', 'project-building'],
    level: 'intermediate',
    useCases: ['project-proof', 'technical-gap'],
    description: 'A project-oriented TypeScript series for building AI agents with the OpenAI Agent SDK.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-master-agentic-ai-workflows',
    title: 'Master Agentic AI, Agentic Workflows and Generative AI',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sCzJnjhtEZBpKGtC1Xk7z5Z&si=3innjKeH_n7e880h',
    topics: ['ai-agents', 'generative-ai'],
    level: 'intermediate',
    useCases: ['technical-gap', 'roadmap'],
    description: 'A structured series covering agentic workflows and generative AI.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-master-docker-containerisation-deployments',
    title: 'Master Docker Containerisation & Deployments',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sDc2woh6XncR9_a310zaAyJ&si=29nEdGEZNl4xSIwZ',
    topics: ['docker'],
    level: 'advanced',
    useCases: ['technical-gap'],
    description: 'An advanced Docker playlist focused on containerisation and deployments.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-system-design',
    title: 'System Design',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sBlBWRox2V2tg9QJ2zr4M3o&si=D4O81RHsTTb3uvX5',
    topics: ['system-design'],
    level: 'intermediate',
    useCases: ['interview-prep', 'technical-gap'],
    description: 'A system design playlist for strengthening concepts and interview preparation.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-javascript-interview-questions',
    title: 'JavaScript Interview Questions',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sDofFbjtCBqbj2l68UHv5Zr&si=SLDYPlCTEzzOWb36',
    topics: ['javascript'],
    level: 'intermediate',
    useCases: ['interview-prep'],
    description: 'A focused JavaScript interview-question playlist.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-javascript-interview-preparation',
    title: 'JavaScript Interview Questions and Preparation',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sDi0keEOQU3n5p3Op28eN2e&si=Q1rgz3ZIanKkh_EN',
    topics: ['javascript'],
    level: 'intermediate',
    useCases: ['interview-prep'],
    description: 'A distinct JavaScript interview preparation playlist.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-rust-programming-language',
    title: 'Rust Programming Language',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sA_M0oxCRgFzPzEMX3CSfT5&si=mGZyiGpz9lIShCqY',
    topics: ['rust'],
    level: 'beginner',
    useCases: ['roadmap'],
    description: 'A structured introduction to the Rust programming language.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-rust-book',
    title: 'The Rust Book | Rust Programming Language',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sAnCkwmMb5Ape5Ibqp0R5bP&si=nqvCnUsULS3iMnVe',
    topics: ['rust'],
    level: 'intermediate',
    useCases: ['roadmap', 'technical-gap'],
    description: 'A Rust learning series organized around The Rust Book.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-build-your-own-x',
    title: 'Build Your Own X',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sC3VyfC7xD_ILyGvlHunoQs&si=gKODb2Vaep-4bK9S',
    topics: ['project-building'],
    level: 'intermediate',
    useCases: ['project-proof'],
    description: 'A hands-on series for learning by building substantial systems and tools.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-complete-git-github',
    title: 'Complete Git and GitHub Tutorial',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sCoLe5k0FWtFd-JykESyu6h&si=2ULE4UTVl3duhLaO',
    topics: ['git-github'],
    level: 'beginner',
    useCases: ['roadmap'],
    description: 'A complete beginner-oriented Git and GitHub tutorial.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-open-source-contributions-guide',
    title: 'Open Source Contributions Guide',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sBsmRRL8XyTGadjRGkzRPb7&si=huQXn8ZO9sdhX0ZX',
    topics: ['open-source'],
    level: 'beginner',
    useCases: ['roadmap', 'project-proof'],
    description: 'A practical guide for beginning open-source contributions.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-open-source-bootcamp',
    title: 'Open Source BootCamp — Master Open Source Contributions',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sAT6CotNj0iffhRV89SkNK9&si=vJP90YVAOUCDHo41',
    topics: ['open-source'],
    level: 'intermediate',
    useCases: ['roadmap', 'project-proof'],
    description: 'A distinct bootcamp series for developing practical open-source contribution skills.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-aws',
    title: 'AWS — Amazon Web Services',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sDZ17Fpe3xGUDRBkutaGyUp&si=PSbCHidi96AwY0fJ',
    topics: ['aws'],
    level: 'beginner',
    useCases: ['roadmap'],
    description: 'A structured introduction to Amazon Web Services.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-serverless',
    title: 'Serverless',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sA0V3kLZoV0qEo5nOLyRjYA&si=L5pd1rEO8oFrZI0p',
    topics: ['serverless'],
    level: 'intermediate',
    useCases: ['technical-gap'],
    description: 'A focused playlist for understanding serverless development.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-master-reactjs',
    title: 'Master ReactJS',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sBm5wu3ixPRQ0gDqHJUlxQf&si=JLnEkxtuufZCft-t',
    topics: ['react'],
    level: 'beginner',
    useCases: ['roadmap'],
    description: 'A structured React learning playlist.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-nginx',
    title: 'Nginx',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sCbKdDspcuD3T6zFWPXzsNt&si=_3wBVNGo-Nmus2pF',
    topics: ['nginx'],
    level: 'intermediate',
    useCases: ['technical-gap'],
    description: 'A focused Nginx learning playlist.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-master-nodejs',
    title: 'Master NodeJS',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sDby4Al-i13hQJGQoRQDfPo&si=4k-bxVskLKqi3ibB',
    topics: ['nodejs'],
    level: 'beginner',
    useCases: ['roadmap'],
    description: 'A structured Node.js learning playlist.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-advanced-javascript-concepts',
    title: 'Advance JavaScript Concepts',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sCZRV74kZrnOXU9zVdKY68w&si=BxJ9NU-oQuAoQbFM',
    topics: ['javascript'],
    level: 'advanced',
    useCases: ['technical-gap'],
    description: 'An advanced JavaScript concepts playlist for moving beyond fundamentals.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-webrtc-video-calling',
    title: 'WebRTC | Video Calling',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sDxXVu4VXdFx678W2pJmORa&si=GupMBUQv8GlhSeBn',
    topics: ['webrtc'],
    level: 'intermediate',
    useCases: ['technical-gap'],
    description: 'A WebRTC playlist focused on video-calling concepts.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-ultimate-javascript',
    title: 'Ultimate JavaScript Tutorials',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sDFRdgPYvjnBs2JsDdHPIMv&si=H6fGrmN6_Wz7bT4l',
    topics: ['javascript'],
    level: 'beginner',
    useCases: ['roadmap'],
    description: 'A broad JavaScript tutorial playlist for foundational learning.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-docker-beginners',
    title: 'Docker | Beginners',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sDvBfeK9EPz9pcJNlM0f3ph&si=xNvWvAQFSqDBHimP',
    topics: ['docker'],
    level: 'beginner',
    useCases: ['roadmap'],
    description: 'A beginner Docker playlist for starting with containers.',
  }),
  curatedFor('piyush-garg', {
    id: 'piyush-nextjs-master-course',
    title: 'NextJS Master Course',
    providerId: piyush,
    type: 'playlist',
    url: 'https://youtube.com/playlist?list=PLinedj3B30sDP2CHN5P0lDD64yYZ0Nn4J&si=amWKDGdkJm1WHk2o',
    topics: ['nextjs'],
    level: 'intermediate',
    useCases: ['roadmap'],
    description: 'A structured Next.js course playlist.',
  }),
  curatedFor('suraj-jha', {
    id: 'suraj-postgresql-complete-beginners',
    title: 'Master PostgreSQL in 6 Hours | Complete Course for Beginners',
    providerId: suraj,
    type: 'video',
    url: 'https://youtu.be/FDVPW49Nebs?si=Zl76CqR4VCzHpz0s',
    topics: ['postgresql'],
    level: 'beginner',
    useCases: ['technical-gap', 'roadmap'],
    description: 'A six-hour foundational PostgreSQL course for beginners.',
  }),
  curatedFor('suraj-jha', {
    id: 'suraj-postman-clone-ai',
    title: 'Build and Deploy a Postman Clone with AI | Next.js 15, Better Auth, React Query | Full Course 2025',
    providerId: suraj,
    type: 'video',
    url: 'https://youtu.be/3k7da4Zhd20?si=qfM6r0Dafk7nT6_j',
    topics: ['project-building', 'nextjs', 'authentication', 'react', 'full-stack'],
    level: 'intermediate',
    useCases: ['project-proof'],
    description: 'A full-stack project course for building and deploying an AI-assisted Postman clone.',
  }),
  curatedFor('suraj-jha', {
    id: 'suraj-web-ai-ide-stackblitz-clone',
    title: 'Build a Web Based AI IDE | Nextjs 15, React, WebContainers, Prisma, Ollama | Stackblitz Clone',
    providerId: suraj,
    type: 'video',
    url: 'https://youtu.be/Mfr8pi-jvu0?si=exDkudWtbP0ysEBi',
    topics: ['project-building', 'nextjs', 'react', 'generative-ai', 'full-stack'],
    level: 'intermediate',
    useCases: ['project-proof'],
    description: 'A substantial full-stack project for building a web-based AI IDE.',
  }),
  curatedFor('suraj-jha', {
    id: 'suraj-shadcn-ui-clone',
    title: 'Build and Deploy Your Shadcn/ui Clone with Next.js, React, Framer Motion, Tailwind, Typescript',
    providerId: suraj,
    type: 'video',
    url: 'https://youtu.be/sq2vJjcJYPY?si=QowQJ-qWXHGdLP0Q',
    topics: ['nextjs', 'react', 'typescript', 'project-building'],
    level: 'intermediate',
    useCases: ['project-proof'],
    description: 'A project course for building and deploying a Shadcn/ui-style component platform.',
  }),
  curatedFor('suraj-jha', {
    id: 'suraj-three-advanced-backend-projects',
    title: 'Build 3 End to End Advance Backend Projects | Youtube-API | E-Commerce-API | Uber-API in 2025',
    providerId: suraj,
    type: 'video',
    url: 'https://youtu.be/YoleJYqC5kg?si=pSbWtZy-tq_8E1XN',
    topics: ['backend', 'project-building'],
    level: 'advanced',
    useCases: ['project-proof'],
    description: 'Three end-to-end advanced backend API projects for demonstrating backend skills.',
  }),
  curatedFor('suraj-jha', {
    id: 'suraj-takeuforward-clone-video-a',
    seriesId: 'takeuforward-clone',
    title: 'Build a TakeUForward Clone — Video A',
    providerId: suraj,
    type: 'video',
    url: 'https://youtu.be/yMVdhxixL6U?si=bfKhbplmAJ4mq-Q6',
    topics: ['nextjs', 'typescript', 'project-building'],
    level: 'intermediate',
    useCases: ['project-proof'],
    description: 'One video in the TakeUForward clone project family using Next.js and TypeScript.',
  }),
  curatedFor('suraj-jha', {
    id: 'suraj-takeuforward-clone-video-b',
    seriesId: 'takeuforward-clone',
    title: 'Build a TakeUForward Clone — Video B',
    providerId: suraj,
    type: 'video',
    url: 'https://youtu.be/xYxYWdP4Fls?si=lBZPFY7LIywk6Poh',
    topics: ['nextjs', 'typescript', 'project-building'],
    level: 'intermediate',
    useCases: ['project-proof'],
    description: 'One video in the TakeUForward clone project family using Next.js and TypeScript.',
  }),
  curatedFor('suraj-jha', {
    id: 'suraj-modern-developer-portfolio',
    title: 'Build and Deploy a Modern Developer Portfolio with Next.JS | Framer Motion | Typescript | Shadcn',
    providerId: suraj,
    type: 'video',
    url: 'https://youtu.be/oYSwi_zqmDE?si=Oc8F2TurfH3lw_ug',
    topics: ['nextjs', 'typescript', 'project-building'],
    level: 'intermediate',
    useCases: ['project-proof'],
    description: 'A project course for building and deploying a modern developer portfolio.',
  }),
  paidCurated({
    id: 'chaicode-genai-js-cohort',
    title: 'GenAI JS Cohort',
    providerId: chaicodeWebsite,
    type: 'cohort',
    url: 'https://chaicode.com/',
    linkMode: 'PROVIDER_FALLBACK',
    deliveryMode: 'LIVE',
    topics: ['generative-ai', 'javascript', 'ai-agents'],
    level: 'intermediate',
    useCases: ['roadmap', 'technical-gap'],
    description: 'A live-snapshot ChaiCode cohort focused on generative AI and agents with JavaScript.',
  }),
  paidCurated({
    id: 'chaicode-full-stack-cohort',
    title: 'Full Stack Cohort',
    providerId: chaicodeWebsite,
    type: 'cohort',
    url: 'https://chaicode.com/',
    linkMode: 'PROVIDER_FALLBACK',
    deliveryMode: 'RECORDED',
    topics: ['full-stack'],
    level: 'beginner',
    useCases: ['roadmap'],
    description: 'A recorded ChaiCode cohort for structured full-stack learning.',
  }),
  paidCurated({
    id: 'chaicode-mobile-dev-cohort',
    title: 'Mobile Dev Cohort',
    providerId: chaicodeWebsite,
    type: 'cohort',
    url: 'https://chaicode.com/',
    linkMode: 'PROVIDER_FALLBACK',
    deliveryMode: 'RECORDED',
    topics: ['mobile-development'],
    level: 'beginner',
    useCases: ['roadmap'],
    description: 'A recorded ChaiCode cohort for structured mobile development learning.',
  }),
  paidCurated({
    id: 'chaicode-dsa-java-cohort',
    title: 'DSA with Java Cohort',
    providerId: chaicodeWebsite,
    type: 'cohort',
    url: 'https://chaicode.com/',
    linkMode: 'PROVIDER_FALLBACK',
    deliveryMode: 'RECORDED',
    topics: ['dsa'],
    level: 'beginner',
    useCases: ['roadmap', 'interview-prep'],
    description: 'A recorded ChaiCode cohort covering data structures and algorithms with Java.',
  }),
  paidCurated({
    id: 'chaicode-data-science-cohort',
    title: 'Data Science Cohort',
    providerId: chaicodeWebsite,
    type: 'cohort',
    url: 'https://chaicode.com/',
    linkMode: 'PROVIDER_FALLBACK',
    deliveryMode: 'RECORDED',
    topics: ['data-science', 'python'],
    level: 'beginner',
    useCases: ['roadmap'],
    description: 'A recorded ChaiCode cohort for learning data science with Python.',
  }),
  paidCurated({
    id: 'chaicode-genai-python-cohort',
    title: 'GenAI with Python Cohort',
    providerId: chaicodeWebsite,
    type: 'cohort',
    url: 'https://chaicode.com/',
    linkMode: 'PROVIDER_FALLBACK',
    deliveryMode: 'RECORDED',
    topics: ['generative-ai', 'python', 'ai-agents'],
    level: 'intermediate',
    useCases: ['roadmap', 'technical-gap'],
    description: 'A recorded ChaiCode cohort focused on generative AI and agents with Python.',
  }),
  paidCurated({
    id: 'chaicode-system-design-cohort',
    title: 'System Design Cohort',
    providerId: chaicodeWebsite,
    type: 'cohort',
    url: 'https://chaicode.com/',
    linkMode: 'PROVIDER_FALLBACK',
    deliveryMode: 'RECORDED',
    topics: ['system-design'],
    level: 'intermediate',
    useCases: ['roadmap', 'interview-prep'],
    description: 'A recorded ChaiCode cohort for structured system design and interview preparation.',
  }),
  paidCurated({
    id: 'chaicode-data-projects-cohort',
    title: 'Data Projects Cohort',
    providerId: chaicodeWebsite,
    type: 'cohort',
    url: 'https://chaicode.com/',
    linkMode: 'PROVIDER_FALLBACK',
    deliveryMode: 'RECORDED',
    topics: ['project-building', 'data-science'],
    level: 'intermediate',
    useCases: ['project-proof'],
    description: 'A recorded ChaiCode cohort centered on building substantial data projects.',
  }),
  paidCurated({
    id: 'chaicode-computer-networking-interview-product',
    title: 'Computer Networking Interview Preparation',
    providerId: chaicodeWebsite,
    type: 'digital-product',
    url: 'https://chaicode.com/',
    linkMode: 'PROVIDER_FALLBACK',
    topics: ['computer-networks'],
    level: 'intermediate',
    useCases: ['interview-prep'],
    description: 'A ChaiCode website product focused specifically on computer networking interview preparation.',
  }),
  paidCurated({
    id: 'chaicode-operating-systems-interview-product',
    title: 'Operating Systems Interview Preparation',
    providerId: chaicodeWebsite,
    type: 'digital-product',
    url: 'https://chaicode.com/',
    linkMode: 'PROVIDER_FALLBACK',
    topics: ['operating-systems'],
    level: 'intermediate',
    useCases: ['interview-prep'],
    description: 'A ChaiCode website product focused specifically on operating systems interview preparation.',
  }),
  paidCurated({
    id: 'chaicode-dbms-interview-product',
    title: 'Database Management System Interview Preparation',
    providerId: chaicodeWebsite,
    type: 'digital-product',
    url: 'https://chaicode.com/',
    linkMode: 'PROVIDER_FALLBACK',
    topics: ['dbms'],
    level: 'intermediate',
    useCases: ['interview-prep'],
    description: 'A ChaiCode website product focused specifically on database management interview preparation.',
  }),
  paidCurated({
    id: 'chaicode-udemy-web-development',
    creatorId: 'hitesh-choudhary',
    title: 'Complete web development course',
    providerId: chaicodeUdemy,
    type: 'course',
    url: 'https://udemy.com/course/web-dev-master/',
    canonicalUrl: 'https://udemy.com/course/web-dev-master/',
    offer: {
      source: 'ChaiCode',
      url: 'https://udemy.com/course/web-dev-master/?referralCode=4F744D1473CEDE3B10CF&couponCode=KEEPLEARNING',
      verifiedAt: PHASE_3_VERIFIED_AT,
      status: 'ACTIVE',
    },
    durationHours: 100,
    topics: ['javascript', 'nodejs', 'react', 'full-stack', 'backend', 'project-building'],
    level: 'beginner',
    useCases: ['roadmap', 'technical-gap'],
    description: 'A comprehensive full-stack web development course covering modern frontend and backend development.',
  }),
  paidCurated({
    id: 'chaicode-udemy-python-bootcamp',
    creatorId: 'hitesh-choudhary',
    title: 'The Ultimate Python Bootcamp: Learn by Building 50 Projects',
    providerId: chaicodeUdemy,
    type: 'course',
    url: 'https://udemy.com/course/100-days-of-python/',
    canonicalUrl: 'https://udemy.com/course/100-days-of-python/',
    offer: {
      source: 'ChaiCode',
      url: 'https://udemy.com/course/100-days-of-python/?referralCode=29DE137BD4CAB2506AF4&couponCode=KEEPLEARNING',
      verifiedAt: PHASE_3_VERIFIED_AT,
      status: 'ACTIVE',
    },
    durationHours: 30.5,
    topics: ['python', 'project-building'],
    level: 'beginner',
    useCases: ['roadmap', 'technical-gap', 'project-proof'],
    description: 'A project-based Python bootcamp built around fifty practical projects.',
  }),
  paidCurated({
    id: 'chaicode-udemy-agentic-ai-python',
    creatorId: 'hitesh-choudhary',
    additionalCreatorIds: ['piyush-garg'],
    title: 'Full stack generative and Agentic AI with python',
    providerId: chaicodeUdemy,
    type: 'course',
    url: 'https://udemy.com/course/full-stack-ai-with-python/',
    canonicalUrl: 'https://udemy.com/course/full-stack-ai-with-python/',
    offer: {
      source: 'ChaiCode',
      url: 'https://udemy.com/course/full-stack-ai-with-python/?referralCode=9FB677774173802C7752&couponCode=KEEPLEARNING',
      verifiedAt: PHASE_3_VERIFIED_AT,
      status: 'ACTIVE',
    },
    durationHours: 32.5,
    topics: ['generative-ai', 'ai-agents', 'python', 'full-stack'],
    level: 'intermediate',
    useCases: ['technical-gap', 'roadmap'],
    description: 'A structured course on building full-stack generative and agentic AI applications with Python.',
  }),
  paidCurated({
    id: 'chaicode-udemy-react-nextjs-ai',
    creatorId: 'hitesh-choudhary',
    additionalCreatorIds: ['suraj-jha'],
    title: 'Complete React and NextJS course with AI powered Projects',
    providerId: chaicodeUdemy,
    type: 'course',
    url: 'https://udemy.com/course/complete-react-and-nextjs-course-with-ai-powered-projects/',
    canonicalUrl: 'https://udemy.com/course/complete-react-and-nextjs-course-with-ai-powered-projects/',
    offer: {
      source: 'ChaiCode',
      url: 'https://udemy.com/course/complete-react-and-nextjs-course-with-ai-powered-projects/?referralCode=5D1CF9FB4ABFED92B037&couponCode=KEEPLEARNING',
      verifiedAt: PHASE_3_VERIFIED_AT,
      status: 'ACTIVE',
    },
    durationHours: 96.5,
    topics: ['react', 'nextjs', 'generative-ai', 'project-building'],
    level: 'intermediate',
    useCases: ['roadmap', 'technical-gap', 'project-proof'],
    description: 'A React and Next.js course centered on substantial AI-powered projects.',
  }),
  paidCurated({
    id: 'chaicode-udemy-nodejs-backend',
    creatorId: 'hitesh-choudhary',
    additionalCreatorIds: ['piyush-garg'],
    title: 'Node.js — Beginner to Advance course with projects',
    providerId: chaicodeUdemy,
    type: 'course',
    url: 'https://udemy.com/course/nodejs-backend/',
    canonicalUrl: 'https://udemy.com/course/nodejs-backend/',
    offer: {
      source: 'ChaiCode',
      url: 'https://udemy.com/course/nodejs-backend/?referralCode=6AD0C798E808E506CC1A&couponCode=KEEPLEARNING',
      verifiedAt: PHASE_3_VERIFIED_AT,
      status: 'ACTIVE',
    },
    durationHours: 36.5,
    topics: ['nodejs', 'backend', 'project-building'],
    level: 'beginner',
    useCases: ['technical-gap', 'roadmap'],
    description: 'A structured Node.js backend course progressing from beginner concepts to advanced projects.',
  }),
  paidCurated({
    id: 'chaicode-udemy-docker-kubernetes',
    creatorId: 'hitesh-choudhary',
    additionalCreatorIds: ['piyush-sachdeva'],
    title: 'Docker and Kubernetes for beginners | DevOps journey',
    providerId: chaicodeUdemy,
    type: 'course',
    url: 'https://udemy.com/course/docker-and-kubernetes-for-beginners-devops-journey/',
    canonicalUrl: 'https://udemy.com/course/docker-and-kubernetes-for-beginners-devops-journey/',
    offer: {
      source: 'ChaiCode',
      url: 'https://udemy.com/course/docker-and-kubernetes-for-beginners-devops-journey/?referralCode=E03A8962469A937D9AB5&couponCode=KEEPLEARNING',
      verifiedAt: PHASE_3_VERIFIED_AT,
      status: 'ACTIVE',
    },
    durationHours: 19,
    topics: ['docker', 'kubernetes', 'devops'],
    level: 'beginner',
    useCases: ['technical-gap', 'roadmap'],
    description: 'A beginner course covering Docker, Kubernetes, and the foundations of a DevOps journey.',
  }),
];

export const RESOURCE_PREFERENCE_RULES: readonly RankingPreferenceRule[] = [
  {
    id: 'prefer-hitesh-computer-networks',
    matchTopics: ['computer-networks'],
    matchUseCases: ['roadmap', 'technical-gap'],
    preferredCreatorIds: ['hitesh-choudhary'],
    boostStrength: 'STRONG',
  },
  {
    id: 'prefer-piyush-developer-mindset',
    matchTopics: ['developer-mindset'],
    matchUseCases: ['developer-mindset'],
    preferredCreatorIds: ['piyush-garg'],
    boostStrength: 'STRONG',
  },
];

const platformHosts: Record<ResourcePlatform, readonly string[]> = {
  YouTube: ['youtube.com', 'www.youtube.com', 'youtu.be'],
  Udemy: ['udemy.com', 'www.udemy.com'],
  Cohort: [],
  Website: [],
};

export class ResourceRegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceRegistryValidationError';
  }
}

export function canonicalResourceUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be') {
    url.search = '';
  } else if (host === 'youtube.com' || host === 'www.youtube.com') {
    url.hostname = 'youtube.com';
    if (url.pathname === '/playlist') {
      const list = url.searchParams.get('list');
      url.search = '';
      if (list) url.searchParams.set('list', list);
    } else if (url.pathname === '/watch') {
      const video = url.searchParams.get('v');
      url.search = '';
      if (video) url.searchParams.set('v', video);
    } else {
      url.searchParams.delete('si');
    }
  } else if (host === 'udemy.com' || host === 'www.udemy.com') {
    url.hostname = 'udemy.com';
    url.search = '';
  }
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  return url.toString().replace(/\/$/, '');
}

function validateHttpsUrl(value: string, label: string): URL {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error();
    return parsed;
  } catch {
    throw new ResourceRegistryValidationError(`${label} must be a valid public HTTPS URL`);
  }
}

function isRecommendableYoutubeUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be') return url.pathname.length > 1;
  if (host !== 'youtube.com' && host !== 'www.youtube.com') return false;
  if (url.pathname === '/watch') return Boolean(url.searchParams.get('v'));
  if (url.pathname === '/playlist') return Boolean(url.searchParams.get('list'));
  return /^\/(?:shorts|live)\/[^/]+/.test(url.pathname);
}

export function validateResourceRegistry(input: {
  creators: readonly Creator[];
  organizations: readonly Organization[];
  providers: readonly Provider[];
  resources: readonly LearningResource[];
}): void {
  const creatorIds = new Set<string>();
  for (const creator of input.creators) {
    if (!creator.id || !creator.name.trim() || creatorIds.has(creator.id)) {
      throw new ResourceRegistryValidationError(`Invalid or duplicate creator: ${creator.id}`);
    }
    creatorIds.add(creator.id);
  }

  const organizationIds = new Set<string>();
  for (const organization of input.organizations) {
    if (!organization.id || !organization.name.trim() || organizationIds.has(organization.id)) {
      throw new ResourceRegistryValidationError(`Invalid or duplicate organization: ${organization.id}`);
    }
    validateHttpsUrl(organization.url, `Organization ${organization.id} URL`);
    organizationIds.add(organization.id);
  }

  const providerIds = new Set<string>();
  for (const provider of input.providers) {
    if (!provider.id || !provider.name.trim() || providerIds.has(provider.id)) {
      throw new ResourceRegistryValidationError(`Invalid or duplicate provider: ${provider.id}`);
    }
    const creatorOwner = 'creatorId' in provider ? provider.creatorId : undefined;
    const organizationOwner = 'organizationId' in provider ? provider.organizationId : undefined;
    if (Boolean(creatorOwner) === Boolean(organizationOwner) ||
        (creatorOwner !== undefined && !creatorIds.has(creatorOwner)) ||
        (organizationOwner !== undefined && !organizationIds.has(organizationOwner))) {
      throw new ResourceRegistryValidationError(`Provider ${provider.id} has an invalid owner`);
    }
    if (!['YouTube', 'Udemy', 'Cohort', 'Website'].includes(provider.platform) ||
        (provider.language !== undefined && !['hi', 'en', 'mixed'].includes(provider.language))) {
      throw new ResourceRegistryValidationError(`Provider ${provider.id} has invalid enum metadata`);
    }
    if (provider.url) {
      const url = validateHttpsUrl(provider.url, `Provider ${provider.id} URL`);
      const allowed = platformHosts[provider.platform];
      if (allowed.length > 0 && !allowed.includes(url.hostname.toLowerCase())) {
        throw new ResourceRegistryValidationError(`Provider ${provider.id} URL does not match its platform`);
      }
    }
    providerIds.add(provider.id);
  }

  const resourceIds = new Set<string>();
  const canonicalUrls = new Set<string>();
  const topicSet = new Set<string>(RESOURCE_TOPICS);
  const useCaseSet = new Set<string>(RESOURCE_USE_CASES);
  for (const resource of input.resources) {
    if (!resource.id || resourceIds.has(resource.id)) {
      throw new ResourceRegistryValidationError(`Invalid or duplicate resource ID: ${resource.id}`);
    }
    const provider = input.providers.find(({ id }) => id === resource.providerId);
    const instructorIds = [resource.creatorId, ...(resource.additionalCreatorIds ?? [])]
      .filter((id): id is string => Boolean(id));
    if (!provider || instructorIds.some((id) => !creatorIds.has(id)) || new Set(instructorIds).size !== instructorIds.length) {
      throw new ResourceRegistryValidationError(`Resource ${resource.id} references an unknown creator/provider`);
    }
    if ('creatorId' in provider && !instructorIds.includes(provider.creatorId)) {
      throw new ResourceRegistryValidationError(`Resource ${resource.id} creator/provider mismatch`);
    }
    const parsed = validateHttpsUrl(resource.url, `Resource ${resource.id} URL`);
    const allowed = platformHosts[provider.platform];
    if (allowed.length > 0 && !allowed.includes(parsed.hostname.toLowerCase())) {
      throw new ResourceRegistryValidationError(`Resource ${resource.id} URL does not match its provider platform`);
    }
    if (provider.platform === 'YouTube' && !isRecommendableYoutubeUrl(parsed)) {
      throw new ResourceRegistryValidationError(`Resource ${resource.id} must be a video or playlist, not a channel`);
    }
    const canonicalUrl = canonicalResourceUrl(resource.url);
    const linkMode = resource.linkMode ?? 'DIRECT_RESOURCE';
    if (linkMode === 'PROVIDER_FALLBACK' && (!provider.url || canonicalUrl !== canonicalResourceUrl(provider.url))) {
      throw new ResourceRegistryValidationError(`Resource ${resource.id} has an invalid provider fallback URL`);
    }
    if (linkMode === 'DIRECT_RESOURCE' && canonicalUrls.has(canonicalUrl)) {
      throw new ResourceRegistryValidationError(`Duplicate resource URL: ${resource.url}`);
    }
    if (resource.canonicalUrl && canonicalResourceUrl(resource.canonicalUrl) !== canonicalUrl) {
      throw new ResourceRegistryValidationError(`Resource ${resource.id} has a mismatched canonical URL`);
    }
    if (provider.platform === 'Udemy' && !resource.canonicalUrl) {
      throw new ResourceRegistryValidationError(`Resource ${resource.id} requires a canonical Udemy URL`);
    }
    if (resource.offer) {
      const offerUrl = validateHttpsUrl(resource.offer.url, `Resource ${resource.id} offer URL`);
      if (resource.offer.source !== 'ChaiCode' ||
          (resource.offer.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(resource.offer.status)) ||
          Number.isNaN(Date.parse(resource.offer.verifiedAt)) ||
          canonicalResourceUrl(offerUrl.toString()) !== canonicalUrl) {
        throw new ResourceRegistryValidationError(`Resource ${resource.id} has invalid offer metadata`);
      }
    }
    if (!resource.title.trim() || !resource.description.trim() || resource.topics.length === 0) {
      throw new ResourceRegistryValidationError(`Resource ${resource.id} has missing required metadata`);
    }
    if (resource.seriesId !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resource.seriesId)) {
      throw new ResourceRegistryValidationError(`Resource ${resource.id} has an invalid series ID`);
    }
    if (resource.topics.some((topic) => !topicSet.has(topic))) {
      throw new ResourceRegistryValidationError(`Resource ${resource.id} has an unknown topic`);
    }
    if (resource.useCases.some((useCase) => !useCaseSet.has(useCase))) {
      throw new ResourceRegistryValidationError(`Resource ${resource.id} has an unknown use-case`);
    }
    if (!['video', 'playlist', 'course', 'cohort', 'digital-product', 'article', 'docs'].includes(resource.type) ||
        !['beginner', 'intermediate', 'advanced'].includes(resource.level) ||
        !['free', 'paid'].includes(resource.accessType) ||
        !['ACTIVE', 'ARCHIVED'].includes(resource.status) ||
        !['DIRECT_RESOURCE', 'PROVIDER_FALLBACK'].includes(linkMode) ||
        (resource.deliveryMode !== undefined && !['LIVE', 'RECORDED'].includes(resource.deliveryMode)) ||
        (resource.durationHours !== undefined && (!Number.isFinite(resource.durationHours) || resource.durationHours <= 0)) ||
        (resource.language !== undefined && !['hi', 'en', 'mixed'].includes(resource.language)) ||
        resource.sourceOrigin !== 'CURATED' ||
        Number.isNaN(Date.parse(resource.verifiedAt))) {
      throw new ResourceRegistryValidationError(`Resource ${resource.id} has invalid enum or date metadata`);
    }
    resourceIds.add(resource.id);
    if (linkMode === 'DIRECT_RESOURCE') canonicalUrls.add(canonicalUrl);
  }
}

validateResourceRegistry({
  creators: RESOURCE_CREATORS,
  organizations: RESOURCE_ORGANIZATIONS,
  providers: RESOURCE_PROVIDERS,
  resources: CURATED_LEARNING_RESOURCES,
});
