import os
import cv2
import numpy as np
import tensorflow as tf
import joblib
import pandas as pd
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from rep_segmenter import RepBuffer
from angle_utils import calculate_angle

# -------------------------------
# Paths
# -------------------------------
BASE_DIR     = os.path.dirname(__file__)
MODEL_PATH   = os.path.join(BASE_DIR, "arm_hgb_model.pkl")
LE_PATH      = os.path.join(BASE_DIR, "arm_label_encoder.pkl")
MOVENET_PATH = os.path.join(BASE_DIR, "movenet.tflite")

# -------------------------------
# Load MoveNet
# -------------------------------
interpreter = tf.lite.Interpreter(model_path=MOVENET_PATH)
interpreter.allocate_tensors()
input_details  = interpreter.get_input_details()
output_details = interpreter.get_output_details()
input_height, input_width = input_details[0]['shape'][1:3]

# -------------------------------
# Load ML model
# -------------------------------
try:
    model = joblib.load(MODEL_PATH)
    le    = joblib.load(LE_PATH)
    print("✅ Arm raise model loaded")
except Exception as e:
    print(f"✗ Arm raise model load failed: {e}")
    model = None
    le    = None

# -------------------------------
# Keypoint indices
# -------------------------------
KP = {
    "l_shoulder": 5, "r_shoulder": 6,
    "l_elbow":    7, "r_elbow":    8,
    "l_wrist":    9, "r_wrist":   10,
    "l_hip":     11, "r_hip":     12,
}

# -------------------------------
# State
# -------------------------------
_buffer    = None
_collecting = False
_rep_count  = 0
_state      = "down"   # "down" | "up"

counters       = {"arm": 0}
feedback       = {"arm": "not detected"}
model_feedback = {"arm": "none"}
collecting     = {"arm": False}

# -------------------------------
# Helpers
# -------------------------------
def run_movenet(frame):
    h, w, _ = frame.shape
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = tf.image.resize_with_pad(np.expand_dims(img, 0), input_height, input_width)
    img = tf.cast(img, dtype=tf.float32)
    interpreter.set_tensor(input_details[0]['index'], img.numpy())
    interpreter.invoke()
    kp = interpreter.get_tensor(output_details[0]['index'])[0][0]
    return kp, w, h

def get_point(kp, idx, w, h):
    return (int(kp[idx][1] * w), int(kp[idx][0] * h))

# -------------------------------
# Status API
# -------------------------------
def get_status():
    return {
        "counters":       counters.copy(),
        "feedback":       feedback.copy(),
        "model_feedback": model_feedback.copy(),
        "collecting":     collecting.copy(),
    }

# -------------------------------
# Main processor
# -------------------------------
def process_arm_frame(frame):
    global _buffer, _collecting, _rep_count, _state

    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape

    kp, w, h = run_movenet(frame)
    overlay  = frame.copy()

    required = [5, 6, 7, 8, 9, 10]
    if not all(kp[i][2] > 0.4 for i in required):
        feedback["arm"] = "not detected"
        collecting["arm"] = False
        return counters.copy(), feedback.copy(), overlay

    r_sh = get_point(kp, KP["r_shoulder"], w, h)
    r_el = get_point(kp, KP["r_elbow"],    w, h)
    r_wr = get_point(kp, KP["r_wrist"],    w, h)
    l_sh = get_point(kp, KP["l_shoulder"], w, h)
    l_el = get_point(kp, KP["l_elbow"],    w, h)
    l_wr = get_point(kp, KP["l_wrist"],    w, h)
    r_hp = get_point(kp, KP["r_hip"],      w, h)
    l_hp = get_point(kp, KP["l_hip"],      w, h)

    # Use right-side shoulder angle (hip→shoulder→elbow) for rep detection
    angle = calculate_angle(r_hp, r_sh, r_el)

    # State machine
    if angle > 150:
        new_state = "down"
    elif angle < 60:
        new_state = "up"
    else:
        new_state = _state

    # Start rep
    if _state == "down" and new_state == "up":
        _collecting = True
        _buffer     = RepBuffer()
        collecting["arm"] = True
        feedback["arm"]   = "⬆ Arms raising..."

    # Collect frames
    if _collecting and _buffer is not None:
        _buffer.add_frame(r_sh, r_el, r_wr,
                          l_sh, l_el, l_wr,
                          r_hp, l_hp)

    # End rep
    if _state == "up" and new_state == "down" and _collecting:
        _collecting       = False
        collecting["arm"] = False
        _rep_count       += 1
        counters["arm"]   = _rep_count

        rep_fb = "model_unavailable"
        if model is not None and le is not None and _buffer is not None:
            try:
                features = _buffer.summarize("NA")
                df = pd.DataFrame([features])
                if "label" in df.columns:
                    df = df.drop(columns=["label"])
                pred   = model.predict(df)
                rep_fb = le.inverse_transform(pred)[0]
            except Exception as e:
                rep_fb = f"error: {str(e)[:40]}"

        model_feedback["arm"] = rep_fb
        feedback["arm"]       = f"✅ Rep {_rep_count} | {rep_fb}"
        _buffer               = None

    _state = new_state

    # Feedback for detected but idle
    if new_state == "down" and _rep_count == 0:
        feedback["arm"] = f"angle: {int(angle)}° — raise arms to start"
    elif new_state == "down" and not _collecting:
        feedback["arm"] = f"angle: {int(angle)}°"

    # Draw skeleton
    for a, b in [(5,7),(7,9),(6,8),(8,10),(5,6),(5,11),(6,12),(11,12)]:
        pa = get_point(kp, a, w, h)
        pb = get_point(kp, b, w, h)
        cv2.line(overlay, pa, pb, (0, 200, 0), 2)

    for i in [5,6,7,8,9,10,11,12]:
        if kp[i][2] > 0.4:
            cv2.circle(overlay, get_point(kp, i, w, h), 5, (0, 0, 255), -1)

    cv2.putText(overlay, f"Reps: {_rep_count}",    (30, 40),  cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,255,0), 2)
    cv2.putText(overlay, f"Angle: {int(angle)}°",  (30, 80),  cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,0), 2)
    cv2.putText(overlay, f"State: {new_state}",    (30, 115), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2)

    return counters.copy(), feedback.copy(), overlay