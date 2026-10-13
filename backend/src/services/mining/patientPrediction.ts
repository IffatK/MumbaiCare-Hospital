import { loadDataset, Row } from "./dataset";
import { runRandomForest } from "./randomForest";
import { MiningError } from "./random";

const FEATURES = [
  "age",
  "gender",
  "disease",
  "systolic_bp",
  "diastolic_bp",
  "cholesterol",
  "heart_rate",
  "stay_days",
  "treatment_cost",
];

export interface PatientPredictionInput {
  age: number;
  gender: string;
  disease: string;
  systolic_bp: number;
  diastolic_bp: number;
  cholesterol: number;
  heart_rate: number;
  stay_days: number;
  treatment_cost: number;
}

export async function predictPatientSeverity(input: PatientPredictionInput) {
  const dataset = await loadDataset();

  if (dataset.length < 30) {
    throw new MiningError(
      "Not enough patient records to train the prediction model.",
    );
  }

  // Train the existing Random Forest model
  const model = runRandomForest(dataset, "severity", FEATURES, 30, 5, 0.3);

  // Create a Row representing the new patient
  const newPatient: Row = {
    record_id: "new-patient",
    hospital: "",
    hospital_id: 0,
    age: input.age,
    age_group: "",
    gender: input.gender,
    disease: input.disease,
    severity: "",
    systolic_bp: input.systolic_bp,
    diastolic_bp: input.diastolic_bp,
    cholesterol: input.cholesterol,
    heart_rate: input.heart_rate,
    stay_days: input.stay_days,
    treatment_cost: input.treatment_cost,
    is_discharged: 0,
    treatment: "",
    tests: "",
  };

  // Predict the severity of the new patient
  const predictedSeverity = model.predict(newPatient);

  return {
    input,
    model: "Random Forest",
    target: "severity",
    predictedSeverity,
    trainingAccuracy: model.accuracy,
  };
}
