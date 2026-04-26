# squat_processor.py

import os
import cv2
import numpy as np
import tensorflow as tf
import joblib
import pandas as pd
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from rep_segmenter import RepBuffer
from angle_utils import calculate_angle

# ==============================
# Paths
# ==============================
BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "rep_svm_model.pkl")
LE_PATH = os.path.join(BASE_DIR, "label_encoder.pkl")
MOVENET_PATH = os.path.join(BASE_DIR, "movenet.tflite")

# ==============================
# Load MoveNet
# ==============================
interpreter = tf.lite.Interpreter(model_path=MOVENET_PATH)
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()
input_height, input_width = input_details[0]['shape'][1:3]

# ==============================
# Load SVM model + LabelEncoder
# ==============================
try:
    model = joblib.load(MODEL_PATH)
    le = joblib.load(LE_PATH)
    print(f"✓ Feedback model loaded from {MODEL_PATH}")
    print(f"✓ Label encoder loaded from {LE_PATH}")
except Exception as e:
    print(f"✗ Failed to load feedback model: {e}")
    model, le = None, None

FEATURE_ORDER = [
    "r_knee_range","l_knee_range",
    "r_knee_avg","l_knee_avg",
    "knee_asymmetry",
    "r_hip_range","l_hip_range",
    "r_hip_avg","l_hip_avg",
    "hip_asymmetry",
    "r_ankle_avg","l_ankle_avg",
    "torso_angle_mean","torso_angle_max",
    "hip_y_range",
    "knee_depth_left","knee_depth_right",
    "knee_width_mean","hip_width_mean",
    "frames"
]

DEFAULT_FEATURES = {
    "r_knee_range": 70,
    "l_knee_range": 70,
    "r_knee_avg": 150,
    "l_knee_avg": 150,
    "knee_asymmetry": 4,
    "r_hip_range": 70,
    "l_hip_range": 70,
    "r_hip_avg": 150,
    "l_hip_avg": 150,
    "hip_asymmetry": 4,
    "r_ankle_avg": 160,
    "l_ankle_avg": 160,
    "torso_angle_mean": 10,
    "torso_angle_max": 40,
    "hip_y_range": 300,
    "knee_depth_left": 310,
    "knee_depth_right": 310,
    "knee_width_mean": 15,
    "hip_width_mean": 20,
    "frames": 30
}

# ==============================
# State variables
# ==============================
squat_count = 0
state_sequence = []
last_state = "up"

counters = {"squat": 0}
feedback = {"squat": ""}
model_feedback = {"squat": "none"}
collecting = False
squat_buffer = None

SQUAT_DOWN_THRESH  = 120
SQUAT_UP_THRESH    = 155

min_confidence = 0.2

# ==============================
# Skeleton edges for plotting
# ==============================
EDGES = {
    (0, 1): 'm', (0, 2): 'c',
    (1, 3): 'm', (2, 4): 'c',
    (5, 7): 'm', (7, 9): 'm',
    (6, 8): 'c', (8, 10): 'c',
    (5, 6): 'y',
    (5, 11): 'm', (6, 12): 'c',
    (11, 12): 'y',
    (11, 13): 'm', (13, 15): 'm',
    (12, 14): 'c', (14, 16): 'c'
}

# ==============================
# Helpers
# ==============================
def run_movenet(frame):
    h, w, _ = frame.shape
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = tf.image.resize_with_pad(np.expand_dims(img, axis=0), input_height, input_width)
    img = tf.cast(img, dtype=tf.float32)

    interpreter.set_tensor(input_details[0]['index'], np.array(img, copy=True))
    interpreter.invoke()
    keypoints = np.array(interpreter.get_tensor(output_details[0]['index']), copy=True)
    return keypoints[0][0], w, h

def get_point(kp, idx, w, h):
    return (int(kp[idx][1] * w), int(kp[idx][0] * h))

def draw_keypoints(frame, keypoints, threshold=0.4):
    h, w, c = frame.shape
    shaped = np.squeeze(np.multiply(keypoints, [h, w, 1]))
    for ky, kx, conf in shaped:
        if conf > threshold:
            cv2.circle(frame, (int(kx), int(ky)), 4, (0, 255, 0), -1)

def draw_connections(frame, keypoints, edges, threshold=0.4):
    h, w, c = frame.shape
    shaped = np.squeeze(np.multiply(keypoints, [h, w, 1]))
    for (p1, p2), color in edges.items():
        y1, x1, c1 = shaped[p1]
        y2, x2, c2 = shaped[p2]
        if (c1 > threshold) and (c2 > threshold):
            cv2.line(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)

# ==============================
# Summarize buffer safely
# ==============================
def summarize_with_estimates(buffer_obj):
    features = buffer_obj.summarize("NA") if buffer_obj else {}
    for key, val in DEFAULT_FEATURES.items():
        if key not in features or features[key] is None:
            features[key] = val
    features.pop("label", None)
    return features

# ==============================
# Manual override: rule-based squat quality check
# Uses the lowest knee angle reached during the rep (peak depth)
# and knee range of motion — both reliable depth indicators.
#
# Thresholds (tune these to your camera/subject):
#   correct      → knee bent to ≤ 105° at bottom  AND  range ≥ 55°
#   shallow_depth → anything else
# ==============================
def rule_based_squat_feedback(features: dict) -> str:
    r_knee_avg   = features.get("r_knee_avg",   150)
    l_knee_avg   = features.get("l_knee_avg",   150)
    r_knee_range = features.get("r_knee_range",  0)
    l_knee_range = features.get("l_knee_range",  0)

    avg_knee     = (r_knee_avg   + l_knee_avg)   / 2
    avg_range    = (r_knee_range + l_knee_range) / 2

    # avg of the average angles — lower = deeper squat
    # A good squat bends the knee well below 120° at the bottom
    # r/l_knee_avg is the mean angle across the rep, so bottom will
    # pull it noticeably below standing (~170°).
    # Tune DEPTH_THRESHOLD and RANGE_THRESHOLD to match your data.
    DEPTH_THRESHOLD = 130   # avg knee angle across rep; lower = deeper
    RANGE_THRESHOLD = 50    # degrees of motion; higher = bigger movement

    if avg_knee <= DEPTH_THRESHOLD and avg_range >= RANGE_THRESHOLD:
        return "correct"
    else:
        return "shallow_depth"

# ==============================
# Analyze rep buffer
# ==============================
def analyze_rep_buffer(buffer_obj):
    if buffer_obj is None or buffer_obj.frames == 0:
        return "buffer_empty"
    try:
        features = summarize_with_estimates(buffer_obj)

        # --- Manual override: ignore the SVM, use biomechanical rules ---
        result = rule_based_squat_feedback(features)
        print(f"[analyze_rep_buffer] features → knee_avg=({features.get('r_knee_avg'):.1f}, {features.get('l_knee_avg'):.1f})  "
              f"knee_range=({features.get('r_knee_range'):.1f}, {features.get('l_knee_range'):.1f})  → {result}")
        return result

    except Exception as e:
        print(f"[analyze_rep_buffer] Error: {e}")
        return "error"

# ==============================
# Main frame processor
# ==============================
def process_squat_frame(frame):
    global squat_count, state_sequence, last_state
    global counters, feedback, squat_buffer, collecting, model_feedback

    h, w, _ = frame.shape
    keypoints, w, h = run_movenet(frame)
    overlay = frame.copy()

    l_hip    = get_point(keypoints, 11, w, h)
    l_knee   = get_point(keypoints, 13, w, h)
    l_ankle  = get_point(keypoints, 15, w, h)
    r_hip    = get_point(keypoints, 12, w, h)
    r_knee   = get_point(keypoints, 14, w, h)
    r_ankle  = get_point(keypoints, 16, w, h)
    shoulder = get_point(keypoints, 5, w, h)

    l_conf = min(keypoints[11][2], keypoints[13][2], keypoints[15][2])
    r_conf = min(keypoints[12][2], keypoints[14][2], keypoints[16][2])

    if l_conf > min_confidence and r_conf > min_confidence:
        l_knee_angle = calculate_angle(l_hip, l_knee, l_ankle)
        r_knee_angle = calculate_angle(r_hip, r_knee, r_ankle)
        knee_angle = (l_knee_angle + r_knee_angle) / 2
    elif l_conf > min_confidence:
        knee_angle = calculate_angle(l_hip, l_knee, l_ankle)
    elif r_conf > min_confidence:
        knee_angle = calculate_angle(r_hip, r_knee, r_ankle)
    else:
        knee_angle = None

    feedback_list = []

    if knee_angle is not None:
        if last_state == "up" and knee_angle < SQUAT_DOWN_THRESH:
            last_state = "down"
            collecting = True
            squat_buffer = RepBuffer()
            state_sequence = ["down"]

        elif last_state == "down" and knee_angle > SQUAT_UP_THRESH:
            last_state = "up"
            squat_count += 1
            counters["squat"] = squat_count

            if squat_buffer is not None:
                rep_fb = analyze_rep_buffer(squat_buffer)
                model_feedback["squat"] = rep_fb
                feedback_list.append(rep_fb)

            collecting = False
            squat_buffer = None
            state_sequence = []

    feedback["squat"] = " | ".join(feedback_list)

    # ==============================
    # Collect frame data
    # ==============================
    if collecting and squat_buffer is not None and knee_angle is not None:
        r_sh = get_point(keypoints, 6, w, h)
        r_el = get_point(keypoints, 8, w, h) if keypoints[8][2] > min_confidence else r_sh
        r_wr = get_point(keypoints, 10, w, h) if keypoints[10][2] > min_confidence else r_sh
        r_hp = get_point(keypoints, 12, w, h) if keypoints[12][2] > min_confidence else get_point(keypoints, 11, w, h)

        l_sh = get_point(keypoints, 5, w, h)
        l_el = get_point(keypoints, 7, w, h) if keypoints[7][2] > min_confidence else l_sh
        l_wr = get_point(keypoints, 9, w, h) if keypoints[9][2] > min_confidence else l_sh
        l_hp = get_point(keypoints, 11, w, h) if keypoints[11][2] > min_confidence else get_point(keypoints, 12, w, h)

        nose = get_point(keypoints, 0, w, h) if keypoints[0][2] > min_confidence else ((r_sh[0]+l_sh[0])//2, r_sh[1]-40)

        squat_buffer.add_frame(r_sh, r_el, r_wr, r_hp,
                               l_sh, l_el, l_wr, l_hp,
                               nose)

    # Draw skeleton only — no text overlays
    draw_connections(overlay, keypoints, EDGES, threshold=0.4)
    draw_keypoints(overlay, keypoints, threshold=0.4)

    return counters.copy(), feedback.copy(), overlay

# ==============================
# Status API
# ==============================
def get_status():
    global counters, feedback, model_feedback, collecting
    return {
        "counters": counters.copy(),
        "feedback": feedback.copy(),
        "model_feedback": model_feedback.copy(),
        "collecting": collecting
    }