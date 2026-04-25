'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

interface Exercise {
  id: string;
  name: string;
  description: string;
  body_part: string;
  instructions: string;
}

interface PatientExercise {
  id: string;
  exercise_id: string;
  reps_target: number;
  sets_target: number;
  angle_threshold: number;
}

export default function AssignExercisesPage() {
  const params = useParams();
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [assignedExercises, setAssignedExercises] = useState<PatientExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedExercises, setSelectedExercises] = useState<{
    [key: string]: {
      reps: number;
      sets: number;
      angle: number;
    };
  }>({});

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get all exercises
      const { data: exercisesData, error: exError } = await supabase
        .from('exercises')
        .select('*');

      if (exError) throw exError;
      setExercises(exercisesData || []);

      // Get assigned exercises
      const { data: assignedData, error: asError } = await supabase
        .from('patient_exercises')
        .select('*')
        .eq('patient_id', params.id);

      if (asError) throw asError;
      setAssignedExercises(assignedData || []);

      // Initialize selected exercises with current values
      const initialized: any = {};
      (assignedData || []).forEach((pe) => {
        initialized[pe.exercise_id] = {
          reps: pe.reps_target,
          sets: pe.sets_target,
          angle: pe.angle_threshold,
        };
      });
      setSelectedExercises(initialized);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExerciseSelect = (exerciseId: string) => {
    if (selectedExercises[exerciseId]) {
      const newSelected = { ...selectedExercises };
      delete newSelected[exerciseId];
      setSelectedExercises(newSelected);
    } else {
      setSelectedExercises({
        ...selectedExercises,
        [exerciseId]: { reps: 10, sets: 3, angle: 45 },
      });
    }
  };

  const handleInputChange = (
    exerciseId: string,
    field: string,
    value: number
  ) => {
    setSelectedExercises({
      ...selectedExercises,
      [exerciseId]: {
        ...selectedExercises[exerciseId],
        [field]: value,
      },
    });
  };

  const handleSave = async () => {
    try {
      setError('');
      setSuccess('');

      // Get current assigned exercise IDs
      const currentIds = new Set(assignedExercises.map((pe) => pe.exercise_id));
      const newIds = new Set(Object.keys(selectedExercises));

      // Remove unassigned exercises
      for (const id of currentIds) {
        if (!newIds.has(id)) {
          const { error } = await supabase
            .from('patient_exercises')
            .delete()
            .eq('patient_id', params.id)
            .eq('exercise_id', id);

          if (error) throw error;
        }
      }

      // Add or update exercises
      for (const [exerciseId, config] of Object.entries(selectedExercises)) {
        const existing = assignedExercises.find(
          (pe) => pe.exercise_id === exerciseId
        );

        if (existing) {
          const { error } = await supabase
            .from('patient_exercises')
            .update({
              reps_target: (config as any).reps,
              sets_target: (config as any).sets,
              angle_threshold: (config as any).angle,
            })
            .eq('id', existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('patient_exercises')
            .insert({
              patient_id: params.id,
              exercise_id: exerciseId,
              reps_target: (config as any).reps,
              sets_target: (config as any).sets,
              angle_threshold: (config as any).angle,
              assigned_by: (await supabase.auth.getUser()).data.user?.id,
            });

          if (error) throw error;
        }
      }

      setSuccess('Exercises assigned successfully!');
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (err) {
      setError('Failed to save exercises');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Assign Exercises</h2>
        <p className="text-gray-500 mt-1">Configure therapy exercises for patient</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {exercises.map((exercise) => {
          const isSelected = !!selectedExercises[exercise.id];
          const config = selectedExercises[exercise.id];

          return (
            <Card key={exercise.id} className={isSelected ? 'border-blue-500' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleExerciseSelect(exercise.id)}
                      className="w-5 h-5"
                    />
                    <div>
                      <CardTitle>{exercise.name}</CardTitle>
                      <CardDescription>{exercise.body_part}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {isSelected && config && (
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">{exercise.description}</p>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Target Reps
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={config.reps}
                        onChange={(e) =>
                          handleInputChange(
                            exercise.id,
                            'reps',
                            parseInt(e.target.value)
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Target Sets
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={config.sets}
                        onChange={(e) =>
                          handleInputChange(
                            exercise.id,
                            'sets',
                            parseInt(e.target.value)
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Angle Threshold (°)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="180"
                        value={config.angle}
                        onChange={(e) =>
                          handleInputChange(
                            exercise.id,
                            'angle',
                            parseInt(e.target.value)
                          )
                        }
                      />
                    </div>
                  </div>

                  <details className="border-t pt-4">
                    <summary className="cursor-pointer font-medium text-blue-600">
                      Instructions
                    </summary>
                    <p className="mt-2 text-sm text-gray-600">{exercise.instructions}</p>
                  </details>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex gap-2 sticky bottom-0">
        <Button onClick={handleSave} className="flex-1">
          Save Assignments
        </Button>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
