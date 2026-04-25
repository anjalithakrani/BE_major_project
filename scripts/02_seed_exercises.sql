-- Seed initial exercises for PhysioAssist
-- These are predefined exercises that can be assigned to patients

INSERT INTO exercises (name, description, body_part, model_url, video_url, instructions) VALUES
(
  'Shoulder Flexion',
  'Raise your arm forward to shoulder height',
  'shoulder',
  '/models/shoulder_flexion.tflite',
  '/videos/shoulder_flexion.mp4',
  'Stand upright with arms at your sides. Slowly raise your arm forward, keeping it straight, until it reaches shoulder height. Hold for 2 seconds, then lower slowly. Repeat.'
),
(
  'Knee Extension',
  'Straighten your leg from a bent position',
  'knee',
  '/models/knee_extension.tflite',
  '/videos/knee_extension.mp4',
  'Sit upright in a chair. Slowly straighten one leg until it is fully extended. Hold for 2 seconds, then bend back to starting position. Keep thigh flat on chair. Repeat.'
),
(
  'Hip Abduction',
  'Lift your leg out to the side',
  'hip',
  '/models/hip_abduction.tflite',
  '/videos/hip_abduction.mp4',
  'Stand upright with weight on one leg. Slowly lift the other leg out to the side, keeping it straight. Lift to about 45 degrees. Hold for 2 seconds, then lower. Repeat.'
),
(
  'Elbow Flexion',
  'Bend your elbow to bring hand toward shoulder',
  'elbow',
  '/models/elbow_flexion.tflite',
  '/videos/elbow_flexion.mp4',
  'Stand upright with arms at your sides. Bend your elbow, bringing your hand toward your shoulder. Keep upper arm still. Hold for 2 seconds, then lower slowly. Repeat.'
),
(
  'Ankle Dorsiflexion',
  'Point your toes upward',
  'ankle',
  '/models/ankle_dorsiflexion.tflite',
  '/videos/ankle_dorsiflexion.mp4',
  'Sit upright in a chair with feet flat on floor. Pull your toes upward toward your body. Hold for 2 seconds, then relax. Repeat.'
);
