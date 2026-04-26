import csv
import os

FILE = "edited.csv"

FIELDNAMES = [
    "r_wrist_y_range",
    "l_wrist_y_range",
    "chin_y_range",
    "hip_y_range",
    "neck_hip_angle_mean",
    "neck_forward_shift",
    "frames",
    "r_elbow_shoulder_dx_mean",
    "l_elbow_shoulder_dx_mean",
    "r_elbow_range",
    "l_elbow_range",
    "label"
]

def log_rep(features):
    if features is None:
        return

    file_exists = os.path.isfile(FILE)

    with open(FILE, "a", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=FIELDNAMES,
            extrasaction="ignore"
        )

        if not file_exists:
            writer.writeheader()

        writer.writerow(features)