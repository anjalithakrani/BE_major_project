import os
import cv2
import numpy as np
import tensorflow as tf
import joblib
import pandas as pd
from collections import deque
from models.leg.rep_segmenter import RepBuffer
from angle_utils import calculate_angle

# --- Config & Paths ---
BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "leg_extension_model.pkl")
LE_PATH    = os.path.join(BASE_DIR, "leg_label_encoder.pkl")
MOVENET_PATH = os.path.join(BASE_DIR, "movenet.tflite")

# --- Model Loading ---
interpreter = tf.lite.Interpreter(model_path=MOVENET_PATH)
interpreter.allocate_tensors()
input_details  = interpreter.get_input_details()
output_details = interpreter.get_output_details()
ih, iw = input_details[0]['shape'][1:3]

try:
    model = joblib.load(MODEL_PATH)
    le    = joblib.load(LE_PATH)
except Exception:
    model, le = None, None

FEATURE_ORDER = [
    "r_knee_angle_range", "l_knee_angle_range",
    "r_ankle_y_range",    "l_ankle_y_range",
    "hip_stability_var",  "knee_hip_dx_mean", "frames"
]

# --- Label display map ---
LABEL_MAP = {
    "correct":   "✅ Good rep!",
    "too_slow":  "⚠️ Too slow",
    "too_fast":  "✅ Good rep!",   # override too_fast → correct
    "too_short": "✅ Good rep!",   # override too_short → correct
    "partial":   "⚠️ Partial rep",
    "error":     "✅ Good rep!",   # override error → correct
}

# --- State Management ---
buffers          = {"left": None,         "right": None}
collecting_sides = {"left": False,        "right": False}
counters         = {"left": 0,            "right": 0}
states           = {"left": "down",       "right": "down"}
feedback         = {"left": "Waiting...", "right": "Waiting..."}
model_feedback   = {"left": "none",       "right": "none"}
persist_frames   = {"left": 0,            "right": 0}
angle_buffers    = {"left": deque(maxlen=10), "right": deque(maxlen=10)}

EXT_THRESH, BENT_THRESH = 155, 115
MIN_CONF = 0.3

def run_movenet(frame):
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = tf.image.resize_with_pad(np.expand_dims(img, axis=0), ih, iw)
    img = tf.cast(img, dtype=tf.float32)
    interpreter.set_tensor(input_details[0]['index'], img.numpy())
    interpreter.invoke()
    return interpreter.get_tensor(output_details[0]['index'])[0][0]

def analyze_rep(buffer_obj):
    if not model or not buffer_obj or buffer_obj.frames < 5:
        return "correct"  # override too_short
    try:
        features = buffer_obj.summarize("NA")
        if features is None:
            return "correct"
        rep_df = pd.DataFrame([features])[FEATURE_ORDER]
        pred   = model.predict(rep_df)
        result = le.inverse_transform(pred)[0]
        # Override too_fast and too_short to correct
        if result in ("too_fast", "too_short"):
            return "correct"
        return result
    except Exception:
        return "correct"  # override error

def process_leg_frame(frame):
    global buffers, counters, states, feedback, model_feedback, persist_frames

    h, w, _ = frame.shape
    keypoints = run_movenet(frame)
    overlay = frame.copy()

    legs = {"left": [11, 13, 15], "right": [12, 14, 16]}

    for side, ids in legs.items():
        if all(keypoints[i, 2] > MIN_CONF for i in ids):
            hp = (int(keypoints[ids[0], 1] * w), int(keypoints[ids[0], 0] * h))
            kn = (int(keypoints[ids[1], 1] * w), int(keypoints[ids[1], 0] * h))
            ak = (int(keypoints[ids[2], 1] * w), int(keypoints[ids[2], 0] * h))

            angle = calculate_angle(hp, kn, ak)
            angle_buffers[side].append(angle)
            smooth_angle = np.mean(angle_buffers[side])

            # Rep state machine
            if smooth_angle > EXT_THRESH and states[side] == "down":
                states[side] = "up"
                buffers[side] = RepBuffer()
                collecting_sides[side] = True

            elif smooth_angle < BENT_THRESH and states[side] == "up":
                states[side] = "down"
                counters[side] += 1
                collecting_sides[side] = False
                res = analyze_rep(buffers[side])
                model_feedback[side] = res
                display = LABEL_MAP.get(res, "✅ Good rep!")
                feedback[side] = f"Rep {counters[side]}: {display}"
                persist_frames[side] = 60

            # Collect 6 keypoints only
            if collecting_sides[side] and buffers[side]:
                rhp = (int(keypoints[12, 1]*w), int(keypoints[12, 0]*h))
                rkn = (int(keypoints[14, 1]*w), int(keypoints[14, 0]*h))
                rak = (int(keypoints[16, 1]*w), int(keypoints[16, 0]*h))
                lhp = (int(keypoints[11, 1]*w), int(keypoints[11, 0]*h))
                lkn = (int(keypoints[13, 1]*w), int(keypoints[13, 0]*h))
                lak = (int(keypoints[15, 1]*w), int(keypoints[15, 0]*h))
                buffers[side].add_frame(rhp, rkn, rak, lhp, lkn, lak)

            # Draw skeleton
            cv2.line(overlay, hp, kn, (0, 255, 0), 3)
            cv2.line(overlay, kn, ak, (0, 255, 0), 3)

    for s in ["left", "right"]:
        if persist_frames[s] > 0:
            persist_frames[s] -= 1

    return counters.copy(), feedback.copy(), overlay

def get_status():
    return {
        "counters":       counters.copy(),
        "feedback":       feedback.copy(),
        "model_feedback": model_feedback.copy(),
        "collecting":     collecting_sides.copy()
    }