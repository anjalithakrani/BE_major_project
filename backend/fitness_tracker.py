from flask import Flask, Response, jsonify, request
import cv2
from models.bicep.bicep_processor import process_bicep_frame, get_status  # auto-detection processor
from models.squat.squat_processor import process_squat_frame, get_status as squat_get_status  # import from squat package
from models.neck.neck_tracker import process_neck
from models.leg.leg_processor import process_leg_frame, get_status as leg_status 
from flask_cors import CORS
from physio_agent import PhysioAgent

app = Flask(__name__)
CORS(app)

# Single global webcam
cap = cv2.VideoCapture(0)


# ==========================
# BICEP ROUTES
# ==========================

agent_sessions = {}

# ================== BICEP ==================
@app.route("/bicep/live")
def bicep_live():

    def generate():
        while True:
            ret, frame = cap.read()
            if not ret:
                continue

            counters, feedback, overlay = process_bicep_frame(frame)

            _, buffer = cv2.imencode(".jpg", overlay)

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + buffer.tobytes()
                + b"\r\n"
            )

    return Response(generate(),
                    mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/bicep/status")
def bicep_status():

    status = get_status()

    return jsonify({
        "exercise": "bicep",
        "counter": status["counters"].get("bicep", 0),
        "feedback": status["feedback"].get("bicep", ""),
        "collecting": status["collecting"].get("bicep", False)
    })


# ==========================
# SQUAT ROUTES
# ==========================

# ==========================
# SQUAT ROUTES
# ==========================

# ================== SQUAT ==================
@app.route("/squat/live")
def squat_live():
    print("[squat/live] 🔴 Endpoint called - starting generator")
    def generate():
        frame_count = 0
        print("[squat/live] 🟢 Generator started, entering loop")
        while True:
            try:
                # Capture frame
                ret, frame = cap.read()
                frame_count += 1
                if frame_count % 30 == 0:  # Log every 30 frames
                    print(f"[squat/live] Frame {frame_count}: ret={ret}, shape={frame.shape if ret else 'None'}")
                
                if not ret:
                    print("[squat/live] ⚠️ Frame capture failed, retrying...")
                    continue  # retry if frame not captured

                # Process frame with squat tracker
                print(f"[squat/live] Processing frame {frame_count}...")
                counters, feedback, overlay = process_squat_frame(frame)
                print(f"[squat/live] ✓ Frame {frame_count} processed: counters={counters}, feedback={feedback.get('squat', 'N/A')[:50]}")

                # Encode and stream overlay
                success, buffer = cv2.imencode('.jpg', overlay)
                if not success:
                    print("[squat/live] ❌ JPEG encoding failed")
                    continue
                
                print(f"[squat/live] ✓ Frame {frame_count} encoded: {len(buffer)} bytes")
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            except Exception as e:
                import traceback
                print(f"[squat/live] 🔥 ERROR: {type(e).__name__}: {e}")
                print(traceback.format_exc())
                continue  # on error, continue streaming
    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")

@app.route("/squat/status")
def squat_status_route():
    # Use the processor's status API if available (preferred)
    try:
        status = squat_get_status()
        return jsonify({
            "exercise": "squat",
            "counters": status.get("counters"),
            "feedback": status.get("feedback"),
            "model_feedback": status.get("model_feedback"),
            "collecting": status.get("collecting")
        })
    except Exception:
        # Fallback: grab a single frame and run processing
        ret, frame = cap.read()
        if not ret:
            return jsonify({"exercise": "squat", "count": 0, "feedback": ""})
        counters, feedback, _ = process_squat_frame(frame)
        return jsonify({"exercise": "squat", "count": counters.get("squat", 0), "feedback": feedback})

    ret, frame = cap.read()

    if not ret:
        return jsonify({
            "exercise": "squat",
            "counter": 0,
            "feedback": ""
        })

    count, feedback, _ = process_squat(frame)

    return jsonify({
        "exercise": "squat",
        "counter": count,
        "feedback": feedback
    })


# ==========================
# NECK ROUTES
# ==========================

# ==========================
# NECK ROUTES
# ==========================

# ================== NECK ==================
@app.route("/neck/live")
def neck_live():

    def generate():
        while True:

            ret, frame = cap.read()
            if not ret:
                continue

            counters, feedback, overlay = process_neck_frame(frame)

            status = get_neck_status()

            # Display ML feedback on video
            model_feedback = status["model_feedback"].get("neck", "none")

            if model_feedback != "none":
                cv2.putText(
                    overlay,
                    f"Model: {model_feedback}",
                    (30, 60),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (0, 255, 255),
                    2
                )

            _, buffer = cv2.imencode(".jpg", overlay)

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + buffer.tobytes()
                + b"\r\n"
            )

    return Response(generate(),
                    mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/neck/status")
def neck_status():

    status = get_neck_status()

    return jsonify({
        "exercise": "neck",
        "counter": status["counters"].get("neck", 0),
        "feedback": status["feedback"].get("neck", ""),
        "model_feedback": status["model_feedback"].get("neck", "none"),
        "collecting": status["collecting"].get("neck", False)
    })


# ================== AGENT ==================
@app.route("/agent/start", methods=["POST", "GET"])
def start_agent():
    if request.method == "GET":
        return jsonify({"message": "Use POST"}), 405
    data = request.json
    session_id = data["session_id"]
    exercise = data["exercise"]

    agent_sessions[session_id] = PhysioAgent(exercise)

    return jsonify({
        "message": agent_sessions[session_id].get_prompt(),
        "state": "READY"
    })

@app.route("/leg/live")
def leg_live():
    def generate():
        while True:
            ret, frame = cap.read()
            if not ret:
                continue
            
            frame = cv2.flip(frame, 1)
            # Unpack the 3-item tuple returned by process_leg_frame
            counters, feedback, overlay = process_leg_frame(frame)
            
            _, buffer = cv2.imencode('.jpg', overlay)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")

@app.route("/leg/status")
def status_route():
    return jsonify(leg_status())


@app.route("/agent/update", methods=["POST", "GET"])
def update_agent():
    if request.method == "GET":
        return jsonify({"message": "Use POST"}), 405
    data = request.json
    session_id = data["session_id"]
    user_input = data.get("user_input", "")

    agent = agent_sessions.get(session_id)
    if not agent:
        return jsonify({"error": "Session not found"}), 404

    reps = latest_status["counters"]["left"]
    feedback = latest_status["feedback"]["left"]

    agent.update(user_input=user_input, feedback=feedback, reps=reps)

    return jsonify({
        "message": agent.get_prompt(),
        "state": agent.state,
        "reps": agent.rep_count
    })

# ==========================
# MAIN
# ==========================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 FLASK LIVE TRACKER STARTING")
    print("="*60)
    print(f"📷 Webcam initialized: {cap.isOpened()}")
    print("📍 Routes available:")
    print("   - /bicep/live")
    print("   - /bicep/status")
    print("   - /squat/live")
    print("   - /squat/status")
    print("   - /neck/live")
    print("   - /neck/status")
    print("="*60 + "\n")
    app.run(port=5001, debug=False, use_reloader=False)

