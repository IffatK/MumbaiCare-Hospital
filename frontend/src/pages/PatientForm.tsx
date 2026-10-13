import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { useHospitals } from "../components/HospitalFilter";
import { patientFormSchema, PatientForm } from "../lib/schemas";
import {
  PageHeader,
  Panel,
  Field,
  Spinner,
  Loading,
  Disclaimer,
} from "../components/ui";
const CONDITIONS = [
  "Dengue",
  "Malaria",
  "Typhoid",
  "Pneumonia",
  "Diabetes Complications",
  "Hypertension",
  "Cardiac Event",
  "Fracture",
  "Gastroenteritis",
  "Asthma Exacerbation",
];
const iso = (d: any) => (d ? String(d).slice(0, 10) : "");
const todayLocal = () => new Date().toLocaleDateString("en-CA");
export default function PatientFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: hs = [] } = useHospitals();
  const existing = useQuery({
    queryKey: ["patient", id],
    queryFn: () => api(`/patients/${id}`),
    enabled: editing,
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PatientForm>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      status: "ADMITTED",
      severity: undefined,
      gender: "Male",
      hospitalId: user?.hospitalId ?? (undefined as any),
      systolicBp: 120,
      diastolicBp: 80,
      cholesterol: 190,
      heartRate: 78,
      admissionDate: new Date().toLocaleDateString("en-CA"),
      tests: "",
    },
  });
  const [assessingRisk, setAssessingRisk] = useState(false);
  const [riskAssessed, setRiskAssessed] = useState(false);
  useEffect(() => {
    const p: any = existing.data;
    if (p)
      reset({
        ...p,
        cost: Number(p.cost),
        admissionDate: iso(p.admissionDate),
        dischargeDate: iso(p.dischargeDate),
      });
  }, [existing.data, reset]);

  const a = watch("admissionDate"),
    dd = watch("dischargeDate"),
    status = watch("status");
  const stay =
    a && dd
      ? Math.round((new Date(dd).getTime() - new Date(a).getTime()) / 86400000)
      : null;
  const assessRisk = async () => {
    setAssessingRisk(true);

    try {
      const token = sessionStorage.getItem("mc_token");

      const response = await fetch("/api/mining/predict-severity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          age: Number(watch("age")),
          gender: watch("gender"),
          disease: watch("condition"),
          systolic_bp: Number(watch("systolicBp")),
          diastolic_bp: Number(watch("diastolicBp")),
          cholesterol: Number(watch("cholesterol")),
          heart_rate: Number(watch("heartRate")),
          stay_days: stay ?? 0,
          treatment_cost: Number(watch("cost")),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to assess patient risk");
      }

      reset({
        ...watch(),
        severity: result.predictedSeverity,
      });
      setRiskAssessed(true);
    } catch (e: any) {
      toast("err", e.message);
    } finally {
      setAssessingRisk(false);
    }
  };
  const save = useMutation({
    mutationFn: (v: PatientForm) =>
      api(editing ? `/patients/${id}` : "/patients", {
        method: editing ? "PUT" : "POST",
        body: {
          ...v,
          dischargeDate: v.dischargeDate || null,
          tests: v.tests ?? "",
        },
      }),
    onSuccess: (p: any) => {
      qc.invalidateQueries();
      toast("ok", editing ? "Record updated" : `Record ${p.recordId} added`);
      nav(`/app/patients/${p.id}`);
    },
    onError: (e: any) => {
      e.issues?.forEach((i: any) =>
        setError(i.path[0], { message: i.message }),
      );
      toast("err", e.message);
    },
  });
  if (editing && existing.isLoading) return <Loading h="h-96" />;
  const n = (k: keyof PatientForm) => register(k);
  return (
    <>
      <PageHeader
        title={
          editing
            ? `Edit ${(existing.data as any)?.recordId}`
            : "Add patient record"
        }
        description="A record ID is generated automatically. Stay duration is calculated from the dates."
      />
      <form
        onSubmit={handleSubmit((v) => save.mutateAsync(v).catch(() => {}))}
        className="space-y-4"
        noValidate
      >
        <Panel title="Record">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Hospital"
              htmlFor="h"
              error={errors.hospitalId?.message}
            >
              <select id="h" className="input" {...n("hospitalId")}>
                <option value="">Select hospital</option>
                {hs
                  .filter(
                    (h) =>
                      h.active &&
                      (user?.role !== "STAFF" || h.id === user.hospitalId),
                  )
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Age" htmlFor="age" error={errors.age?.message}>
              <input id="age" type="number" className="input" {...n("age")} />
            </Field>
            <Field label="Gender" htmlFor="g">
              <select id="g" className="input" {...n("gender")}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Status" htmlFor="st">
              <select id="st" className="input" {...n("status")}>
                <option value="ADMITTED">Admitted</option>
                <option value="DISCHARGED">Discharged</option>
              </select>
            </Field>
          </div>
        </Panel>
        <Panel title="Condition and vitals">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Condition"
              htmlFor="c"
              error={errors.condition?.message}
            >
              <input
                id="c"
                list="conds"
                className="input"
                {...n("condition")}
              />
              <datalist id="conds">
                {CONDITIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Patient Risk Level">
              <p className="input bg-ink-50">
                {riskAssessed
                  ? watch("severity") === "MILD"
                    ? "Mild"
                    : watch("severity") === "MODERATE"
                      ? "Moderate"
                      : "Severe"
                  : "Not assessed"}
              </p>
              <input type="hidden" {...n("severity")} />
            </Field>
            <Field
              label="Systolic BP (mmHg)"
              htmlFor="sbp"
              error={errors.systolicBp?.message}
            >
              <input
                id="sbp"
                type="number"
                className="input"
                {...n("systolicBp")}
              />
            </Field>
            <Field
              label="Diastolic BP (mmHg)"
              htmlFor="dbp"
              error={errors.diastolicBp?.message}
            >
              <input
                id="dbp"
                type="number"
                className="input"
                {...n("diastolicBp")}
              />
            </Field>
            <Field
              label="Cholesterol (mg/dL)"
              htmlFor="ch"
              error={errors.cholesterol?.message}
            >
              <input
                id="ch"
                type="number"
                className="input"
                {...n("cholesterol")}
              />
            </Field>
            <Field
              label="Heart rate (bpm)"
              htmlFor="hr"
              error={errors.heartRate?.message}
            >
              <input
                id="hr"
                type="number"
                className="input"
                {...n("heartRate")}
              />
            </Field>
          </div>
        </Panel>
        <Panel title="Stay and treatment">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Admission date"
              htmlFor="ad"
              error={errors.admissionDate?.message}
            >
              <input
                id="ad"
                type="date"
                className="input"
                {...n("admissionDate")}
              />
            </Field>
            <Field
              label="Discharge date"
              htmlFor="dd"
              error={errors.dischargeDate?.message}
            >
              <input
                id="dd"
                type="date"
                className="input"
                disabled={status === "ADMITTED"}
                {...n("dischargeDate")}
              />
            </Field>
            <Field label="Stay duration">
              <p className="input bg-ink-50">
                {stay != null && stay >= 0 ? `${stay} days` : "—"}
              </p>
            </Field>
            <Field
              label="Treatment cost (₹)"
              htmlFor="cost"
              error={errors.cost?.message}
            >
              <input
                id="cost"
                type="number"
                step="0.01"
                className="input"
                {...n("cost")}
              />
            </Field>
            <Field
              label="Treatment / procedure"
              htmlFor="tr"
              error={errors.treatment?.message}
            >
              <input id="tr" className="input" {...n("treatment")} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Tests (comma-separated)" htmlFor="ts">
                <input
                  id="ts"
                  className="input"
                  placeholder="CBC, ECG, Chest X-Ray"
                  {...n("tests")}
                />
              </Field>
            </div>
          </div>
        </Panel>
        <Disclaimer>
          Enter synthetic data only. Do not enter real patient information.
        </Disclaimer>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => nav(-1)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={assessRisk}
            disabled={assessingRisk || isSubmitting}
          >
            {assessingRisk && <Spinner />}
            {assessingRisk ? "Assessing..." : "Assess Patient Risk"}
          </button>
          <button className="btn-primary" disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            {editing ? "Save changes" : "Add record"}
          </button>
        </div>
      </form>
    </>
  );
}
