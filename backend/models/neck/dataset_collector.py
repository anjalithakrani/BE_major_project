# dataset_collector.py
import cv2
import numpy as np
import tensorflow as tf

from backend.ai_models.neck_exercise.neck_rep_segmenter import RepBuffer
from dataset_logger import log_rep
from angle_utils import calculate_angle

# -------------------------------
# Load MoveNet TFLite
# -------------------------------
interpreter = tf.lite.Interpreter(model_path="movenet.tflite")
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()
input_height, input_width = input_details[0]['shape'][1:3]

# -------------------------------
# MoveNet helpers
# -------------------------------
def run_movenet(frame):
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = tf.image.resize_with_pad(
        np.expand_dims(img, axis=0),
        input_height,
        input_width
    )
    img = tf.cast(img, dtype=tf.float32)
    interpreter.set_tensor(input_details[0]['index'], img.numpy())
    interpreter.invoke()
    keypoints = interpreter.get_tensor(output_details[0]['index'])[0][0]
    return keypoints

def get_point(kp, idx, w, h):
    return (int(kp[idx][1] * w), int(kp[idx][0] * h))

# -------------------------------
# MoveNet keypoints
# -------------------------------
KP = {
    "nose": 0,
    "l_shoulder": 5, "r_shoulder": 6,
    "l_elbow": 7, "r_elbow": 8,
    "l_wrist": 9, "r_wrist": 10,
    "l_hip": 11, "r_hip": 12
}

# -------------------------------
# Camera
# -------------------------------
cap = cv2.VideoCapture(0)

# -------------------------------
# Manual state
# -------------------------------
collecting = False
buffer = None
frame_id = 0
FRAME_SKIP = 3
CONF_THRESH = 0.3
pending_label = None

# -------------------------------
# LABELS (5 TOTAL)
# -------------------------------
label_map = {
    'c': 'correct',
    'n': 'no_chin_lift',
    'p': 'partial_motion',
    'h': 'hunching_forward',
    'e': 'elbow_out_of_place'
}

print("Press 's' to START a rep")
print("Press 'e' to END a rep")
print("Then press label key: c/n/p/h/e")
print("ESC to quit")

# -------------------------------
# Main loop
# -------------------------------
while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape
    frame_id += 1

    keypoints = run_movenet(frame)
    display_frame = frame.copy()

    required = [
        KP["r_shoulder"], KP["r_elbow"], KP["r_wrist"], KP["r_hip"],
        KP["l_shoulder"], KP["l_elbow"], KP["l_wrist"], KP["l_hip"],
        KP["nose"]
    ]

    if all(keypoints[i][2] > CONF_THRESH for i in required):

        # Right side
        r_sh = get_point(keypoints, KP["r_shoulder"], w, h)
        r_el = get_point(keypoints, KP["r_elbow"], w, h)
        r_wr = get_point(keypoints, KP["r_wrist"], w, h)
        r_hp = get_point(keypoints, KP["r_hip"], w, h)

        # Left side
        l_sh = get_point(keypoints, KP["l_shoulder"], w, h)
        l_el = get_point(keypoints, KP["l_elbow"], w, h)
        l_wr = get_point(keypoints, KP["l_wrist"], w, h)
        l_hp = get_point(keypoints, KP["l_hip"], w, h)

        # Chin (nose)
        chin = get_point(keypoints, KP["nose"], w, h)

        # Angles
        r_angle = calculate_angle(r_sh, r_el, r_wr)
        l_angle = calculate_angle(l_sh, l_el, l_wr)

        cv2.putText(display_frame, f"Right Elbow: {int(r_angle)}°", (30,50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0),2)

        cv2.putText(display_frame, f"Left Elbow: {int(l_angle)}°", (30,90),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0),2)

        cv2.putText(display_frame, f"Chin Y: {chin[1]}", (30,130),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,0),2)

        # Add frame to buffer
        if collecting and frame_id % FRAME_SKIP == 0:
            buffer.add_frame(
                r_sh, r_el, r_wr, r_hp,
                l_sh, l_el, l_wr, l_hp,
                chin
            )

        # Draw skeleton
        pairs = [
            (KP["r_shoulder"], KP["r_elbow"]),
            (KP["r_elbow"], KP["r_wrist"]),
            (KP["l_shoulder"], KP["l_elbow"]),
            (KP["l_elbow"], KP["l_wrist"]),
            (KP["l_shoulder"], KP["r_shoulder"]),
            (KP["l_hip"], KP["r_hip"])
        ]

        for a,b in pairs:
            if keypoints[a][2] > CONF_THRESH and keypoints[b][2] > CONF_THRESH:
                pa = get_point(keypoints, a, w, h)
                pb = get_point(keypoints, b, w, h)
                cv2.line(display_frame, pa, pb, (0,255,0), 2)

    else:
        cv2.putText(display_frame, "Move fully into frame", (50,400),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255),2)

    cv2.imshow("MoveNet Collector", display_frame)
    key = cv2.waitKey(1) & 0xFF

    # Quit
    if key == 27:
        break

    # Start collection
    elif key == ord('s') and not collecting:
        collecting = True
        buffer = RepBuffer()
        frame_id = 0
        print("▶ Started new rep collection")

    # End collection
    elif key == ord('e') and collecting:
        collecting = False
        pending_label = True
        print("⏸ Rep ended. Press label key: c/n/p/h/e")

    # Label rep
    elif pending_label and chr(key) in label_map:
        label = label_map[chr(key)]
        features = buffer.summarize(label)
        log_rep(features)
        print(f"✔ Rep logged: {label}")
        buffer = None
        pending_label = None

cap.release()
cv2.destroyAllWindows()