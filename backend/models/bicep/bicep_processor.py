import os
import cv2
import numpy as np
import tensorflow as tf
import joblib
import pandas as pd
from collections import deque
import sys
import os
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
    print(f"  Looking for: {MODEL_PATH}")
    print(f"  Looking for: {LE_PATH}")
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
# State - Auto-detection
# -------------------------------
buffers = {"left": None, "right": None}
collecting_sides = {"left": False, "right": False}
counters = {"left": 0, "right": 0}
states = {"left": "down", "right": "down"}
feedback = {"left": "not detected", "right": "not detected"}
model_feedback = {"left": "none", "right": "none"}  # Store model predictions separately
feedback_persist_frames = {"left": 0, "right": 0}  # Keep feedback for N frames
angle_buffers = {"left": deque(maxlen=10), "right": deque(maxlen=10)}
frames_in_state = {"left": 0, "right": 0}

# thresholds
flexion_threshold, extension_threshold = 65, 100
min_confidence = 0.5

# helpers
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

def analyze_rep_buffer(buffer_obj, side):
    """Run feedback model on a completed rep buffer. Returns feedback string."""
    print(f"\n[analyze_rep_buffer] Starting for {side}")
    
    if buffer_obj is None:
        print(f"[ERROR] Buffer is None for {side}")
        return "buffer_empty"
    
    if buffer_obj.frames == 0:
        print(f"[ERROR] Buffer has 0 frames for {side}")
        return "buffer_empty"
    
    print(f"[Buffer] {side}: {buffer_obj.frames} frames collected")
    
    try:
        # Get features
        print(f"[Features] Summarizing buffer for {side}...")
        features = buffer_obj.summarize("NA")
        print(f"[Features] Generated: {list(features.keys())}")
        print(f"[Features] Values: {features}")
        
        # Create DataFrame
        rep_df = pd.DataFrame([features])
        print(f"[DataFrame] Shape: {rep_df.shape}")
        print(f"[DataFrame] Columns: {list(rep_df.columns)}")
        
        # Drop label if exists
        if "label" in rep_df.columns:
            rep_df = rep_df.drop(columns=["label"])
            print(f"[DataFrame] Dropped 'label' column")
        
        # Check model availability
        print(f"[Model] model is not None: {model is not None}")
        print(f"[Model] le is not None: {le is not None}")
        
        if model is None or le is None:
            print(f"[ERROR] Model or Label Encoder is None!")
            return "model_unavailable"
        
        # Extract features in correct order
        print(f"[Features] Extracting in order: {FEATURE_ORDER}")
        X = rep_df[FEATURE_ORDER].values
        print(f"[Features] Shape for prediction: {X.shape}")
        print(f"[Features] Values:\n{X}")
        
        # Make prediction
        print(f"[Prediction] Calling model.predict()...")
        pred = model.predict(X)
        print(f"[Prediction] Raw prediction: {pred}")
        
        # Decode label
        print(f"[Decoding] Inverse transforming prediction...")
        result_feedback = le.inverse_transform(pred)[0]
        print(f"[Success] {side} feedback: {result_feedback}")
        
        # ==========================================
        # OVERRIDE LOGIC: Check final elbow angle
        # ==========================================
        if result_feedback == "partial_motion":
            # Get final elbow angle (last value in buffer)
            if side == "left" and buffer_obj.l_elbow_angles:
                final_angle = buffer_obj.l_elbow_angles[-1]
            elif side == "right" and buffer_obj.r_elbow_angles:
                final_angle = buffer_obj.r_elbow_angles[-1]
            else:
                final_angle = None
            
            if final_angle is not None:
                print(f"[Override Check] {side} final angle: {final_angle:.1f}°")
                # If final angle is in correct range, override to good_form
                if 170 <= final_angle <= 175:
                    print(f"[Override] Changing {side} from 'partial_motion' to 'good_form'")
                    result_feedback = "correct"
        
        return result_feedback
        
    except KeyError as e:
        print(f"[KeyError] Missing feature column: {e}")
        print(f"[Available] Columns in df: {list(rep_df.columns)}")
        print(f"[Required] Columns: {FEATURE_ORDER}")
        return f"missing_feature: {str(e)}"
    except Exception as e:
        import traceback
        print(f"[Exception] {type(e).__name__}: {e}")
        print(traceback.format_exc())
        return f"error: {str(e)[:50]}"

# -------------------------------
# Public API
# -------------------------------

def get_status():
    return {"counters": counters.copy(), "feedback": feedback.copy(), "model_feedback": model_feedback.copy(), "collecting": collecting_sides.copy()}


def process_bicep_frame(frame):
    """Process a single frame with automatic rep detection and feedback model.
    - Auto-detects rep cycles (down → up → down)
    - Auto-collects frames during each rep
    - Auto-runs feedback model when rep completes
    Returns: (counters, feedback, overlay_frame)
    """
    global buffers, collecting_sides, counters, states, feedback, model_feedback, frames_in_state, feedback_persist_frames

    h, w, _ = frame.shape
    keypoints, w, h = run_movenet(frame)

    arms = {
        "left":  {"shoulder_idx":5, "elbow_idx":7, "wrist_idx":9},
        "right": {"shoulder_idx":6, "elbow_idx":8, "wrist_idx":10}
    }

    overlay = frame.copy()

    for side, idxs in arms.items():
        s_idx, e_idx, w_idx = idxs["shoulder_idx"], idxs["elbow_idx"], idxs["wrist_idx"]
        conf_ok = (keypoints[s_idx,2] > min_confidence and keypoints[e_idx,2] > min_confidence and keypoints[w_idx,2] > min_confidence)
        
        if conf_ok:
            s = get_point(keypoints, s_idx, w, h)
            e = get_point(keypoints, e_idx, w, h)
            wr = get_point(keypoints, w_idx, w, h)

            elbow_angle = calculate_angle(s, e, wr)
            angle_buffers[side].append(elbow_angle)
            smooth_angle = np.mean(angle_buffers[side])

            frames_in_state[side] += 1
            
            # Only update feedback if not in persist mode
            if feedback_persist_frames[side] == 0:
                feedback[side] = f"detected - {int(smooth_angle)}°"

            # ==========================================
            # AUTO REP DETECTION & COLLECTION LOGIC
            # ==========================================
            
            # Detect transition from DOWN to UP (flexion)
            if smooth_angle < flexion_threshold and states[side] == "down" and frames_in_state[side] > 3:
                states[side] = "up"
                frames_in_state[side] = 0
                feedback[side] = "flexing (curl up)"
                # START collecting for this rep
                buffers[side] = RepBuffer()
                collecting_sides[side] = True

            # Detect transition from UP to DOWN (extension) - REP COMPLETE
            elif smooth_angle > extension_threshold and states[side] == "up" and frames_in_state[side] > 3:
                states[side] = "down"
                frames_in_state[side] = 0
                counters[side] += 1
                
                # END collecting and run feedback model
                collecting_sides[side] = False
                rep_feedback = analyze_rep_buffer(buffers[side], side)
                model_feedback[side] = rep_feedback  # Store model feedback separately
                feedback[side] = f"✅ curl counted! Total: {counters[side]} | Feedback: {rep_feedback}"
                feedback_persist_frames[side] = 60  # Keep feedback visible for 60 frames (~2 sec)
                buffers[side] = None

            # ==========================================
            # ADD FRAME TO BUFFER IF COLLECTING
            # ==========================================
            if collecting_sides[side] and buffers[side] is not None:
                # Get all required keypoints for RepBuffer
                r_sh = get_point(keypoints, 6, w, h)
                r_el = get_point(keypoints, 8, w, h)
                r_wr = get_point(keypoints, 10, w, h)
                r_hp = get_point(keypoints, 12, w, h)

                l_sh = get_point(keypoints, 5, w, h)
                l_el = get_point(keypoints, 7, w, h)
                l_wr = get_point(keypoints, 9, w, h)
                l_hp = get_point(keypoints, 11, w, h)

                nose = get_point(keypoints, 0, w, h)

                buffers[side].add_frame(r_sh, r_el, r_wr, r_hp,
                                        l_sh, l_el, l_wr, l_hp,
                                        nose)

            # Draw skeleton
            cv2.line(overlay, s, e, (0,255,0), 3)
            cv2.line(overlay, e, wr, (0,255,0), 3)
            cv2.circle(overlay, s, 5, (0,0,255), -1)
            cv2.circle(overlay, e, 5, (0,0,255), -1)
            cv2.circle(overlay, wr, 5, (0,0,255), -1)
            cv2.putText(overlay, f"{side.capitalize()} {int(smooth_angle)}°", (e[0]-50, e[1]-20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255),2)
        else:
            # Only reset feedback if not in persist mode
            if feedback_persist_frames[side] == 0:
                feedback[side] = "not detected"

        # Decrement feedback persist counter
        if feedback_persist_frames[side] > 0:
            feedback_persist_frames[side] -= 1

    return counters.copy(), feedback.copy(), overlay
