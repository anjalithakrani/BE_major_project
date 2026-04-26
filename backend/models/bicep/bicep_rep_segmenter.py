# rep_segmenter.py
import numpy as np
from angle_utils import calculate_angle

class RepBuffer:
    def __init__(self):
        # -----------------------
        # Elbow angles (for range)
        # -----------------------
        self.r_elbow_angles = []
        self.l_elbow_angles = []

        # -----------------------
        # Wrist vertical motion
        # -----------------------
        self.r_wrist_y = []
        self.l_wrist_y = []

        # -----------------------
        # Hip vertical motion
        # -----------------------
        self.hip_y = []

        # -----------------------
        # Posture (neck–hip)
        # -----------------------
        self.neck_hip_angles = []

        # For neck forward shift
        self.neck_x = []
        self.hip_x = []

        # -----------------------
        # Elbow drift (horizontal)
        # -----------------------
        self.r_elbow_dx = []
        self.l_elbow_dx = []

        # -----------------------
        # Timing
        # -----------------------
        self.frames = 0

    def add_frame(
        self,
        r_shoulder, r_elbow, r_wrist, r_hip,
        l_shoulder, l_elbow, l_wrist, l_hip,
        neck
    ):
        # -----------------------
        # Elbow angles
        # -----------------------
        self.r_elbow_angles.append(
            calculate_angle(r_shoulder, r_elbow, r_wrist)
        )
        self.l_elbow_angles.append(
            calculate_angle(l_shoulder, l_elbow, l_wrist)
        )

        # -----------------------
        # Wrist vertical movement
        # -----------------------
        self.r_wrist_y.append(r_wrist[1])
        self.l_wrist_y.append(l_wrist[1])

        # -----------------------
        # Hip midpoint
        # -----------------------
        hip_mid_x = (r_hip[0] + l_hip[0]) / 2
        hip_mid_y = (r_hip[1] + l_hip[1]) / 2

        self.hip_y.append(hip_mid_y)

        # -----------------------
        # Neck–hip posture angle
        # -----------------------
        hip_mid = (hip_mid_x, hip_mid_y)
        vertical_ref = (hip_mid_x, hip_mid_y - 100)

        self.neck_hip_angles.append(
            calculate_angle(neck, hip_mid, vertical_ref)
        )

        # -----------------------
        # Neck forward shift
        # -----------------------
        self.neck_x.append(neck[0])
        self.hip_x.append(hip_mid_x)

        # -----------------------
        # Elbow drift (horizontal)
        # -----------------------
        self.r_elbow_dx.append(abs(r_elbow[0] - r_shoulder[0]))
        self.l_elbow_dx.append(abs(l_elbow[0] - l_shoulder[0]))

        self.frames += 1

    def summarize(self, label):
        # Safety check
        if self.frames == 0:
            return None

        return {
            # -----------------------
            # Elbow ROM
            # -----------------------
            "r_elbow_range": float(
                np.max(self.r_elbow_angles) - np.min(self.r_elbow_angles)
            ),
            "l_elbow_range": float(
                np.max(self.l_elbow_angles) - np.min(self.l_elbow_angles)
            ),

            # -----------------------
            # Wrist motion
            # -----------------------
            "r_wrist_y_range": float(
                np.max(self.r_wrist_y) - np.min(self.r_wrist_y)
            ),
            "l_wrist_y_range": float(
                np.max(self.l_wrist_y) - np.min(self.l_wrist_y)
            ),

            # -----------------------
            # Hip swing
            # -----------------------
            "hip_y_range": float(
                np.max(self.hip_y) - np.min(self.hip_y)
            ),

            # -----------------------
            # Posture
            # -----------------------
            "neck_hip_angle_mean": float(
                np.mean(self.neck_hip_angles)
            ),
            "neck_forward_shift": float(
                np.mean(np.array(self.neck_x) - np.array(self.hip_x))
            ),

            # -----------------------
            # Timing
            # -----------------------
            "frames": self.frames,

            # -----------------------
            # Elbow drift
            # -----------------------
            "r_elbow_shoulder_dx_mean": float(
                np.mean(self.r_elbow_dx)
            ),
            "l_elbow_shoulder_dx_mean": float(
                np.mean(self.l_elbow_dx)
            ),

            # -----------------------
            # Label
            # -----------------------
            "label": label
        }
