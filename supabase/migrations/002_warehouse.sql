create schema if not exists dw;
create table if not exists dw.dim_hospital (
  hospital_key serial primary key, hospital_id int unique not null,
  hospital_name text, area text, hospital_type text
);
create table if not exists dw.dim_patient (
  patient_key serial primary key, patient_record_id text unique not null,
  age int, age_group text, gender text
);
create table if not exists dw.dim_disease (
  disease_key serial primary key, disease text not null, severity text not null,
  unique(disease, severity)
);
create table if not exists dw.dim_date (
  date_key int primary key, full_date date, day smallint, month smallint,
  month_name text, quarter smallint, year smallint, weekday text
);
create table if not exists dw.fact_patient_admission (
  fact_id bigserial primary key, source_record_id text unique not null,
  patient_key int references dw.dim_patient(patient_key),
  hospital_key int references dw.dim_hospital(hospital_key),
  disease_key int references dw.dim_disease(disease_key),
  admission_date_key int references dw.dim_date(date_key),
  discharge_date_key int references dw.dim_date(date_key),
  patient_count smallint default 1, is_discharged smallint not null,
  stay_days int, treatment_cost numeric(12,2),
  systolic_bp int, diastolic_bp int, cholesterol int, heart_rate int,
  treatment text, tests text
);
create index if not exists ix_fact_hosp_date on dw.fact_patient_admission(hospital_key, admission_date_key);
create index if not exists ix_fact_disease on dw.fact_patient_admission(disease_key);
