-- PhysioAssist Database Schema
-- Initialize all tables and set up basic relationships

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles table (Supabase Auth integration)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'patient')),
  clinic_name TEXT,
  license_number TEXT,
  date_of_birth DATE,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Doctor-Patient relationship
CREATE TABLE IF NOT EXISTS doctor_patient (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  UNIQUE(doctor_id, patient_id)
);

-- Exercises (predefined exercises)
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  body_part TEXT NOT NULL,
  model_url TEXT NOT NULL,
  video_url TEXT,
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Patient Exercises (exercise configuration per patient)
CREATE TABLE IF NOT EXISTS patient_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  reps_target INTEGER NOT NULL,
  sets_target INTEGER NOT NULL,
  angle_threshold FLOAT NOT NULL,
  confidence_threshold FLOAT DEFAULT 0.7,
  frequency_per_week INTEGER DEFAULT 3,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  assigned_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT true,
  UNIQUE(patient_id, exercise_id)
);

-- Sessions (workout sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_exercise_id UUID NOT NULL REFERENCES patient_exercises(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT false,
  reps_completed INTEGER DEFAULT 0,
  sets_completed INTEGER DEFAULT 0,
  data JSONB,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Doctor Notes (feedback from doctors)
CREATE TABLE IF NOT EXISTS doctor_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_doctor_id ON doctor_patient(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_patient_id ON doctor_patient(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_exercises_patient_id ON patient_exercises(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_exercises_exercise_id ON patient_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_sessions_patient_id ON sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_doctor_notes_doctor_id ON doctor_notes(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_notes_session_id ON doctor_notes(session_id);

-- Enable RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can see their own profile and doctors can see their patients
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Doctors can view their patients" ON profiles
  FOR SELECT USING (
    auth.uid() IN (
      SELECT doctor_id FROM doctor_patient WHERE patient_id = id
    )
  );

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Doctor Patient: Visible to involved doctor/patient and admin
CREATE POLICY "Users can view their doctor relationships" ON doctor_patient
  FOR SELECT USING (
    auth.uid() = doctor_id OR 
    auth.uid() = patient_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Patient Exercises: Visible to patient, their doctor, and admin
CREATE POLICY "Patients can view their exercises" ON patient_exercises
  FOR SELECT USING (
    auth.uid() = patient_id OR
    auth.uid() IN (
      SELECT doctor_id FROM doctor_patient WHERE patient_id = patient_exercises.patient_id
    ) OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Sessions: Visible to patient, their doctor, and admin
CREATE POLICY "Patients can view their sessions" ON sessions
  FOR SELECT USING (
    auth.uid() = patient_id OR
    auth.uid() IN (
      SELECT doctor_id FROM doctor_patient WHERE patient_id = sessions.patient_id
    ) OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Doctor Notes: Visible to involved doctor, patient, and admin
CREATE POLICY "View doctor notes" ON doctor_notes
  FOR SELECT USING (
    auth.uid() = doctor_id OR
    auth.uid() IN (
      SELECT patient_id FROM sessions WHERE id = session_id
    ) OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
