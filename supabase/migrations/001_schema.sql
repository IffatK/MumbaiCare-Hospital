create table if not exists hospitals (
  id serial primary key, code text unique not null, name text not null, area text not null,
  type text not null, phone text, email text, active boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists users (
  id serial primary key, email text unique not null, password_hash text not null,
  name text not null, role text not null check (role in ('ADMIN','ANALYST','STAFF')),
  hospital_id int references hospitals(id), created_at timestamptz default now()
);
create table if not exists patients (
  id serial primary key, record_id text unique not null, hospital_id int not null references hospitals(id),
  age int not null, gender text not null, condition text not null,
  severity text not null check (severity in ('MILD','MODERATE','SEVERE')),
  systolic_bp int, diastolic_bp int, cholesterol int, heart_rate int,
  admission_date date not null, discharge_date date, stay_days int,
  treatment text not null, tests text not null default '', cost numeric(12,2) not null,
  status text not null check (status in ('ADMITTED','DISCHARGED')),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists ix_patients_hosp_date on patients(hospital_id, admission_date);
create index if not exists ix_patients_condition on patients(condition);
create index if not exists ix_patients_severity on patients(severity);
create index if not exists ix_patients_status on patients(status);
create index if not exists ix_patients_updated on patients(updated_at);
create or replace function set_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_patients_updated on patients;
create trigger trg_patients_updated before update on patients for each row execute function set_updated_at();
create table if not exists etl_runs (
  id serial primary key, started_at timestamptz default now(), ended_at timestamptz,
  status text not null, extracted int default 0, transformed int default 0,
  loaded int default 0, rejected int default 0, issues jsonb default '[]'
);
create table if not exists activity_log (
  id serial primary key, user_id int, action text not null, detail text, created_at timestamptz default now()
);
