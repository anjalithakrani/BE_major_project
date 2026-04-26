import os
import cv2
import numpy as np
import tensorflow as tf
import joblib
import pandas as pd
from collections import deque

from neck_exercise.neck_rep_segmenter import RepBuffer
from neck_exercise.angle_utils import calculate_angle

import time

# -------------------------------
# Paths
# -------------------------------
BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR,"neck_exercise","rep_svm_model.pkl")
LE_PATH = os.path.join(BASE_DIR,"neck_exercise","label_encoder.pkl")
MOVENET_PATH = os.path.join(BASE_DIR,"movenet.tflite")


# -------------------------------
# Load MoveNet
# -------------------------------
interpreter = tf.lite.Interpreter(model_path=MOVENET_PATH)
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

input_height, input_width = input_details[0]['shape'][1:3]


# -------------------------------
# Load ML Model
# -------------------------------
try:
    model = joblib.load(MODEL_PATH)
    le = joblib.load(LE_PATH)
    print("✓ Neck model loaded")
except Exception as e:
    print("✗ Neck model load failed:", e)
    model = None
    le = None


FEATURE_ORDER = [
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
]


# -------------------------------
# State
# -------------------------------
buffers = {"neck": None}
collecting = {"neck": False}
counters = {"neck": 0}

feedback = {"neck": "not detected"}
model_feedback = {"neck": "none"}

feedback_persist = {"neck": 0}

angle_buffers = {"neck": deque(maxlen=5)}

movement_direction = {"neck": "DOWN"}
prev_angle = {"neck": 0}
prev_nose_y = {"neck": None}


# -------------------------------
# Thresholds
# -------------------------------
EXPAND_ANGLE = 135
RELAX_ANGLE = 115

ANGLE_DELTA_THRESHOLD = 1.5
NOSE_DELTA_THRESHOLD = 3

min_confidence = 0.3

# -------------------------------
# Frame skipping / cooldown
# -------------------------------
frame_id = 0
last_rep_time = 0

FRAME_SKIP = 3
COOLDOWN = 1.2
MIN_FRAMES = 15

CHIN_UP_THRESHOLD = 8
CHIN_DOWN_THRESHOLD = -5

# -------------------------------
# MoveNet
# -------------------------------
def run_movenet(frame):

    h,w,_ = frame.shape

    img = cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)

    img = tf.image.resize_with_pad(np.expand_dims(img,0),
                                   input_height,input_width)

    img = tf.cast(img,dtype=tf.float32)

    interpreter.set_tensor(input_details[0]['index'],img.numpy())

    interpreter.invoke()

    keypoints = interpreter.get_tensor(output_details[0]['index'])[0][0]

    return keypoints,w,h


def get_point(kp,idx,w,h):

    return (int(kp[idx][1]*w), int(kp[idx][0]*h))


# -------------------------------
# Model Feedback
# -------------------------------
def analyze_rep_buffer(buffer_obj):

    if buffer_obj is None or buffer_obj.frames == 0:
        return "buffer_empty"

    if buffer_obj.frames < MIN_FRAMES:
        return "rep_too_short"

    try:

        features = buffer_obj.summarize("NA")

        df = pd.DataFrame([features])

        if "label" in df.columns:
            df = df.drop(columns=["label"])

        if model is None or le is None:
            return "model_unavailable"

        X = df[FEATURE_ORDER].values

        pred = model.predict(X)
        pred_proba = model.predict_proba(X)[0]
        confidence = pred_proba.max()

        if confidence < 0.6:
            return f"{le.inverse_transform(pred)[0]} (?)"

        result = le.inverse_transform(pred)[0]

        return result

    except Exception as e:

        return f"error: {str(e)[:40]}"


# -------------------------------
# Status
# -------------------------------
def get_status():

    return {
        "counters": counters.copy(),
        "feedback": feedback.copy(),
        "model_feedback": model_feedback.copy(),
        "collecting": collecting.copy()
    }


# -------------------------------
# MAIN PROCESSOR
# -------------------------------
def process_neck_frame(frame):

    global buffers, collecting, counters
    global feedback, model_feedback
    global feedback_persist
    global angle_buffers
    global movement_direction, prev_angle, prev_nose_y
    global frame_id, last_rep_time

    keypoints,w,h = run_movenet(frame)

    overlay = frame.copy()


    # Keypoints
    nose_idx = 0
    l_sh_idx = 5
    r_sh_idx = 6
    l_el_idx = 7
    r_el_idx = 8
    l_wr_idx = 9
    r_wr_idx = 10
    l_hip_idx = 11
    r_hip_idx = 12


    conf_ok = all(keypoints[i,2] > min_confidence for i in
    [nose_idx,l_sh_idx,r_sh_idx,l_el_idx,r_el_idx,l_wr_idx,r_wr_idx,l_hip_idx,r_hip_idx])


    if conf_ok:

        nose = get_point(keypoints,nose_idx,w,h)
        l_sh = get_point(keypoints,l_sh_idx,w,h)
        r_sh = get_point(keypoints,r_sh_idx,w,h)

        l_el = get_point(keypoints,l_el_idx,w,h)
        r_el = get_point(keypoints,r_el_idx,w,h)

        l_wr = get_point(keypoints,l_wr_idx,w,h)
        r_wr = get_point(keypoints,r_wr_idx,w,h)

        l_hip = get_point(keypoints,l_hip_idx,w,h)
        r_hip = get_point(keypoints,r_hip_idx,w,h)


        mid_sh = ((l_sh[0]+r_sh[0])//2,(l_sh[1]+r_sh[1])//2)
        mid_hip = ((l_hip[0]+r_hip[0])//2,(l_hip[1]+r_hip[1])//2)


        # ---------------------
        # Shoulder Expansion Angle
        # ---------------------
        left_angle = calculate_angle(l_el,l_sh,r_sh)
        right_angle = calculate_angle(r_el,r_sh,l_sh)

        shoulder_angle = (left_angle + right_angle) / 2

        angle_buffers["neck"].append(shoulder_angle)

        smooth_angle = np.mean(angle_buffers["neck"])


        # DEBUG: print angle
        print("ANGLE:", int(smooth_angle))


        if prev_angle["neck"] == 0:
            prev_angle["neck"] = smooth_angle

        if prev_nose_y["neck"] is None:
            prev_nose_y["neck"] = nose[1]


        angle_change = smooth_angle - prev_angle["neck"]
        nose_change = prev_nose_y["neck"] - nose[1]

        arms_expanding = angle_change > ANGLE_DELTA_THRESHOLD
        chin_lifting = nose_change > CHIN_UP_THRESHOLD


        prev_angle["neck"] = smooth_angle
        prev_nose_y["neck"] = nose[1]


        if feedback_persist["neck"] == 0:
            feedback["neck"] = f"{int(smooth_angle)}°"


        # ---------------------
        # START REP
        # ---------------------
        if smooth_angle >= EXPAND_ANGLE and movement_direction["neck"] == "DOWN":

            movement_direction["neck"] = "UP"

            collecting["neck"] = True

            buffers["neck"] = RepBuffer()

            frame_id = 0

            feedback["neck"] = "expanding"


        # ---------------------
        # FINISH REP
        # ---------------------
        elif smooth_angle <= RELAX_ANGLE and movement_direction["neck"] == "UP":

            current_time = time.time()

            if current_time - last_rep_time >= COOLDOWN:

                movement_direction["neck"] = "DOWN"

                counters["neck"] += 1

                collecting["neck"] = False

                rep_feedback = analyze_rep_buffer(buffers["neck"]) if buffers["neck"] else "no_buffer"

                model_feedback["neck"] = rep_feedback

                feedback["neck"] = f"rep {counters['neck']} | {rep_feedback}"

                feedback_persist["neck"] = 60

                last_rep_time = current_time

            buffers["neck"] = None


        if arms_expanding and not chin_lifting:

            feedback["neck"] = "Lift your chin while opening arms"


        # ---------------------
        # Collect data
        # ---------------------
        if collecting["neck"] and buffers["neck"]:

            frame_id += 1

            if frame_id % FRAME_SKIP == 0:

                buffers["neck"].add_frame(
                    r_sh,r_el,r_wr,r_hip,
                    l_sh,l_el,l_wr,l_hip,
                    nose
                )


        # ---------------------
        # Drawing
        # ---------------------
        for i in range(keypoints.shape[0]):

            if keypoints[i,2] > min_confidence:

                pt = get_point(keypoints,i,w,h)

                cv2.circle(overlay,pt,4,(0,0,255),-1)


        pairs = [
            (5,7),(7,9),
            (6,8),(8,10),
            (5,6),
            (11,12)
        ]

        for a,b in pairs:

            pa = get_point(keypoints,a,w,h)
            pb = get_point(keypoints,b,w,h)

            cv2.line(overlay,pa,pb,(255,0,0),2)


        cv2.line(overlay,mid_hip,mid_sh,(0,255,0),3)
        cv2.line(overlay,mid_sh,nose,(0,255,0),3)


        cv2.putText(overlay,
                    f"Reps: {counters['neck']}",
                    (30,30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.9,
                    (0,255,0),2)


        cv2.putText(overlay,
                    f"Angle: {int(smooth_angle)}",
                    (30,70),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (255,255,255),2)


    else:

        if feedback_persist["neck"] == 0:
            feedback["neck"] = "not detected"


    if feedback_persist["neck"] > 0:
        feedback_persist["neck"] -= 1

    return counters.copy(), feedback.copy(), overlay