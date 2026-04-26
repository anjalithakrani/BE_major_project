import numpy as np
from angle_utils import calculate_angle

class RepBuffer:
    def __init__(self):
        self.r_elbow_angles = []
        self.l_elbow_angles = []

        self.r_wrist_y = []
        self.l_wrist_y = []

        self.hip_y = []

        self.neck_hip_angles = []

        self.neck_x = []
        self.hip_x = []

        self.r_elbow_dx = []
        self.l_elbow_dx = []

        # NEW: Chin vertical movement
        self.neck_y = []

        self.frames = 0

    def add_frame(
        self,
        r_shoulder, r_elbow, r_wrist, r_hip,
        l_shoulder, l_elbow, l_wrist, l_hip,
        neck
    ):
        self.r_elbow_angles.append(
            calculate_angle(r_shoulder, r_elbow, r_wrist)
        )
        self.l_elbow_angles.append(
            calculate_angle(l_shoulder, l_elbow, l_wrist)
        )

        self.r_wrist_y.append(r_wrist[1])
        self.l_wrist_y.append(l_wrist[1])

        hip_mid_x = (r_hip[0] + l_hip[0]) / 2
        hip_mid_y = (r_hip[1] + l_hip[1]) / 2
        self.hip_y.append(hip_mid_y)

        hip_mid = (hip_mid_x, hip_mid_y)
        vertical_ref = (hip_mid_x, hip_mid_y - 100)

        self.neck_hip_angles.append(
            calculate_angle(neck, hip_mid, vertical_ref)
        )

        self.neck_x.append(neck[0])
        self.hip_x.append(hip_mid_x)

        self.r_elbow_dx.append(abs(r_elbow[0] - r_shoulder[0]))
        self.l_elbow_dx.append(abs(l_elbow[0] - l_shoulder[0]))

        # NEW
        self.neck_y.append(neck[1])

        self.frames += 1

    def summarize(self, label):
        if self.frames == 0:
            return None

        return {
            "r_elbow_range": float(np.max(self.r_elbow_angles) - np.min(self.r_elbow_angles)),
            "l_elbow_range": float(np.max(self.l_elbow_angles) - np.min(self.l_elbow_angles)),

            "r_wrist_y_range": float(np.max(self.r_wrist_y) - np.min(self.r_wrist_y)),
            "l_wrist_y_range": float(np.max(self.l_wrist_y) - np.min(self.l_wrist_y)),

            # NEW FEATURE
            "chin_y_range": float(np.max(self.neck_y) - np.min(self.neck_y)),

            "hip_y_range": float(np.max(self.hip_y) - np.min(self.hip_y)),

            "neck_hip_angle_mean": float(np.mean(self.neck_hip_angles)),
            "neck_forward_shift": float(np.mean(np.array(self.neck_x) - np.array(self.hip_x))),

            "frames": self.frames,

            "r_elbow_shoulder_dx_mean": float(np.mean(self.r_elbow_dx)),
            "l_elbow_shoulder_dx_mean": float(np.mean(self.l_elbow_dx)),

            "label": label
        }