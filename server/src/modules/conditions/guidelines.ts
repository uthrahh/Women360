/**
 * Everything the "worth discussing with a doctor" signals and the condition panels claim lives
 * here, so it can be reviewed in one sitting.
 *
 * Nothing in this app diagnoses. A signal says: here are YOUR numbers, here is the published
 * line they cross, here is who looks at this and what they may check. Each rule keeps apart
 *  - what a named guideline says (GUIDELINE_* values and the `guideline` text), and
 *  - our own choices about how much logged data is enough to say anything (DESIGN_* values),
 * because the guidelines define normal ranges for clinicians, not how many logged cycles are
 * enough for an app to speak.
 *
 * REVIEW.reviewed stays false until a clinician has been through this file, including checking
 * every citation and link below, and the screens say so while it does.
 */

export const REVIEW = {
  reviewed: false,
  note: "Draft: the thresholds, wording and links have not yet been reviewed by a clinician.",
};

export interface Source {
  label: string;
  url: string;
}

export const SOURCES = {
  pcos2023: {
    label: "International evidence-based guideline for the assessment and management of PCOS (2023)",
    url: "https://doi.org/10.1093/humrep/dead156",
  },
  figo2018: {
    label: "FIGO systems for normal and abnormal uterine bleeding (Munro et al., 2018)",
    url: "https://doi.org/10.1002/ijgo.12666",
  },
  nice88: {
    label: "NICE NG88: Heavy menstrual bleeding, assessment and management",
    url: "https://www.nice.org.uk/guidance/ng88",
  },
  eshre2022: {
    label: "ESHRE guideline: Endometriosis (2022)",
    url: "https://doi.org/10.1093/hropen/hoac009",
  },
  nice73: {
    label: "NICE NG73: Endometriosis, diagnosis and management",
    url: "https://www.nice.org.uk/guidance/ng73",
  },
  dsm5tr: {
    label: "DSM-5-TR (American Psychiatric Association, 2022): premenstrual dysphoric disorder",
    url: "https://www.psychiatry.org/psychiatrists/practice/dsm",
  },
  straw10: {
    label: "STRAW+10: staging of reproductive ageing (Harlow et al., 2012)",
    url: "https://doi.org/10.1097/gme.0b013e31824d8f40",
  },
  nice23: {
    label: "NICE NG23: Menopause, diagnosis and management",
    url: "https://www.nice.org.uk/guidance/ng23",
  },
  asrmAmenorrhea: {
    label: "ASRM Practice Committee: current evaluation of amenorrhea",
    url: "https://www.asrm.org/practice-guidance/practice-committee-documents/",
  },
} satisfies Record<string, Source>;

// ---- What the guidelines say ---------------------------------------------------------

/** PCOS 2023: cycles shorter than 21 or longer than 35 days are irregular (from three years after the first period). */
export const GUIDELINE_CYCLE_MIN = 21;
export const GUIDELINE_CYCLE_MAX = 35;
/** FIGO 2018: a period lasting more than 8 days is prolonged. */
export const GUIDELINE_PERIOD_MAX_DAYS = 8;
/** Absence of periods for three months is secondary amenorrhoea (ASRM). */
export const GUIDELINE_AMENORRHEA_DAYS = 90;
/** STRAW+10: early transition is a persistent difference of 7 or more days between consecutive cycles; late transition begins with 60 or more days without a period. */
export const GUIDELINE_CYCLE_VARIATION_DAYS = 7;
export const GUIDELINE_LATE_TRANSITION_GAP_DAYS = 60;
/** The perimenopause signal is only offered from this age (NICE NG23 considers it from the 40s). */
export const GUIDELINE_PERIMENOPAUSE_FROM_AGE = 40;
/** From this age irregular cycles are expected to be perimenopause, so the irregular-cycle signal gives way to that one. */
export const GUIDELINE_IRREGULAR_UNTIL_AGE = 45;

// ---- Our own choices (how much logged data is enough) -------------------------------

/** At least this many logged cycle lengths before saying anything about regularity. */
export const DESIGN_MIN_INTERVALS = 3;
/** How many recent cycle lengths are looked at. */
export const DESIGN_RECENT_INTERVALS = 4;
/** Irregular when at least this many of those fall outside the guideline range. */
export const DESIGN_IRREGULAR_COUNT = 2;
/** Pain is logged 0 to 4; this or more is "severe" in our wording. */
export const DESIGN_PAIN_SEVERE = 3;
/** Painful when at least this many of her last four periods had a severe-pain day. */
export const DESIGN_PAIN_PERIODS = 3;
/** A period with this many heavy-flow days is "heavy" in our wording. */
export const DESIGN_HEAVY_DAYS = 3;
/** Heavy or long when at least this many of her last three periods were. */
export const DESIGN_HEAVY_PERIODS = 2;
/** Energy is logged 0 to 4; this or less is "low". */
export const DESIGN_LOW_ENERGY = 1;
export const DESIGN_LOW_ENERGY_DAYS = 3;
/** Mood is logged 0 (lowest) to 4 (best). The week before a period must be this much lower than the week after it starts, and itself low. */
export const DESIGN_MOOD_DROP = 1.0;
export const DESIGN_MOOD_LOW = 2.0;
export const DESIGN_MOOD_LATE_DAYS_MIN = 4;
export const DESIGN_MOOD_EARLY_DAYS_MIN = 3;
export const DESIGN_MOOD_CYCLES = 2;
/** A signal she has set aside stays away this long. */
export const DESIGN_DISMISS_DAYS = 90;

// ---- Conditions she can tell us about ------------------------------------------------

export type ConditionCode = "PCOS" | "ENDOMETRIOSIS" | "THYROID" | "PMDD" | "PERIMENOPAUSE" | "ANAEMIA";

export interface ConditionInfo {
  code: ConditionCode;
  label: string;
  /** One plain sentence about what it is. */
  about: string;
  /** What to watch and note, from the guideline's own list of features. */
  trackSymptoms: string[];
  /** Why those, and who to ask. */
  note: string;
  sources: Source[];
}

export const CONDITIONS: Record<ConditionCode, ConditionInfo> = {
  PCOS: {
    code: "PCOS",
    label: "PCOS",
    about: "Polycystic ovary syndrome: a common hormonal condition that often shows as irregular cycles and can bring acne, extra hair growth and changes in weight or mood.",
    trackSymptoms: ["Acne", "Excess hair growth", "Scalp hair thinning", "Weight change", "Low mood", "Anxiety"],
    note: "The 2023 guideline lists irregular cycles and signs of high androgens (acne, extra hair, scalp hair loss) as the main features, and recommends regular checks of blood pressure, blood sugar, cholesterol, weight and mood. Your doctor decides which checks you need and how often.",
    sources: [SOURCES.pcos2023],
  },
  ENDOMETRIOSIS: {
    code: "ENDOMETRIOSIS",
    label: "Endometriosis",
    about: "Tissue like the womb lining growing elsewhere in the pelvis, often causing painful periods and pelvic pain. It is commonly diagnosed years after symptoms begin.",
    trackSymptoms: ["Pelvic pain", "Painful sex", "Pain when passing stool", "Pain when passing urine", "Bloating", "Fatigue"],
    note: "Guidelines list painful periods, pelvic pain, pain with sex or with bowel and bladder habits, and tiredness as the usual features. Noting when each happens in your cycle is exactly what a specialist asks about.",
    sources: [SOURCES.eshre2022, SOURCES.nice73],
  },
  THYROID: {
    code: "THYROID",
    label: "Thyroid condition",
    about: "An underactive or overactive thyroid, which can change your energy, weight, temperature sensitivity and the regularity of your periods.",
    trackSymptoms: ["Fatigue", "Hair loss", "Feeling cold", "Feeling hot", "Weight change", "Heart racing"],
    note: "Thyroid conditions are diagnosed with a blood test, not from symptoms. Logging them alongside your cycle gives your doctor a clearer picture when your thyroid levels are reviewed.",
    sources: [],
  },
  PMDD: {
    code: "PMDD",
    label: "PMDD",
    about: "Premenstrual dysphoric disorder: marked mood symptoms such as low mood, irritability or anxiety in the week before a period that ease soon after it starts.",
    trackSymptoms: ["Irritability", "Anxiety", "Low mood", "Feeling overwhelmed", "Trouble concentrating", "Poor sleep"],
    note: "Diagnosis needs daily ratings across at least two cycles, which is what logging your mood here gives you to bring to a doctor. If you ever feel hopeless or unsafe, contact a doctor or a crisis line straight away.",
    sources: [SOURCES.dsm5tr],
  },
  PERIMENOPAUSE: {
    code: "PERIMENOPAUSE",
    label: "Perimenopause",
    about: "The years before periods stop, when cycles become less predictable and symptoms such as hot flushes and poor sleep can begin.",
    trackSymptoms: ["Hot flushes", "Night sweats", "Poor sleep", "Vaginal dryness", "Low mood", "Brain fog"],
    note: "Guidelines list these as the common symptoms. Predictions on the Cycle page are kept loose for you because cycle length varies a lot in this stage.",
    sources: [SOURCES.nice23, SOURCES.straw10],
  },
  ANAEMIA: {
    code: "ANAEMIA",
    label: "Anaemia or low iron",
    about: "Too little iron or haemoglobin in the blood, often linked to heavy periods, causing tiredness, breathlessness and pale skin.",
    trackSymptoms: ["Fatigue", "Breathlessness", "Dizziness", "Pale skin", "Heavy bleeding"],
    note: "Anaemia is found with a blood test. Noting how heavy your periods are and how tired you feel helps your doctor decide what to check.",
    sources: [SOURCES.nice88],
  },
};

export const CONDITION_CODES = Object.keys(CONDITIONS) as [ConditionCode, ...ConditionCode[]];

// ---- Signals: what each says, in plain words -----------------------------------------

export type SignalKey = "IRREGULAR_CYCLES" | "LONG_GAP" | "HEAVY_OR_LONG_PERIODS" | "PAINFUL_PERIODS" | "LUTEAL_MOOD_PATTERN" | "CYCLE_CHANGES_PERIMENOPAUSE";

export interface SignalInfo {
  title: string;
  /** What the guideline draws the line at. */
  guideline: string;
  /** What a doctor may look at, never what she has. */
  mayCheck: string[];
  relatedTo: ConditionCode[];
  sources: Source[];
}

export const SIGNALS: Record<SignalKey, SignalInfo> = {
  IRREGULAR_CYCLES: {
    title: "Your cycle lengths have been outside the usual range",
    guideline: "The 2023 PCOS guideline counts cycles shorter than 21 or longer than 35 days as irregular.",
    mayCheck: ["Hormone blood tests, including thyroid and prolactin", "Signs of high androgens such as acne or extra hair growth", "An ultrasound or an AMH blood test if PCOS is suspected", "Stress, weight change, medicines and your thyroid, which can all affect cycles"],
    relatedTo: ["PCOS", "THYROID"],
    sources: [SOURCES.pcos2023],
  },
  LONG_GAP: {
    title: "It has been a long time since your last period",
    guideline: "Three months without a period is called secondary amenorrhoea and is a reason to see a doctor (unless you are pregnant, breastfeeding or have stopped periods on purpose).",
    mayCheck: ["A pregnancy test", "Thyroid and prolactin blood tests", "Hormone levels, including those linked to PCOS", "Stress, very low weight, heavy exercise or a medicine change"],
    relatedTo: ["PCOS", "THYROID", "PERIMENOPAUSE"],
    sources: [SOURCES.asrmAmenorrhea, SOURCES.pcos2023],
  },
  HEAVY_OR_LONG_PERIODS: {
    title: "Your periods have been heavy or long",
    guideline: "FIGO counts a period lasting more than 8 days as prolonged. NICE says heavy bleeding that interferes with your life is a reason to be assessed, and a full blood count is recommended.",
    mayCheck: ["A full blood count to look for anaemia, and iron levels", "A pelvic examination or ultrasound", "Thyroid tests if other symptoms point to it", "Fibroids, polyps and hormonal causes"],
    relatedTo: ["ANAEMIA", "ENDOMETRIOSIS"],
    sources: [SOURCES.figo2018, SOURCES.nice88],
  },
  PAINFUL_PERIODS: {
    title: "You have logged strong period pain in several cycles",
    guideline: "ESHRE and NICE list painful periods as a main feature of endometriosis, which is often diagnosed years after symptoms start. Severe pain that disrupts daily life is a reason to be assessed.",
    mayCheck: ["A conversation about when and where the pain happens", "A pelvic examination and an ultrasound", "Whether pain also comes with sex, or with bowel or bladder habits", "Other causes of painful periods"],
    relatedTo: ["ENDOMETRIOSIS"],
    sources: [SOURCES.eshre2022, SOURCES.nice73],
  },
  LUTEAL_MOOD_PATTERN: {
    title: "Your mood dips in the week before your period",
    guideline: "A mood pattern tied to the cycle is assessed with daily ratings across at least two cycles, which is what your logged mood provides. It can have several causes, and a doctor decides what it is.",
    mayCheck: ["A review of your daily mood ratings across cycles", "Whether symptoms ease soon after your period starts", "Other causes of low mood, sleep and stress", "Treatments, which differ by cause"],
    relatedTo: ["PMDD"],
    sources: [SOURCES.dsm5tr],
  },
  CYCLE_CHANGES_PERIMENOPAUSE: {
    title: "Your cycles are changing in a way that fits the years around menopause",
    guideline: "STRAW+10 describes the early change as a persistent difference of 7 or more days between consecutive cycle lengths, and the later change as 60 or more days without a period. NICE says perimenopause is usually recognised from symptoms and age.",
    mayCheck: ["Your symptoms and how they affect you", "Whether another cause fits better, such as thyroid or pregnancy", "Options for managing symptoms", "Bone and heart health at this stage"],
    relatedTo: ["PERIMENOPAUSE"],
    sources: [SOURCES.straw10, SOURCES.nice23],
  },
};
