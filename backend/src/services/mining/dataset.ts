import { q } from '../../lib/db';
import { MiningError } from './random';
export interface Row {
  record_id: string; hospital: string; hospital_id: number; age: number; age_group: string; gender: string;
  disease: string; severity: string; systolic_bp: number; diastolic_bp: number; cholesterol: number;
  heart_rate: number; stay_days: number | null; treatment_cost: number; is_discharged: number; treatment: string; tests: string;
}
export async function loadDataset(hospitalIds?: number[]): Promise<Row[]> {
  const where = hospitalIds?.length ? `where h.hospital_id in (${hospitalIds.join(',')})` : '';
  const rows = await q<Row>(`
    select f.source_record_id record_id, h.hospital_name hospital, h.hospital_id, p.age, p.age_group, p.gender,
      d.disease, d.severity, f.systolic_bp, f.diastolic_bp, f.cholesterol, f.heart_rate, f.stay_days,
      f.treatment_cost, f.is_discharged, f.treatment, f.tests
    from dw.fact_patient_admission f
    join dw.dim_hospital h on h.hospital_key=f.hospital_key
    join dw.dim_patient p on p.patient_key=f.patient_key
    join dw.dim_disease d on d.disease_key=f.disease_key ${where}
    order by f.source_record_id`);
  if (!rows.length) throw new MiningError('The warehouse is empty for this selection. Run the ETL first.');
  return rows;
}
