import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

let detector: poseDetection.PoseDetector | null = null;

export async function initializePoseDetection() {
  if (detector) return detector;

  try {
    const model = poseDetection.SupportedModels.BlazePose;
    const detectorConfig = {
      runtime: 'tfjs' as const,
      modelType: 'full' as const,
    };

    detector = await poseDetection.createDetector(model, detectorConfig);
    return detector;
  } catch (error) {
    console.error('Failed to initialize pose detection:', error);
    throw error;
  }
}

export async function detectPose(video: HTMLVideoElement) {
  if (!detector) {
    throw new Error('Pose detector not initialized');
  }

  try {
    const poses = await detector.estimatePoses(video, {
      maxPoses: 1,
      flipHorizontal: false,
    });
    return poses;
  } catch (error) {
    console.error('Pose detection error:', error);
    throw error;
  }
}

export function calculateAngle(
  a: poseDetection.Keypoint,
  b: poseDetection.Keypoint,
  c: poseDetection.Keypoint
): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) -
    Math.atan2(a.y - b.y, a.x - b.x);

  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
}

export function getKeypoint(
  pose: poseDetection.Pose,
  keypointName: string
): poseDetection.Keypoint | null {
  const keypoint = pose.keypoints.find((kp) => kp.name === keypointName);
  return keypoint && keypoint.score && keypoint.score > 0.5 ? keypoint : null;
}

export interface RepData {
  timestamp: number;
  angle: number;
  confidence: number;
  isValid: boolean;
}

export function detectRep(
  angle: number,
  previousAngle: number,
  minAngle: number,
  maxAngle: number,
  angleThreshold: number
): { repCompleted: boolean; phase: 'up' | 'down' | 'none' } {
  const repCompleted =
    previousAngle > minAngle &&
    previousAngle < maxAngle &&
    angle > maxAngle - angleThreshold;

  let phase: 'up' | 'down' | 'none' = 'none';

  if (angle > previousAngle) {
    phase = 'up';
  } else if (angle < previousAngle) {
    phase = 'down';
  }

  return { repCompleted, phase };
}

export function drawKeypoints(
  ctx: CanvasRenderingContext2D,
  poses: poseDetection.Pose[],
  minConfidence: number = 0.5
) {
  const keypoints = poses.map((pose) => pose.keypoints).flat();

  keypoints.forEach((keypoint) => {
    if (keypoint.score && keypoint.score >= minConfidence) {
      const circle = new Path2D();
      circle.arc(keypoint.x, keypoint.y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#00FF00';
      ctx.fill(circle);
    }
  });
}

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  poses: poseDetection.Pose[],
  minConfidence: number = 0.5
) {
  const adjacentKeyPoints = [
    ['nose', 'left_eye'],
    ['nose', 'right_eye'],
    ['nose', 'left_ear'],
    ['nose', 'right_ear'],
    ['left_shoulder', 'right_shoulder'],
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_hip'],
    ['right_shoulder', 'right_hip'],
    ['left_hip', 'right_hip'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_ankle'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_ankle'],
  ];

  poses.forEach((pose) => {
    const keypointsMap = new Map(
      pose.keypoints.map((kp) => [kp.name, kp])
    );

    adjacentKeyPoints.forEach(([point1, point2]) => {
      const kp1 = keypointsMap.get(point1);
      const kp2 = keypointsMap.get(point2);

      if (
        kp1 &&
        kp2 &&
        kp1.score &&
        kp2.score &&
        kp1.score >= minConfidence &&
        kp2.score >= minConfidence
      ) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  });
}
