import numpy as np
from angle_utils import calculate_angle

class RepBuffer:
    def __init__(self):
        self.r_knee_angles = []
        self.l_knee_angles = []
        self.r_ankle_y = []
        self.l_ankle_y = []
        self.hip_y = []
        self.knee_hip_dx = []
        self.frames = 0

    def add_frame(self, r_hp, r_kn, r_ak, l_hp, l_kn, l_ak):
        # Store angles
        self.r_knee_angles.append(calculate_angle(r_hp, r_kn, r_ak))
        self.l_knee_angles.append(calculate_angle(l_hp, l_kn, l_ak))
        
        # Store vertical positions
        self.r_ankle_y.append(r_ak[1])
        self.l_ankle_y.append(l_ak[1])
        
        # Store hip stability (average height of both hips)
        self.hip_y.append((r_hp[1] + l_hp[1]) / 2)
        
        # Store horizontal distance between knee and hip
        self.knee_hip_dx.append(abs(r_kn[0] - r_hp[0]))
        
        self.frames += 1

    def summarize(self, label):
        if self.frames < 5: return None
        return {
            "r_knee_angle_range": float(np.max(self.r_knee_angles) - np.min(self.r_knee_angles)),
            "l_knee_angle_range": float(np.max(self.l_knee_angles) - np.min(self.l_knee_angles)),
            "r_ankle_y_range": float(np.max(self.r_ankle_y) - np.min(self.r_ankle_y)),
            "l_ankle_y_range": float(np.max(self.l_ankle_y) - np.min(self.l_ankle_y)),
            "hip_stability_var": float(np.var(self.hip_y)),
            "knee_hip_dx_mean": float(np.mean(self.knee_hip_dx)),
            "frames": self.frames,
            "label": label
        }