import cv2
import numpy as np
import tensorflow as tf
import joblib
import pandas as pd
from angle_utils import calculate_angle
from rep_segmenter import RepBuffer

# -------------------------------
# Load Model + Encoder
# -------------------------------
model = joblib.load("backend/ai_models/arms/arm_hgb_model.pkl")
le = joblib.load("backend/ai_models/arms/arm_label_encoder.pkl")

print("✅ Model loaded")

# -------------------------------
# Load MoveNet
# -------------------------------
interpreter = tf.lite.Interpreter(model_path="movenet.tflite")
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()
input_height, input_width = input_details[0]['shape'][1:3]

def run_movenet(frame):
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = tf.image.resize_with_pad(np.expand_dims(img, axis=0), input_height, input_width)
    img = tf.cast(img, dtype=tf.float32)

    interpreter.set_tensor(input_details[0]['index'], img.numpy())
    interpreter.invoke()

    return interpreter.get_tensor(output_details[0]['index'])[0][0]

def get_point(kp, idx, w, h):
    return (int(kp[idx][1] * w), int(kp[idx][0] * h))

# -------------------------------
# Keypoints
# -------------------------------
KP = {
    "l_shoulder": 5, "r_shoulder": 6,
    "l_elbow": 7, "r_elbow": 8,
    "l_wrist": 9, "r_wrist": 10,
    "l_hip": 11, "r_hip": 12
}

# -------------------------------
# Rep Detection Variables
# -------------------------------
buffer = None
collecting = False
rep_count = 0
state = "down"

# -------------------------------
# Camera
# -------------------------------
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape

    keypoints = run_movenet(frame)
    display = frame.copy()

    # Check visibility
    required = [5,6,7,8,9,10]
    if all(keypoints[i][2] > 0.4 for i in required):

        r_sh = get_point(keypoints, KP["r_shoulder"], w, h)
        r_el = get_point(keypoints, KP["r_elbow"], w, h)
        r_wr = get_point(keypoints, KP["r_wrist"], w, h)

        l_sh = get_point(keypoints, KP["l_shoulder"], w, h)
        l_el = get_point(keypoints, KP["l_elbow"], w, h)
        l_wr = get_point(keypoints, KP["l_wrist"], w, h)

        r_hp = get_point(keypoints, KP["r_hip"], w, h)
        l_hp = get_point(keypoints, KP["l_hip"], w, h)

        # Shoulder angle (right side for rep detection)
        angle = calculate_angle(r_hp, r_sh, r_el)

        # -------------------------------
        # REP LOGIC (Simple but works well)
        # -------------------------------
        if angle > 150:
            new_state = "down"
        elif angle < 60:
            new_state = "up"
        else:
            new_state = state

        # Start rep
        if state == "down" and new_state == "up":
            collecting = True
            buffer = RepBuffer()

        # End rep
        if collecting:
            buffer.add_frame(
                r_sh, r_el, r_wr,
                l_sh, l_el, l_wr,
                r_hp, l_hp
            )

        if state == "up" and new_state == "down" and collecting:
            collecting = False
            rep_count += 1

            # Predict
            features = buffer.summarize("NA")
            df = pd.DataFrame([features])
            df = df.drop(columns=["label"])

            pred = model.predict(df)
            label = le.inverse_transform(pred)[0]

            print(f"Rep {rep_count}: {label}")

        state = new_state

        # Display angle
        cv2.putText(display, f"Angle: {int(angle)}", (30,50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0),2)

    # Show rep count
    cv2.putText(display, f"Reps: {rep_count}", (30,100),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255,0,0),2)

    cv2.imshow("Arm Raise Test", display)

    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()