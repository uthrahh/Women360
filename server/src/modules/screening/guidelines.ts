/**
 * The preventive screening rules the app shows, with their sources.
 *
 * These are medical claims, so they are written down in one place, each tied to
 * a source a clinician can check. Change them deliberately and update
 * `REVIEWED_ON`. The numbers below were read from the documents named in
 * `SOURCES` on 2026-10-20:
 *
 *  - NCDC / MoHFW, "Training Module for Medical Officers for Prevention, Control
 *    and Population Level Screening of Hypertension, Diabetes and Common Cancer
 *    (Oral, Breast & Cervical)", NPCDCS, 2017. Its Table 2.1 sets the target
 *    population (diabetes, hypertension and oral cancer: men and women 30-65;
 *    cervical and breast cancer: all women 30-65, citing the GOI 2016
 *    Operational Framework for Management of Common Cancers) and Table 2.2 sets
 *    the frequency (diabetes and hypertension once a year; breast, cervical and
 *    oral cancer once in five years). Methods named there: blood pressure
 *    measurement, blood glucose test, oral visual examination (OVE), clinical
 *    breast examination (CBE), visual inspection with acetic acid (VIA).
 *  - WHO, Cervical cancer fact sheet: screening "with a high-performance test
 *    every 5-10 years starting at age 30"; women living with HIV "every 3-5
 *    years, starting at age 25".
 *  - WHO, Breast cancer fact sheet: mammography screening, usually women 50-69.
 *
 * NOT clinically reviewed. India's programme has no stated upper age for blood
 * pressure and diabetes ("30 years and above"); the cancers stop at 65. After
 * the stated range the app says "ask your doctor", it does not say "stop".
 */

export const REVIEWED_ON = "2026-10-20";
export const REVIEW_STATUS = "Draft: not yet reviewed by a clinician";
export const REGION = "India";

export interface Source {
  label: string;
  url?: string;
}

export const SOURCES: Record<string, Source> = {
  npcdcs: {
    label: "NCDC / Ministry of Health & Family Welfare (India): NPCDCS population-level screening training module, 2017",
    url: "https://nhsrcindia.org/sites/default/files/2021-06/Module%20for%20MOs%20for%20Prevention,Control%20&%20PBS%20of%20Hypertension,Diabetes%20&%20Common%20Cancer.pdf",
  },
  whoCervical: {
    label: "WHO: Cervical cancer fact sheet",
    url: "https://www.who.int/news-room/fact-sheets/detail/cervical-cancer",
  },
  whoBreast: {
    label: "WHO: Breast cancer fact sheet",
    url: "https://www.who.int/news-room/fact-sheets/detail/breast-cancer",
  },
};

export interface Screening {
  id: string;
  title: string;
  /** What is done, in plain words. */
  method: string;
  /** Why it matters, one sentence. */
  why: string;
  startAge: number;
  /** The programme's stated upper age; undefined where none is stated. */
  endAge?: number;
  intervalMonths: number;
  /** Plain-language note shown with the item. */
  note?: string;
  /** Things that mean "talk to a clinician" rather than follow the standard interval. */
  caveats: string[];
  sources: (keyof typeof SOURCES)[];
}

export const SCREENINGS: Screening[] = [
  {
    id: "blood-pressure",
    title: "Blood pressure check",
    method: "A quick blood pressure measurement",
    why: "High blood pressure usually has no symptoms, and catching it early lowers the risk of heart disease and stroke.",
    startAge: 30,
    intervalMonths: 12,
    caveats: ["If you already have high blood pressure, follow your doctor's schedule instead."],
    sources: ["npcdcs"],
  },
  {
    id: "blood-sugar",
    title: "Blood sugar test",
    method: "A blood glucose test",
    why: "Diabetes can develop without obvious symptoms; finding it early makes it much easier to manage.",
    startAge: 30,
    intervalMonths: 12,
    caveats: ["If you already have diabetes or higher risk, follow your doctor's schedule instead."],
    sources: ["npcdcs"],
  },
  {
    id: "oral-exam",
    title: "Mouth (oral) examination",
    method: "A visual check of your mouth by a trained health worker or dentist",
    why: "Oral cancer can often be seen early, especially in people who use tobacco.",
    startAge: 30,
    endAge: 65,
    intervalMonths: 60,
    note: "Tell your doctor straight away about any mouth sore that doesn't heal, or a white or red patch.",
    caveats: ["Check more often if you use tobacco, and ask your doctor how often."],
    sources: ["npcdcs"],
  },
  {
    id: "breast-exam",
    title: "Clinical breast examination",
    method: "A breast examination by a trained health worker or doctor",
    why: "Breast changes found early are easier to treat.",
    startAge: 30,
    endAge: 65,
    intervalMonths: 60,
    note: "India's national programme uses a clinical breast examination. WHO describes mammography screening for women usually aged 50-69 where a programme can be run well; ask your doctor whether a mammogram is right for you.",
    caveats: ["See a doctor promptly for any new lump, nipple discharge or skin change; don't wait for the next check."],
    sources: ["npcdcs", "whoBreast"],
  },
  {
    id: "cervical",
    title: "Cervical screening",
    method: "A visual inspection with acetic acid (VIA), or an HPV test where available",
    why: "Cervical cancer develops slowly, and screening can find changes long before they become cancer.",
    startAge: 30,
    endAge: 65,
    intervalMonths: 60,
    note: "India's programme uses VIA once every five years. WHO recommends a high-performance test (HPV DNA) every 5 to 10 years from age 30.",
    caveats: [
      "Not done during your period, in pregnancy, or within 12 weeks of a delivery or abortion; and not for anyone previously treated for cervical cancer.",
      "WHO advises women living with HIV start at 25 and screen every 3 to 5 years.",
    ],
    sources: ["npcdcs", "whoCervical"],
  },
];

export const DISCLAIMER =
  "A general guide for adults in India, not medical advice. If you have symptoms, a family history, or a health condition, your doctor may suggest checks earlier or more often.";
