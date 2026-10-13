import { Router } from "express";
import { z } from "zod";
import { wrap, HttpError } from "../lib/http";
import { loadDataset } from "../services/mining/dataset";
import { runKMeans } from "../services/mining/kmeans";
import { runDBSCAN } from "../services/mining/dbscan";
import { runDecisionTree } from "../services/mining/decisionTree";
import { runRandomForest } from "../services/mining/randomForest";
import { runNaiveBayes } from "../services/mining/naiveBayes";
import { runLinearRegression } from "../services/mining/linearRegression";
import { runApriori } from "../services/mining/apriori";
import { runCrossHospital } from "../services/mining/crossHospital";
import { runComparison } from "../services/mining/compare";
import { MiningError } from "../services/mining/random";
import {
  predictPatientSeverity,
  PatientPredictionInput,
} from "../services/mining/patientPrediction";
const r = Router();
const NUM = [
  "age",
  "systolic_bp",
  "diastolic_bp",
  "cholesterol",
  "heart_rate",
  "stay_days",
  "treatment_cost",
] as const;
const ALL_FEAT = [
  ...NUM,
  "gender",
  "disease",
  "hospital",
  "age_group",
] as const;
const base = z.object({ hospitalIds: z.array(z.number()).optional() });
const guard = async <T>(fn: () => Promise<T> | T) => {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof MiningError) throw new HttpError(400, (e as any).message);
    throw e;
  }
};

r.post(
  "/kmeans",
  wrap(async (req, res) => {
    const b = base
      .extend({
        features: z.array(z.enum(NUM)).min(2),
        k: z.number().int().min(2).max(10),
        standardize: z.boolean().default(true),
      })
      .parse(req.body);
    const { labels, rowsUsed, ...out } = await guard(async () =>
      runKMeans(
        await loadDataset(b.hospitalIds),
        b.features,
        b.k,
        b.standardize,
      ),
    );
    res.json(out);
  }),
);
r.post(
  "/dbscan",
  wrap(async (req, res) => {
    const b = base
      .extend({
        features: z.array(z.enum(NUM)).min(2),
        eps: z.number().min(0.01).max(10).default(0.5),
        minPts: z.number().int().min(2).max(20).default(5),
        standardize: z.boolean().default(true),
      })
      .parse(req.body);
    res.json(
      await guard(async () =>
        runDBSCAN(
          await loadDataset(b.hospitalIds),
          b.features,
          b.eps,
          b.minPts,
          b.standardize,
        ),
      ),
    );
  }),
);
r.post(
  "/decision-tree",
  wrap(async (req, res) => {
    const b = base
      .extend({
        target: z
          .enum(["severity", "is_discharged", "age_group"])
          .default("severity"),
        features: z.array(z.enum(ALL_FEAT)).min(1),
        maxDepth: z.number().int().min(1).max(10).default(4),
        testSize: z.number().min(0.1).max(0.5).default(0.3),
      })
      .parse(req.body);
    res.json(
      await guard(async () =>
        runDecisionTree(
          await loadDataset(b.hospitalIds),
          b.target,
          b.features,
          b.maxDepth,
          b.testSize,
        ),
      ),
    );
  }),
);
r.post(
  "/random-forest",
  wrap(async (req, res) => {
    const b = base
      .extend({
        target: z
          .enum(["severity", "is_discharged", "age_group"])
          .default("severity"),
        features: z.array(z.enum(ALL_FEAT)).min(1),
        nTrees: z.number().int().min(5).max(100).default(30),
        maxDepth: z.number().int().min(1).max(8).default(5),
        testSize: z.number().min(0.1).max(0.5).default(0.3),
      })
      .parse(req.body);
    res.json(
      await guard(async () =>
        runRandomForest(
          await loadDataset(b.hospitalIds),
          b.target,
          b.features,
          b.nTrees,
          b.maxDepth,
          b.testSize,
        ),
      ),
    );
  }),
);
r.post(
  "/naive-bayes",
  wrap(async (req, res) => {
    const b = base
      .extend({
        target: z
          .enum(["severity", "is_discharged", "age_group"])
          .default("severity"),
        features: z.array(z.enum(NUM)).min(1),
        testSize: z.number().min(0.1).max(0.5).default(0.3),
      })
      .parse(req.body);
    res.json(
      await guard(async () =>
        runNaiveBayes(
          await loadDataset(b.hospitalIds),
          b.target,
          b.features,
          b.testSize,
        ),
      ),
    );
  }),
);
r.post(
  "/linear-regression",
  wrap(async (req, res) => {
    const b = base
      .extend({
        target: z
          .enum(["treatment_cost", "stay_days", "age"])
          .default("treatment_cost"),
        features: z.array(z.enum(NUM)).min(1),
        testSize: z.number().min(0.1).max(0.5).default(0.3),
      })
      .parse(req.body);
    res.json(
      await guard(async () =>
        runLinearRegression(
          await loadDataset(b.hospitalIds),
          b.target,
          b.features,
          b.testSize,
        ),
      ),
    );
  }),
);
r.post(
  "/apriori",
  wrap(async (req, res) => {
    const b = base
      .extend({
        source: z.enum(["tests", "tests_treatment"]).default("tests_treatment"),
        minSupport: z.number().min(0.01).max(1),
        minConfidence: z.number().min(0.05).max(1),
        minLift: z.number().min(0).max(50).default(1),
      })
      .parse(req.body);
    res.json(
      await guard(async () =>
        runApriori(
          await loadDataset(b.hospitalIds),
          b.source,
          b.minSupport,
          b.minConfidence,
          b.minLift,
        ),
      ),
    );
  }),
);
r.post(
  "/cross-hospital",
  wrap(async (req, res) => {
    const b = base
      .extend({
        features: z
          .array(z.enum(NUM))
          .min(2)
          .default(["age", "stay_days", "treatment_cost"]),
        k: z.number().int().min(2).max(8).default(3),
      })
      .parse(req.body);
    res.json(
      await guard(async () =>
        runCrossHospital(await loadDataset(b.hospitalIds), b.features, b.k),
      ),
    );
  }),
);
r.post(
  "/compare",
  wrap(async (req, res) => {
    const b = base
      .extend({
        target: z
          .enum(["severity", "is_discharged", "age_group"])
          .default("severity"),
        features: z.array(z.enum(ALL_FEAT)).min(2),
        testSize: z.number().min(0.1).max(0.5).default(0.3),
      })
      .parse(req.body);
    res.json(
      await guard(async () =>
        runComparison(
          await loadDataset(b.hospitalIds),
          b.target,
          b.features,
          b.testSize,
        ),
      ),
    );
  }),
);
r.post("/predict-severity", async (req, res) => {
  try {
    const input: PatientPredictionInput = {
      age: Number(req.body.age),
      gender: String(req.body.gender),
      disease: String(req.body.disease),
      systolic_bp: Number(req.body.systolic_bp),
      diastolic_bp: Number(req.body.diastolic_bp),
      cholesterol: Number(req.body.cholesterol),
      heart_rate: Number(req.body.heart_rate),
      stay_days: Number(req.body.stay_days),
      treatment_cost: Number(req.body.treatment_cost),
    };

    const result = await predictPatientSeverity(input);

    res.json({
      success: true,
      ...result,
    });
  } catch (e: any) {
    res.status(400).json({
      success: false,
      error: e?.message ?? "Prediction failed",
    });
  }
});
export default r;
