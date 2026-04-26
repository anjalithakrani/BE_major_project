// 'use client';

// import { useEffect, useState, useRef } from 'react';
// import { useParams, useRouter } from 'next/navigation';
// import { useAuth } from '@/lib/auth-context';
// import { supabase } from '@/lib/supabase';
// import {
//   initializePoseDetection,
//   detectPose,
//   calculateAngle,
//   getKeypoint,
//   drawKeypoints,
//   drawSkeleton,
//   detectRep,
// } from '@/lib/pose-detection';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent } from '@/components/ui/card';
// import { Spinner } from '@/components/ui/spinner';
// import type * as poseDetection from '@tensorflow-models/pose-detection';

// interface PatientExercise {
//   id: string;
//   reps_target: number;
//   sets_target: number;
//   angle_threshold: number;
//   confidence_threshold: number;
//   exercise: {
//     id: string;
//     name: string;
//     body_part: string;
//     instructions: string;
//   };
// }

// export default function WorkoutPage() {
//   const params = useParams();
//   const router = useRouter();
//   const { user } = useAuth();
//   const [exercise, setExercise] = useState<PatientExercise | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');

//   // Workout state
//   const [isRunning, setIsRunning] = useState(false);
//   const [reps, setReps] = useState(0);
//   const [sets, setSets] = useState(0);
//   const [feedback, setFeedback] = useState('');

//   // Refs
//   const videoRef = useRef<HTMLVideoElement>(null);
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
//   const sessionRef = useRef<string | null>(null);
//   const repPhaseRef = useRef<'up' | 'down' | 'none'>('none');
//   const prevAngleRef = useRef(0);

//   useEffect(() => {
//     if (user) {
//       fetchExercise();
//     }
//   }, [user, params.id]);

//   const fetchExercise = async () => {
//     try {
//       setLoading(true);
//       const { data, error: fError } = await supabase
//         .from('patient_exercises')
//         .select(
//           `
//           id, reps_target, sets_target, angle_threshold, confidence_threshold,
//           exercise(id, name, body_part, instructions)
//         `
//         )
//         .eq('id', params.id)
//         .eq('patient_id', user?.id)
//         .single();

//       if (fError) throw fError;
//       setExercise(data);
//     } catch (err) {
//       setError('Failed to load exercise');
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const startWorkout = async () => {
//     try {
//       setError('');

//       // Initialize pose detection
//       if (!detectorRef.current) {
//         detectorRef.current = await initializePoseDetection();
//       }

//       // Get user media
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { width: { ideal: 640 }, height: { ideal: 480 } },
//       });

//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;

//         // Create session
//         const { data: sessionData, error: sessionError } = await supabase
//           .from('sessions')
//           .insert({
//             patient_id: user?.id,
//             patient_exercise_id: params.id,
//             start_time: new Date().toISOString(),
//             completed: false,
//           })
//           .select('id')
//           .single();

//         if (sessionError) throw sessionError;
//         sessionRef.current = sessionData.id;

//         setIsRunning(true);
//         setReps(0);
//         setSets(0);
//         setFeedback('Starting detection...');

//         // Start pose detection loop
//         startPoseDetectionLoop();
//       }
//     } catch (err) {
//       setError('Failed to start workout: ' + (err instanceof Error ? err.message : ''));
//       console.error(err);
//     }
//   };

//   const startPoseDetectionLoop = async () => {
//     const video = videoRef.current;
//     const canvas = canvasRef.current;

//     if (!video || !canvas || !detectorRef.current || !exercise) {
//       return;
//     }

//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;

//     const processFrame = async () => {
//       if (!isRunning || !video || !canvas) return;

//       try {
//         // Detect poses
//         const poses = await detectPose(video);

//         if (poses.length > 0) {
//           const pose = poses[0];

//           // Draw video frame with skeleton
//           ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
//           drawKeypoints(ctx, poses, exercise.confidence_threshold);
//           drawSkeleton(ctx, poses, exercise.confidence_threshold);

//           // Calculate angle based on exercise type
//           // This is a simplified example for shoulder flexion
//           const shoulder = getKeypoint(pose, 'left_shoulder');
//           const elbow = getKeypoint(pose, 'left_elbow');
//           const wrist = getKeypoint(pose, 'left_wrist');

//           if (shoulder && elbow && wrist) {
//             const angle = calculateAngle(shoulder, elbow, wrist);

//             // Detect rep completion
//             const { repCompleted, phase } = detectRep(
//               angle,
//               prevAngleRef.current,
//               exercise.angle_threshold - 45,
//               exercise.angle_threshold + 45,
//               20
//             );

//             if (repCompleted && repPhaseRef.current === 'up') {
//               setReps((prev) => prev + 1);
//               setFeedback('Rep completed!');
//               repPhaseRef.current = 'down';
//             }

//             prevAngleRef.current = angle;
//             repPhaseRef.current = phase;

//             // Display angle on canvas
//             ctx.fillStyle = '#FFFFFF';
//             ctx.font = '20px Arial';
//             ctx.fillText(`Angle: ${angle.toFixed(1)}°`, 10, 30);
//             ctx.fillText(
//               `Reps: ${reps}/${exercise.reps_target} Sets: ${sets}/${exercise.sets_target}`,
//               10,
//               60
//             );
//           } else {
//             setFeedback('Please align your body with the camera');
//           }
//         } else {
//           setFeedback('No body detected. Please move in front of the camera.');
//         }
//       } catch (err) {
//         console.error('Frame processing error:', err);
//       }

//       if (isRunning) {
//         requestAnimationFrame(processFrame);
//       }
//     };

//     processFrame();
//   };

//   const endWorkout = async () => {
//     setIsRunning(false);

//     // Stop video stream
//     if (videoRef.current && videoRef.current.srcObject) {
//       const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
//       tracks.forEach((track) => track.stop());
//     }

//     // Save session
//     if (sessionRef.current) {
//       const { error } = await supabase
//         .from('sessions')
//         .update({
//           end_time: new Date().toISOString(),
//           completed: reps >= (exercise?.reps_target || 0),
//           reps_completed: reps,
//           sets_completed: sets,
//           feedback,
//         })
//         .eq('id', sessionRef.current);

//       if (error) {
//         setError('Failed to save session');
//         console.error(error);
//       } else {
//         setFeedback('Workout saved! Redirecting...');
//         setTimeout(() => {
//           router.push('/patient');
//         }, 2000);
//       }
//     }
//   };

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center h-64">
//         <Spinner />
//       </div>
//     );
//   }

//   if (!exercise) {
//     return (
//       <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
//         Exercise not found
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-2xl mx-auto space-y-6">
//       <div>
//         <h2 className="text-3xl font-bold tracking-tight">{exercise.exercise.name}</h2>
//         <p className="text-gray-500 mt-1">{exercise.exercise.instructions}</p>
//       </div>

//       {error && (
//         <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
//           {error}
//         </div>
//       )}

//       <Card>
//         <CardContent className="pt-6">
//           {!isRunning ? (
//             <Button onClick={startWorkout} className="w-full mb-4">
//               Start Workout
//             </Button>
//           ) : (
//             <div className="space-y-4">
//               <div className="relative">
//                 <video
//                   ref={videoRef}
//                   autoPlay
//                   playsInline
//                   className="hidden"
//                   width="640"
//                   height="480"
//                 />
//                 <canvas
//                   ref={canvasRef}
//                   width="640"
//                   height="480"
//                   className="w-full border-2 border-gray-300 rounded"
//                 />
//               </div>

//               <div className="grid grid-cols-3 gap-4 text-center">
//                 <div className="p-4 bg-blue-50 rounded-lg">
//                   <p className="text-sm text-gray-600">Reps</p>
//                   <p className="text-2xl font-bold">
//                     {reps}/{exercise.reps_target}
//                   </p>
//                 </div>
//                 <div className="p-4 bg-green-50 rounded-lg">
//                   <p className="text-sm text-gray-600">Sets</p>
//                   <p className="text-2xl font-bold">
//                     {sets}/{exercise.sets_target}
//                   </p>
//                 </div>
//                 <div className="p-4 bg-purple-50 rounded-lg">
//                   <p className="text-sm text-gray-600">Status</p>
//                   <p className="text-sm font-semibold">{feedback}</p>
//                 </div>
//               </div>

//               <Button
//                 onClick={endWorkout}
//                 variant="destructive"
//                 className="w-full"
//               >
//                 End Workout
//               </Button>
//             </div>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// }
