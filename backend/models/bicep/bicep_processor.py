# bicep_processor.py

import os
import cv2
import numpy as np
import tensorflow as tf
import joblib
import pandas as pd
from collections import deque
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from bicep_rep_segmenter import RepBuffer
from angle_utils import calculate_angle

# -------------------------------
# Paths
# -------------------------------
BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.normpath(os.path.join(BASE_DIR, "rep_svm_model.pkl"))
LE_PATH = os.path.normpath(os.path.join(BASE_DIR, "label_encoder.pkl"))
MOVENET_PATH = os.path.join(BASE_DIR, "movenet.tflite")

# -------------------------------
# Load MoveNet TFLite
# -------------------------------
interpreter = tf.lite.Interpreter(model_path=MOVENET_PATH)
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()
input_height, input_width = input_details[0]['shape'][1:3]

# -------------------------------
# Load feedback model (SVM pipeline + label encoder)
# -------------------------------
try:
    model = joblib.load(MODEL_PATH)
    le = joblib.load(LE_PATH)
    print(f"✓ Feedback model loaded from {MODEL_PATH}")
    print(f"✓ Label encoder loaded from {LE_PATH}")
except Exception as e:
    print(f"✗ Failed to load feedback model: {e}")
    model = None
    le = None

FEATURE_ORDER = [
    "r_wrist_y_range",
    "l_wrist_y_range",
    "hip_y_range",
    "neck_hip_angle_mean",
    "neck_forward_shift",
    "frames",
    "r_elbow_shoulder_dx_mean",
    "l_elbow_shoulder_dx_mean",
    "r_elbow_range",
    "l_elbow_range",
]

# -------------------------------
# State
# -------------------------------
buffers = {"left": None, "right": None}
collecting_sides = {"left": False, "right": False}
counters = {"left": 0, "right": 0}
states = {"left": "down", "right": "down"}
feedback = {"left": "not detected", "right": "not detected"}
model_feedback = {"left": "none", "right": "none"}
feedback_persist_frames = {"left": 0, "right": 0}
angle_buffers = {"left": deque(maxlen=10), "right": deque(maxlen=10)}
frames_in_state = {"left": 0, "right": 0}

# Thresholds
flexion_threshold = 65
extension_threshold = 100
min_confidence = 0.5

# -------------------------------
# Helpers
# -------------------------------
def run_movenet(frame):
    h, w, _ = frame.shape
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = tf.image.resize_with_pad(np.expand_dims(img, axis=0), input_height, input_width)
    img = tf.cast(img, dtype=tf.float32)
    interpreter.set_tensor(input_details[0]['index'], img.numpy())
    interpreter.invoke()
    keypoints = interpreter.get_tensor(output_details[0]['index'])[0][0]
    return keypoints, w, h

def get_point(kp, idx, w, h):
    return (int(kp[idx][1] * w), int(kp[idx][0] * h))

# -------------------------------
# Rule-based feedback
# Bypasses SVM which is biased toward partial_motion.
# Uses elbow range of motion and wrist vertical travel.
#
# Thresholds (tune per camera distance):
#   elbow_range >= 120° AND wrist_y >= 100px  → correct
#   elbow dx > 40px                            → elbow_flare
#   anything else                              → partial_motion
# -------------------------------
def rule_based_bicep_feedback(features: dict, side: str) -> str:
    r_elbow_range = features.get("r_elbow_range", 0)
    l_elbow_range = features.get("l_elbow_range", 0)
    r_wrist_y     = features.get("r_wrist_y_range", 0)
    l_wrist_y     = features.get("l_wrist_y_range", 0)
    r_dx          = features.get("r_elbow_shoulder_dx_mean", 0)
    l_dx          = features.get("l_elbow_shoulder_dx_mean", 0)

    if side == "left":
        elbow_range = l_elbow_range
        wrist_y     = l_wrist_y
        dx          = l_dx
    else:
        elbow_range = r_elbow_range
        wrist_y     = r_wrist_y
        dx          = r_dx

    print(f"[RuleBased] {side} | elbow_range={elbow_range:.1f} wrist_y={wrist_y:.1f} dx={dx:.1f}")

    if dx > 40:
        return "elbow_flare"
    if elbow_range < 120 or wrist_y < 100:
        return "partial_motion"
    return "correct"


# -------------------------------
# Analyze rep buffer
# -------------------------------
def analyze_rep_buffer(buffer_obj, side):
    print(f"\n[analyze_rep_buffer] Starting for {side}")

    if buffer_obj is None:
        print(f"[ERROR] Buffer is None for {side}")
        return "buffer_empty"

    if buffer_obj.frames == 0:
        print(f"[ERROR] Buffer has 0 frames for {side}")
        return "buffer_empty"

    print(f"[Buffer] {side}: {buffer_obj.frames} frames collected")

    try:
        features = buffer_obj.summarize("NA")
        print(f"[Features] Values: {features}")

        rep_df = pd.DataFrame([features])
        if "label" in rep_df.columns:
            rep_df = rep_df.drop(columns=["label"])

        # Always use rule-based — SVM is biased toward partial_motion
        result = rule_based_bicep_feedback(features, side)
        print(f"[Final feedback] {side}: {result}")
        return result

    except Exception as e:
        import traceback
        print(f"[Exception] {type(e).__name__}: {e}")
        print(traceback.format_exc())
        return f"error: {str(e)[:50]}"


# -------------------------------
# Public API
# -------------------------------
def get_status():
    return {
        "counters":       counters.copy(),
        "feedback":       feedback.copy(),
        "model_feedback": model_feedback.copy(),
        "collecting":     collecting_sides.copy(),
    }


# -------------------------------
# Main frame processor
# -------------------------------
def process_bicep_frame(frame):
    global buffers, collecting_sides, counters, states, feedback
    global model_feedback, frames_in_state, feedback_persist_frames

    h, w, _ = frame.shape
    keypoints, w, h = run_movenet(frame)

    arms = {
        "left":  {"shoulder_idx": 5, "elbow_idx": 7, "wrist_idx": 9},
        "right": {"shoulder_idx": 6, "elbow_idx": 8, "wrist_idx": 10},
    }

    overlay = frame.copy()

    for side, idxs in arms.items():
        s_idx = idxs["shoulder_idx"]
        e_idx = idxs["elbow_idx"]
        w_idx = idxs["wrist_idx"]

        conf_ok = (
            keypoints[s_idx, 2] > min_confidence and
            keypoints[e_idx, 2] > min_confidence and
            keypoints[w_idx, 2] > min_confidence
        )

        if conf_ok:
            s  = get_point(keypoints, s_idx, w, h)
            e  = get_point(keypoints, e_idx, w, h)
            wr = get_point(keypoints, w_idx, w, h)

            elbow_angle = calculate_angle(s, e, wr)
            angle_buffers[side].append(elbow_angle)
            smooth_angle = np.mean(angle_buffers[side])

            frames_in_state[side] += 1

            # Only update feedback text if not in persist window
            if feedback_persist_frames[side] == 0:
                feedback[side] = f"detected - {int(smooth_angle)}°"

            # ── Rep detection state machine ──────────────────────────────

            # DOWN → UP (curl up): start collecting
            if smooth_angle < flexion_threshold and states[side] == "down" and frames_in_state[side] > 3:
                states[side] = "up"
                frames_in_state[side] = 0
                feedback[side] = "flexing (curl up)"
                buffers[side] = RepBuffer()
                collecting_sides[side] = True

            # UP → DOWN (extension): rep complete
            elif smooth_angle > extension_threshold and states[side] == "up" and frames_in_state[side] > 3:
                states[side] = "down"
                frames_in_state[side] = 0
                counters[side] += 1

                collecting_sides[side] = False
                rep_fb = analyze_rep_buffer(buffers[side], side)
                model_feedback[side] = rep_fb
                feedback[side] = f"Rep {counters[side]} | {rep_fb}"
                feedback_persist_frames[side] = 60  # keep visible ~2s at 30fps
                buffers[side] = None

            # ── Collect frame into buffer ────────────────────────────────
            if collecting_sides[side] and buffers[side] is not None:
                r_sh = get_point(keypoints, 6, w, h)
                r_el = get_point(keypoints, 8, w, h)
                r_wr = get_point(keypoints, 10, w, h)
                r_hp = get_point(keypoints, 12, w, h)

                l_sh = get_point(keypoints, 5, w, h)
                l_el = get_point(keypoints, 7, w, h)
                l_wr = get_point(keypoints, 9, w, h)
                l_hp = get_point(keypoints, 11, w, h)

                nose = get_point(keypoints, 0, w, h)

                buffers[side].add_frame(
                    r_sh, r_el, r_wr, r_hp,
                    l_sh, l_el, l_wr, l_hp,
                    nose,
                )

            # ── Draw skeleton ────────────────────────────────────────────
            cv2.line(overlay, s, e, (0, 255, 0), 3)
            cv2.line(overlay, e, wr, (0, 255, 0), 3)
            cv2.circle(overlay, s, 5, (0, 0, 255), -1)
            cv2.circle(overlay, e, 5, (0, 0, 255), -1)
            cv2.circle(overlay, wr, 5, (0, 0, 255), -1)

        else:
            if feedback_persist_frames[side] == 0:
                feedback[side] = "not detected"

        # Decrement persist counter each frame
        if feedback_persist_frames[side] > 0:
            feedback_persist_frames[side] -= 1

    return counters.copy(), feedback.copy(), overlay