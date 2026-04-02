// Schema-driven constants — source of truth: Data_Extraction_Form_v7

export const PUBLICATION_TYPES = [
  "Conference paper",
  "Journal article",
];

export const STUDY_DESIGNS = [
  "Case report",
  "Case series",
  "Clinical trial",
  "Cohort",
  "Cross-sectional",
  "Survey",
  "Prototyping / Bench testing",
  "Conceptual / Ideation study",
  "Engineering/development study with user testing",
  "Other",
];

export const AMPUTATION_CAUSES = [
  "Acquired – disease",
  "Acquired – trauma",
  "Congenital",
  "Mixed",
  "Not reported",
];

export const AMPUTATION_LEVELS = [
  "Hand / partial hand",
  "Wrist disarticulation",
  "Transradial",
  "Elbow disarticulation",
  "Transhumeral",
  "Shoulder level",
  "Multiple levels",
  "Not reported",
];

export const PROSTHESIS_LEVELS = [
  "Hand",
  "Hand + wrist",
  "Transradial",
  "Transhumeral",
  "Multi-level / other",
  "Not reported",
];

export const CONTROL_STRATEGIES = [
  "Direct EMG (1 site)",
  "Direct EMG (2 sites)",
  "Pattern recognition",
  "Proportional control",
  "Switch control",
  "Hybrid control",
  "Not reported",
  "Not applicable (e.g., passive/cosmetic prosthesis)",
  "Other",
];

export const SENSORS = [
  "Surface EMG",
  "Force / pressure sensor",
  "IMU / motion sensor",
  "Not reported",
  "Not applicable",
  "Other",
];

export const FEEDBACK_MODALITIES = [
  "Visual",
  "Auditory",
  "Vibrotactile",
  "None / Not applicable",
  "Not reported",
  "Other",
];

export const GROWTH_ACCOMMODATIONS = [
  "Adjustable / modular component",
  "Socket replacement schedule",
  "No specific strategy",
  "Not reported",
  "Not applicable",
];

// "Mixed" REMOVED per v7 requirements
export const SETTINGS = [
  "Laboratory",
  "Hospital / inpatient",
  "Rehabilitation clinic",
  "Home use",
  "School / community",
  "Not reported",
  "Not applicable (No testing performed)",
];

export const FUNCTIONAL_TESTS = [
  "Box and Block Test (BBT)",
  "SHAP",
  "Jebsen-Taylor",
  "QUEST",
  "TAPES",
  "ACMC",
  "None / Not applicable",
  "Other",
];

// Renamed to focus on INFERENTIAL statistics
export const STATISTICAL_TESTS_PERFORMED = [
  "Yes",
  "No",
  "Not reported / Unclear",
];

export const HAS_PEDIATRIC_PARTICIPANTS = [
  "Yes",
  "No",
];

// Q6 added
export const RESEARCH_QUESTIONS = [
  "Q1 – Main (Geral)",
  "Q2 – Technology and Design",
  "Q3 – Usability and Acceptance",
  "Q4 – Functional and Clinical Outcomes",
  "Q5 – Pediatric-Specific Needs and Gaps",
  "Q6 – Technical Challenges and Barriers",
];

export const ALL_RESEARCH_QUESTIONS = [
  ...RESEARCH_QUESTIONS,
];
