import cv2
import numpy as np
import tensorflow as tf
from collections import deque
import os 
# ================================
# Load MoveNet
# ================================

# With this:
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
interpreter = tf.lite.Interpreter(model_path=os.path.join(BASE_DIR, "movenet.tflite"))
interpreter.allocate_tensors()
inp = interpreter.get_input_details()
out = interpreter.get_output_details()
H, W = inp[0]['shape'][1:3]


# ================================
# Pose extraction
# ================================
def angle(a, b, c):
    ba = a - b
    bc = c - b
    return np.degrees(
        np.arccos(
            np.clip(
                np.dot(ba, bc) /
                (np.linalg.norm(ba) * np.linalg.norm(bc)),
                -1.0, 1.0
            )
        )
    )

def cosine(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def extract_pose(frame):
    h, w, _ = frame.shape
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    rgb = tf.image.resize_with_pad(np.expand_dims(rgb, 0), H, W)
    interpreter.set_tensor(inp[0]['index'], rgb.numpy())
    interpreter.invoke()
    kp = interpreter.get_tensor(out[0]['index'])[0][0]

    def pt(i):
        return np.array([kp[i, 1] * w, kp[i, 0] * h])

    # Keypoints we need
    nose = pt(0)
    ls, rs = pt(5), pt(6)
    le, re = pt(7), pt(8)
    lw, rw = pt(9), pt(10)
    hip = pt(11)
    vec = np.array([
        np.linalg.norm(ls - hip),
        np.linalg.norm(rs - hip),
        angle(ls, le, lw),
        angle(rs, re, rw),
        angle(ls, nose, hip)
    ])
    points = [nose, ls, rs, le, re, lw, rw]
    return vec, points
# ================================
# Load Reference Poses
# ================================
start_img = cv2.imread(os.path.join(BASE_DIR, "start.png"))
end_img = cv2.imread(os.path.join(BASE_DIR, "end.png"))

start_vec, _ = extract_pose(start_img)
end_vec, _ = extract_pose(end_img)

print("Reference loaded")

# ================================
# Similarity & Speed Buffers
# ================================
sim_start_buf = deque(maxlen=10)
sim_end_buf = deque(maxlen=10)
speed_buf = deque(maxlen=20)

# ================================
# State (GLOBAL)
# ================================
rep_count = 0
state = "AT_START"
ready_flag = False
ready_buf = deque(maxlen=5)  # For confirming starting pose
head_y_buf = deque(maxlen=10)
HEAD_THRESH = 20  # pixels
head_state = "NEUTRAL"  # UP / NEUTRAL

# ================================
# Main processing function
# ================================
def process_neck(frame):
    global rep_count, state, head_state

    vec, points = extract_pose(frame)
    nose = points[0]

    # ---------- HEAD Y LOGIC ----------
    head_y_buf.append(nose[1])
    head_y = np.mean(head_y_buf)

    if head_state == "NEUTRAL":
        neutral_y = head_y
        if head_y < neutral_y - HEAD_THRESH:
            head_state = "UP"

    elif head_state == "UP":
        if head_y > neutral_y - 3:
            head_state = "NEUTRAL"
    # ---------------------------------

    sim_start = cosine(vec, start_vec)
    sim_end = cosine(vec, end_vec)

    sim_start_buf.append(sim_start)
    sim_end_buf.append(sim_end)
    sim_start_avg = np.mean(sim_start_buf)
    sim_end_avg = np.mean(sim_end_buf)

    ready_buf.append(sim_start_avg > 0.7)
    ready_flag = all(ready_buf)

    # ---------- ORIGINAL STATE MACHINE ----------
    if ready_flag:
        if state == "AT_START" and sim_end_avg > sim_start_avg + 0.05:
            state = "GOING_BACK"

        elif state == "GOING_BACK" and sim_end_avg > 0.95:
            state = "AT_END"

        elif state == "AT_END" and sim_start_avg > sim_end_avg + 0.06:
            state = "RETURNING"

        elif state == "RETURNING" and sim_start_avg > 0.9:
            # ONLY COUNT IF HEAD MOVED
            if head_state == "NEUTRAL":
              rep_count += 1
            state = "AT_START"
    # --------------------------------------------

    # DRAW
    overlay = frame.copy()
    for p in points:
        cv2.circle(overlay, tuple(p.astype(int)), 6, (0, 255, 0), -1)

# Draw skeleton lines: Head → Shoulder → Elbow → Wrist 
    def line(a, b): 
      cv2.line(overlay, tuple(a.astype(int)), tuple(b.astype(int)), (255, 0, 0), 2) 
    nose, ls, rs, le, re, lw, rw = points
    # Left arm 
    line(nose, ls) 
    line(ls, le)
    line(le, lw) 
    # Right arm 
    line(nose, rs)
    line(rs, re) 
    line(re, rw)
    
    return rep_count, overlay
