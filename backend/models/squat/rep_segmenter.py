# rep_segmenter.py
import numpy as np
from angle_utils import calculate_angle

class RepBuffer:
    def __init__(self):
        # -----------------------
        # Knee angles (primary for squat)
        # -----------------------
        self.r_knee_angles = []
        self.l_knee_angles = []

        # -----------------------
        # Hip angles (posture)
        # -----------------------
        self.r_hip_angles = []
        self.l_hip_angles = []

        # -----------------------
        # Ankle angles
        # -----------------------
        self.r_ankle_angles = []
        self.l_ankle_angles = []

        # -----------------------
        # Torso angle (forward lean)
        # -----------------------
        self.torso_angles = []

        # -----------------------
        # Vertical positions (for depth)
        # -----------------------
        self.hip_y = []
        self.r_knee_y = []
        self.l_knee_y = []

        # -----------------------
        # Horizontal positions (knee alignment)
        # -----------------------
        self.r_knee_x = []
        self.l_knee_x = []
        self.r_hip_x = []
        self.l_hip_x = []

        # -----------------------
        # Timing
        # -----------------------
        self.frames = 0

    def add_frame(
        self,
        r_hip, r_knee, r_ankle,
        l_hip, l_knee, l_ankle,
        r_shoulder, l_shoulder,
        neck
    ):
        # -----------------------
        # Knee angles (main ROM metric)
        # -----------------------
        self.r_knee_angles.append(
            calculate_angle(r_hip, r_knee, r_ankle)
        )
        self.l_knee_angles.append(
            calculate_angle(l_hip, l_knee, l_ankle)
        )

        # -----------------------
        # Hip angles (flexion)
        # -----------------------
        # Calculate hip angle: shoulder-hip-knee
        self.r_hip_angles.append(
            calculate_angle(r_shoulder, r_hip, r_knee)
        )
        self.l_hip_angles.append(
            calculate_angle(l_shoulder, l_hip, l_knee)
        )

        # -----------------------
        # Ankle angles
        # -----------------------
        self.r_ankle_angles.append(
            calculate_angle(r_knee, r_ankle, (r_ankle[0], r_ankle[1] + 100))
        )
        self.l_ankle_angles.append(
            calculate_angle(l_knee, l_ankle, (l_ankle[0], l_ankle[1] + 100))
        )

        # -----------------------
        # Torso angle (forward lean)
        # -----------------------
        hip_mid_x = (r_hip[0] + l_hip[0]) / 2
        hip_mid_y = (r_hip[1] + l_hip[1]) / 2
        hip_mid = (hip_mid_x, hip_mid_y)
        vertical_ref = (hip_mid_x, hip_mid_y - 100)
        
        neck_to_shoulder_mid = ((r_shoulder[0] + l_shoulder[0]) / 2, (r_shoulder[1] + l_shoulder[1]) / 2)
        self.torso_angles.append(
            calculate_angle(neck_to_shoulder_mid, hip_mid, vertical_ref)
        )

        # -----------------------
        # Vertical positions (depth tracking)
        # -----------------------
        self.hip_y.append(hip_mid_y)
        self.r_knee_y.append(r_knee[1])
        self.l_knee_y.append(l_knee[1])

        # -----------------------
        # Horizontal positions (knee alignment)
        # -----------------------
        self.r_knee_x.append(r_knee[0])
        self.l_knee_x.append(l_knee[0])
        self.r_hip_x.append(r_hip[0])
        self.l_hip_x.append(l_hip[0])

        self.frames += 1

    def summarize(self, label):
        # Safety check
        if self.frames == 0:
            return None

        return {
            # -----------------------
            # Knee ROM (primary metric)
            # -----------------------
            "r_knee_range": float(
                np.max(self.r_knee_angles) - np.min(self.r_knee_angles)
            ),
            "l_knee_range": float(
                np.max(self.l_knee_angles) - np.min(self.l_knee_angles)
            ),

            # -----------------------
            # Average knee angles
            # -----------------------
            "r_knee_avg": float(
                np.mean(self.r_knee_angles)
            ),
            "l_knee_avg": float(
                np.mean(self.l_knee_angles)
            ),

            # -----------------------
            # Hip ROM and posture
            # -----------------------
            "r_hip_range": float(
                np.max(self.r_hip_angles) - np.min(self.r_hip_angles)
            ),
            "l_hip_range": float(
                np.max(self.l_hip_angles) - np.min(self.l_hip_angles)
            ),
            "r_hip_avg": float(
                np.mean(self.r_hip_angles)
            ),
            "l_hip_avg": float(
                np.mean(self.l_hip_angles)
            ),

            # -----------------------
            # Ankle angles
            # -----------------------
            "r_ankle_avg": float(
                np.mean(self.r_ankle_angles)
            ),
            "l_ankle_avg": float(
                np.mean(self.l_ankle_angles)
            ),

            # -----------------------
            # Torso (forward lean)
            # -----------------------
            "torso_angle_mean": float(
                np.mean(self.torso_angles)
            ),
            "torso_angle_max": float(
                np.max(self.torso_angles)
            ),

            # -----------------------
            # Depth (hip vertical range)
            # -----------------------
            "hip_y_range": float(
                np.max(self.hip_y) - np.min(self.hip_y)
            ),
            "knee_depth_left": float(
                np.min(self.l_knee_y)  # lower y = deeper
            ),
            "knee_depth_right": float(
                np.min(self.r_knee_y)
            ),

            # -----------------------
            # Knee alignment (valgus/varus)
            # -----------------------
            "knee_width_mean": float(
                np.mean(np.abs(np.array(self.l_knee_x) - np.array(self.r_knee_x)))
            ),
            "hip_width_mean": float(
                np.mean(np.abs(np.array(self.l_hip_x) - np.array(self.r_hip_x)))
            ),

            # -----------------------
            # Symmetry (left vs right)
            # -----------------------
            "knee_asymmetry": float(
                np.mean(np.abs(np.array(self.r_knee_angles) - np.array(self.l_knee_angles)))
            ),
            "hip_asymmetry": float(
                np.mean(np.abs(np.array(self.r_hip_angles) - np.array(self.l_hip_angles)))
            ),

            # -----------------------
            # Timing
            # -----------------------
            "frames": self.frames,

            # -----------------------
            # Label
            # -----------------------
            "label": label
        }
